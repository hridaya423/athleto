/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { 
  Dumbbell, 
  Clock, 
  Target, 
  Flame,
  Timer,
  User,
  AlertCircle,
  Trophy,
  BarChart,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { formatPlanName } from '@/lib/utils';

type MuscleGroup = 
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' 
  | 'forearms' | 'core' | 'quadriceps' | 'hamstrings' 
  | 'calves' | 'glutes' | 'traps' | 'lats' | 'lower_back';

type WorkoutType = 
  | 'powerlifting' | 'bodyweight' | 'hiit' | 'strength' 
  | 'cardio' | 'crossfit' | 'endurance' | 'circuit' | 'isolation';

type Difficulty = 'beginner' | 'intermediate' | 'advanced';

interface Exercise {
  id: string;
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
  id: string;
  name: string;
  description: string;
  day_of_week: number;
  estimated_duration: string;
  workout_type: WorkoutType;
  exercises: Exercise[];
}

interface WorkoutPlan {
  id: string;
  user_id: string;
  name: string;
  description: string;
  duration_weeks: number;
  difficulty: Difficulty;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  focus_muscles: MuscleGroup[];
  rest_days: number[];
  workouts: Workout[];
}

const canCompletePlan = (createdAt: string, durationWeeks: number): boolean => {
  const creationDate = new Date(createdAt);
  const completionDate = new Date(creationDate.getTime() + (durationWeeks * 7 * 24 * 60 * 60 * 1000));
  return new Date() >= completionDate;
};

const getTodayWorkout = (workouts: Workout[], restDays: number[]): Workout | null => {
  const today = new Date().getDay() + 1;
  if (restDays.includes(today)) return null;
  return workouts.find(w => w.day_of_week === today) ?? null;
};

const WorkoutPlansDisplay = () => {
  const [plans, setPlans] = React.useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = React.useState<string | null>(null);
  const [showCompletionError, setShowCompletionError] = React.useState<string | null>(null);
  
  const session = useSession();
  const supabase = useSupabaseClient();

  const fetchWorkoutPlans = React.useCallback(async () => {
    if (!session?.user?.id) {
      setError('Please log in to view workout plans');
      setLoading(false);
      return;
    }

    try {
      const { data: plansData, error: plansError } = await supabase
        .from('workout_plans')
        .select(`
          *,
          workouts (
            *,
            exercises (*)
          )
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (plansError) throw plansError;
      
      if (plansData) {
        setPlans(plansData as WorkoutPlan[]);
        const firstActivePlan = plansData.find(plan => plan.is_active);
        if (firstActivePlan) {
          setSelectedPlan(firstActivePlan.id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workout plans');
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, supabase]);

  React.useEffect(() => {
    if (session?.user) {
      fetchWorkoutPlans();
    }
  }, [session, fetchWorkoutPlans]);

  const formatDuration = (duration: string): string => {
    if (!duration) return '0m';

    const parseTime = (timeStr: string): number => {
      if (timeStr.includes(':')) {
        const [hours = '0', minutes = '0'] = timeStr.split(':');
        return (parseInt(hours) * 60) + parseInt(minutes);
      }
      
      const hours = timeStr.match(/(\d+)\s*hour/);
      const minutes = timeStr.match(/(\d+)\s*min/);
      
      return (hours ? parseInt(hours[1]) * 60 : 0) + 
             (minutes ? parseInt(minutes[1]) : 0);
    };

    const totalMinutes = parseTime(duration);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const handleMarkAsComplete = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    if (!canCompletePlan(plan.created_at, plan.duration_weeks)) {
      setShowCompletionError(`This plan can only be completed after ${
        new Date(new Date(plan.created_at).getTime() + (plan.duration_weeks * 7 * 24 * 60 * 60 * 1000)).toLocaleDateString()
      }`);
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('workout_plans')
        .update({ is_active: false })
        .eq('id', planId);

      if (updateError) throw updateError;
      await fetchWorkoutPlans();
      setShowCompletionError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan status');
    }
  };

  const handleLogWorkout = async (planId: string, workoutId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: existingLog } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('workout_id', workoutId)
        .eq('user_id', session?.user?.id)
        .gte('completed_at', today)
        .single();

      if (existingLog) {
        setError("You've already logged today's workout!");
        return;
      }

      const { error: logError } = await supabase
        .from('workout_logs')
        .insert({
          user_id: session?.user?.id,
          workout_id: workoutId,
          completed_at: new Date().toISOString(),
        });

      if (logError) throw logError;
      
      setError(null);
      await fetchWorkoutPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log workout');
    }
  };

  const renderPlanActionButton = (plan: WorkoutPlan) => {
    if (!plan.is_active) return null;

    const todayWorkout = getTodayWorkout(plan.workouts, plan.rest_days);
    const canComplete = canCompletePlan(plan.created_at, plan.duration_weeks);

    if (canComplete) {
      return (
        <button 
          onClick={() => handleMarkAsComplete(plan.id)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Trophy className="h-4 w-4" />
          Complete Plan
        </button>
      );
    }

    if (!todayWorkout) {
      return (
        <Badge variant="secondary">
          Rest Day
        </Badge>
      );
    }

    return (
      <button 
        onClick={() => handleLogWorkout(plan.id, todayWorkout.id)}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
      >
        <Dumbbell className="h-4 w-4" />
        Log Today&apos;s Workout
      </button>
    );
  };
  const getDayName = (day: number): string => {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day - 1];
  };

  const getDifficultyColor = (difficulty: Difficulty): string => ({
    beginner: 'text-green-500',
    intermediate: 'text-yellow-500',
    advanced: 'text-red-500'
  })[difficulty];

  const getWorkoutTypeColor = (type: WorkoutType): string => ({
    powerlifting: 'bg-red-100 text-red-800 border-red-200',
    bodyweight: 'bg-green-100 text-green-800 border-green-200',
    hiit: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    strength: 'bg-purple-100 text-purple-800 border-purple-200',
    cardio: 'bg-blue-100 text-blue-800 border-blue-200',
    circuit: 'bg-orange-100 text-orange-800 border-orange-200',
    crossfit: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    endurance: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    isolation: 'bg-pink-100 text-pink-800 border-pink-200'
  })[type];

  const calculateWorkoutVolume = (exercises: Exercise[]): number => {
    return exercises.reduce((total, ex) => total + (ex.sets * ex.reps), 0);
  };

  const calculateWeeklyDuration = (workouts: Workout[]): number => {
    return workouts.reduce((total, workout) => 
      total + parseInt(formatDuration(workout.estimated_duration)), 0
    );
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome to Workout Tracker</CardTitle>
            <CardDescription>Please sign in to view and manage your workout plans</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Dumbbell className="h-16 w-16 text-primary opacity-50" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const renderPlanList = (activePlans: boolean) => {
    const filteredPlans = plans.filter(plan => plan.is_active === activePlans);
    
    if (filteredPlans.length === 0) {
      return (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-muted-foreground">
              {activePlans ? "No Active Plans" : "No Completed Plans"}
            </CardTitle>
            <CardDescription>
              {activePlans 
                ? "Start a new workout plan to begin your fitness journey" 
                : "Complete your active plans to see them here"}
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }

     return (
      <div className="grid grid-cols-1 gap-6">
        {filteredPlans.map((plan) => (
          <Card 
            key={plan.id} 
            className={`overflow-hidden border-2 bg-black/40 backdrop-blur-sm transition-all duration-200 ${
              selectedPlan === plan.id ? 'border-blue-400 shadow-lg shadow-blue-500/10' : 'border-blue-500/20 hover:border-blue-500/40'
            }`}
          >
            <CardHeader className="bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-transparent">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                      <Target className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                        {formatPlanName(plan.name)}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-blue-200/60">
                        <User className="h-4 w-4" />
                        <span className={getDifficultyColor(plan.difficulty)}>
                          {plan.difficulty}
                        </span>
                        <span className="text-blue-400">•</span>
                        <CalendarIcon className="h-4 w-4" />
                        <span>{plan.duration_weeks} weeks</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  {renderPlanActionButton(plan)}
                  {plan.is_active && !canCompletePlan(plan.created_at, plan.duration_weeks) && (
                    <div className="text-sm text-blue-200/60 mt-2">
                      Can be completed after {
                        new Date(new Date(plan.created_at).getTime() + 
                        (plan.duration_weeks * 7 * 24 * 60 * 60 * 1000)).toLocaleDateString()
                      }
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              <div className="flex flex-wrap gap-2">
                {plan.focus_muscles?.map((muscle) => (
                  <Badge 
                    key={muscle} 
                    className="capitalize bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-200 border-blue-500/20"
                  >
                    <Flame className="h-3 w-3 mr-1" />
                    {muscle.replace('_', ' ')}
                  </Badge>
                ))}
              </div>

              <Alert className="bg-black border-blue-500/20">
                <Timer className="h-4 w-4" />
                <AlertDescription className="text-blue-200/80 flex items-center gap-2">
                  <span className="font-medium">Rest days:</span>
                  {plan.rest_days?.map(day => getDayName(day)).join(', ')}
                </AlertDescription>
              </Alert>

              <Accordion 
                type="single" 
                collapsible 
                className="w-full"
                defaultValue={`workout-0`}
              >
                {plan.workouts?.map((workout, index) => (
                  <AccordionItem 
                    key={workout.id} 
                    value={`workout-${index}`}
                    className="border border-blue-500/20 rounded-lg mb-2 data-[state=open]:bg-blue-500/5 transition-colors overflow-hidden"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline group">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                            <Dumbbell className="h-5 w-5 text-blue-400" />
                          </div>
                          <div className="text-left">
                            <h3 className="font-medium text-blue-100 group-hover:text-blue-50 transition-colors">
                              {formatPlanName(workout.name)}
                            </h3>
                            <p className="text-sm text-blue-200/60">
                              {getDayName(workout.day_of_week)} · {formatDuration(workout.estimated_duration)}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-blue-500/10 text-blue-200 border-blue-500/20">
                          {workout.workout_type}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    
                    <AccordionContent>
                      <div className="p-6 space-y-6 bg-blue-500/5">
                        <p className="text-blue-200/80">{workout.description}</p>
                        
                        <div className="rounded-xl overflow-hidden border border-blue-500/20">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-blue-500/20 hover:bg-transparent">
                                <TableHead className="text-blue-300">Exercise</TableHead>
                                <TableHead className="text-blue-300 w-32">Sets × Reps</TableHead>
                                <TableHead className="text-blue-300 w-24">Rest</TableHead>
                                <TableHead className="text-blue-300">Equipment</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {workout.exercises?.map((exercise, idx) => (
                                <TableRow 
                                  key={exercise.id} 
                                  className={`
                                    border-blue-500/10 hover:bg-blue-500/5 transition-colors
                                    ${idx % 2 === 0 ? 'bg-transparent' : 'bg-blue-500/5'}
                                  `}
                                >
                                  <TableCell>
                                    <div className="space-y-2">
                                      <p className="font-medium text-blue-100">{formatPlanName(exercise.name)}</p>
                                      <div className="flex flex-wrap gap-1">
                                        {exercise.primary_muscles?.map((muscle) => (
                                          <Badge 
                                            key={muscle} 
                                            className="text-xs bg-blue-500/20 text-blue-200 border-none"
                                          >
                                            {muscle.replace('_', ' ')}
                                          </Badge>
                                        ))}
                                      </div>
                                      {exercise.secondary_muscles?.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                          {exercise.secondary_muscles?.map((muscle) => (
                                            <Badge 
                                              key={muscle} 
                                              variant="outline" 
                                              className="text-xs text-blue-200/60 border-blue-500/20"
                                            >
                                              +{muscle.replace('_', ' ')}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-mono text-blue-200">
                                    {exercise.sets} × {exercise.reps}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1 text-blue-200">
                                      <Clock className="h-3 w-3" />
                                      {formatDuration(exercise.rest_duration)}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {exercise.equipment_needed?.map((equipment) => (
                                        <Badge 
                                          key={equipment} 
                                          className="text-xs bg-blue-500/10 text-blue-200 border-blue-500/20"
                                        >
                                          {equipment}
                                        </Badge>
                                      ))}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                          <div className="flex items-center justify-between text-sm text-blue-200">
                            <div className="flex items-center gap-2">
                              <BarChart className="h-4 w-4" />
                              <span>Workout Volume</span>
                            </div>
                            <span>
                              {calculateWorkoutVolume(workout.exercises)} total reps
                            </span>
                          </div>
                          <Progress 
                            value={70} 
                            className="mt-3 h-2 bg-blue-950"
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
            
            <CardFooter className="bg-gradient-to-r from-blue-500/5 to-transparent border-t border-blue-500/20 p-2">
              <div className="flex items-center justify-between w-full text-sm text-blue-200/60">
                <span>Last updated {new Date(plan.updated_at).toLocaleDateString()}</span>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>
                    {calculateWeeklyDuration(plan.workouts)}m per week
                  </span>
                </div>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="w-full max-w-md mx-auto grid grid-cols-2">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Flame className="h-4 w-4" />
            Active Plans ({plans.filter(p => p.is_active).length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Completed Plans ({plans.filter(p => !p.is_active).length})
          </TabsTrigger>
        </TabsList>
        
        <div className="mt-6">
          <TabsContent value="active" className="m-0">
            {renderPlanList(true)}
          </TabsContent>
          
          <TabsContent value="completed" className="m-0">
            {renderPlanList(false)}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default WorkoutPlansDisplay;
