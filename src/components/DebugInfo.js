import React from 'react';
import { useUser } from '../contexts/UserContext';

function DebugInfo() {
  const { user, loading } = useUser();

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      fontFamily: 'monospace'
    }}>
      <div><strong>Debug Info:</strong></div>
      <div>Loading: {loading ? 'true' : 'false'}</div>
      <div>User: {user ? user.email : 'null'}</div>
      <div>User ID: {user ? user.id : 'null'}</div>
      <div>Time: {new Date().toLocaleTimeString()}</div>
    </div>
  );
}

export default DebugInfo; 