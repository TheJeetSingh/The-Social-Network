const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Please check your .env file contains REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/v1/', limiter);

// API Key authentication middleware
const authenticateApiKey = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  try {
    // Check if API key exists and is active
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('id, user_id, name, is_active')
      .eq('api_key', apiKey)
      .eq('is_active', 'true')
      .single();
    
    if (keyError || !keyData) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    // Log the API request
    await supabase
      .from('api_requests')
      .insert([{
        api_key_id: keyData.id,
        endpoint: req.path,
        method: req.method,
        user_agent: req.get('User-Agent') || 'Unknown',
        ip_address: req.ip
      }]);
    
    // Update API key usage
    await supabase
      .from('api_keys')
      .update({ 
        last_used_at: new Date().toISOString(),
        usage_count: keyData.usage_count + 1
      })
      .eq('id', keyData.id);
    
    req.apiKey = keyData;
    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Apply authentication to all API routes
app.use('/v1/', authenticateApiKey);

// API Routes

// Get all posts
app.get('/v1/posts', async (req, res) => {
  try {
    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        id,
        content,
        created_at,
        updated_at,
        user_id,
        users!inner(username, full_name, avatar_url)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: posts,
      count: posts.length
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get posts by specific user
app.get('/v1/users/:userId/posts', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        id,
        content,
        created_at,
        updated_at,
        user_id,
        users!inner(username, full_name, avatar_url)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: posts,
      count: posts.length
    });
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

// Get post details with comments and likes
app.get('/v1/posts/:postId', async (req, res) => {
  try {
    const postId = req.params.postId;
    
    // Get post with user info
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select(`
        id,
        content,
        created_at,
        updated_at,
        user_id,
        users!inner(username, full_name, avatar_url)
      `)
      .eq('id', postId)
      .single();
    
    if (postError) throw postError;
    
    // Get comments
    const { data: comments, error: commentsError } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        user_id,
        users!inner(username, full_name, avatar_url)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    
    if (commentsError) throw commentsError;
    
    // Get likes count
    const { count: likesCount, error: likesError } = await supabase
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);
    
    if (likesError) throw likesError;
    
    res.json({
      success: true,
      data: {
        ...post,
        comments,
        likes_count: likesCount || 0
      }
    });
  } catch (error) {
    console.error('Error fetching post details:', error);
    res.status(500).json({ error: 'Failed to fetch post details' });
  }
});

// Get user profile
app.get('/v1/users/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id,
        username,
        full_name,
        avatar_url,
        followers_count,
        following_count,
        created_at
      `)
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Get user followers
app.get('/v1/users/:userId/followers', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const { data: followers, error } = await supabase
      .from('followers')
      .select(`
        follower_id,
        users!followers_follower_id_fkey(username, full_name, avatar_url)
      `)
      .eq('following_id', userId);
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: followers,
      count: followers.length
    });
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// Get user following
app.get('/v1/users/:userId/following', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const { data: following, error } = await supabase
      .from('followers')
      .select(`
        following_id,
        users!followers_following_id_fkey(username, full_name, avatar_url)
      `)
      .eq('follower_id', userId);
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: following,
      count: following.length
    });
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

// Get admins
app.get('/v1/admins', async (req, res) => {
  try {
    const { data: admins, error } = await supabase
      .from('admins')
      .select(`
        id,
        user_id,
        role,
        created_at,
        users!inner(username, full_name, avatar_url)
      `);
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: admins,
      count: admins.length
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// Get reported posts
app.get('/v1/reports', async (req, res) => {
  try {
    const { data: reports, error } = await supabase
      .from('post_reports')
      .select(`
        id,
        post_id,
        reporter_id,
        reason,
        description,
        status,
        created_at,
        posts!inner(content, user_id),
        users!post_reports_reporter_id_fkey(username, full_name)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: reports,
      count: reports.length
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Health check endpoint
app.get('/v1/health', (req, res) => {
  res.json({
    success: true,
    message: 'The Social Network API is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('/v1/*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /v1/posts',
      'GET /v1/posts/:postId',
      'GET /v1/users/:userId',
      'GET /v1/users/:userId/posts',
      'GET /v1/users/:userId/followers',
      'GET /v1/users/:userId/following',
      'GET /v1/admins',
      'GET /v1/reports',
      'GET /v1/health'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 The Social Network API server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/v1/health`);
}); 