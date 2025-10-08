const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Middleware
app.use(cors());
app.use(express.json());

// JSON prettification middleware
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    // Always return prettified JSON
    const jsonString = JSON.stringify(data, null, 2);
    res.setHeader('Content-Type', 'application/json');
    return res.send(jsonString);
  };
  next();
});

// API Key authentication middleware
const authenticateApiKey = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  const apiKey = authHeader.substring(7);
  console.log('🔑 Authenticating API key:', apiKey.substring(0, 10) + '...');
  
  try {
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('id, user_id, name, is_active')
      .eq('api_key', apiKey)
      .eq('is_active', 'true')
      .single();
    
    console.log('🔍 Key lookup result:', { keyData, keyError });
    
    if (keyError || !keyData) {
      console.log('❌ Authentication failed:', keyError);
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    console.log('✅ Authentication successful for user:', keyData.user_id);
    
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
    
    req.apiKey = keyData;
    next();
  } catch (error) {
    console.error('❌ API key authentication error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Health check endpoint (public)
app.get('/v1/health', (req, res) => {
  res.json({
    success: true,
    message: 'The Social Network API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Apply authentication to all other API routes
app.use('/v1/', authenticateApiKey);

// Get all posts with pagination and sorting
app.get('/v1/posts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const sort = req.query.sort || 'newest';
    const offset = (page - 1) * limit;

    let query = supabase
      .from('posts')
      .select(`
        id,
        content,
        created_at,
        updated_at,
        user_id,
        title,
        image_url,
        video_url,
        media_type,
        users!inner(id, username, full_name, avatar_url)
      `);

    // Apply sorting
    switch (sort) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'popular':
        // For now, just sort by newest since we don't have like counts in the main query
        query = query.order('created_at', { ascending: false });
        break;
      default: // newest
        query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: posts, error, count } = await query;

    if (error) throw error;

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true });

    // Get likes and comments counts for each post
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        // Get likes count
        const { count: likesCount } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);

        // Get comments count
        const { count: commentsCount } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);

        return {
          id: post.id,
          content: post.content,
          created_at: post.created_at,
          user: {
            id: post.users.id,
            username: post.users.username,
            full_name: post.users.full_name
          },
          likes_count: likesCount || 0,
          comments_count: commentsCount || 0
        };
      })
    );

    res.json({
      data: postsWithCounts,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        pages: Math.ceil((totalCount || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get specific post with comments and likes
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
        title,
        image_url,
        video_url,
        media_type,
        users!inner(id, username, full_name, avatar_url)
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
        users!inner(id, username, full_name, avatar_url)
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
      id: post.id,
      content: post.content,
      created_at: post.created_at,
      user: {
        id: post.users.id,
        username: post.users.username,
        full_name: post.users.full_name
      },
      comments: comments.map(comment => ({
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        user: {
          id: comment.users.id,
          username: comment.users.username
        }
      })),
      likes_count: likesCount || 0
    });
  } catch (error) {
    console.error('Error fetching post details:', error);
    res.status(500).json({ error: 'Failed to fetch post details' });
  }
});

// Get user profile by ID or username
app.get('/v1/users/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Check if it's a UUID or username
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    
    let query = supabase
      .from('users')
      .select(`
        id,
        username,
        full_name,
        avatar_url,
        created_at
      `);
    
    if (isUuid) {
      query = query.eq('id', userId);
    } else {
      query = query.eq('username', userId);
    }
    
    const { data: user, error } = await query.single();
    
    if (error) throw error;

    // Get posts count
    const { count: postsCount, error: postsError } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (!postsError) {
      user.posts_count = postsCount || 0;
    }

    // Get followers count
    const { count: followersCount, error: followersError } = await supabase
      .from('followers')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId);

    if (!followersError) {
      user.followers_count = followersCount || 0;
    }

    // Get following count
    const { count: followingCount, error: followingError } = await supabase
      .from('followers')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId);

    if (!followingError) {
      user.following_count = followingCount || 0;
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Search users by username
app.get('/v1/users/search/:username', async (req, res) => {
  try {
    const username = req.params.username;
    
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        username,
        full_name,
        avatar_url,
        created_at
      `)
      .ilike('username', `%${username}%`)
      .limit(10);
    
    if (error) throw error;
    
    res.json({
      data: users,
      total: users.length
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get posts by specific user (by ID or username)
app.get('/v1/users/:userId/posts', async (req, res) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    
    // Check if it's a UUID or username
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    
    let query = supabase
      .from('posts')
      .select(`
        id,
        content,
        created_at,
        updated_at,
        user_id,
        title,
        image_url,
        video_url,
        media_type,
        users!inner(id, username, full_name, avatar_url)
      `);
    
        if (isUuid) {
      query = query.eq('user_id', userId);
    } else {
      // Join with users table to filter by username
      query = query.eq('users.username', userId);
    }
    
    const { data: posts, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    // Get likes and comments counts for each post
    const postsWithCounts = await Promise.all(
      posts.map(async (post) => {
        // Get likes count
        const { count: likesCount } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);

        // Get comments count
        const { count: commentsCount } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);

        return {
          id: post.id,
          content: post.content,
          created_at: post.created_at,
          user: {
            id: post.users.id,
            username: post.users.username,
            full_name: post.users.full_name
          },
          likes_count: likesCount || 0,
          comments_count: commentsCount || 0
        };
      })
    );

    res.json({
      data: postsWithCounts,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        pages: Math.ceil((totalCount || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ error: 'Failed to fetch user posts' });
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
      .select('*');
    
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
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      data: reports,
      count: reports.length
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Analytics endpoints
app.get('/v1/analytics/trending', async (req, res) => {
  try {
    // Get trending topics (for now, return recent posts with hashtags)
    const { data: posts, error } = await supabase
      .from('posts')
      .select('content, created_at')
      .ilike('content', '%#%')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) throw error;

    // Extract hashtags from posts
    const hashtags = {};
    posts.forEach(post => {
      const matches = post.content.match(/#\w+/g);
      if (matches) {
        matches.forEach(tag => {
          hashtags[tag] = (hashtags[tag] || 0) + 1;
        });
      }
    });

    // Convert to array and sort by frequency
    const trending = Object.entries(hashtags)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    res.json({
      data: trending,
      count: trending.length
    });
  } catch (error) {
    console.error('Error fetching trending topics:', error);
    res.status(500).json({ error: 'Failed to fetch trending topics' });
  }
});

app.get('/v1/analytics/stats', async (req, res) => {
  try {
    // Get platform statistics
    const [
      { count: totalUsers },
      { count: totalPosts },
      { count: totalComments },
      { count: totalLikes }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('comments').select('*', { count: 'exact', head: true }),
      supabase.from('post_likes').select('*', { count: 'exact', head: true })
    ]);
    
    res.json({
      total_users: totalUsers || 0,
      total_posts: totalPosts || 0,
      total_comments: totalComments || 0,
      total_likes: totalLikes || 0,
      engagement_rate: totalPosts > 0 ? ((totalLikes + totalComments) / totalPosts).toFixed(2) : 0
    });
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({ error: 'Failed to fetch platform stats' });
  }
});



app.listen(PORT, () => {
  console.log(`🚀 The Social Network API server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/v1/health`);
}); 
