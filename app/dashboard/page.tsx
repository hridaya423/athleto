/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { 
    Loader2, TrendingUp, Calendar, Weight, Activity, 
    Sparkles, Flame, Trophy, Target
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useToast } from "@/hooks/use-toast";
import { Database } from '@/types/supabase';
import { ErrorBoundary } from 'react-error-boundary';

type Profile = Database['public']['Tables']['profiles']['Row'];
type WorkoutPlan = Database['public']['Tables']['workout_plans']['Row'];
type Workout = Database['public']['Tables']['workouts']['Row'];
type ProgressMetric = Database['public']['Tables']['progress_metrics']['Row'];
type UserMetadata = {
    full_name?: string;
    avatar_url?: string;
};

interface EnhancedWorkoutPlan extends WorkoutPlan {
    workouts: Workout[];
}

interface DashboardData {
    profile: Profile | null;
    activePlan: EnhancedWorkoutPlan | null;
    progressMetrics: ProgressMetric[];
    todayWorkout: Workout | null;
    isRestDay: boolean;
    hasLoggedToday: boolean;
}

const initialDashboardData: DashboardData = {
    profile: null,
    activePlan: null,
    progressMetrics: [],
    todayWorkout: null,
    isRestDay: false,
    hasLoggedToday: false
};

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
    return (
        <div className="p-6 border border-red-500/20 bg-red-950/10 rounded-xl backdrop-blur-xl">
            <h2 className="text-xl font-bold text-red-400">Something went wrong</h2>
            <pre className="mt-4 text-sm text-red-300/80">{error.message}</pre>
            <Button 
                onClick={resetErrorBoundary} 
                className="mt-6 bg-red-500/20 hover:bg-red-500/30 text-red-300"
            >
                Try again
            </Button>
        </div>
    );
}

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

