import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing authentication...');
  const processingRef = useRef(false);

  const handleAuthCallback = useCallback(async () => {
    // Prevent multiple simultaneous auth callback processing
    if (processingRef.current) {
      console.log('🔄 Auth callback already in progress, skipping...');
      return;
    }
    processingRef.current = true;
    
    try {
      console.log('🔍 Starting auth callback process...');
      console.log('📍 Current URL:', window.location.href);
      console.log('🔍 URL parameters:', window.location.search);
      
      let session = null;
      
      // Check if this is a Google OAuth callback with a code
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      
      if (code) {
        console.log('🔑 OAuth code detected, exchanging for session...');
        setStatus('Completing OAuth sign-in...');
        
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          console.error('❌ Code exchange error:', error);
          setStatus('OAuth authentication failed. Please try signing in again.');
          setTimeout(() => navigate('/'), 2000);
          return;
        }
        
        session = data?.session;
        console.log('✅ OAuth code exchange successful');
      } else {
        // Not OAuth - try regular session retrieval
        console.log('🔍 No OAuth code, checking for session...');
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          setStatus('Authentication failed. Please try signing in again.');
          setTimeout(() => navigate('/'), 2000);
          return;
        }
        
        session = sessionData?.session;
      }
      
      if (!session) {
        console.error('❌ No valid session found');
        setStatus('No valid session found. Please sign in again.');
        setTimeout(() => navigate('/'), 2000);
        return;
      }

      const user = session.user;
      console.log('✅ Got user from session:', user.email);
      setStatus('Checking user status...');

      // Now that we have an authenticated session, check roles with RLS-permitted queries
      // Check if user is an admin
      let isAdmin = false;
      try {
        console.log('🔍 Checking admin status with authenticated query...');
        const { data: adminData, error: adminError } = await supabase
          .from('admins')
          .select('*')
          .eq('email', user.email)
          .maybeSingle();

        if (adminError) {
          console.log('⚠️ Admin check error:', adminError);
          // Don't fail - just not an admin
        } else if (adminData) {
          console.log('👑 User is admin, caching and redirecting to admin dashboard');
          isAdmin = true;
          
          // Cache admin status
          const adminCacheData = {
            isAdmin: true,
            email: user.email,
            timestamp: Date.now()
          };
          localStorage.setItem('cachedAdminStatus', JSON.stringify(adminCacheData));
          
          // Cache user data
          const adminUserData = {
            ...adminData,
            is_admin: true,
            email: user.email,
            id: user.id,
            created_at: user.created_at
          };
          localStorage.setItem('cachedUser', JSON.stringify(adminUserData));
          
          setStatus('Admin access granted. Redirecting...');
          window.location.href = '/admin';
          return;
        } else {
          console.log('👤 User is not an admin');
        }
      } catch (tableError) {
        console.log('⚠️ Admin table error:', tableError);
        // Don't fail - just not an admin
      }

      if (isAdmin) return;

      // Check if user exists in users table with authenticated query
      let userExists = false;
      let userData = null;
      try {
        console.log('🔍 Checking if user exists in users table with authenticated query...');
        const { data: dbUserData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', user.email)
          .maybeSingle();

        if (userError) {
          console.error('❌ Error checking user existence:', userError);
          // Don't fail completely - we'll create the user
        } else if (dbUserData) {
          console.log('✅ User exists in database');
          userExists = true;
          userData = dbUserData;
        } else {
          console.log('📝 User not found in database, will create new user');
        }
      } catch (tableError) {
        console.error('❌ Error checking users table:', tableError);
        // Don't fail - we'll try to create the user
      }

      if (userExists) {
        // Cache existing user data
        const cachedUserData = {
          ...userData,
          email: user.email,
          id: userData.id,
          created_at: userData.created_at
        };
        localStorage.setItem('cachedUser', JSON.stringify(cachedUserData));
        
        setStatus('Access granted. Redirecting to dashboard...');
        window.location.href = '/dashboard';
        return;
      }

      // New user - create account
      try {
        console.log('📝 Creating new user account...');
        const { error: insertError } = await supabase
          .from('users')
          .insert([{
            id: user.id, // Use the auth user ID
            email: user.email,
            full_name: user.user_metadata?.full_name || null,
            avatar_url: user.user_metadata?.avatar_url || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);

        if (insertError) {
          if (insertError.code === '23505') {
            // Duplicate key error - user already exists, that's fine
            console.log('✅ User already exists (duplicate key)');
            
            // Try to get the existing user data
            const { data: existingUser, error: getError } = await supabase
              .from('users')
              .select('*')
              .eq('email', user.email)
              .maybeSingle();
              
            if (!getError && existingUser) {
              const cachedUserData = {
                ...existingUser,
                email: user.email,
                id: existingUser.id,
                created_at: existingUser.created_at
              };
              localStorage.setItem('cachedUser', JSON.stringify(cachedUserData));
            }
            
            setStatus('Account found. Redirecting to dashboard...');
            // Force a hard navigation to ensure immediate redirect
            window.location.href = '/dashboard';
            return;
          } else {
            console.error('❌ Error creating user account:', insertError);
            throw insertError;
          }
        }

        console.log('✅ User account created successfully');
        
        // Cache the new user data
        const newUserData = {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        localStorage.setItem('cachedUser', JSON.stringify(newUserData));
        
        setStatus('Account created! Redirecting to dashboard...');
        // Force a hard navigation to ensure immediate redirect
        window.location.href = '/dashboard';
        return;
      } catch (insertError) {
        console.error('❌ Critical error creating user account:', insertError);
        setStatus(`Error creating account: ${insertError.message}. Please contact support.`);
        setTimeout(() => navigate('/'), 2000);
        return;
      }

    } catch (error) {
      console.error('❌ Critical auth callback error:', error);
      
      // Handle specific error cases
      if (error.message?.includes('token is invalid or has expired')) {
        setStatus('Magic link has expired. Please request a new one.');
      } else if (error.message?.includes('No session')) {
        setStatus('Session verification failed. Please try signing in again.');
      } else {
        setStatus(`Authentication failed: ${error.message}`);
      }
      
      setTimeout(() => navigate('/'), 2000);
    } finally {
      processingRef.current = false;
    }
  }, [navigate]);

  useEffect(() => {
    // Just run the callback immediately - don't wait for auth state changes
    handleAuthCallback();
  }, [handleAuthCallback]);

  return (
    <div className="auth-callback">
      <div className="auth-callback-content">
        <div className="loading-spinner"></div>
        <p>{status}</p>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
          URL: {window.location.href}
        </p>
      </div>
    </div>
  );
}

export default AuthCallback; 