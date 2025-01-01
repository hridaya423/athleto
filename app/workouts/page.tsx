'use client'
import React from 'react';
import WorkoutPlanGenerator from "@/components/plangenerator";
import WorkoutPlansDisplay from "@/components/planview";
import { Dumbbell } from 'lucide-react';

export default function Workouts() {
    return (
        <main className="min-h-screen bg-black relative overflow-hidden" aria-label="Workout Planning Dashboard">
            <div 
                className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-purple-900/20 to-blue-900/30 transition-opacity duration-1000"
                aria-hidden="true"
            />
            
            <div className="absolute inset-0" aria-hidden="true">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl animate-pulse duration-3000" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse duration-3000 delay-1000" />
                <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-indigo-500/20 rounded-full blur-2xl animate-pulse duration-2000" />
            </div>

            <div className="relative container mx-auto px-6 max-w-6xl py-16 space-y-16">
                <header className="relative group transition-transform duration-300 hover:scale-102">
                    <div 
                        className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl opacity-25 
                        group-hover:opacity-75 transition-all duration-500 blur group-hover:blur-md"
                        aria-hidden="true"
                    />
                    <div className="relative flex items-center gap-4 p-4 backdrop-blur-sm rounded-lg">
                        <Dumbbell className="h-10 w-10 text-blue-400 group-hover:text-blue-300 transition-colors duration-300" />
                        <div>
                            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 
                            tracking-tight pb-2">
                                Forge Your Fitness Journey
                            </h1>
                            <p className="text-blue-200/90 text-lg">
                                Craft and track your personalized workout odyssey
                            </p>
                        </div>
                    </div>
                </header>

                <div className="space-y-16">
                    <section className="backdrop-blur-sm bg-black/20 rounded-xl p-6 shadow-xl">
                        <WorkoutPlanGenerator />
                    </section>
                    <section className="backdrop-blur-sm bg-black/20 rounded-xl p-6 shadow-xl">
                        <WorkoutPlansDisplay />
                    </section>
                </div>
            </div>
        </main>
    );
}