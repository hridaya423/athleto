/* eslint-disable prefer-const */
import React, { useState, useEffect } from 'react';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import type { Database } from '@/types/supabase';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2, User, Activity, Clock, Heart, Scale, Target, Calendar } from 'lucide-react';
import type { PostgrestError } from '@supabase/supabase-js';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';


const fitnessLevels: FitnessLevel[] = ['beginner', 'intermediate', 'advanced'];
const activityLevels: ActivityLevel[] = ['sedentary', 'lightly_active', 'moderately_active', 'very_active'];

const defaultProfile: Profile = {
  id: '',
  full_name: null,
  avatar_url: null,
  height: null,
  weight: null,
  age: null,
  gender: null,
  fitness_level: null,
  activity_level: null,
  current_bmi: null,
  target_weight: null,
  medical_conditions: null,
  has_completed_onboarding: false,
  updated_at: new Date().toISOString(),
  preferred_workout_time: null,
  available_equipment: null
};

export default function ProfilePage() {
  const session = useSession();
  const supabase = useSupabaseClient<Database>();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profile, setProfile] = useState<Profile>(defaultProfile);

  useEffect(() => {
    async function fetchOrCreateProfile() {
      try {
        setLoading(true);
        if (!session?.user?.id) return;

        let { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (fetchError && fetchError.code === 'PGRST116') {
          const { error: insertError } = await supabase.auth.updateUser({
            data: {
              full_name: session.user.user_metadata.full_name,
              avatar_url: session.user.user_metadata.avatar_url
            }
          });

          if (insertError) throw insertError;

          const { data: newProfile, error: refetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (refetchError) throw refetchError;
          data = newProfile;
        } else if (fetchError) {
          throw fetchError;
        }

        if (data) {
          setProfile(data);
        }
      } catch (error) {
        const pgError = error as PostgrestError;
        console.error('Error fetching profile:', pgError);
        setMessage({ 
          type: 'error', 
          text: `Failed to load profile data: ${pgError.message || 'Unknown error'}`
        });
      } finally {
        setLoading(false);
      }
    }

    fetchOrCreateProfile();
  }, [session, supabase]);

  useEffect(() => {
    if (profile.height && profile.weight) {
      const heightInMeters = Number(profile.height) / 100;
      const bmi = Number(profile.weight) / (heightInMeters * heightInMeters);
      setProfile(prev => ({ ...prev, current_bmi: Math.round(bmi * 10) / 10 }));
    }
  }, [profile.height, profile.weight]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    
    try {
      if (!session?.user?.id) {
        setMessage({ type: 'error', text: 'Please sign in to update your profile' });
        return;
      }

      const updateData: ProfileUpdate = {
        full_name: profile.full_name,
        height: profile.height,
        weight: profile.weight,
        age: profile.age,
        gender: profile.gender,
        fitness_level: profile.fitness_level,
        activity_level: profile.activity_level,
        current_bmi: profile.current_bmi,
        target_weight: profile.target_weight,
        medical_conditions: profile.medical_conditions,
        preferred_workout_time: profile.preferred_workout_time,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', session.user.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
      const pgError = error as PostgrestError;
      console.error('Error updating profile:', pgError);
      setMessage({ 
        type: 'error', 
        text: `Error updating profile: ${pgError.message || 'Please try again'}`
      });
    } finally {
      setSaving(false);
    }
  };
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-400"></div>
          <div className="absolute inset-0 animate-pulse blur-xl bg-blue-500/30 rounded-full"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Alert className="max-w-lg bg-gray-900/80 border border-blue-500/20 text-blue-100">
          <AlertDescription className="text-lg">Please sign in to view and edit your profile.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden p-20">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-blue-900/20"></div>
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      <form onSubmit={handleSubmit} className="relative container mx-auto px-4 max-w-4xl py-12 space-y-8 ">
        <Card className="bg-gray-900/80 border border-blue-500/20 backdrop-blur-xl">
          <CardHeader className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg opacity-25 group-hover:opacity-50 transition duration-500 blur"></div>
            <div className="relative flex items-center gap-3">
              <User className="h-8 w-8 text-blue-400" />
              <div>
                <CardTitle className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                  Your Divine Profile
                </CardTitle>
                <CardDescription className="text-blue-200/80">
                  Forge your legendary journey
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 group">
                <Label className="text-blue-100">Full Name</Label>
                <div className="relative">
                  <Input
                    value={profile.full_name || ''}
                    onChange={e => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                    className="bg-gray-800/50 border-blue-500/20 text-blue-100 focus:border-blue-400 focus:ring-blue-400/50 pl-10"
                  />
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-blue-100 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-400" /> Age
                </Label>
                <Input
                  type="number"
                  value={profile.age || ''}
                  onChange={e => setProfile(prev => ({ ...prev, age: e.target.value ? Number(e.target.value) : null }))}
                  min="13"
                  max="120"
                  className="bg-gray-800/50 border-blue-500/20 text-blue-100 focus:border-blue-400 focus:ring-blue-400/50"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-blue-100 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-blue-400" /> Height (cm)
                </Label>
                <Input
                  type="number"
                  value={profile.height || ''}
                  onChange={e => setProfile(prev => ({ ...prev, height: e.target.value ? Number(e.target.value) : null }))}
                  step="0.1"
                  className="bg-gray-800/50 border-blue-500/20 text-blue-100 focus:border-blue-400 focus:ring-blue-400/50"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-blue-100 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-blue-400" /> Weight (kg)
                </Label>
                <Input
                  type="number"
                  value={profile.weight || ''}
                  onChange={e => setProfile(prev => ({ ...prev, weight: e.target.value ? Number(e.target.value) : null }))}
                  step="0.1"
                  className="bg-gray-800/50 border-blue-500/20 text-blue-100 focus:border-blue-400 focus:ring-blue-400/50"
                />
              </div>

              {profile.current_bmi && (
                <div className="space-y-3">
                  <Label className="text-blue-100 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-400" /> Current BMI
                  </Label>
                  <div className="h-10 px-4 py-2 rounded-md border border-blue-500/20 bg-gray-800/50 text-blue-100">
                    {profile.current_bmi}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-blue-100 flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-400" /> Target Weight (kg)
                </Label>
                <Input
                  type="number"
                  value={profile.target_weight || ''}
                  onChange={e => setProfile(prev => ({ ...prev, target_weight: e.target.value ? Number(e.target.value) : null }))}
                  step="0.1"
                  className="bg-gray-800/50 border-blue-500/20 text-blue-100 focus:border-blue-400 focus:ring-blue-400/50"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-blue-100 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-400" /> Fitness Level
                </Label>
                <Select
                  value={profile.fitness_level || ''}
                  onValueChange={(value) => setProfile(prev => ({ ...prev, fitness_level: value }))}
                >
                  <SelectTrigger className="bg-gray-800/50 border-blue-500/20 text-blue-100">
                    <SelectValue placeholder="Select fitness level" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-blue-500/20">
                    {fitnessLevels.map(level => (
                      <SelectItem key={level} value={level} className="text-blue-100 hover:bg-blue-500/20 capitalize">
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-blue-100 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-400" /> Activity Level
                </Label>
                <Select
                  value={profile.activity_level || ''}
                  onValueChange={(value) => setProfile(prev => ({ ...prev, activity_level: value }))}
                >
                  <SelectTrigger className="bg-gray-800/50 border-blue-500/20 text-blue-100">
                    <SelectValue placeholder="Select activity level" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-blue-500/20">
                    {activityLevels.map(level => (
                      <SelectItem key={level} value={level} className="text-blue-100 hover:bg-blue-500/20">
                        {level.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-blue-100 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-400" /> Preferred Workout Time
                </Label>
                <Input
                  type="time"
                  value={profile.preferred_workout_time || ''}
                  onChange={e => setProfile(prev => ({ ...prev, preferred_workout_time: e.target.value }))}
                  className="bg-gray-800/50 border-blue-500/20 text-blue-100 focus:border-blue-400 focus:ring-blue-400/50"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-blue-100 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-blue-400" /> Medical Conditions
                </Label>
                <Input
                  value={profile.medical_conditions?.join(', ') || ''}
                  onChange={e => setProfile(prev => ({ 
                    ...prev, 
                    medical_conditions: e.target.value ? e.target.value.split(',').map(s => s.trim()) : null 
                  }))}
                  placeholder="Separate conditions with commas"
                  className="bg-gray-800/50 border-blue-500/20 text-blue-100 focus:border-blue-400 focus:ring-blue-400/50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="relative group px-8 py-3 rounded-xl"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-500"></div>
            <div className="relative flex items-center justify-center gap-2 text-white font-bold">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'Inscribing...' : 'Save Legend'}
            </div>
          </button>
        </div>

        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'} 
                className="bg-gray-900/80 border border-blue-500/20 text-blue-100">
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}
      </form>
    </div>
  );
};
