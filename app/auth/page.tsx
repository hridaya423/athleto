'use client'
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { loginWithGoogle } from '@/lib/supabase';

export default function Auth() {
    const router = useRouter();
    const supabase = createClientComponentClient();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkUser = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    router.push('/dashboard');
                }
            } catch (error) {
                console.error('Auth check error:', error);
            } finally {
                setLoading(false);
            }
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                router.push('/dashboard');
            }
        });

        checkUser();

        return () => {
            subscription.unsubscribe();
        };
    }, [router, supabase]);

    const handleGoogleLogin = async () => {
        try {
            await loginWithGoogle()
        } catch (error) {
            console.error('Login error:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="relative">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-400"></div>
                    <div className="absolute inset-0 animate-pulse blur-xl bg-blue-500/30 rounded-full"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen bg-black overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-blue-900/20"></div>
            <div className="absolute inset-0 bg-cover bg-center opacity-5"></div>

            <div className="absolute inset-0">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-700"></div>
                <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
            </div>

            <div className="relative min-h-screen">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12 md:pt-32 md:pb-20">
                    <div className="relative flex justify-center mb-16">
                        <div className="relative">
                            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-xl opacity-75 animate-pulse"></div>
                            <h1 className="relative text-7xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-white animate-gradient">
                                ATHLETO
                            </h1>
                        </div>
                    </div>

                    <div className="text-center max-w-5xl mx-auto">
                        <h2 className="text-5xl md:text-7xl font-extrabold mb-8">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-white to-purple-300">
                                Ascend to Greatness
                            </span>
                        </h2>
                        <p className="text-2xl md:text-3xl text-blue-100 mb-12 font-light">
                            Where legends are forged and limits are transcended
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                            {[
                                {
                                    icon: "💫",
                                    title: "Divine Training",
                                    description: "Workouts crafted by fitness angels"
                                },
                                {
                                    icon: "⚡",
                                    title: "Mythical Progress",
                                    description: "Log your workouts daily on the dashboard!"
                                },
                                {
                                    icon: "⚔️",
                                    title: "Battle-Tested Methods",
                                    description: "Proven techniques for peak performance"
                                }
                            ].map((feature, index) => (
                                <div key={index} className="group relative">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-500"></div>
                                    <div className="relative p-8 bg-gray-900 ring-1 ring-gray-800/50 rounded-xl transform transition duration-500 hover:scale-105">
                                        <div className="text-3xl mb-4">{feature.icon}</div>
                                        <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                                        <p className="text-blue-200">{feature.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="max-w-md mx-auto relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-500"></div>
                            
                            <button
                                onClick={handleGoogleLogin}
                                className="relative w-full flex items-center justify-center px-8 py-5 text-lg font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transform transition-all duration-500 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25"
                            >
                                <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24">
                                    <path
                                        fill="currentColor"
                                        d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                                    />
                                </svg>
                                Begin Your Legendary Journey
                            </button>
                        </div>

                        <div className="mt-16 text-xl text-blue-200 font-light italic">
                            &quot;Strength does not come from the body. It comes from the will within.&quot;
                        </div>
                    </div>
                </div>

                <footer className="relative mt-20">
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="text-center text-blue-300/60">
                            <p>© 2025 Athleto. Forging legends daily.</p>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}