export default function Dashboard() {
    const router = useRouter();
    const session = useSession();
    const supabase = useSupabaseClient<Database>();
    const { toast } = useToast();
    const [loading, setLoading] = useState<boolean>(true);
    const [dashboardData, setDashboardData] = useState<DashboardData>(initialDashboardData);
    const abortControllerRef = useRef<AbortController | null>(null);

    const retryOperation = async <T,>(
        operation: () => Promise<T>,
        attempts: number = RETRY_ATTEMPTS
    ): Promise<T> => {
        for (let i = 0; i < attempts; i++) {
            try {
                return await operation();
            } catch (error) {
                if (i === attempts - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, i)));
            }
        }
        throw new Error('Operation failed after all retry attempts');
    };

    const fetchDashboardData = useCallback(async () => {
        if (!session?.user?.id) return;

        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();

        try {
            const today = new Date().toISOString().split('T')[0];
            
            const [profileData, planData, metricsData, todayLogs] = await Promise.all([
                retryOperation(async () => {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();
                    if (error) throw error;
                    return data;
                }),
                retryOperation(async () => {
                    const { data, error } = await supabase
                        .from('workout_plans')
                        .select('*, workouts(*)')
                        .eq('user_id', session.user.id)
                        .eq('is_active', true)
                        .single();
                    if (error && error.code !== 'PGRST116') throw error;
                    return data;
                }),
                retryOperation(async () => {
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    const { data, error } = await supabase
                        .from('progress_metrics')
                        .select('*')
                        .eq('user_id', session.user.id)
                        .gte('measurement_date', thirtyDaysAgo.toISOString())
                        .order('measurement_date', { ascending: true });
                    if (error) throw error;
                    return data;
                }),
                retryOperation(async () => {
                    const workoutLogsPromise = supabase
                        .from('workout_logs')
                        .select('id')
                        .eq('user_id', session.user.id)
                        .gte('completed_at', today)
                        .maybeSingle();

                    const restLogsPromise = supabase
                        .from('rest_day_logs')
                        .select('id')
                        .eq('user_id', session.user.id)
                        .gte('rest_date', today)
                        .maybeSingle();

                    const [workoutLog, restLog] = await Promise.all([workoutLogsPromise, restLogsPromise]);
                    return {
                        hasLoggedWorkout: !!workoutLog.data,
                        hasLoggedRest: !!restLog.data
                    };
                })
            ]);

            let processedMetrics = metricsData?.length ? metricsData.map(metric => ({
                ...metric,
                current_bmi: metric.current_bmi || 
                    (profileData?.height && metric.weight 
                        ? Number((metric.weight / Math.pow(profileData.height / 100, 2)).toFixed(1))
                        : null),
                measurement_date: new Date(metric.measurement_date).toISOString(),
                weight: metric.weight ? Number(metric.weight) : null
            })) : [];

            if (!processedMetrics.length && profileData) {
                processedMetrics = [{
                    id: 'initial',
                    user_id: profileData.id,
                    measurement_date: new Date().toISOString(),
                    weight: profileData.weight,
                    current_bmi: profileData.current_bmi,
                    created_at: new Date().toISOString()
                }];
            }

            const todayNum = new Date().getDay() === 0 ? 7 : new Date().getDay();
            const isRestDay = planData?.rest_days?.includes(todayNum) ?? false;
            const todayWorkout = !isRestDay && planData?.workouts 
  ? planData.workouts.find((w: Workout) => w.day_of_week === todayNum) ?? null
  : null;

            setDashboardData(prev => ({
                ...prev,
                profile: profileData,
                activePlan: planData as EnhancedWorkoutPlan,
                progressMetrics: processedMetrics,
                todayWorkout,
                isRestDay,
                hasLoggedToday: todayLogs.hasLoggedWorkout || todayLogs.hasLoggedRest
            }));
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            toast({
                title: "Error",
                description: "Failed to load dashboard data. Please refresh the page.",
                variant: "destructive",
            });
            throw error;
        } finally {
            setLoading(false);
        }
    }, [session, supabase, toast]);

    const handleLogWorkout = async () => {
        if (!dashboardData.todayWorkout?.id || !session?.user?.id) {
            toast({
                title: "Error",
                description: "Missing required data. Please try again.",
                variant: "destructive",
            });
            return;
        }

        try {
            const { error: insertError } = await supabase
                .from('workout_logs')
                .insert({
                    user_id: session.user.id,
                    workout_id: dashboardData.todayWorkout.id,
                    completed_at: new Date().toISOString(),
                    duration: dashboardData.todayWorkout.estimated_duration,
                    difficulty_rating: 3,
                    mood: 'good'
                });

            if (insertError) throw insertError;

            const userMetadata = session.user.user_metadata as UserMetadata;
            const userFullName = userMetadata?.full_name || session.user.email?.split('@')[0];

            toast({
                title: `Great work, ${userFullName}!`,
                description: "Your workout has been logged successfully.",
            });

            setDashboardData(prev => ({
                ...prev,
                hasLoggedToday: true
            }));

        } catch (error) {
            console.error('Workout logging error:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : 'Failed to log workout',
                variant: "destructive",
            });
        }
    };

    const handleLogRestDay = async (wasFollowed: boolean) => {
        if (!dashboardData.activePlan?.id || !session?.user?.id) {
            toast({
                title: "Error",
                description: "Missing required data. Please try again.",
                variant: "destructive",
            });
            return;
        }

        try {
            const { error } = await supabase
                .from('rest_day_logs')
                .insert({
                    user_id: session.user.id,
                    plan_id: dashboardData.activePlan.id,
                    rest_date: new Date().toISOString(),
                    was_followed: wasFollowed,
                });

            if (error) throw error;

            const userMetadata = session.user.user_metadata as UserMetadata;
            const userFullName = userMetadata?.full_name || session.user.email?.split('@')[0];
            
            toast({
                title: wasFollowed ? "Rest well!" : "Alternative workout logged!",
                description: `Keep up the good work, ${userFullName}!`,
            });

            setDashboardData(prev => ({
                ...prev,
                hasLoggedToday: true
            }));

        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : 'Failed to log rest day',
                variant: "destructive",
            });
        }
    };

    useEffect(() => {
        if (!session) {
            router.push('/auth');
            return;
        }

        fetchDashboardData().catch(console.error);

        return () => {
            abortControllerRef.current?.abort();
        };
    }, [session, router, fetchDashboardData]);

    if (!session) {
        return <LoadingState />;
    }

    if (loading) {
        return <LoadingSpinner />;
    }

    const userMetadata = session.user.user_metadata as UserMetadata;
    const userFullName = userMetadata?.full_name || session.user.email?.split('@')[0];
    const userEmail = session.user.email;

    const initialWeight = dashboardData.profile?.weight;
    const targetWeight = dashboardData.profile?.target_weight;
    const currentWeight = dashboardData.progressMetrics[dashboardData.progressMetrics.length - 1]?.weight;
    
    let weightProgress = 0;
    if (initialWeight && targetWeight && currentWeight) {
        weightProgress = targetWeight > initialWeight
            ? ((currentWeight - initialWeight) / (targetWeight - initialWeight)) * 100
            : ((initialWeight - currentWeight) / (initialWeight - targetWeight)) * 100;
    }

    return (
        <ErrorBoundary FallbackComponent={ErrorFallback} onReset={fetchDashboardData}>
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-20">
                <div className="fixed inset-0 overflow-hidden">
                    <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute top-1/3 -right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
                    <div className="absolute -bottom-1/4 left-1/3 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl animate-pulse delay-700" />
                </div>

                <div className="relative max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                    <div className="mb-12">
                        <div className="flex items-center gap-3">
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
                                Welcome back, {userFullName || userEmail}!
                            </h1>
                            <Sparkles className="w-6 h-6 text-blue-400" />
                        </div>
                        <p className="mt-2 text-blue-200/60">Your fitness journey continues</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <ActivityCard 
                            dashboardData={dashboardData}
                            handleLogWorkout={handleLogWorkout}
                            handleLogRestDay={handleLogRestDay}
                        />

                        <WeightProgressCard 
                            progressMetrics={dashboardData.progressMetrics}
                            weightProgress={weightProgress}
                        />

                        <BMITrackingCard 
                            progressMetrics={dashboardData.progressMetrics}
                        />
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    );
}

