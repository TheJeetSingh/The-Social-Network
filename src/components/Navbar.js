import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

function Navbar() {
  const { user } = useUser();

  return (
    <nav className="navbar">
      <Link to="/" className="app-name">The Social Network</Link>
      {user && (
        <div className="nav-links">
          <Link to="/dashboard" className="nav-link">Dashboard</Link>
          <Link to="/developers" className="nav-link">Developer Portal</Link>
        </div>
      )}
    </nav>
  );
}

export default Navbar; 