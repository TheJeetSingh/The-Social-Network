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

  // Load cached admin status on initial load
  useEffect(() => {
    const cachedAdminStatus = localStorage.getItem('cachedAdminStatus');
    if (cachedAdminStatus) {
      try {
        const parsedStatus = JSON.parse(cachedAdminStatus);
        // Check if cache is still valid (within 5 minutes)
        const cacheAge = Date.now() - (parsedStatus.timestamp || 0);
        if (cacheAge < 5 * 60 * 1000) {
          setIsAdmin(parsedStatus.isAdmin);
        } else {
          console.log('Admin cache expired, will recheck');
          localStorage.removeItem('cachedAdminStatus');
        }
      } catch (error) {
        console.warn('Failed to parse cached admin status:', error);
        localStorage.removeItem('cachedAdminStatus');
      }
    }
  }, []);

  useEffect(() => {
    checkAdmin();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkAdmin();
    });

    return () => {
      if (authListener) authListener.subscription.unsubscribe();
    };
  }, []);

  async function checkAdmin() {
    try {
      // Use authenticated session to check admin status
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        localStorage.removeItem('cachedAdminStatus');
        return;
      }

      console.log('🔍 Checking admin status with authenticated query for:', user.email);
      
      // Now that we have an authenticated user, query with RLS permissions
      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (adminError) {
        console.log('⚠️ Admin check error:', adminError);
        // Try to use cached admin status if query fails
        const cachedAdminStatus = localStorage.getItem('cachedAdminStatus');
        if (cachedAdminStatus) {
          try {
            const parsedStatus = JSON.parse(cachedAdminStatus);
            const cacheAge = Date.now() - (parsedStatus.timestamp || 0);
            if (parsedStatus.email === user.email && cacheAge < 5 * 60 * 1000) {
              console.log('Using cached admin status due to query error');
              setIsAdmin(parsedStatus.isAdmin);
              return;
            }
          } catch (error) {
            console.warn('Failed to parse cached admin status:', error);
          }
        }
        
        // Fallback to false if no valid cache
        setIsAdmin(false);
        return;
      }

      const adminStatus = !!adminData;
      setIsAdmin(adminStatus);
      
      // Cache the admin status with timestamp
      localStorage.setItem('cachedAdminStatus', JSON.stringify({
        isAdmin: adminStatus,
        email: user.email,
        timestamp: Date.now()
      }));
      
      console.log(`✅ Admin status cached: ${adminStatus ? 'is admin' : 'not admin'}`);
    } catch (error) {
      console.error('❌ Error checking admin status:', error);
      setIsAdmin(false);
      localStorage.removeItem('cachedAdminStatus');
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