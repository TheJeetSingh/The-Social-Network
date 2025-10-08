import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuthCache } from '../hooks/useAuthCache';

const UserContext = createContext({});

export function useUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { clearAuthCache } = useAuthCache();

  // Simplified user check function
  const checkUser = async () => {
    try {
      console.log('🔍 Checking user authentication...');
      
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        setUser(null);
        setLoading(false);
        return;
      }

      if (!session) {
        console.log('❌ No active session found');
        setUser(null);
        setLoading(false);
        return;
      }

      console.log('✅ Session found for user:', session.user.email);

      // Try to get user data from our database
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.user.email)
          .maybeSingle();

        if (userError) {
          console.warn('Database query error:', userError);
          // Use basic user data if database query fails
          const basicUser = {
            id: session.user.id,
            email: session.user.email,
            username: null,
            full_name: null,
            avatar_url: null,
            created_at: session.user.created_at
          };
          setUser(basicUser);
        } else if (userData) {
          console.log('✅ User data found in database');
          setUser(userData);
        } else {
          console.log('❌ User not found in database');
          setUser(null);
        }
      } catch (dbError) {
        console.warn('Database error:', dbError);
        // Use basic user data if database is unavailable
        const basicUser = {
          id: session.user.id,
          email: session.user.email,
          username: null,
          full_name: null,
          avatar_url: null,
          created_at: session.user.created_at
        };
        setUser(basicUser);
      }
    } catch (error) {
      console.error('Error checking user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Set up auth state listener
  useEffect(() => {
    console.log('🔧 Setting up auth state listener...');
    
    // Initial check
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.email);
      
      if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out');
        setUser(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log('✅ User signed in or token refreshed');
        checkUser();
      }
    });

    return () => {
      console.log('🧹 Cleaning up auth state listener');
      subscription?.unsubscribe();
    };
  }, []);

  const value = {
    user,
    loading,
    clearCache: clearAuthCache // Use the centralized cache clearing helper
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
} 