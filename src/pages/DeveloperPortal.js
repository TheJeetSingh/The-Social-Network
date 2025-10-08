import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useUser } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import '../DeveloperPortal.css';

function DeveloperPortal() {
  const { user, loading } = useUser();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [apiKey, setApiKey] = useState('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', message: '' });
  const [usageStats, setUsageStats] = useState({
    totalRequests: 0,
    thisMonth: 0,
    lastMonth: 0
  });

  const loadExistingApiKey = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('api_key')
        .eq('user_id', user.id)
        .eq('is_active', 'true')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading API key:', error);
        return;
      }

      if (data) {
        setApiKey(data.api_key);
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    }
  }, [user?.id]);

  const loadUsageStats = useCallback(async () => {
    try {
      // First get the user's API key ID
      const { data: apiKeyData, error: apiKeyError } = await supabase
        .from('api_keys')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', 'true')
        .single();

      if (apiKeyError || !apiKeyData) {
        // No API key exists yet, set stats to 0
        setUsageStats({
          totalRequests: 0,
          thisMonth: 0,
          lastMonth: 0
        });
        return;
      }

      const apiKeyId = apiKeyData.id;

      // Get total requests
      const { count: totalRequests, error: totalError } = await supabase
        .from('api_requests')
        .select('*', { count: 'exact', head: true })
        .eq('api_key_id', apiKeyId);

      if (!totalError) {
        setUsageStats(prev => ({ ...prev, totalRequests: totalRequests || 0 }));
      }

      // Get this month's requests
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      const { count: thisMonthCount, error: thisMonthError } = await supabase
        .from('api_requests')
        .select('*', { count: 'exact', head: true })
        .eq('api_key_id', apiKeyId)
        .gte('created_at', thisMonth.toISOString());

      if (!thisMonthError) {
        setUsageStats(prev => ({ ...prev, thisMonth: thisMonthCount || 0 }));
      }

      // Get last month's requests
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      lastMonth.setDate(1);
      lastMonth.setHours(0, 0, 0, 0);

      const { count: lastMonthCount, error: lastMonthError } = await supabase
        .from('api_requests')
        .select('*', { count: 'exact', head: true })
        .eq('api_key_id', apiKeyId)
        .gte('created_at', lastMonth.toISOString())
        .lt('created_at', thisMonth.toISOString());

      if (!lastMonthError) {
        setUsageStats(prev => ({ ...prev, lastMonth: lastMonthCount || 0 }));
      }
    } catch (error) {
      console.error('Error loading usage stats:', error);
      // Set default stats on error
      setUsageStats({
        totalRequests: 0,
        thisMonth: 0,
        lastMonth: 0
      });
    }
  }, [user?.id]);

  // Check authentication and load existing API key
  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
    
    if (user) {
      loadExistingApiKey();
      loadUsageStats();
    }
  }, [user, loading, navigate, loadExistingApiKey, loadUsageStats]);

  const generateApiKey = async () => {
    setIsGeneratingKey(true);
    try {
      // Generate a secure API key
      const key = 'tsn_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Store in database
      const { error } = await supabase
        .from('api_keys')
        .insert([{
          user_id: user.id,
          api_key: key,
          name: `API Key for ${user.email}`,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;
      
      setApiKey(key);
      setStatusMessage({ type: 'success', message: 'API key generated successfully!' });
      
      // Refresh usage stats
      loadUsageStats();
    } catch (error) {
      console.error('Error generating API key:', error);
      setStatusMessage({ type: 'error', message: 'Failed to generate API key' });
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setStatusMessage({ type: 'success', message: 'Copied to clipboard!' });
  };

  const regenerateApiKey = async () => {
    try {
      // Generate new key
      const newKey = 'tsn_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Check if user already has an API key
      const { data: existingKey, error: checkError } = await supabase
        .from('api_keys')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', 'true')
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingKey) {
        // Update existing key
        const { error } = await supabase
          .from('api_keys')
          .update({ 
            api_key: newKey,
            last_used_at: null,
            usage_count: 0
          })
          .eq('id', existingKey.id);

        if (error) throw error;
      } else {
        // Create new key
        const { error } = await supabase
          .from('api_keys')
          .insert([{
            user_id: user.id,
            api_key: newKey,
            name: `API Key for ${user.email}`,
            created_at: new Date().toISOString()
          }]);

        if (error) throw error;
      }
      
      setApiKey(newKey);
      setStatusMessage({ type: 'success', message: 'API key regenerated successfully!' });
      
      // Refresh usage stats
      loadUsageStats();
    } catch (error) {
      console.error('Error regenerating API key:', error);
      setStatusMessage({ type: 'error', message: 'Failed to regenerate API key' });
    }
  };

  const revokeApiKey = async () => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', 'true');

      if (error) throw error;
      
      setApiKey('');
      setStatusMessage({ type: 'success', message: 'API key revoked successfully!' });
      
      // Refresh usage stats
      loadUsageStats();
    } catch (error) {
      console.error('Error revoking API key:', error);
      setStatusMessage({ type: 'error', message: 'Failed to revoke API key' });
    }
  };

  if (loading) {
    return (
      <div className="developer-portal-loading">
        <div className="loading-spinner"></div>
        <p>Loading developer portal...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="developer-portal">
      {/* Header */}
      <div className="portal-header">
        <div className="portal-title">
          <h1 className="gradient-text">Developer Portal</h1>
          <p>Build amazing integrations with The Social Network API</p>
        </div>
        <div className="portal-nav">
          <button 
            className={`nav-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`nav-button ${activeTab === 'authentication' ? 'active' : ''}`}
            onClick={() => setActiveTab('authentication')}
          >
            Authentication
          </button>
          <button 
            className={`nav-button ${activeTab === 'endpoints' ? 'active' : ''}`}
            onClick={() => setActiveTab('endpoints')}
          >
            Endpoints
          </button>
          <button 
            className={`nav-button ${activeTab === 'examples' ? 'active' : ''}`}
            onClick={() => setActiveTab('examples')}
          >
            Examples
          </button>
          <button 
            className={`nav-button ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {statusMessage.message && (
        <div className={`status-message ${statusMessage.type}`}>
          {statusMessage.message}
        </div>
      )}

      {/* Content Sections */}
      <div className="portal-content">
        {activeTab === 'overview' && (
          <div className="overview-section">
            <div className="hero-section glass-effect">
              <h2>Welcome to The Social Network API</h2>
              <p>Access public data from our social network platform to build powerful integrations, analytics tools, and social media applications.</p>
              
              <div className="feature-grid">
                <div className="feature-card">
                  <div className="feature-icon">📊</div>
                  <h3>Public Posts</h3>
                  <p>Access all public posts with comments, likes, and engagement data</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">👥</div>
                  <h3>User Profiles</h3>
                  <p>Get public user information by username or UUID with follower counts</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🔍</div>
                  <h3>User Search</h3>
                  <p>Find users by username with partial matching capabilities</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">📈</div>
                  <h3>Analytics</h3>
                  <p>Track engagement, trending topics, and community insights</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🛡️</div>
                  <h3>Secure Access</h3>
                  <p>API key authentication with rate limiting and monitoring</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">✨</div>
                  <h3>User-Friendly</h3>
                  <p>Use usernames instead of UUIDs for easier integration</p>
                </div>
              </div>
            </div>

            <div className="quick-start glass-effect">
              <h3>Quick Start</h3>
              <div className="steps">
                <div className="step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <h4>Get Your API Key</h4>
                    <p>Generate a secure API key from your dashboard</p>
                  </div>
                </div>
                <div className="step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <h4>Make Your First Request</h4>
                    <p>Use the key to authenticate your API calls</p>
                  </div>
                </div>
                <div className="step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <h4>Build Your Integration</h4>
                    <p>Access posts, users, and engagement data with user-friendly endpoints</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'authentication' && (
          <div className="authentication-section">
            <div className="auth-overview glass-effect">
              <h2>Authentication</h2>
              <p>All API requests require authentication using an API key. Include your key in the request headers.</p>
              
                             <div className="api-key-section">
                 <h3>Your API Key</h3>
                 {apiKey ? (
                   <div className="api-key-display">
                     <code className="api-key">{apiKey}</code>
                     <button 
                       onClick={() => copyToClipboard(apiKey)}
                       className="copy-button"
                     >
                       📋 Copy
                     </button>
                   </div>
                 ) : (
                   <div className="generate-key-section">
                     <p>You haven't generated an API key yet.</p>
                     <button 
                       onClick={generateApiKey}
                       className="generate-key-button"
                       disabled={isGeneratingKey}
                     >
                       {isGeneratingKey ? 'Generating...' : 'Generate API Key'}
                     </button>
                   </div>
                 )}
               </div>

              <div className="usage-example">
                <h3>Usage Example</h3>
                <div className="code-block">
                  <div className="code-header">
                    <span>cURL</span>
                    <button 
                      onClick={() => copyToClipboard(`curl -H "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}" https://thesocialnetworkapi.vercel.app/v1/posts`)}
                      className="copy-button small"
                    >
                      Copy
                    </button>
                  </div>
                  <pre><code>{`curl -H "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}" \\
  https://thesocialnetworkapi.vercel.app/v1/posts`}</code></pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'endpoints' && (
          <div className="endpoints-section">
            <div className="endpoints-overview glass-effect">
              <h2>API Endpoints</h2>
              <p>Explore the available endpoints and their response formats.</p>
            </div>

            <div className="endpoint-group">
              <h3>Posts</h3>
              
              <div className="endpoint-card">
                <div className="endpoint-header">
                  <span className="method get">GET</span>
                  <span className="endpoint-path">/v1/posts</span>
                </div>
                <p>Get all public posts with pagination</p>
                <div className="endpoint-details">
                  <div className="params">
                    <h4>Query Parameters</h4>
                    <ul>
                      <li><code>page</code> - Page number (default: 1)</li>
                      <li><code>limit</code> - Items per page (default: 20, max: 100)</li>
                      <li><code>sort</code> - Sort order: "newest", "oldest", "popular"</li>
                    </ul>
                  </div>
                  <div className="response">
                    <h4>Response</h4>
                    <pre><code>{`{
  "data": [
    {
      "id": "uuid",
      "content": "Post content",
      "created_at": "2024-01-01T00:00:00Z",
      "user": {
        "id": "uuid",
        "username": "username",
        "full_name": "Full Name"
      },
      "likes_count": 42,
      "comments_count": 5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}`}</code></pre>
                  </div>
                </div>
              </div>

              <div className="endpoint-card">
                <div className="endpoint-header">
                  <span className="method get">GET</span>
                  <span className="endpoint-path">/v1/posts/{'{id}'}</span>
                </div>
                <p>Get a specific post with comments and likes</p>
                <div className="endpoint-details">
                  <div className="response">
                    <h4>Response</h4>
                    <pre><code>{`{
  "id": "uuid",
  "content": "Post content",
  "created_at": "2024-01-01T00:00:00Z",
  "user": {
    "id": "uuid",
    "username": "username",
    "full_name": "Full Name"
  },
  "comments": [
    {
      "id": "uuid",
      "content": "Comment text",
      "created_at": "2024-01-01T00:00:00Z",
      "user": {
        "id": "uuid",
        "username": "username"
      }
    }
  ],
  "likes_count": 42
}`}</code></pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="endpoint-group">
              <h3>Users</h3>
              
              <div className="endpoint-card">
                <div className="endpoint-header">
                  <span className="method get">GET</span>
                  <span className="endpoint-path">/v1/users/search/{'{username}'}</span>
                </div>
                <p>Search users by username (partial match)</p>
                <div className="endpoint-details">
                  <div className="response">
                    <h4>Response</h4>
                    <pre><code>{`{
  "data": [
    {
      "id": "uuid",
      "username": "username",
      "full_name": "Full Name",
      "avatar_url": "https://...",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1
}`}</code></pre>
                  </div>
                </div>
              </div>

              <div className="endpoint-card">
                <div className="endpoint-header">
                  <span className="method get">GET</span>
                  <span className="endpoint-path">/v1/users/{'{id|username}'}</span>
                </div>
                <p>Get public user profile information by user ID or username</p>
                <div className="endpoint-details">
                  <div className="response">
                    <h4>Response</h4>
                    <pre><code>{`{
  "id": "uuid",
  "username": "username",
  "full_name": "Full Name",
  "avatar_url": "https://...",
  "created_at": "2024-01-01T00:00:00Z",
  "followers_count": 150,
  "following_count": 75,
  "posts_count": 42
}`}</code></pre>
                  </div>
                </div>
              </div>

              <div className="endpoint-card">
                <div className="endpoint-header">
                  <span className="method get">GET</span>
                  <span className="endpoint-path">/v1/users/{'{id|username}'}/posts</span>
                </div>
                <p>Get posts by a specific user (by ID or username)</p>
                <div className="endpoint-details">
                  <div className="params">
                    <h4>Query Parameters</h4>
                    <ul>
                      <li><code>page</code> - Page number (default: 1)</li>
                      <li><code>limit</code> - Items per page (default: 20, max: 100)</li>
                    </ul>
                  </div>
                  <div className="response">
                    <h4>Response</h4>
                    <pre><code>{`{
  "data": [
    {
      "id": "uuid",
      "content": "Post content",
      "created_at": "2024-01-01T00:00:00Z",
      "user": {
        "id": "uuid",
        "username": "username",
        "full_name": "Full Name"
      },
      "likes_count": 42,
      "comments_count": 5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}`}</code></pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'examples' && (
          <div className="examples-section">
            <div className="examples-overview glass-effect">
              <h2>Code Examples</h2>
              <p>Learn how to integrate with our API using popular programming languages and frameworks.</p>
            </div>

            <div className="example-tabs">
              <div className="tab-buttons">
                <button className="tab-button active">JavaScript</button>
                <button className="tab-button">Python</button>
                <button className="tab-button">cURL</button>
                <button className="tab-button">PHP</button>
              </div>

              <div className="example-content">
                <div className="example-card">
                  <h3>Fetch All Posts</h3>
                  <div className="code-block">
                    <div className="code-header">
                      <span>JavaScript (Fetch)</span>
                      <button className="copy-button small">Copy</button>
                    </div>
                    <pre><code>{`const API_KEY = '${apiKey || 'YOUR_API_KEY'}';
const API_BASE = 'https://thesocialnetworkapi.vercel.app/v1';

async function getPosts() {
  const response = await fetch(\`\${API_BASE}/posts?limit=20\`, {
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  return data;
}

// Usage
getPosts().then(posts => {
  console.log('Posts:', posts.data);
});`}</code></pre>
                  </div>
                </div>

                <div className="example-card">
                  <h3>Get User Profile</h3>
                  <div className="code-block">
                    <div className="code-header">
                      <span>JavaScript (Fetch)</span>
                      <button className="copy-button small">Copy</button>
                    </div>
                    <pre><code>{`async function getUserProfile(userId) {
  const response = await fetch(\`\${API_BASE}/users/\${userId}\`, {
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`,
      'Content-Type': 'application/json'
    }
  });
  
  const user = await response.json();
  return user;
}

// Usage - supports both UUID and username
getUserProfile('jet').then(user => {
  console.log('User:', user);
});`}</code></pre>
                  </div>
                </div>

                <div className="example-card">
                  <h3>Search Users</h3>
                  <div className="code-block">
                    <div className="code-header">
                      <span>JavaScript (Fetch)</span>
                      <button className="copy-button small">Copy</button>
                    </div>
                    <pre><code>{`async function searchUsers(username) {
  const response = await fetch(\`\${API_BASE}/users/search/\${username}\`, {
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`,
      'Content-Type': 'application/json'
    }
  });
  
  const result = await response.json();
  return result;
}

// Usage - partial match search
searchUsers('je').then(result => {
  console.log('Found users:', result.data);
});`}</code></pre>
                  </div>
                </div>

                <div className="example-card">
                  <h3>Get User Posts</h3>
                  <div className="code-block">
                    <div className="code-header">
                      <span>JavaScript (Fetch)</span>
                      <button className="copy-button small">Copy</button>
                    </div>
                    <pre><code>{`async function getUserPosts(userId, page = 1, limit = 20) {
  const response = await fetch(\`\${API_BASE}/users/\${userId}/posts?page=\${page}&limit=\${limit}\`, {
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`,
      'Content-Type': 'application/json'
    }
  });
  
  const posts = await response.json();
  return posts;
}

// Usage - supports both UUID and username
getUserPosts('jet', 1, 10).then(posts => {
  console.log('User posts:', posts.data);
});`}</code></pre>
                  </div>
                </div>

                <div className="example-card">
                  <h3>Error Handling</h3>
                  <div className="code-block">
                    <div className="code-header">
                      <span>JavaScript</span>
                      <button className="copy-button small">Copy</button>
                    </div>
                    <pre><code>{`async function makeApiRequest(endpoint) {
  try {
    const response = await fetch(\`\${API_BASE}\${endpoint}\`, {
      headers: {
        'Authorization': \`Bearer \${API_KEY}\`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}`}</code></pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="dashboard-section">
            <div className="dashboard-overview glass-effect">
              <h2>API Dashboard</h2>
              <p>Monitor your API usage and manage your integration.</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-content">
                  <h3>Total Requests</h3>
                  <div className="stat-number">{usageStats.totalRequests.toLocaleString()}</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">📅</div>
                <div className="stat-content">
                  <h3>This Month</h3>
                  <div className="stat-number">{usageStats.thisMonth.toLocaleString()}</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">📈</div>
                <div className="stat-content">
                  <h3>Last Month</h3>
                  <div className="stat-number">{usageStats.lastMonth.toLocaleString()}</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">⚡</div>
                <div className="stat-content">
                  <h3>Rate Limit</h3>
                  <div className="stat-number">1000/hour</div>
                </div>
              </div>
            </div>

            <div className="api-key-management glass-effect">
              <h3>API Key Management</h3>
              {apiKey ? (
                <div className="key-info">
                  <div className="key-details">
                    <p><strong>Status:</strong> <span className="status active">Active</span></p>
                    <p><strong>Created:</strong> {new Date().toLocaleDateString()}</p>
                    <p><strong>Last Used:</strong> Never</p>
                  </div>
                  <div className="key-actions">
                    <button 
                      onClick={regenerateApiKey}
                      className="regenerate-button"
                    >
                      Regenerate Key
                    </button>
                    <button 
                      onClick={revokeApiKey}
                      className="revoke-button"
                    >
                      Revoke Key
                    </button>
                  </div>
                </div>
              ) : (
                <div className="no-key">
                  <p>You haven't generated an API key yet.</p>
                  <button 
                    onClick={generateApiKey}
                    className="generate-key-button"
                    disabled={isGeneratingKey}
                  >
                    {isGeneratingKey ? 'Generating...' : 'Generate Your First API Key'}
                  </button>
                </div>
              )}
            </div>

            <div className="usage-chart glass-effect">
              <h3>Usage Analytics</h3>
              <div className="chart-placeholder">
                <p>📊 Usage charts will be available soon</p>
                <p>Track your API usage over time with detailed analytics</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DeveloperPortal; 
