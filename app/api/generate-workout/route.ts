/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const VALID_MUSCLE_GROUPS = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core', 'quadriceps', 'hamstrings', 'calves', 'glutes', 'traps', 'lats', 'lower_back'] as const;
const VALID_WORKOUT_TYPES = ['powerlifting', 'bodyweight', 'hiit', 'strength', 'cardio', 'crossfit', 'endurance', 'circuit', 'isolation'] as const;
const VALID_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

type MuscleGroup = typeof VALID_MUSCLE_GROUPS[number];
type WorkoutType = typeof VALID_WORKOUT_TYPES[number];
type Difficulty = typeof VALID_DIFFICULTIES[number];

const RequestBodySchema = z.object({
  userId: z.string(),
  goalType: z.string(),
  workoutType: z.enum(VALID_WORKOUT_TYPES),
  durationWeeks: z.number(),
  daysPerWeek: z.number(),
  focusMuscles: z.array(z.enum(VALID_MUSCLE_GROUPS)),
  additionalNotes: z.string().optional()
});

interface Exercise {
  name: string;
  description: string;
  sets: number;
  reps: number;
  rest_duration: string;
  order_in_workout: number;
  primary_muscles: MuscleGroup[];
  secondary_muscles: MuscleGroup[];
  equipment_needed: string[];
  exercise_type: WorkoutType;
}

interface Workout {
  name: string;
  description: string;
  day_of_week: number;
  estimated_duration: string;
  workout_type: WorkoutType;
  exercises: Exercise[];
}

interface WorkoutPlan {
  description: string;
  difficulty: Difficulty;
  restDays: number[];
  workouts: Workout[];
}

const quickValidate = (plan: any): WorkoutPlan => {
  if (!plan?.description || !plan?.difficulty || !Array.isArray(plan?.workouts)) {
    throw new Error('Invalid plan structure');
  }
  return plan as WorkoutPlan;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number = 30000): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
};

async function saveWorkoutPlan(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  goalType: string,
  workoutPlan: WorkoutPlan,
  planParams: {
    durationWeeks: number;
    workoutType: WorkoutType;
    focusMuscles: MuscleGroup[];
    daysPerWeek: number;
  }
): Promise<{ id: string }> {
  const { data: goal, error: goalError } = await supabase
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

  if (goalError) {
    console.error('Goal creation error:', goalError);
    throw new Error(`Failed to create fitness goal: ${goalError.message}`);
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

  if (planError) {
    console.error('Plan creation error:', planError);
    throw new Error(`Failed to create workout plan: ${planError.message}`);
  }

  for (const workout of workoutPlan.workouts) {
    const { data: workoutData, error: workoutError } = await supabase
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

    if (workoutError) {
      console.error('Workout creation error:', workoutError);
      throw new Error(`Failed to create workout: ${workoutError.message}`);
    }

    const exercisePromises = workout.exercises.map(exercise =>
      supabase
        .from('exercises')
        .insert({
          workout_id: workoutData.id,
          name: exercise.name,
          description: exercise.description,
          sets: exercise.sets,
          reps: exercise.reps,
          rest_duration: exercise.rest_duration,
          order_in_workout: exercise.order_in_workout,
          exercise_type: exercise.exercise_type,
          primary_muscles: exercise.primary_muscles,
          secondary_muscles: exercise.secondary_muscles,
          equipment_needed: exercise.equipment_needed
        })
    );

    try {
      await Promise.all(exercisePromises);
    } catch (error) {
      console.error('Exercise creation error:', error);
      throw new Error('Failed to create exercises');
    }
  }

  return plan;
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const env = process.env;
    if (!env.ANTHROPIC_API_KEY || !env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing env vars');
    }

    const body = RequestBodySchema.parse(await req.json());
    
    const supabase = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
    
    const anthropic = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      maxRetries: 2,
      timeout: 25000
    });

    const restDays = Array.from({ length: 7 - body.daysPerWeek }, (_, i) => i + 1);

    const completion = await withTimeout(
      anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 4000,
        temperature: 0.7,
        system: `You are a fitness trainer. Generate a valid JSON workout plan. Follow these rules exactly:
1. Use proper JSON syntax with double quotes for all keys and string values
2. No trailing commas
3. Arrays must be properly terminated
4. All strings must be properly quoted
5. Numbers should not be quoted

The structure must be exactly:
{
  "description": "string value",
  "difficulty": "${VALID_DIFFICULTIES.join('" | "')}",
  "restDays": [${restDays.join(', ')}],
  "workouts": [
    {
      "name": "string value",
      "description": "string value",
      "day_of_week": 1,
      "estimated_duration": "30 minutes",
      "workout_type": "${VALID_WORKOUT_TYPES.join('" | "')}",
      "exercises": [
        {
          "name": "string value",
          "description": "string value",
          "sets": 3,
          "reps": 12,
          "rest_duration": "60 seconds",
          "order_in_workout": 1,
          "primary_muscles": ["${VALID_MUSCLE_GROUPS.join('", "')}", "..."],
          "secondary_muscles": ["${VALID_MUSCLE_GROUPS.join('", "')}", "..."],
          "equipment_needed": ["string value"],
          "exercise_type": "${VALID_WORKOUT_TYPES.join('" | "')}"
        }
      ]
    }
  ]
}`,
        messages: [{
          role: "user",
          content: `Create workout plan:
- Duration: ${body.durationWeeks}w
- Type: ${body.workoutType}
- Muscles: ${body.focusMuscles.join(',')}
- Days/week: ${body.daysPerWeek}
- Rest: ${restDays.join(',')}
- Goal: ${body.goalType}
- Notes: ${body.additionalNotes || 'None'}
Return ONLY JSON.`
        }]
      }),
      25000
    );

    const planContent = completion.content[0].type === 'text' ? completion.content[0].text : '';
    if (!planContent) throw new Error('No plan generated');

    const cleanedContent = planContent
      .replace(/```json\n?|\n?```/g, '') 
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/,(\s*[}\]])/g, '$1')
      .trim();
    
    let workoutPlan;
    try {
      workoutPlan = quickValidate(JSON.parse(cleanedContent));
    } catch (e) {
      console.error('JSON Parse Error:', e);
      console.error('Cleaned Content:', cleanedContent);
      throw new Error('Failed to parse workout plan: Invalid JSON structure');
    }

    const plan = await withTimeout(
      saveWorkoutPlan(supabase, body.userId, body.goalType, workoutPlan, {
        durationWeeks: body.durationWeeks,
        workoutType: body.workoutType,
        focusMuscles: body.focusMuscles as MuscleGroup[],
        daysPerWeek: body.daysPerWeek
      }),
      15000
    );

    return NextResponse.json({
      success: true,
      message: 'Plan created',
      plan: {
        id: plan.id,
        description: workoutPlan.description,
        difficulty: workoutPlan.difficulty,
        workouts: workoutPlan.workouts.length
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message.includes('timeout') ? 504 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
