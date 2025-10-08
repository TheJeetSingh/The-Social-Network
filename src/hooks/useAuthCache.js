import { useCallback } from 'react';
import { supabase } from '../supabaseClient';

/**
 * Centralized authentication cache management hook
 * Handles clearing local storage and signing out properly
 */
export function useAuthCache() {
  const clearAuthCache = useCallback(async () => {
    try {
      console.log('🧹 Clearing authentication cache...');
      
      // Clear all auth-related localStorage items
      const authKeys = [
        'cachedUser',
        'cachedAdminStatus',
        'user',
        'user_profile',
        'user_preferences',
        'auth_token',
        'refresh_token'
      ];
      
      authKeys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
      
      console.log('✅ Authentication cache cleared and user signed out');
      return true;
    } catch (error) {
      console.error('❌ Error clearing auth cache:', error);
      return false;
    }
  }, []);

  return { clearAuthCache };
}

export default useAuthCache;
