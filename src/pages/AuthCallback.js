import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing authentication...');

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      // Get session - Supabase automatically handles OAuth code exchange
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        console.error('Auth error:', error);
        setStatus('Authentication failed. Redirecting...');
        setTimeout(() => navigate('/'), 2000);
        return;
      }

      const user = session.user;
      setStatus('Checking user status...');

      // Check if admin
      const { data: adminData } = await supabase
        .from('admins')
        .select('email')
        .eq('email', user.email)
        .maybeSingle();

      if (adminData) {
        localStorage.setItem('cachedAdminStatus', JSON.stringify({
          isAdmin: true,
          email: user.email,
          timestamp: Date.now()
        }));
        setStatus('Admin access granted...');
        window.location.href = '/admin';
        return;
      }

      // Check if user exists
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (userData) {
        localStorage.setItem('cachedUser', JSON.stringify(userData));
        setStatus('Access granted...');
        window.location.href = '/dashboard';
        return;
      }

      // Create new user
      await supabase.from('users').insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name,
        avatar_url: user.user_metadata?.avatar_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const newUserData = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name,
        avatar_url: user.user_metadata?.avatar_url
      };
      localStorage.setItem('cachedUser', JSON.stringify(newUserData));
      
      setStatus('Account created!');
      window.location.href = '/dashboard';
      
    } catch (error) {
      console.error('Auth error:', error);
      setStatus('Authentication failed. Redirecting...');
      setTimeout(() => navigate('/'), 2000);
    }
  };

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