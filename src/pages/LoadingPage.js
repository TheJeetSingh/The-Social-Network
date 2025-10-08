import React, { useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';

function LoadingPage() {
  const { user, loading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    // Only navigate when loading is complete
    if (!loading) {
      if (user) {
        console.log('✅ User found, navigating to dashboard');
        navigate('/dashboard', { replace: true });
      } else {
        console.log('❌ No user found, navigating to landing page');
        navigate('/', { replace: true });
      }
    }
  }, [user, loading, navigate]);

  return (
    <div className="loading-page">
      <div className="loading-container">
        <div className="loading-spinner" />
        <h2 className="loading-title">Loading your experience…</h2>
        <p className="loading-subtitle">Hang tight, we're getting things ready.</p>
      </div>
    </div>
  );
}

export default LoadingPage;