function LoadingState() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="mb-12">
                <Skeleton className="h-12 w-72 bg-gray-800/50" />
            </div>
            <div className="space-y-8">
                <Card className="bg-gray-800/30 border-gray-700/50">
                    <CardContent className="p-8">
                        <Skeleton className="h-10 w-56 mb-6 bg-gray-800/50" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="space-y-3">
                                    <Skeleton className="h-5 w-32 bg-gray-800/50" />
                                    <Skeleton className="h-12 w-full bg-gray-800/50" />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
    );
}

function LoadingSpinner() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
            <div className="absolute inset-0 blur-xl bg-blue-500/20 rounded-full animate-pulse" />
        </div>
    </div>
    );
}

interface ActivityCardProps {
    dashboardData: DashboardData;
    handleLogWorkout: () => Promise<void>;
    handleLogRestDay: (wasFollowed: boolean) => Promise<void>;
}

function ActivityCard({ dashboardData, handleLogWorkout, handleLogRestDay }: ActivityCardProps) {
    const session = useSession();
    const userMetadata = session?.user?.user_metadata as UserMetadata;
    const userFullName = userMetadata?.full_name || session?.user?.email?.split('@')[0];


    return (
        <Card className="bg-gray-800/30 border-gray-700/50 backdrop-blur-xl relative group overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <CardHeader>
            <CardTitle className="flex items-center gap-3 text-gray-100">
                <Activity className="h-6 w-6 text-blue-400" />
                Today&apos;s Activity
            </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
            {dashboardData.hasLoggedToday ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Trophy className="h-8 w-8 text-yellow-500" />
                        <p className="text-xl text-gray-100">
                            Amazing work today, {userFullName}! 🎉
                        </p>
                    </div>
                    <p className="text-blue-200/60">
                        Rest well and come back tomorrow for your next challenge!
                    </p>
                </div>
            ) : dashboardData.isRestDay ? (
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <Target className="h-8 w-8 text-purple-400" />
                        <p className="text-xl text-gray-100">
                            Today is your scheduled rest day! 🌟
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <Button 
                            onClick={() => handleLogRestDay(true)}
                            className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-100"
                        >
                            <Flame className="w-4 h-4 mr-2" />
                            Log Rest Day (Followed)
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => handleLogRestDay(false)}
                            className="border-blue-500/20 hover:bg-blue-500/10 text-blue-100"
                        >
                            Log Alternative Activity
                        </Button>
                    </div>
                </div>
            ) : dashboardData.todayWorkout ? (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-xl font-semibold text-gray-100 mb-2">
                            {dashboardData.todayWorkout.name}
                        </h3>
                        <p className="text-blue-200/60">
                            {dashboardData.todayWorkout.description}
                        </p>
                    </div>
                    <Button 
                        onClick={handleLogWorkout}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white"
                    >
                        <Flame className="w-4 h-4 mr-2" />
                        Log Today&apos;s Workout
                    </Button>
                </div>
            ) : (
                <p className="text-gray-300">No workout scheduled for today</p>
            )}
        </CardContent>
    </Card>
    );
}

