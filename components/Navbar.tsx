/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'
import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Menu, X, User, Dumbbell, Home, LogOut, LogIn,  } from 'lucide-react';
import { useRouter } from 'next/navigation';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeItem, setActiveItem] = useState('');
  const supabase = useSupabaseClient();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  const handleSignIn = () => {
    router.push('/auth');
  };

  const navigationItems = [
    { name: 'Home', href: '/dashboard', icon: Home },
    { name: 'Workouts', href: '/workouts', icon: Dumbbell },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  return (
    <>
      <div className="fixed top-0 left-0 w-full">
        <div className="absolute inset-0 h-16 bg-black/95" />
        <div className="absolute inset-0 h-16 bg-gradient-to-r from-blue-900/20 via-purple-900/20 to-blue-900/20" />
        <div className="absolute inset-0 h-16">
          <div className="absolute top-0 left-1/4 w-96 h-full bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute top-0 right-1/4 w-96 h-full bg-purple-500/10 rounded-full blur-3xl" />
        </div>
      </div>

      <nav className={`fixed w-full top-0 z-50 transition-all duration-300`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button 
                onClick={() => router.push('/')}
                className="flex-shrink-0 flex items-center group relative"
              >
                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-white animate-gradient">
                  Athleto
                </span>
              </button>
            </div>

            <div className="hidden md:flex md:items-center md:space-x-1">
              {isLoggedIn && navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeItem === item.name;
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      router.push(item.href);
                      setActiveItem(item.name);
                    }}
                    className={`flex items-center px-4 py-2 rounded-lg transition-all duration-300 group relative
                      ${isActive 
                        ? 'text-blue-300 bg-blue-900/50' 
                        : 'text-gray-300 hover:text-blue-300 hover:bg-blue-900/30'
                      }`}
                  >
                    <Icon className={`h-5 w-5 mr-2 transition-all duration-300 ${
                      isActive ? 'scale-110' : 'group-hover:scale-110'
                    }`} />
                    <span className="font-medium">{item.name}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-0 h-0.5 w-full bg-gradient-to-r from-blue-600 to-purple-600 transform origin-left" />
                    )}
                  </button>
                );
              })}
              
              {isLoggedIn ? (
                <button
                  onClick={handleSignOut}
                  className="flex items-center px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-all duration-300 group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 to-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <LogOut className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-medium relative z-10">Sign Out</span>
                </button>
              ) : (
                <button
                  onClick={handleSignIn}
                  className="flex items-center px-6 py-2 rounded-lg relative group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />
                  <LogIn className="h-5 w-5 mr-2 text-white relative z-10 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-medium text-white relative z-10">Sign In</span>
                </button>
              )}
            </div>

            <div className="flex md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center justify-center p-2 rounded-lg relative group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                {isOpen ? (
                  <X className="block h-6 w-6 text-gray-700 group-hover:text-blue-600 transition-colors duration-300" />
                ) : (
                  <Menu className="block h-6 w-6 text-gray-700 group-hover:text-blue-600 transition-colors duration-300" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className={`md:hidden absolute w-full bg-black/95 backdrop-blur-xl border-t border-gray-800 transform transition-all duration-300 origin-top ${
          isOpen ? 'scale-y-100 opacity-100' : 'scale-y-95 opacity-0 pointer-events-none'
        }`}>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-purple-900/20 to-blue-900/20" />
          <div className="absolute inset-0">
            <div className="absolute top-0 left-1/4 w-96 h-full bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute top-0 right-1/4 w-96 h-full bg-purple-500/10 rounded-full blur-3xl" />
          </div>
          <div className="px-2 pt-2 pb-3 space-y-1">
            {isLoggedIn && navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    router.push(item.href);
                    setActiveItem(item.name);
                    setIsOpen(false);
                  }}
                  className={`flex items-center w-full px-4 py-3 rounded-lg transition-all duration-300 group relative
                    ${isActive 
                      ? 'text-blue-300 bg-blue-900/50' 
                      : 'text-gray-300 hover:text-blue-300 hover:bg-blue-900/30'
                    }`}
                >
                  <Icon className={`h-5 w-5 mr-2 transition-all duration-300 ${
                    isActive ? 'scale-110' : 'group-hover:scale-110'
                  }`} />
                  <span className="font-medium">{item.name}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-0 h-0.5 w-full bg-gradient-to-r from-blue-600 to-purple-600 transform origin-left" />
                  )}
                </button>
              );
            })}
            
            {isLoggedIn ? (
              <button
                onClick={() => {
                  handleSignOut();
                  setIsOpen(false);
                }}
                className="flex items-center w-full px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-all duration-300 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 to-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <LogOut className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform duration-300" />
                <span className="font-medium relative z-10">Sign Out</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  handleSignIn();
                  setIsOpen(false);
                }}
                className="flex items-center w-full px-4 py-3 rounded-lg relative group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 transition-transform duration-300 group-hover:scale-105" />
                <LogIn className="h-5 w-5 mr-2 text-white relative z-10 group-hover:scale-110 transition-transform duration-300" />
                <span className="font-medium text-white relative z-10">Sign In</span>
              </button>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;