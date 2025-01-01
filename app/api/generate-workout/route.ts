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

type MuscleGroup = (typeof VALID_MUSCLE_GROUPS)[number];

const ExerciseSchema = z.object({
  name: z.string(),
  description: z.string(),
  sets: z.number().int().positive(),
  reps: z.number().int().positive(),
  rest_duration: z.string(),
  order_in_workout: z.number().int().nonnegative(),
  primary_muscles: z.array(z.enum(VALID_MUSCLE_GROUPS)),
  secondary_muscles: z.array(z.enum(VALID_MUSCLE_GROUPS)),
  equipment_needed: z.array(z.string()),
  exercise_type: z.enum(VALID_WORKOUT_TYPES)
});

const WorkoutSchema = z.object({
  name: z.string(),
  description: z.string(),
  day_of_week: z.number().int().min(1).max(7),
  estimated_duration: z.string(),
  workout_type: z.enum(VALID_WORKOUT_TYPES),
  exercises: z.array(ExerciseSchema).min(1).max(5)
});

const WorkoutPlanSchema = z.object({
  description: z.string(),
  difficulty: z.enum(VALID_DIFFICULTIES),
  restDays: z.array(z.number().int().min(1).max(7)),
  workouts: z.array(WorkoutSchema)
});

const RequestBodySchema = z.object({
  userId: z.string().uuid(),
  goalType: z.string(),
  workoutType: z.enum(VALID_WORKOUT_TYPES),
  durationWeeks: z.number().int().positive().max(52),
  daysPerWeek: z.number().int().min(1).max(7),
  focusMuscles: z.array(z.enum(VALID_MUSCLE_GROUPS)).min(1),
  additionalNotes: z.string().optional()
});

function validateRestDays(daysPerWeek: number): number[] {
  const allDays = [1, 2, 3, 4, 5, 6, 7];
  const restDaysCount = 7 - daysPerWeek;
  const shuffled = [...allDays].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, restDaysCount).sort((a, b) => a - b);
}

function validateMuscleGroups(muscles: string[]): MuscleGroup[] {
  return muscles.filter((muscle): muscle is MuscleGroup => 
    VALID_MUSCLE_GROUPS.includes(muscle as MuscleGroup)
  );
}

const parseInterval = (duration: string): string => {
  const minutes = parseInt(duration.replace(/[^0-9]/g, ''));
  if (isNaN(minutes) || minutes <= 0) return '30 minutes';
  return `${minutes} minutes`;
};

export async function POST(req: Request) {
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
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', body.userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const validRestDays = validateRestDays(body.daysPerWeek);

    const completion = await anthropic.messages.create({
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
}

Guidelines:
- Keep descriptions concise but informative
- Limit exercises to 4-5 per workout
- Rest days MUST be exactly: ${validRestDays.join(', ')}
- Use ONLY the specified muscle groups
- Ensure progressive overload across weeks
- Match difficulty to user's fitness level
- Include proper warm-up exercises
- Vary exercise selection for engagement`,
      messages: [
        {
          role: "user",
          content: `Create a workout plan with these parameters:
- Duration: ${body.durationWeeks} weeks
- Type: ${body.workoutType}
- Focus muscles: ${validateMuscleGroups(body.focusMuscles).join(', ')}
- Days per week: ${body.daysPerWeek}
- Rest days: ${validRestDays.join(', ')}
- Goal: ${body.goalType}
- Additional notes: ${body.additionalNotes || 'None'}
- Fitness level: ${profile.fitness_level || 'intermediate'}

Return ONLY the JSON object, no additional text or explanations.`
        }
      ]
    });

    const planContent = completion.content[0].type === 'text' 
      ? completion.content[0].text
      : '';

    if (!planContent) {
      throw new Error('Failed to generate workout plan');
    }
    const cleanJSON = planContent.replace(/```json\n?|\n?```/g, '').trim();
    const workoutPlan = WorkoutPlanSchema.parse(JSON.parse(cleanJSON));

    const { data: goal, error: goalError } = await supabase
      .from('fitness_goals')
      .insert({
        user_id: body.userId,
        goal_type: body.goalType,
        target_date: new Date(Date.now() + body.durationWeeks * 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        specific_targets: {
          workout_type: body.workoutType,
          focus_muscles: validateMuscleGroups(body.focusMuscles),
          days_per_week: body.daysPerWeek
        }
      })
      .select()
      .single();

    if (goalError || !goal) {
      throw new Error(`Failed to create fitness goal: ${goalError?.message}`);
    }

    const { data: plan, error: planError } = await supabase
      .from('workout_plans')
      .insert({
        user_id: body.userId,
        goal_id: goal.id,
        name: `${body.goalType} - ${body.workoutType} Plan`,
        description: workoutPlan.description,
        duration_weeks: body.durationWeeks,
        difficulty: workoutPlan.difficulty,
        is_active: true,
        focus_muscles: validateMuscleGroups(body.focusMuscles),
        rest_days: workoutPlan.restDays
      })
      .select()
      .single();

    if (planError || !plan) {
      throw new Error(`Failed to create workout plan: ${planError?.message}`);
    }

    for (const workout of workoutPlan.workouts) {
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          plan_id: plan.id,
          name: workout.name,
          description: workout.description,
          day_of_week: workout.day_of_week,
          estimated_duration: parseInterval(workout.estimated_duration),
          workout_type: workout.workout_type
        })
        .select()
        .single();

      if (workoutError || !workoutData) {
        throw new Error(`Failed to create workout: ${workoutError?.message}`);
      }


      const exercisePromises = workout.exercises.map(exercise => 
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
      );

      const exerciseResults = await Promise.allSettled(exercisePromises);
      const failedExercises = exerciseResults.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected'
      );

      if (failedExercises.length > 0) {
        throw new Error(`Failed to create some exercises: ${failedExercises[0].reason}`);
      }
    }

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

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
