/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

type MuscleGroup = typeof VALID_MUSCLE_GROUPS[number];
type WorkoutType = typeof VALID_WORKOUT_TYPES[number];
type Difficulty = typeof VALID_DIFFICULTIES[number];

const VALID_MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'forearms', 'core', 'quadriceps', 'hamstrings',
  'calves', 'glutes', 'traps', 'lats', 'lower_back'
] as const;

const VALID_WORKOUT_TYPES = [
  'powerlifting', 'bodyweight', 'hiit', 'strength',
  'cardio', 'crossfit', 'endurance', 'circuit', 'isolation'
] as const;

const VALID_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

const ExerciseSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  sets: z.number().int().positive(),
  reps: z.number().int().positive(),
  rest_duration: z.string().min(1),
  order_in_workout: z.number().int().nonnegative(),
  primary_muscles: z.array(z.enum(VALID_MUSCLE_GROUPS)).min(1),
  secondary_muscles: z.array(z.enum(VALID_MUSCLE_GROUPS)),
  equipment_needed: z.array(z.string()),
  exercise_type: z.enum(VALID_WORKOUT_TYPES)
});

const WorkoutSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  day_of_week: z.number().int().min(1).max(7),
  estimated_duration: z.string().min(1),
  workout_type: z.enum(VALID_WORKOUT_TYPES),
  exercises: z.array(ExerciseSchema).min(1).max(5)
});

const WorkoutPlanSchema = z.object({
  description: z.string().min(1),
  difficulty: z.enum(VALID_DIFFICULTIES),
  restDays: z.array(z.number().int().min(1).max(7)),
  workouts: z.array(WorkoutSchema)
});

const RequestBodySchema = z.object({
  userId: z.string().uuid(),
  goalType: z.string().min(1),
  workoutType: z.enum(VALID_WORKOUT_TYPES),
  durationWeeks: z.number().int().positive().max(52),
  daysPerWeek: z.number().int().min(1).max(7),
  focusMuscles: z.array(z.enum(VALID_MUSCLE_GROUPS)).min(1),
  additionalNotes: z.string().optional()
});

type Workout = z.infer<typeof WorkoutSchema>;
type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number = 25000
): Promise<T> => {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
};

const validateRestDays = (daysPerWeek: number): number[] => {
  const allDays = [1, 2, 3, 4, 5, 6, 7] as const;
  const restDaysCount = 7 - daysPerWeek;
  
  if (restDaysCount < 0 || restDaysCount > 6) {
    throw new Error('Invalid days per week');
  }
  
  const shuffled = [...allDays].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, restDaysCount).sort((a, b) => a - b);
};

const validateMuscleGroups = (muscles: string[]): MuscleGroup[] => {
  const validatedMuscles = muscles.filter((muscle): muscle is MuscleGroup => 
    VALID_MUSCLE_GROUPS.includes(muscle as MuscleGroup)
  );
  
  if (validatedMuscles.length === 0) {
    throw new Error('No valid muscle groups provided');
  }
  
  return validatedMuscles;
};

const parseInterval = (duration: string): string => {
  const minutes = parseInt(duration.replace(/[^0-9]/g, ''));
  return isNaN(minutes) || minutes <= 0 ? '30 minutes' : `${minutes} minutes`;
};

interface PlanParams {
  durationWeeks: number;
  workoutType: WorkoutType;
  focusMuscles: MuscleGroup[];
  daysPerWeek: number;
}

