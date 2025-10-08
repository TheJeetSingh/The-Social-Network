import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const navigate = useNavigate();
  const { user, loading } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [loading, user, navigate]);

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth-callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      setStatus('error');
      setMessage('Failed to sign in with Google.');
      setIsSubmitting(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus('');
    setMessage('');

    try {
      if (isSignUp) {
        // Sign up with email/password
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth-callback`,
          },
        });

        if (error) throw error;

        if (data?.user) {
          // Create user record
          await supabase.from('users').insert({
            id: data.user.id,
            email: data.user.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          
          setStatus('success');
          setMessage('Account created! Redirecting...');
          setTimeout(() => navigate('/dashboard'), 1000);
        }
      } else {
        // Sign in with email/password
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        setStatus('success');
        setMessage('Welcome back! Redirecting...');
        setTimeout(() => navigate('/dashboard'), 1000);
      }
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="main-content">
      <h1 className="main-header">Welcome to the Other Side</h1>
      <h2 className="sub-header">Join the most exclusive social network</h2>
      
      <div className="landing-actions">
        <div className="action-section">
          <h3 className="action-title">{isSignUp ? 'Create Account' : 'Sign In'}</h3>
          
          {/* Google OAuth Button */}
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

          <div className="oauth-divider">
            <span>or</span>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="signin-form">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="signin-input"
              required
              disabled={isSubmitting}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="signin-input"
              required
              disabled={isSubmitting}
              minLength={6}
            />
            <button 
              type="submit" 
              className={`signin-button ${isSubmitting ? 'submitting' : ''}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </button>
          </form>

          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="toggle-auth-mode"
            disabled={isSubmitting}
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
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