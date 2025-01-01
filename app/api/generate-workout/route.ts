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
  const [goalResult, planResult] = await Promise.all([
    supabase
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
      .single(),
    
    supabase
      .from('workout_plans')
      .insert({
        user_id: userId,
        description: workoutPlan.description,
        duration_weeks: planParams.durationWeeks,
        difficulty: workoutPlan.difficulty,
        is_active: true,
        focus_muscles: planParams.focusMuscles,
        rest_days: workoutPlan.restDays
      })
      .select('id')
      .single()
  ]);

  if (goalResult.error || !goalResult.data) throw new Error('Failed to create goal');
  if (planResult.error || !planResult.data) throw new Error('Failed to create plan');

  const workoutInserts = workoutPlan.workouts.map(workout => ({
    plan_id: planResult.data.id,
    name: workout.name,
    description: workout.description,
    day_of_week: workout.day_of_week,
    estimated_duration: workout.estimated_duration,
    workout_type: workout.workout_type,
    exercises: workout.exercises
  }));

  const { data: workouts, error: workoutsError } = await supabase
    .from('workouts')
    .insert(workoutInserts)
    .select('id');

  if (workoutsError || !workouts) throw new Error('Failed to create workouts');

  const exerciseInserts = workouts.flatMap((workout, idx) => 
    workoutPlan.workouts[idx].exercises.map(exercise => ({
      workout_id: workout.id,
      ...exercise
    }))
  );

  const { error: exercisesError } = await supabase
    .from('exercises')
    .insert(exerciseInserts);

  if (exercisesError) throw new Error('Failed to create exercises');

  return planResult.data;
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
        system: `You are a fitness trainer. Generate a workout plan as JSON with structure:
{
  "description": string,
  "difficulty": "${VALID_DIFFICULTIES.join('|')}",
  "restDays": [${restDays.join(',')}],
  "workouts": [{
    "name": string,
    "description": string,
    "day_of_week": number,
    "estimated_duration": string,
    "workout_type": "${VALID_WORKOUT_TYPES.join('|')}",
    "exercises": [{
      "name": string,
      "description": string,
      "sets": number,
      "reps": number,
      "rest_duration": string,
      "order_in_workout": number,
      "primary_muscles": ["${VALID_MUSCLE_GROUPS.join('","')}"],
      "secondary_muscles": ["${VALID_MUSCLE_GROUPS.join('","')}"],
      "equipment_needed": string[],
      "exercise_type": "${VALID_WORKOUT_TYPES.join('|')}"
    }]
  }]
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

    const workoutPlan = quickValidate(JSON.parse(planContent.replace(/```json\n?|\n?```/g, '').trim()));

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