interface WeightProgressCardProps {
    progressMetrics: ProgressMetric[];
    weightProgress: number;
}

function WeightProgressCard({ progressMetrics, weightProgress }: WeightProgressCardProps) {
    return (
        <Card className="bg-gray-800/30 border-gray-700/50 backdrop-blur-xl relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <CardHeader>
                <CardTitle className="flex items-center gap-3 text-gray-100">
                    <Weight className="h-6 w-6 text-blue-400" />
                    Weight Progress
                </CardTitle>
            </CardHeader>
            
            <CardContent>
                <div className="h-64">
                    {progressMetrics.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-400">
                            No weight data available yet
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart 
                                data={progressMetrics}
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis 
                                    dataKey="measurement_date" 
                                    tickFormatter={(date) => new Date(date).toLocaleDateString()}
                                    stroke="#9CA3AF"
                                    minTickGap={50}
                                />
                                <YAxis 
                                    domain={['auto', 'auto']}
                                    tickFormatter={(value) => `${value.toFixed(1)} kg`}
                                    stroke="#9CA3AF"
                                />
                                <Tooltip 
                                    contentStyle={{
                                        backgroundColor: 'rgba(17, 24, 39, 0.8)',
                                        border: '1px solid rgba(59, 130, 246, 0.2)',
                                        borderRadius: '0.5rem',
                                        backdropFilter: 'blur(4px)'
                                    }}
                                    labelStyle={{ color: '#E5E7EB' }}
                                    itemStyle={{ color: '#93C5FD' }}
                                    labelFormatter={(date) => new Date(date).toLocaleDateString()}
                                    formatter={(value) => [`${value.toFixed(1)} kg`, 'Weight']}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="weight" 
                                    stroke="#3B82F6"
                                    strokeWidth={2}
                                    dot={{
                                        stroke: '#3B82F6',
                                        strokeWidth: 2,
                                        r: 4,
                                        fill: '#1E3A8A'
                                    }}
                                    activeDot={{
                                        stroke: '#3B82F6',
                                        strokeWidth: 2,
                                        r: 6,
                                        fill: '#1E3A8A'
                                    }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
                <div className="mt-6 space-y-3">
                    <p className="text-sm text-blue-200/60">
                        Progress towards target
                    </p>
                    <div className="relative">
                        <div className="w-full bg-gray-700/50 rounded-full h-2">
                            <div 
                                className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                                style={{ width: `${Math.min(Math.max(weightProgress, 0), 100)}%` }}
                            />
                        </div>
                        <span className="absolute right-0 top-4 text-sm text-blue-200/60">
                            {weightProgress.toFixed(1)}%
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

interface BMITrackingCardProps {
    progressMetrics: ProgressMetric[];
}

function BMITrackingCard({ progressMetrics }: BMITrackingCardProps) {
    const getLatestBMI = () => {
        const latestMetric = progressMetrics[progressMetrics.length - 1];
        return latestMetric?.current_bmi || null;
    };

    const getBMIStatus = (bmi: number) => {
        if (bmi < 18.5) return { status: 'Underweight', color: 'text-blue-400' };
        if (bmi < 25) return { status: 'Healthy', color: 'text-green-400' };
        if (bmi < 30) return { status: 'Overweight', color: 'text-yellow-400' };
        return { status: 'Obese', color: 'text-red-400' };
    };

    const currentBMI = getLatestBMI();
    const bmiStatus = currentBMI ? getBMIStatus(currentBMI) : null;

    return (
        <Card className="bg-gray-800/30 border-gray-700/50 backdrop-blur-xl relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <CardHeader>
                <CardTitle className="flex items-center gap-3 text-gray-100">
                    <TrendingUp className="h-6 w-6 text-blue-400" />
                    BMI Tracking
                </CardTitle>
            </CardHeader>
            
            <CardContent>
                <div className="h-64">
                    {progressMetrics.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-400">
                            No BMI data available yet
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart 
                                data={progressMetrics}
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis 
                                    dataKey="measurement_date" 
                                    tickFormatter={(date) => new Date(date).toLocaleDateString()}
                                    stroke="#9CA3AF"
                                    minTickGap={50}
                                />
                                <YAxis 
                                    domain={[15, 35]}
                                    tickFormatter={(value) => value.toFixed(1)}
                                    stroke="#9CA3AF"
                                />
                                <Tooltip 
                                    contentStyle={{
                                        backgroundColor: 'rgba(17, 24, 39, 0.8)',
                                        border: '1px solid rgba(59, 130, 246, 0.2)',
                                        borderRadius: '0.5rem',
                                        backdropFilter: 'blur(4px)'
                                    }}
                                    labelStyle={{ color: '#E5E7EB' }}
                                    itemStyle={{ color: '#93C5FD' }}
                                    labelFormatter={(date) => new Date(date).toLocaleDateString()}
                                    formatter={(value) => [`${value.toFixed(1)}`, 'BMI']}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="current_bmi" 
                                    stroke="#3B82F6"
                                    strokeWidth={2}
                                    dot={{
                                        stroke: '#3B82F6',
                                        strokeWidth: 2,
                                        r: 4,
                                        fill: '#1E3A8A'
                                    }}
                                    activeDot={{
                                        stroke: '#3B82F6',
                                        strokeWidth: 2,
                                        r: 6,
                                        fill: '#1E3A8A'
                                    }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {currentBMI && bmiStatus && (
                    <div className="mt-6 space-y-3">
                        <p className="text-sm text-blue-200/60">
                            Current BMI Status
                        </p>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`h-3 w-3 rounded-full ${bmiStatus.color}`} />
                                <span className={`text-lg font-medium ${bmiStatus.color}`}>
                                    {bmiStatus.status}
                                </span>
                            </div>
                            <span className="text-lg font-medium text-gray-100">
                                {currentBMI.toFixed(1)}
                            </span>
                        </div>
                        <div className="mt-2">
                            <div className="w-full bg-gray-700/50 rounded-full h-2">
                                <div 
                                    className={`h-2 rounded-full ${
                                        bmiStatus.status === 'Healthy' 
                                            ? 'bg-gradient-to-r from-blue-500 to-green-500'
                                            : 'bg-gradient-to-r from-blue-500 to-purple-500'
                                    }`}
                                    style={{ 
                                        width: `${Math.min(Math.max((currentBMI / 35) * 100, 0), 100)}%` 
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-4 grid grid-cols-4 gap-2">
                    <div className="text-center p-2 rounded-lg bg-gray-700/20">
                        <div className="text-xs text-gray-400">Underweight</div>
                        <div className="text-sm text-gray-300">&lt;18.5</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-gray-700/20">
                        <div className="text-xs text-gray-400">Healthy</div>
                        <div className="text-sm text-gray-300">18.5-24.9</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-gray-700/20">
                        <div className="text-xs text-gray-400">Overweight</div>
                        <div className="text-sm text-gray-300">25-29.9</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-gray-700/20">
                        <div className="text-xs text-gray-400">Obese</div>
                        <div className="text-sm text-gray-300">&gt;30</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
