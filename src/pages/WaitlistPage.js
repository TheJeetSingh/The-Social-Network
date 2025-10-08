import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
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
    <div className="page-container">
      <h1 className="page-header">Join the Waitlist</h1>
      <form onSubmit={handleSubmit} className="waitlist-form">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          className="waitlist-input"
          required
          disabled={isSubmitting}
        />
        <button 
          type="submit" 
          className={`submit-button ${isSubmitting ? 'submitting' : ''}`}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Processing...' : 'Submit'}
        </button>
        {status && (
          <div className={`status-message ${status}`}>
            {message}
          </div>
        )}
      </form>
    </div>
  );
}

export default WaitlistPage; 
