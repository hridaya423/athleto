export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type MuscleGroup = 
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'quadriceps'
  | 'hamstrings'
  | 'calves'
  | 'glutes'
  | 'traps'
  | 'lats'
  | 'lower_back'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          updated_at: string
          full_name: string | null
          avatar_url: string | null
          height: number | null
          weight: number | null
          age: number | null
          gender: string | null
          fitness_level: 'beginner' | 'intermediate' | 'advanced' | null
          has_completed_onboarding: boolean
          current_bmi: number | null
          target_weight: number | null
          activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | null
          medical_conditions: string[] | null
          preferred_workout_time: string | null
          available_equipment: string[] | null
        }
        Insert: {
          id: string
          updated_at?: string
          full_name?: string | null
          avatar_url?: string | null
          height?: number | null
          weight?: number | null
          age?: number | null
          gender?: string | null
          fitness_level?: 'beginner' | 'intermediate' | 'advanced' | null
          has_completed_onboarding?: boolean
          current_bmi?: number | null
          target_weight?: number | null
          activity_level?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | null
          medical_conditions?: string[] | null
          preferred_workout_time?: string | null
          available_equipment?: string[] | null
        }
        Update: {
          id?: string
          updated_at?: string
          full_name?: string | null
          avatar_url?: string | null
          height?: number | null
          weight?: number | null
          age?: number | null
          gender?: string | null
          fitness_level?: 'beginner' | 'intermediate' | 'advanced' | null
          has_completed_onboarding?: boolean
          current_bmi?: number | null
          target_weight?: number | null
          activity_level?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | null
          medical_conditions?: string[] | null
          preferred_workout_time?: string | null
          available_equipment?: string[] | null
        }
      }
      onboarding_progress: {
        Row: {
          user_id: string
          current_step: 'welcome' | 'personal_info' | 'fitness_assessment' | 'goal_setting' | 'equipment_check' | 'schedule_setup' | 'tutorial_complete'
          completed_steps: string[]
          last_interaction: string
          created_at: string
        }
        Insert: {
          user_id: string
          current_step?: 'welcome' | 'personal_info' | 'fitness_assessment' | 'goal_setting' | 'equipment_check' | 'schedule_setup' | 'tutorial_complete'
          completed_steps?: string[]
          last_interaction?: string
          created_at?: string
        }
        Update: {
          user_id?: string
          current_step?: 'welcome' | 'personal_info' | 'fitness_assessment' | 'goal_setting' | 'equipment_check' | 'schedule_setup' | 'tutorial_complete'
          completed_steps?: string[]
          last_interaction?: string
          created_at?: string
        }
      }
      fitness_goals: {
        Row: {
          id: string
          user_id: string
          goal_type: 'muscle_gain' | 'fat_loss' | 'strength' | 'endurance' | 'flexibility'
          target_date: string
          status: 'active' | 'completed' | 'abandoned'
          created_at: string
          updated_at: string
          specific_targets: Json
        }
        Insert: {
          id?: string
          user_id: string
          goal_type: 'muscle_gain' | 'fat_loss' | 'strength' | 'endurance' | 'flexibility'
          target_date: string
          status?: 'active' | 'completed' | 'abandoned'
          created_at?: string
          updated_at?: string
          specific_targets?: Json
        }
        Update: {
          id?: string
          user_id?: string
          goal_type?: 'muscle_gain' | 'fat_loss' | 'strength' | 'endurance' | 'flexibility'
          target_date?: string
          status?: 'active' | 'completed' | 'abandoned'
          created_at?: string
          updated_at?: string
          specific_targets?: Json
        }
      }
      workout_plans: {
        Row: {
          id: string
          user_id: string
          goal_id: string
          name: string
          description: string | null
          duration_weeks: number
          difficulty: 'beginner' | 'intermediate' | 'advanced'
          created_at: string
          updated_at: string
          is_active: boolean
          focus_muscles: MuscleGroup[]
          rest_days: number[]
        }
        Insert: {
          id?: string
          user_id: string
          goal_id: string
          name: string
          description?: string | null
          duration_weeks: number
          difficulty: 'beginner' | 'intermediate' | 'advanced'
          created_at?: string
          updated_at?: string
          is_active?: boolean
          focus_muscles: MuscleGroup[]
          rest_days: number[]
        }
        Update: {
          id?: string
          user_id?: string
          goal_id?: string
          name?: string
          description?: string | null
          duration_weeks?: number
          difficulty?: 'beginner' | 'intermediate' | 'advanced'
          created_at?: string
          updated_at?: string
          is_active?: boolean
          focus_muscles?: MuscleGroup[]
          rest_days?: number[]
        }
      }
      workouts: {
        Row: {
          id: string
          plan_id: string
          name: string
          description: string | null
          day_of_week: number
          estimated_duration: string
          workout_type: 'powerlifting' | 'bodyweight' | 'hiit' | 'strength' | 'cardio' | 'crossfit' | 'endurance' | 'circuit' | 'isolation'
        }
        Insert: {
          id?: string
          plan_id: string
          name: string
          description?: string | null
          day_of_week: number
          estimated_duration: string
          workout_type: 'powerlifting' | 'bodyweight' | 'hiit' | 'strength' | 'cardio' | 'crossfit' | 'endurance' | 'circuit' | 'isolation'
        }
        Update: {
          id?: string
          plan_id?: string
          name?: string
          description?: string | null
          day_of_week?: number
          estimated_duration?: string
          workout_type?: 'powerlifting' | 'bodyweight' | 'hiit' | 'strength' | 'cardio' | 'crossfit' | 'endurance' | 'circuit' | 'isolation'
        }
      }
      exercises: {
        Row: {
          id: string
          workout_id: string
          name: string
          description: string | null
          sets: number
          reps: number
          weight: number | null
          duration: string | null
          rest_duration: string
          order_in_workout: number
          exercise_type: 'powerlifting' | 'bodyweight' | 'hiit' | 'strength' | 'cardio' | 'crossfit' | 'endurance' | 'circuit' | 'isolation'
          primary_muscles: MuscleGroup[]
          secondary_muscles: MuscleGroup[]
          equipment_needed: string[]
        }
        Insert: {
          id?: string
          workout_id: string
          name: string
          description?: string | null
          sets: number
          reps: number
          weight?: number | null
          duration?: string | null
          rest_duration: string
          order_in_workout: number
          exercise_type: 'powerlifting' | 'bodyweight' | 'hiit' | 'strength' | 'cardio' | 'crossfit' | 'endurance' | 'circuit' | 'isolation'
          primary_muscles: MuscleGroup[]
          secondary_muscles: MuscleGroup[]
          equipment_needed: string[]
        }
        Update: {
          id?: string
          workout_id?: string
          name?: string
          description?: string | null
          sets?: number
          reps?: number
          weight?: number | null
          duration?: string | null
          rest_duration?: string
          order_in_workout?: number
          exercise_type?: 'powerlifting' | 'bodyweight' | 'hiit' | 'strength' | 'cardio' | 'crossfit' | 'endurance' | 'circuit' | 'isolation'
          primary_muscles?: MuscleGroup[]
          secondary_muscles?: MuscleGroup[]
          equipment_needed?: string[]
        }
      }
      workout_logs: {
        Row: {
          id: string
          user_id: string
          workout_id: string
          completed_at: string
          duration: string
          difficulty_rating: number
          notes: string | null
          mood: 'great' | 'good' | 'okay' | 'tired' | 'exhausted'
        }
        Insert: {
          id?: string
          user_id: string
          workout_id: string
          completed_at?: string
          duration: string
          difficulty_rating: number
          notes?: string | null
          mood: 'great' | 'good' | 'okay' | 'tired' | 'exhausted'
        }
        Update: {
          id?: string
          user_id?: string
          workout_id?: string
          completed_at?: string
          duration?: string
          difficulty_rating?: number
          notes?: string | null
          mood?: 'great' | 'good' | 'okay' | 'tired' | 'exhausted'
        }
      }
      exercise_logs: {
        Row: {
          id: string
          workout_log_id: string
          exercise_id: string
          sets_completed: number
          reps_completed: number
          weight_used: number | null
          duration_actual: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          workout_log_id: string
          exercise_id: string
          sets_completed: number
          reps_completed: number
          weight_used?: number | null
          duration_actual?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          workout_log_id?: string
          exercise_id?: string
          sets_completed?: number
          reps_completed?: number
          weight_used?: number | null
          duration_actual?: string | null
          notes?: string | null
        }
      }
      progress_metrics: {
        Row: {
          id: string
          user_id: string
          measurement_date: string
          weight: number | null
          body_fat_percentage: number | null
          chest_cm: number | null
          waist_cm: number | null
          hips_cm: number | null
          biceps_cm: number | null
          thighs_cm: number | null
          energy_level: number | null
          sleep_hours: number | null
          notes: string | null
        }
        Insert: {
          id?: string
          user_id: string
          measurement_date?: string
          weight?: number | null
          body_fat_percentage?: number | null
          chest_cm?: number | null
          waist_cm?: number | null
          hips_cm?: number | null
          biceps_cm?: number | null
          thighs_cm?: number | null
          energy_level?: number | null
          sleep_hours?: number | null
          notes?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          measurement_date?: string
          weight?: number | null
          body_fat_percentage?: number | null
          chest_cm?: number | null
          waist_cm?: number | null
          hips_cm?: number | null
          biceps_cm?: number | null
          thighs_cm?: number | null
          energy_level?: number | null
          sleep_hours?: number | null
          notes?: string | null
        }
      }
      rest_day_logs: {
        Row: {
          id: string
          user_id: string
          plan_id: string
          rest_date: string
          was_followed: boolean
          alternate_activity: string | null
          sleep_quality: number | null
          recovery_rating: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_id: string
          rest_date: string
          was_followed?: boolean
          alternate_activity?: string | null
          sleep_quality?: number | null
          recovery_rating?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_id?: string
          rest_date?: string
          was_followed?: boolean
          alternate_activity?: string | null
          sleep_quality?: number | null
          recovery_rating?: number | null
          notes?: string | null
          created_at?: string
        }
      }
    }
  }
}
