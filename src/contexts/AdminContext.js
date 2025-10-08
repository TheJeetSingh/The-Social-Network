import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuthCache } from '../hooks/useAuthCache';

const AdminContext = createContext({});

export function useAdmin() {
  return useContext(AdminContext);
}

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { clearAuthCache } = useAuthCache();

  useEffect(() => {
    checkAdmin();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkAdmin();
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  async function checkAdmin() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data: adminData } = await supabase
        .from('admins')
        .select('email')
        .eq('email', user.email)
        .maybeSingle();

      setIsAdmin(!!adminData);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }

  const value = {
    isAdmin,
    loading,
    clearCache: clearAuthCache // Use the centralized cache clearing helper
  };

  return (
    <AdminContext.Provider value={value}>
      {!loading && children}
    </AdminContext.Provider>
  );
} 