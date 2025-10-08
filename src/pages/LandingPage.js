import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const navigate = useNavigate();
  const { user, loading } = useUser();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Auto-redirect if user is already logged in
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      // Get session using the correct API
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      // If we have a valid session, enable the button
      setHasSession(!!session?.user);
      
      // Set up auth state change listener
      supabase.auth.onAuthStateChange((event, session) => {
        setHasSession(!!(session?.user));
      });
    } catch (error) {
      console.error('Error checking session:', error);;
      setHasSession(false);
    }
  };

  // Google OAuth sign-in handler
  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setStatus('');
    setMessage('');

    try {
      // Clear any existing session
      await supabase.auth.signOut();

      // Let Supabase handle OAuth - no pre-checks needed
      console.log('Initiating Google OAuth sign-in...');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth-callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('Google OAuth error:', error);
        throw error;
      }

      // The redirect will happen automatically
      setStatus('info');
      setMessage('Redirecting to Google...');
    } catch (error) {
      console.error('Google OAuth error:', error);
      setStatus('error');
      setMessage('Failed to sign in with Google. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus('');
    setMessage('');

    try {
      // Clear any existing session
      await supabase.auth.signOut();

      // Let Supabase own the sign-in flow - no pre-checks!
      // The auth callback will determine admin vs user after session is established
      console.log('Sending magic link to:', email);
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth-callback`,
          shouldCreateUser: true, // Allow new users to be created
        },
      });

      if (signInError) {
        console.error('Error sending magic link:', signInError);
        throw signInError;
      }

      setStatus('success');
      setMessage('Magic link sent! Check your email to sign in.');
      setEmail('');

    } catch (error) {
      console.error('Error:', error);
      setStatus('error');
      setMessage('Something went wrong. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="main-content">
      <h1 className="main-header">Welcome to the Other Side</h1>
      <h2 className="sub-header">Not Everyone Get's In</h2>
      
      <div className="landing-actions">
        {hasSession && (
          <div className="action-section">
            <button 
              onClick={async () => {
                try {
                  // Get current session
                  const { data: { session }, error } = await supabase.auth.getSession();
                  if (error) throw error;
                  
                  if (session?.user) {
                    navigate('/dashboard');
                  } else {
                    setMessage('Session expired. Please sign in again.');
                    setStatus('error');
                    setHasSession(false);
                  }
                } catch (error) {
                  console.error('Error accessing dashboard:', error);
                  setMessage('Error accessing dashboard. Please try signing in again.');
                  setStatus('error');
                  setHasSession(false);
                }
              }}
              className="dashboard-button"
            >
              Access Your Dashboard
            </button>
          </div>
        )}
        
        <div className="action-section">
          <h3 className="action-title">Sign In or Create Account</h3>
          
          {/* Google OAuth Button */}
          <div className="oauth-buttons">
            <button 
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="oauth-button google-button"
            >
              <svg className="oauth-icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
      </button>
        </div>

          <div className="oauth-divider">
          <span>or</span>
        </div>

          {/* Email Form */}
          <form onSubmit={handleEmailSignIn} className="signin-form">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="signin-input"
              required
              disabled={isSubmitting}
            />
            <button 
              type="submit" 
              className={`signin-button ${isSubmitting ? 'submitting' : ''}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Sign In / Sign Up with Email'}
            </button>
          </form>
        </div>
      </div>

      {status && (
        <div className={`landing-status-message ${status}`}>
          {message}
        </div>
      )}
    </main>
  );
}

export default LandingPage; 