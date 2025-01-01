/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import type { Database } from '@/types/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Dumbbell, Target, Calendar, Clock, FileText, BicepsFlexed } from 'lucide-react';
import { formatPlanName } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';

type WorkoutPlan = Database['public']['Tables']['workout_plans']['Row'];
type FitnessGoal = Database['public']['Tables']['fitness_goals']['Row'];

const goalTypes = ['muscle_gain', 'fat_loss', 'strength', 'endurance', 'flexibility'] as const;
const workoutTypes = [
  'powerlifting',
  'bodyweight',
  'hiit',
  'strength',
  'cardio',
  'crossfit',
  'endurance',
  'circuit',
  'isolation'
] as const;

const muscleGroups = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'quadriceps',
  'hamstrings',
  'calves',
  'glutes',
  'traps',
  'lats',
  'lower_back'
] as const;

interface ApiError {
  message: string;
  details?: string;
}

const initialFormData = {
  goalType: '',
  workoutType: '',
  durationWeeks: 4,
  focusMuscles: [] as string[],
  daysPerWeek: 3,
  availableEquipment: [] as string[],
  additionalNotes: ''
};

export default function WorkoutPlanGenerator() {
  const session = useSession();
  const supabase = useSupabaseClient<Database>();
  
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingPlans, setCheckingPlans] = useState(true);
  const [hasActivePlan, setHasActivePlan] = useState(false);
  const [activePlanDetails, setActivePlanDetails] = useState<WorkoutPlan | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkActivePlans = async () => {
      if (!session?.user?.id) return;

      try {
        const { data: activePlan, error } = await supabase
          .from('workout_plans')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('is_active', true)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        setHasActivePlan(!!activePlan);
        setActivePlanDetails(activePlan);
        
        if (activePlan) {
          setMessage({
            type: 'warning',
            text: `You have an active workout plan (${formatPlanName(activePlan.name)}). Please complete it before generating a new one.`
          });
        }
      } catch (error) {
        console.error('Error checking active plans:', error);
        setMessage({
          type: 'error',
          text: 'Failed to check for active plans. Please refresh the page.'
        });
      } finally {
        setCheckingPlans(false);
      }
    };

    checkActivePlans();
  }, [session, supabase]);

  const handleError = (error: unknown) => {
    console.error('Detailed error:', error);
    let errorMessage = 'Failed to generate workout plan. Please try again.';
  
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null && 'error' in error) {
      errorMessage = String((error as { error: string }).error);
    }
  
    setMessage({ type: 'error', text: errorMessage });
  };

  const generateWorkoutPlan = async () => {
    if (!session?.user?.id) {
      setMessage({ type: 'error', text: 'Please sign in to generate a workout plan' });
      return;
    }
  
    if (hasActivePlan) {
      setMessage({ 
        type: 'warning', 
        text: 'Please complete or deactivate your current plan before generating a new one.'
      });
      return;
    }

    if (!formData.goalType || !formData.workoutType || formData.focusMuscles.length === 0) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }
  
    setLoading(true);
    setMessage(null);
  
    try {
      const response = await fetch('/api/generate-workout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          ...formData
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to generate workout plan: ${response.statusText}`);
      }
  
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate workout plan');
      }

      setMessage({ 
        type: 'success', 
        text: 'Workout plan generated successfully! You can view it in your dashboard.' 
      });
      setFormData(initialFormData);

    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return null;
  }

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Alert>
          <AlertDescription>Please sign in to generate a workout plan.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (checkingPlans) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const formatMuscleGroupName = (muscle: string) => 
    muscle.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Card className="border border-blue-500/20 shadow-lg shadow-blue-500/10 backdrop-blur-sm bg-black/40">
        <CardHeader className="space-y-4 pb-8">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/10 p-3 rounded-lg">
              <Dumbbell className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-2xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Generate Workout Plan
              </CardTitle>
              <CardDescription className="text-blue-200/60">
                {hasActivePlan 
                  ? "Complete or deactivate your current plan to generate a new one"
                  : "Customize your preferences to generate a personalized workout plan"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className={`space-y-8 ${hasActivePlan ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 group transition-all duration-300">
              <div className="flex items-center gap-2 text-blue-400">
                <Target className="h-4 w-4" />
                <Label className="font-medium">Goal Type</Label>
              </div>
              <Select
                value={formData.goalType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, goalType: value }))}
              >
                <SelectTrigger className="bg-black/40 border-blue-500/20 hover:border-blue-400/40 transition-colors">
                  <SelectValue placeholder="Select your goal" />
                </SelectTrigger>
                <SelectContent>
                  {goalTypes.map(goal => (
                    <SelectItem key={goal} value={goal} className="hover:bg-blue-500/10">
                      {formatMuscleGroupName(goal)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-purple-400">
                <Clock className="h-4 w-4" />
                <Label className="font-medium">Workout Type</Label>
              </div>
              <Select
                value={formData.workoutType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, workoutType: value }))}
              >
                <SelectTrigger className="bg-black/40 border-purple-500/20 hover:border-purple-400/40 transition-colors">
                  <SelectValue placeholder="Select workout type" />
                </SelectTrigger>
                <SelectContent>
                  {workoutTypes.map(type => (
                    <SelectItem key={type} value={type} className="hover:bg-purple-500/10">
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-blue-400">
                <Calendar className="h-4 w-4" />
                <Label className="font-medium">Program Duration</Label>
              </div>
              <div className="bg-blue-950/40 p-4 rounded-lg border border-blue-500/20">
                <Slider
                  value={[formData.durationWeeks]}
                  onValueChange={([value]) => setFormData(prev => ({ ...prev, durationWeeks: value }))}
                  min={1}
                  max={12}
                  step={1}
                  className="my-4"
                />
                <div className="text-sm text-blue-200/70 text-center font-medium">
                  {formData.durationWeeks} weeks
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-purple-400">
                <Clock className="h-4 w-4" />
                <Label className="font-medium">Days per Week</Label>
              </div>
              <div className="bg-purple-950/40 p-4 rounded-lg border border-purple-500/20">
                <Slider
                  value={[formData.daysPerWeek]}
                  onValueChange={([value]) => setFormData(prev => ({ ...prev, daysPerWeek: value }))}
                  min={1}
                  max={6}
                  step={1}
                  className="my-4"
                />
                <div className="text-sm text-purple-200/60 text-center font-medium">
                  {formData.daysPerWeek} days
                </div>
              </div>
            </div>

            <div className="space-y-3 col-span-2">
              <div className="flex items-center gap-2 text-blue-400">
                <BicepsFlexed className="h-4 w-4" />
                <Label className="font-medium">Focus Muscle Groups</Label>
              </div>
              <div className="bg-blue-950/40 p-4 rounded-lg border border-blue-500/20">
                <Select
                  value={formData.focusMuscles[0] || ''}
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    focusMuscles: [...prev.focusMuscles, value] 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select muscle groups to focus on" />
                  </SelectTrigger>
                  <SelectContent>
                    {muscleGroups
                      .filter(muscle => !formData.focusMuscles.includes(muscle))
                      .map(muscle => (
                        <SelectItem key={muscle} value={muscle}>
                          {formatMuscleGroupName(muscle)}
                        </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-4">
                  {formData.focusMuscles.map(muscle => (
                    <Button
                      key={muscle}
                      variant="secondary"
                      size="sm"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        focusMuscles: prev.focusMuscles.filter(m => m !== muscle)
                      }))}
                      className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-200"
                    >
                      {formatMuscleGroupName(muscle)}
                      <span className="ml-1">✕</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 col-span-2">
              <div className="flex items-center gap-2 text-purple-400">
                <FileText className="h-4 w-4" />
                <Label className="font-medium">Additional Notes</Label>
              </div>
              <Input
                id="additional-notes"
                placeholder="Any specific requirements or limitations?"
                value={formData.additionalNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, additionalNotes: e.target.value }))}
                className="bg-purple-950/40 border-purple-500/20 hover:border-purple-400/40 transition-colors"
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between pt-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => setFormData(initialFormData)}
            disabled={hasActivePlan}
            className="border-blue-500/20 hover:border-blue-400/40 text-blue-400"
          >
            Reset
          </Button>
          <Button
            type="button"
            onClick={generateWorkoutPlan}
            disabled={loading || hasActivePlan || !formData.goalType || !formData.workoutType || formData.focusMuscles.length === 0}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Dumbbell className="h-4 w-4 mr-2" />
            )}
            {loading ? 'Generating...' : 'Generate Plan'}
          </Button>
        </CardFooter>
      </Card>

      {message && (
        <Alert 
          className="mt-6 border-l-4 border-l-blue-500 shadow-lg animate-fadeIn bg-white" 
          variant={message.type === 'error' ? 'destructive' : message.type === 'warning' ? 'warning' : 'default'}
        >
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {hasActivePlan && activePlanDetails && (
        <Alert className="mt-6 border-l-4 border-l-blue-500 shadow-lg animate-fadeIn">
          <AlertDescription>
            Current active plan: {formatPlanName(activePlanDetails.name)}
            <br />
            Please scroll down to manage your current plan
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}