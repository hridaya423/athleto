import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import Anthropic from '@anthropic-ai/sdk';

const VALID_MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'forearms', 'core', 'quadriceps', 'hamstrings',
  'calves', 'glutes', 'traps', 'lats', 'lower_back'
] as const;

type MuscleGroup = (typeof VALID_MUSCLE_GROUPS)[number];
type WorkoutType = 'powerlifting' | 'bodyweight' | 'hiit' | 'strength' | 
                  'cardio' | 'crossfit' | 'endurance' | 'circuit' | 'isolation';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';

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

interface RequestBody {
  userId: string;
  goalType: string;
  workoutType: WorkoutType;
  durationWeeks: number;
  daysPerWeek: number;
  focusMuscles: string[];
  additionalNotes?: string;
}

interface Profile {
  id: string;
  fitness_level?: Difficulty;
}

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

function parseWorkoutPlanJSON(jsonString: string): WorkoutPlan {
  const plan = JSON.parse(jsonString) as Partial<WorkoutPlan>;
  
  if (!plan.restDays || !Array.isArray(plan.restDays) || plan.restDays.length > 7) {
    throw new Error('Invalid rest days configuration');
  }
  
  const invalidDays = plan.restDays.filter(day => !Number.isInteger(day) || day < 1 || day > 7);
  if (invalidDays.length > 0) {
    throw new Error('Rest days must be integers between 1 and 7');
  }

  if (!plan.workouts || !Array.isArray(plan.workouts)) {
    throw new Error('Invalid workouts configuration');
  }

  const validatedWorkouts = plan.workouts.map(workout => ({
    ...workout,
    exercises: workout.exercises.map(exercise => ({
      ...exercise,
      primary_muscles: validateMuscleGroups(exercise.primary_muscles),
      secondary_muscles: validateMuscleGroups(exercise.secondary_muscles)
    }))
  })) as Workout[];
  
  if (!plan.description || !plan.difficulty || !validatedWorkouts) {
    throw new Error('Missing required workout plan fields');
  }

  return {
    description: plan.description,
    difficulty: plan.difficulty,
    restDays: plan.restDays,
    workouts: validatedWorkouts
  };
}

const parseInterval = (duration: string): string => {
  const minutes = parseInt(duration.replace(/[^0-9]/g, ''));
  if (isNaN(minutes)) return '30 minutes';
  return `${minutes} minutes`;
};

export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY || 
        !process.env.NEXT_PUBLIC_SUPABASE_URL || 
        !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const body = await req.json() as RequestBody;
    if (!body.userId || !body.goalType || !body.workoutType || 
        !body.durationWeeks || !body.daysPerWeek || !body.focusMuscles) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

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
      throw new Error('User not found');
    }

    const validRestDays = validateRestDays(body.daysPerWeek);
    const validMuscles = validateMuscleGroups(VALID_MUSCLE_GROUPS as unknown as string[]);

    const completion = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 4200,
      temperature: 0.5,
      system: `You are a workout plan trainer and expert. Generate and return a valid JSON object containing a workout plan. Keep descriptions concise and limit the number of exercises per workout to 4-5 maximum to ensure the response fits within limits. The restDays array MUST contain exactly ${7 - body.daysPerWeek} days (numbers 1-7 representing days of the week) and MUST match these exact days: ${validRestDays.join(', ')}. Do not deviate from these rest days.

Primary and secondary muscles MUST ONLY use these exact values: ${validMuscles.join(', ')}. Do not use any other muscle names or variations.`,
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
- Notes: ${body.additionalNotes || 'None'}
- Fitness level: ${(profile as Profile).fitness_level || 'intermediate'}

Remember to ONLY use these muscle group names: ${validMuscles.join(', ')}

Respond ONLY with the JSON object, no other text.`
        }
      ]
    });

    const planContent = completion.content[0].type === 'text' 
    ? completion.content[0].text
    : '';

    console.log('Raw API Response:', planContent);

    if (planContent.startsWith('An error')) {
      throw new Error(`API returned an error response: ${planContent}`);
    }
    
    if (!planContent) {
      throw new Error('Failed to generate workout plan content');
    }
    let workoutPlan: WorkoutPlan;
    try {
      const cleanJSON = planContent.replace(/```json\n?|\n?```/g, '').trim();
      console.log('Cleaned JSON:', cleanJSON);
      let parsedJSON: unknown;

      try {
        parsedJSON = JSON.parse(cleanJSON);
      } catch (parseError) {
        console.error('Initial JSON parsing error:', parseError);
        const jsonMatch = cleanJSON.match(/\{(?:[^{}]|(\{[^{}]*\}))*\}/);
        if (!jsonMatch) {
          throw new Error('Could not find complete JSON object in response');
        }
        parsedJSON = JSON.parse(jsonMatch[0]);
      }

      workoutPlan = parseWorkoutPlanJSON(JSON.stringify(parsedJSON));
    } catch (error) {
      throw new Error(`Failed to parse workout plan JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

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

      for (const exercise of workout.exercises) {
        const { error: exerciseError } = await supabase
          .from('exercises')
          .insert({
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
          });

        if (exerciseError) {
          throw new Error(`Failed to create exercise: ${exerciseError.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Workout plan generated and saved successfully',
      plan: {
        id: plan.id,
        description: workoutPlan.description,
        difficulty: workoutPlan.difficulty
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
