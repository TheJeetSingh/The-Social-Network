import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAdmin } from '../contexts/AdminContext';
import { useNavigate } from 'react-router-dom';

function AdminDashboard() {
  const { isAdmin, loading, clearCache } = useAdmin();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [activeTab, setActiveTab] = useState('reports');
  const [statusMessage, setStatusMessage] = useState({ type: '', message: '' });

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/');
      } else {
        try {
          const { data: adminData, error: adminError } = await supabase
            .from('admins')
            .select('*')
            .eq('email', session.user.email)
            .maybeSingle();

          if (adminError) {
            setCurrentAdmin(null);
          } else {
            setCurrentAdmin(adminData);
          }
        } catch (tableError) {
          setCurrentAdmin(null);
        }
      }
    }
    checkSession();
  }, [navigate]);

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchReports();
      fetchAdmins();
    }
  }, [isAdmin]);

  const handleSignOut = async () => {
    try {
      // clearCache now handles both cache clearing and sign out
      await clearCache();
      navigate('/');
    } catch (error) {
      setStatusMessage({ type: 'error', message: 'Failed to sign out' });
    }
  };

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setUsers([]);
        return;
      }
      setUsers(data);
    } catch (error) {
      setUsers([]);
    }
  }

  async function fetchReports() {
    try {
      const { data: reportsData, error: reportsError } = await supabase
        .from('post_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (reportsError) {
        console.error('Error fetching reports:', reportsError);
        setReports([]);
        return;
      }

      const enrichedReports = await Promise.all(
        reportsData.map(async (report) => {
          const { data: postData } = await supabase
            .from('posts')
            .select('content, image_url, video_url')
            .eq('id', report.post_id)
            .single();

          const { data: reporterData } = await supabase
            .from('users')
            .select('email')
            .eq('id', report.reporter_id)
            .single();

          let resolverData = null;
          if (report.resolved_by) {
            const { data: adminData } = await supabase
              .from('admins')
              .select('email')
              .eq('id', report.resolved_by)
              .single();
            resolverData = adminData;
          }

          return {
            ...report,
            posts: postData || {},
            reporter_email: reporterData?.email || 'Unknown',
            resolver_email: resolverData?.email || null
          };
        })
      );

      setReports(enrichedReports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setReports([]);
    }
  }

  const resolveReport = async (reportId, action) => {
    try {
      console.log('Resolving report:', reportId, 'with action:', action);
      
      // First update the report status
      const { error: updateError } = await supabase
        .from('post_reports')
        .update({ 
          status: action,
          resolved_by: currentAdmin.id,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (updateError) {
        console.error('Error updating report:', updateError);
        throw updateError;
      }

      // If action is 'removed', also remove the post
      if (action === 'removed') {
        const report = reports.find(r => r.id === reportId);
        if (report && report.post_id) {
          console.log('Deleting post with ID:', report.post_id);
          
          const { error: deleteError } = await supabase
            .from('posts')
            .delete()
            .eq('id', report.post_id);

          if (deleteError) {
            console.error('Error deleting post:', deleteError);
            setStatusMessage({ type: 'error', message: 'Report updated but failed to delete post' });
            return;
          }
          
          console.log('Post deleted successfully');
        }
      }

      // Refresh the reports list
      await fetchReports();
      setStatusMessage({ type: 'success', message: `Report ${action} successfully` });
      
    } catch (error) {
      console.error('Error resolving report:', error);
      setStatusMessage({ type: 'error', message: 'Error resolving report. Please try again.' });
    }
  };

  async function fetchAdmins() {
    try {
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setAdmins([]);
        return;
      }
      setAdmins(data);
    } catch (error) {
      setAdmins([]);
    }
  }

  async function addAdmin(e) {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('admins')
        .insert([{ 
          email: newAdminEmail,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.warn('Error adding admin:', error);
        setStatusMessage({ 
          type: 'error', 
          message: error.code === '23505' ? 'This email is already an admin' : 'Failed to add admin' 
        });
        return;
      }
      
      setStatusMessage({ type: 'success', message: 'Admin added successfully' });
      setNewAdminEmail('');
      fetchAdmins();
    } catch (error) {
      console.error('Error adding admin:', error);
      setStatusMessage({ 
        type: 'error', 
        message: error.code === '23505' ? 'This email is already an admin' : 'Failed to add admin' 
      });
    }
  }

  async function removeAdmin(email) {
    if (email === currentAdmin?.email) {
      setStatusMessage({ type: 'error', message: 'You cannot remove yourself' });
      return;
    }

    try {
      const { error } = await supabase
        .from('admins')
        .delete()
        .eq('email', email);

      if (error) {
        console.warn('Error removing admin:', error);
        setStatusMessage({ type: 'error', message: 'Failed to remove admin' });
        return;
      }
      
      setStatusMessage({ type: 'success', message: 'Admin removed successfully' });
      fetchAdmins();
    } catch (error) {
      console.error('Error removing admin:', error);
      setStatusMessage({ type: 'error', message: 'Failed to remove admin' });
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (loading || !isAdmin) return null;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', minHeight: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid #333' }}>
        <div>
          <h1 style={{ fontFamily: 'monospace', fontSize: '2.5rem', color: '#ffffff', marginBottom: '0.5rem' }}>Admin Dashboard</h1>
          {currentAdmin && (
            <p style={{ fontFamily: 'monospace', color: '#888', fontSize: '0.9rem', margin: 0 }}>Logged in as: {currentAdmin.email}</p>
          )}
        </div>
        <button onClick={handleSignOut} style={{ padding: '0.75rem 1.5rem', background: '#dc3545', border: 'none', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '6px', textTransform: 'uppercase' }}>
          Sign Out
        </button>
      </div>

      {/* Tab Navigation - SIMPLIFIED AND GUARANTEED TO WORK */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        marginBottom: '2rem', 
        padding: '1rem',
        background: '#1a1a1a',
        borderRadius: '12px',
        border: '2px solid #333'
      }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => setActiveTab('users')}
            style={{
              padding: '1rem 2rem',
              background: activeTab === 'users' ? '#4285F4' : '#2a2a2a',
              border: '1px solid #444',
              color: activeTab === 'users' ? '#ffffff' : '#888',
              fontFamily: 'monospace',
              fontSize: '1rem',
              cursor: 'pointer',
              borderRadius: '8px',
              textTransform: 'uppercase',
              minWidth: '120px'
            }}
          >
            USERS
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            style={{
              padding: '1rem 2rem',
              background: activeTab === 'reports' ? '#4285F4' : '#2a2a2a',
              border: '1px solid #444',
              color: activeTab === 'reports' ? '#ffffff' : '#888',
              fontFamily: 'monospace',
              fontSize: '1rem',
              cursor: 'pointer',
              borderRadius: '8px',
              textTransform: 'uppercase',
              minWidth: '120px'
            }}
          >
            REPORTS
          </button>
          <button 
            onClick={() => setActiveTab('admins')}
            style={{
              padding: '1rem 2rem',
              background: activeTab === 'admins' ? '#4285F4' : '#2a2a2a',
              border: '1px solid #444',
              color: activeTab === 'admins' ? '#ffffff' : '#888',
              fontFamily: 'monospace',
              fontSize: '1rem',
              cursor: 'pointer',
              borderRadius: '8px',
              textTransform: 'uppercase',
              minWidth: '120px'
            }}
          >
            ADMINS
          </button>
        </div>
      </div>

      {/* Current Tab Indicator */}
      <div style={{ textAlign: 'center', marginBottom: '2rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px', border: '1px solid #444' }}>
        <span style={{ color: '#888', fontFamily: 'monospace' }}>Current View: </span>
        <span style={{ color: '#4285F4', fontWeight: 'bold', fontFamily: 'monospace' }}>{activeTab.toUpperCase()}</span>
      </div>

      {/* Status Message */}
      {statusMessage.message && (
        <div style={{ 
          padding: '1rem', 
          marginBottom: '2rem', 
          borderRadius: '8px',
          background: statusMessage.type === 'success' ? '#28a745' : '#dc3545',
          color: '#ffffff',
          textAlign: 'center',
          fontFamily: 'monospace'
        }}>
          {statusMessage.message}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'users' && (
        <div>
          <h2 style={{ fontFamily: 'monospace', fontSize: '1.5rem', color: '#ffffff', marginBottom: '1.5rem', paddingBottom: '0.5rem', borderBottom: '2px solid #4285F4' }}>User Management</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333' }}>
            <thead>
              <tr>
                <th style={{ background: '#2a2a2a', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.8rem', textTransform: 'uppercase', padding: '1rem', textAlign: 'left', borderBottom: '1px solid #333' }}>Email</th>
                <th style={{ background: '#2a2a2a', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.8rem', textTransform: 'uppercase', padding: '1rem', textAlign: 'left', borderBottom: '1px solid #333' }}>Username</th>
                <th style={{ background: '#2a2a2a', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.8rem', textTransform: 'uppercase', padding: '1rem', textAlign: 'left', borderBottom: '1px solid #333' }}>Joined Date</th>
                <th style={{ background: '#2a2a2a', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.8rem', textTransform: 'uppercase', padding: '1rem', textAlign: 'left', borderBottom: '1px solid #333' }}>Last Login</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid #333' }}>
                  <td style={{ padding: '1rem', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.9rem' }}>{user.email}</td>
                  <td style={{ padding: '1rem', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.9rem' }}>{user.username || 'Not set'}</td>
                  <td style={{ padding: '1rem', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.9rem' }}>{formatDate(user.created_at)}</td>
                  <td style={{ padding: '1rem', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.9rem' }}>{user.last_login ? formatDate(user.last_login) : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'reports' && (
        <div>
          <h2 style={{ fontFamily: 'monospace', fontSize: '1.5rem', color: '#ffffff', marginBottom: '1.5rem', paddingBottom: '0.5rem', borderBottom: '2px solid #4285F4' }}>Post Reports</h2>
          {reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontFamily: 'monospace' }}>
              <p>No reports to review</p>
            </div>
          ) : (
            <div>
              {reports.map((report) => (
                <div key={report.id} style={{ background: '#1a1a1a', padding: '1.5rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid #333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <span style={{ color: '#ffffff', fontFamily: 'monospace', fontSize: '1rem', marginRight: '1rem' }}>{report.reason}</span>
                      <span style={{ 
                        background: report.status === 'pending' ? '#ffc107' : '#28a745', 
                        color: '#000000', 
                        padding: '0.25rem 0.5rem', 
                        borderRadius: '4px', 
                        fontFamily: 'monospace', 
                        fontSize: '0.8rem',
                        textTransform: 'uppercase'
                      }}>
                        {report.status}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', color: '#888', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      <div>Reported by: {report.reporter_email}</div>
                      <div>{formatDate(report.created_at)}</div>
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{ color: '#ffffff', fontFamily: 'monospace', marginBottom: '0.5rem' }}>Reported Post:</h4>
                    <p style={{ color: '#ffffff', fontFamily: 'monospace', fontSize: '1.1rem' }}>{truncateText(report.posts?.content)}</p>
                  </div>

                  {report.description && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ color: '#ffffff', fontFamily: 'monospace', marginBottom: '0.5rem' }}>Description:</h4>
                      <p style={{ color: '#ffffff', fontFamily: 'monospace' }}>{report.description}</p>
                    </div>
                  )}

                  {report.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => resolveReport(report.id, 'dismissed')}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: '#6c757d',
                          border: 'none',
                          color: '#ffffff',
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          textTransform: 'uppercase'
                        }}
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => resolveReport(report.id, 'removed')}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: '#dc3545',
                          border: 'none',
                          color: '#ffffff',
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          textTransform: 'uppercase'
                        }}
                      >
                        Remove Post
                      </button>
                    </div>
                  )}

                  {report.status !== 'pending' && (
                    <div style={{ textAlign: 'right', color: '#888', fontFamily: 'monospace', fontSize: '0.8rem', marginTop: '1rem' }}>
                      <div>Resolved by: {report.resolver_email}</div>
                      <div>{formatDate(report.resolved_at)}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'admins' && (
        <div>
          <h2 style={{ fontFamily: 'monospace', fontSize: '1.5rem', color: '#ffffff', marginBottom: '1.5rem', paddingBottom: '0.5rem', borderBottom: '2px solid #4285F4' }}>Admin Management</h2>
          <form onSubmit={addAdmin} style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="Enter email to add admin"
              required
              style={{
                padding: '0.75rem',
                background: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: '6px',
                color: '#ffffff',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                flex: 1
              }}
            />
            <button type="submit" style={{
              padding: '0.75rem 1.5rem',
              background: '#28a745',
              border: 'none',
              color: '#ffffff',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              cursor: 'pointer',
              borderRadius: '6px',
              textTransform: 'uppercase'
            }}>
              Add Admin
            </button>
          </form>

          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333' }}>
            <thead>
              <tr>
                <th style={{ background: '#2a2a2a', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.8rem', textTransform: 'uppercase', padding: '1rem', textAlign: 'left', borderBottom: '1px solid #333' }}>Email</th>
                <th style={{ background: '#2a2a2a', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.8rem', textTransform: 'uppercase', padding: '1rem', textAlign: 'left', borderBottom: '1px solid #333' }}>Added Date</th>
                <th style={{ background: '#2a2a2a', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.8rem', textTransform: 'uppercase', padding: '1rem', textAlign: 'left', borderBottom: '1px solid #333' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.email} style={{ borderBottom: '1px solid #333' }}>
                  <td style={{ padding: '1rem', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.9rem' }}>{admin.email}</td>
                  <td style={{ padding: '1rem', color: '#ffffff', fontFamily: 'monospace', fontSize: '0.9rem' }}>{formatDate(admin.created_at)}</td>
                  <td style={{ padding: '1rem' }}>
                    {admin.email !== currentAdmin?.email && (
                      <button
                        onClick={() => removeAdmin(admin.email)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#dc3545',
                          border: 'none',
                          color: '#ffffff',
                          fontFamily: 'monospace',
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          textTransform: 'uppercase'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard; 
