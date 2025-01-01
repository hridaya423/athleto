/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

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

type MuscleGroup = typeof VALID_MUSCLE_GROUPS[number];
type WorkoutType = typeof VALID_WORKOUT_TYPES[number];

const ExerciseSchema = z.object({
  name: z.string(),
  description: z.string(),
  sets: z.number(),
  reps: z.number(),
  rest_duration: z.string(),
  order_in_workout: z.number(),
  primary_muscles: z.array(z.enum(VALID_MUSCLE_GROUPS)),
  secondary_muscles: z.array(z.enum(VALID_MUSCLE_GROUPS)),
  equipment_needed: z.array(z.string()),
  exercise_type: z.enum(VALID_WORKOUT_TYPES)
});

const WorkoutSchema = z.object({
  name: z.string(),
  description: z.string(),
  day_of_week: z.number(),
  estimated_duration: z.string(),
  workout_type: z.enum(VALID_WORKOUT_TYPES),
  exercises: z.array(ExerciseSchema).max(5)
});

const WorkoutPlanSchema = z.object({
  description: z.string(),
  difficulty: z.enum(VALID_DIFFICULTIES),
  restDays: z.array(z.number()),
  workouts: z.array(WorkoutSchema)
});

const RequestBodySchema = z.object({
  userId: z.string().uuid(),
  goalType: z.string(),
  workoutType: z.enum(VALID_WORKOUT_TYPES),
  durationWeeks: z.number().int().positive().max(52),
  daysPerWeek: z.number().int().min(1).max(7),
  focusMuscles: z.array(z.enum(VALID_MUSCLE_GROUPS)),
  additionalNotes: z.string().optional()
});

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number = 15000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    )
  ]);
};

async function saveWorkoutPlan(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  goalType: string,
  workoutPlan: z.infer<typeof WorkoutPlanSchema>,
  planParams: {
    durationWeeks: number;
    workoutType: WorkoutType;
    focusMuscles: MuscleGroup[];
    daysPerWeek: number;
  }
): Promise<{ id: string }> {
  const goalData = {
    user_id: userId,
    goal_type: goalType,
    target_date: new Date(Date.now() + planParams.durationWeeks * 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    specific_targets: {
      workout_type: planParams.workoutType,
      focus_muscles: planParams.focusMuscles,
      days_per_week: planParams.daysPerWeek
    }
  };

  const { data: goal } = await supabase
    .from('fitness_goals')
    .insert(goalData)
    .select('id')
    .single();

  if (!goal) throw new Error('Failed to create fitness goal');

  const { data: plan } = await supabase
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

  if (!plan) throw new Error('Failed to create workout plan');

  const workoutPromises = workoutPlan.workouts.map(async (workout) => {
    const { data: workoutData } = await supabase
      .from('workouts')
      .insert({
        plan_id: plan.id,
        name: workout.name,
        description: workout.description,
        day_of_week: workout.day_of_week,
        estimated_duration: workout.estimated_duration,
        workout_type: workout.workout_type
      })
      .select('id')
      .single();

    if (!workoutData) throw new Error('Failed to create workout');

    const exerciseData = workout.exercises.map(ex => ({
      workout_id: workoutData.id,
      ...ex
    }));

    await supabase.from('exercises').insert(exerciseData);
  });

  await Promise.all(workoutPromises);
  return plan;
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    if (!process.env.ANTHROPIC_API_KEY || 
        !process.env.NEXT_PUBLIC_SUPABASE_URL || 
        !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing environment variables');
    }

    const body = RequestBodySchema.parse(await req.json());

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
      maxRetries: 1,
      timeout: 12000
    });


    const profilePromise = new Promise<{ data: { fitness_level?: string } | null, error: any }>(async (resolve) => {
      const result = await supabase
        .from('profiles')
        .select('fitness_level')
        .eq('id', body.userId)
        .single();
      resolve(result);
    });

    const { data: profile, error: profileError } = await withTimeout(profilePromise, 5000);

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }


    const restDays = Array.from({ length: 7 - body.daysPerWeek }, (_, i) => i + 1)
      .sort(() => 0.5 - Math.random());

    const completion = await withTimeout(
      anthropic.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 4000,
        temperature: 0.7,
        system: `You are an expert fitness trainer specializing in creating personalized workout plans. Generate a detailed workout plan as a JSON object with this exact structure:

{
  "description": "Brief overview of the plan",
  "difficulty": "${VALID_DIFFICULTIES.join('" | "')}",
  "restDays": [${restDays.join(', ')}],
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
- Focus muscles: ${body.focusMuscles.join(', ')}
- Days per week: ${body.daysPerWeek}
- Rest days: ${restDays.join(', ')}
- Goal: ${body.goalType}
- Additional notes: ${body.additionalNotes || 'None'}
- Fitness level: ${profile.fitness_level || 'intermediate'}

Return ONLY the JSON object, no additional text or explanations.`
        }]
      }),
      12000
    );

    const planContent = completion.content[0].type === 'text' ? completion.content[0].text : '';
    if (!planContent) throw new Error('Failed to generate plan');


    const workoutPlan = WorkoutPlanSchema.parse(
      JSON.parse(planContent.replace(/```json\n?|\n?```/g, '').trim())
    );

    const plan = await withTimeout(
      saveWorkoutPlan(supabase, body.userId, body.goalType, workoutPlan, {
        durationWeeks: body.daysPerWeek,
        workoutType: body.workoutType,
        focusMuscles: body.focusMuscles,
        daysPerWeek: body.daysPerWeek
      }),
      15000
    );

    return NextResponse.json({
      success: true,
      message: 'Plan generated successfully',
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

    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('timeout') ? 504 : 500;
    
    return NextResponse.json({ error: message }, { status });
  }
}
