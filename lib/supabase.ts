import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export const loginWithGoogle = async () => {
  const supabase = createClientComponentClient();
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error logging in with Google:', error);
    throw error;
  }
};