async function saveWorkoutPlan(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  goalType: string,
  workoutPlan: WorkoutPlan,
  planParams: PlanParams
): Promise<{ id: string }> {
  const goalPromise = new Promise<{ data: { id: string } | null, error: any }>(async (resolve) => {
    const result = await supabase
      .from('fitness_goals')
      .insert({
        user_id: userId,
        goal_type: goalType,
        target_date: new Date(Date.now() + planParams.durationWeeks * 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        specific_targets: {
          workout_type: planParams.workoutType,
          focus_muscles: planParams.focusMuscles,
          days_per_week: planParams.daysPerWeek
        }
      })
      .select('id')
      .single();
    resolve(result);
  });

  const { data: goal, error: goalError } = await goalPromise;

  if (goalError || !goal) {
    throw new Error(`Failed to create fitness goal: ${goalError?.message}`);
  }

  const { data: plan, error: planError } = await supabase
    .from('workout_plans')
    .insert({
      user_id: userId,
      goal_id: goal.id,
      name: `${goalType} - ${planParams.workoutType} Plan`,
      description: workoutPlan.description,
      duration_weeks: planParams.durationWeeks,
      difficulty: workoutPlan.difficulty,
      is_active: true,
      focus_muscles: planParams.focusMuscles,
      rest_days: workoutPlan.restDays
    })
    .select('id')
    .single();

  if (planError || !plan) {
    throw new Error(`Failed to create workout plan: ${planError?.message}`);
  }

  await Promise.all(workoutPlan.workouts.map(workout => 
    processWorkout(supabase, plan.id, workout)
  ));

  return plan;
}

async function processWorkout(
  supabase: ReturnType<typeof createClient<Database>>,
  planId: string,
  workout: Workout
): Promise<void> {
  const { data: workoutData, error: workoutError } = await supabase
    .from('workouts')
    .insert({
      plan_id: planId,
      name: workout.name,
      description: workout.description,
      day_of_week: workout.day_of_week,
      estimated_duration: parseInterval(workout.estimated_duration),
      workout_type: workout.workout_type
    })
    .select('id')
    .single();

  if (workoutError || !workoutData) {
    throw new Error(`Failed to create workout: ${workoutError?.message}`);
  }

  await Promise.all(workout.exercises.map(exercise =>
    supabase.from('exercises').insert({
      workout_id: workoutData.id,
      name: exercise.name,
      description: exercise.description,
      sets: exercise.sets,
      reps: exercise.reps,
      rest_duration: parseInterval(exercise.rest_duration),
      order_in_workout: exercise.order_in_workout,
      exercise_type: exercise.exercise_type,
      primary_muscles: exercise.primary_muscles,
      secondary_muscles: exercise.secondary_muscles,
      equipment_needed: exercise.equipment_needed
    })
  ));
}

interface SuccessResponse {
  success: true;
  message: string;
  plan: {
    id: string;
    description: string;
    difficulty: Difficulty;
    workouts: number;
  };
}

interface ErrorResponse {
  error: string;
  details?: z.ZodError['issues'];
}

type ApiResponse = SuccessResponse | ErrorResponse;

export async function POST(req: Request): Promise<NextResponse<ApiResponse>> {
  try {
    if (!process.env.ANTHROPIC_API_KEY || 
        !process.env.NEXT_PUBLIC_SUPABASE_URL || 
        !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const rawBody = await req.json();
    const body = RequestBodySchema.parse(rawBody);

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false },
        db: { schema: 'public' }
      }
    );
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 2,
      timeout: 20000
    });

    const validRestDays = validateRestDays(body.daysPerWeek);
    const validMuscles = validateMuscleGroups(body.focusMuscles);

    const completion = await withTimeout(
      anthropic.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 4000,
        temperature: 0.7,
        system: `You are an expert fitness trainer specializing in creating personalized workout plans. Generate a detailed workout plan as a JSON object with this exact structure:

{
  "description": "Brief overview of the plan",
  "difficulty": "${VALID_DIFFICULTIES.join('" | "')}",
  "restDays": [${validRestDays.join(', ')}],
  "workouts": [
    {
      "name": "Workout name",
      "description": "Brief workout description",
      "day_of_week": number(1-7),
      "estimated_duration": "X minutes",
      "workout_type": "${VALID_WORKOUT_TYPES.join('" | "')}",
      "exercises": [
        {
          "name": "Exercise name",
          "description": "Brief exercise description",
          "sets": number,
          "reps": number,
          "rest_duration": "X minutes",
          "order_in_workout": number,
          "primary_muscles": ["${VALID_MUSCLE_GROUPS.join('", "')}"],
          "secondary_muscles": ["${VALID_MUSCLE_GROUPS.join('", "')}"],
          "equipment_needed": string[],
          "exercise_type": "${VALID_WORKOUT_TYPES.join('" | "')}",
        }
      ]
    }
  ]
}`,
        messages: [
          {
            role: "user",
            content: `Create a workout plan with these parameters:
- Duration: ${body.durationWeeks} weeks
- Type: ${body.workoutType}
- Focus muscles: ${validMuscles.join(', ')}
- Days per week: ${body.daysPerWeek}
- Rest days: ${validRestDays.join(', ')}
- Goal: ${body.goalType}
- Additional notes: ${body.additionalNotes || 'None'}

Return ONLY the JSON object, no additional text or explanations.`
          }
        ]
      }),
      20000
    );

    const planContent = completion.content[0].type === 'text' 
      ? completion.content[0].text
      : '';

    if (!planContent) {
      throw new Error('Failed to generate workout plan');
    }

    const cleanJSON = planContent.replace(/```json\n?|\n?```/g, '').trim();
    const workoutPlan = WorkoutPlanSchema.parse(JSON.parse(cleanJSON));

    const plan = await withTimeout(
      saveWorkoutPlan(supabase, body.userId, body.goalType, workoutPlan, {
        durationWeeks: body.durationWeeks,
        workoutType: body.workoutType,
        focusMuscles: validMuscles,
        daysPerWeek: body.daysPerWeek
      }),
      25000
    );

    return NextResponse.json({
      success: true,
      message: 'Workout plan generated and saved successfully',
      plan: {
        id: plan.id,
        description: workoutPlan.description,
        difficulty: workoutPlan.difficulty,
        workouts: workoutPlan.workouts.length
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const status = errorMessage.includes('timeout') ? 504 : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}
