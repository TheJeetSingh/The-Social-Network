import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useUser } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import ReportPost from '../components/ReportPost';

// Enhanced UserDashboard with Twitter/X-like design
function UserDashboard() {
  const { user, loading, clearCache } = useUser();
  const navigate = useNavigate();

  const [statusMessage, setStatusMessage] = useState({ type: '', message: '' });
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState({ title: '', content: '', image_url: '', video_url: '', media_type: 'image' });
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profile, setProfile] = useState({
    username: user?.username || '',
    full_name: user?.full_name || '',
    avatar_url: user?.avatar_url || ''
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [animateIn, setAnimateIn] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [expandedPost, setExpandedPost] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [isRefreshingUserData, setIsRefreshingUserData] = useState(false);

  // Report post state
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedPostForReport, setSelectedPostForReport] = useState(null);



  // Following/Followers state
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [isLoadingFollowers, setIsLoadingFollowers] = useState(false);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  // User stats state
  const [userPostCount, setUserPostCount] = useState(0);

  // Ref to track if notifications have been fetched
  const notificationsFetchedRef = useRef(false);
  // Ref to track if user data has been refreshed
  const userDataRefreshedRef = useRef(false);

  // Animation states
  const [fadeIn, setFadeIn] = useState(false);
  const [slideIn, setSlideIn] = useState(false);
  const [pulse, setPulse] = useState(false);

  // Auto-hide success messages
  useEffect(() => {
    if (statusMessage.type === 'success' && statusMessage.message) {
      const timer = setTimeout(() => {
        setStatusMessage({ type: '', message: '' });
      }, 2000); // Hide after 2 seconds
      
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Helper function to set status message with auto-hide for success
  const setStatusMessageWithAutoHide = (type, message) => {
    setStatusMessage({ type, message });
  };

  // Helper function to handle authentication errors
  const handleAuthError = useCallback(async (error) => {
    console.error('Authentication error:', error);
    
    // If it's a 403 or 401 error, clear cache, sign out, and redirect
    if (error?.status === 403 || error?.status === 401 || error?.message?.includes('403')) {
      console.log('Clearing auth cache and signing out due to authentication error');
      await clearCache(); // Uses centralized clearAuthCache helper
      navigate('/');
      return;
    }
  }, [clearCache, navigate]);

  // Report post handlers
  const handleReportPost = (post) => {
    setSelectedPostForReport(post);
    setShowReportModal(true);
  };

  const handleCloseReportModal = () => {
    setShowReportModal(false);
    setSelectedPostForReport(null);
  };

  const handleReportSubmitted = () => {
    setStatusMessageWithAutoHide('success', 'Post reported successfully. Thank you for helping keep our community safe.');
  };




  // Check session and redirect if needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/');
      }
    }
    checkSession();
  }, [navigate]);

  // Main user data initialization effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (user && user.id && !userDataRefreshedRef.current) {
      console.log('🚀 Initializing user dashboard for:', user.email);
      
      // Only fetch posts once when user is loaded, not on every re-render
      fetchPosts();
      setProfile({
        username: user.username || '',
        full_name: user.full_name || '',
        avatar_url: user.avatar_url || ''
      });
      
      // Trigger entrance animations
      setTimeout(() => setFadeIn(true), 100);
      setTimeout(() => setSlideIn(true), 200);
      setTimeout(() => setPulse(true), 300);
      setTimeout(() => setIsLoading(false), 500);
      
      // Refresh user data in background after a short delay (only once)
      setTimeout(async () => {
        if (!userDataRefreshedRef.current) {
          userDataRefreshedRef.current = true;
          setIsRefreshingUserData(true);
          // User data is already loaded from the context
          setIsRefreshingUserData(false);
        }
      }, 1000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only depend on user.id to prevent unnecessary re-renders

  // Enhanced loading animation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setAnimateIn(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const handleSignOut = async () => {
    try {
      // clearCache now handles both cache clearing and sign out
      await clearCache();
      
      // Force navigation to landing page
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
      setStatusMessageWithAutoHide('error', 'Failed to sign out');
      // Force navigation anyway
      window.location.href = '/';
    }
  };

  const fetchPosts = async () => {
    try {
      // Check if posts table exists first
      const { error: tableCheckError } = await supabase
        .from('posts')
        .select('*')
        .limit(1);

      if (tableCheckError) {
        console.log('Posts table does not exist yet - setting empty posts array');
        setPosts([]);
        return;
      }

      // If table exists, fetch posts with relationships
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          users!posts_user_id_fkey(id, email, username, full_name, avatar_url),
          post_likes(user_id),
          comments(
            id,
            content,
            created_at,
            users!comments_user_id_fkey(id, email, username, full_name, avatar_url)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (postsError) {
        console.log('Error fetching posts with relationships, trying simple fetch:', postsError);
        const { data: simpleData, error: simpleError } = await supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (simpleError) {
          console.log('Simple fetch also failed, setting empty posts:', simpleError);
          setPosts([]);
          return;
        }
        setPosts(simpleData || []);
        return;
      }
      
      setPosts(postsData || []);
    } catch (error) {
      console.log('Unexpected error fetching posts:', error);
      setPosts([]);
    }
  };

  const fetchUserPostCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (error) {
        console.warn('Error fetching user post count:', error);
        return 0;
      }
      return count || 0;
    } catch (error) {
      console.warn('Error fetching user post count:', error);
      return 0;
    }
  }, [user?.id]);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.content.trim()) {
      setStatusMessageWithAutoHide('error', 'Post content is required');
      return;
    }

    if (!user || !user.id) {
      setStatusMessageWithAutoHide('error', 'User not properly loaded. Please refresh the page.');
      return;
    }

    setIsCreatingPost(true);
    setUploadingFile(true);
    
    try {
      console.log('Creating post with user ID:', user.id);
      
      let mediaUrl = null;
      let mediaType = 'image';

      // Upload file if selected
      if (selectedFile) {
        try {
          mediaUrl = await uploadFile(selectedFile);
          mediaType = selectedFile.type.startsWith('image/') ? 'image' : 'video';
        } catch (uploadError) {
          console.error('File upload failed:', uploadError);
          setStatusMessageWithAutoHide('error', 'Failed to upload file. Please try again.');
          return;
        }
      }
      
      const postData = {
        user_id: user.id,
        content: newPost.content.trim(),
        image_url: mediaType === 'image' ? mediaUrl : null,
        video_url: mediaType === 'video' ? mediaUrl : null,
        media_type: mediaType
      };

      if (newPost.title.trim()) {
        postData.title = newPost.title.trim();
      }

      console.log('Post data:', postData);

      const { error } = await supabase
        .from('posts')
        .insert([postData])
        .select()
        .single();

      if (error) {
        console.error('Error creating post:', error);
        setStatusMessageWithAutoHide('error', 'Failed to create post. Please try again.');
        return;
      }



      setNewPost({ title: '', content: '', image_url: '', video_url: '', media_type: 'image' });
      clearFileUpload();
      setStatusMessageWithAutoHide('success', 'Post created successfully!');
      fetchPosts();
      
      // Update user's post count
      fetchUserPostCount().then(count => setUserPostCount(count));
    } catch (error) {
      console.error('Error creating post:', error);
      setStatusMessageWithAutoHide('error', 'Failed to create post');
    } finally {
      setIsCreatingPost(false);
      setUploadingFile(false);
    }
  };

  // File upload functions
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setStatusMessageWithAutoHide('error', 'File size must be less than 50MB');
      return;
    }

    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      setStatusMessageWithAutoHide('error', 'Please select an image or video file');
      return;
    }

    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setFilePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const uploadFile = async (file) => {
    if (!file || !user?.id) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const filePath = `${file.type.startsWith('image/') ? 'images' : 'videos'}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };

  const clearFileUpload = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setNewPost(prev => ({ ...prev, image_url: '', video_url: '', media_type: 'image' }));
  };

  // Helper function to create notifications
  const createNotification = async (recipientId, senderId, type, title, message, relatedId = null) => {
    if (!user?.id || recipientId === user.id) return; // Don't notify yourself
    
    try {
      const { error } = await supabase
        .from('notifications')
        .insert([{
          recipient_id: recipientId,
          sender_id: senderId,
          type: type,
          title: title,
          message: message,
          related_id: relatedId,
          is_read: false
        }]);

      if (error) {
        console.error('Error creating notification:', error);
      }
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  const handleLikePost = async (postId) => {
    if (!user.id) {
      console.warn('User ID not available for liking post');
      return;
    }

    try {
      const { error } = await supabase
        .from('post_likes')
        .insert([{
          post_id: postId,
          user_id: user.id
        }]);

      if (error && error.code !== '23505') {
        console.warn('Error liking post:', error);
        return;
      }

      // Create notification for the post owner
      const post = posts.find(p => p.id === postId);
      if (post && post.user_id !== user.id) {
        const senderName = user.full_name || user.username || user.email?.split('@')[0];
        await createNotification(
          post.user_id,
          user.id,
          'like',
          `${senderName} liked your post`,
          `${senderName} liked your post "${post.title || 'your post'}"`,
          postId
        );
      }
      
      // Refresh posts data to show updated like count
      await fetchPosts();
    } catch (error) {
      console.warn('Error liking post:', error);
    }
  };

  const handleUnlikePost = async (postId) => {
    if (!user.id) {
      console.warn('User ID not available for unliking post');
      return;
    }

    try {
      const { error } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);

      if (error) {
        console.warn('Error unliking post:', error);
        return;
      }
      
      // Refresh posts data to show updated like count
      await fetchPosts();
    } catch (error) {
      console.warn('Error unliking post:', error);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsEditingProfile(true);
    
    try {
      const { error } = await supabase
        .from('users')
        .update({
          username: profile.username.trim() || null,
          full_name: profile.full_name.trim() || null,
          avatar_url: profile.avatar_url.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        console.error('Profile update error:', error);
        setStatusMessageWithAutoHide('error', 'Failed to update profile. Please try again.');
        return;
      }

      setStatusMessageWithAutoHide('success', 'Profile updated successfully!');
      setIsEditingProfile(false);
    } catch (error) {
      console.error('Profile update error:', error);
      setStatusMessageWithAutoHide('error', 'Failed to update profile');
      setIsEditingProfile(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setStatusMessageWithAutoHide('error', 'File size must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setStatusMessageWithAutoHide('error', 'Please select a valid image file');
      return;
    }

    try {
      setStatusMessageWithAutoHide('info', 'Uploading image...');
      
      // First, check if avatars bucket exists
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        console.error('Storage buckets error:', bucketsError);
        setStatusMessageWithAutoHide('error', 'Storage not configured. Please contact support.');
        return;
      }

      const avatarsBucket = buckets.find(bucket => bucket.name === 'avatars');
      
      if (!avatarsBucket) {
        // If bucket doesn't exist, convert to base64 for now
        console.warn('Avatars bucket not found, converting to base64');
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64Data = event.target.result;
          
          // Update profile with base64 image
          setProfile(prev => ({ ...prev, avatar_url: base64Data }));
          
          // Save to database
          const { error: updateError } = await supabase
            .from('users')
            .update({
              avatar_url: base64Data,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

          if (updateError) {
            console.error('Profile update error:', updateError);
            setStatusMessageWithAutoHide('error', 'Failed to save image. Please try again.');
            return;
          }

          setStatusMessageWithAutoHide('success', 'Profile picture updated successfully!');
          e.target.value = '';
        };
        reader.readAsDataURL(file);
        return;
      }

      // Upload to Supabase Storage (if bucket exists)
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        setStatusMessageWithAutoHide('error', 'Failed to upload image. Please try again.');
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      
      // Save to database
      const { error: updateError } = await supabase
        .from('users')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        setStatusMessageWithAutoHide('error', 'Failed to save image. Please try again.');
        return;
      }

      setStatusMessageWithAutoHide('success', 'Profile picture updated successfully!');
      
      // Clear the file input
      e.target.value = '';
      
    } catch (error) {
      console.error('Avatar upload error:', error);
      setStatusMessageWithAutoHide('error', 'Failed to upload image');
    }
  };

  const isPostLiked = (post) => {
    if (!user.id) return false;
    return post.post_likes?.some(like => like.user_id === user.id);
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const postDate = new Date(dateString);
    const diffInSeconds = Math.floor((now - postDate) / 1000);
    
    if (diffInSeconds < 60) return 'now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d`;
    return postDate.toLocaleDateString();
  };

  const handleImagePreview = (url) => {
    setImagePreviewUrl(url);
    setShowImagePreview(true);
  };

  const closeImagePreview = () => {
    setShowImagePreview(false);
    setImagePreviewUrl('');
  };

  const handleCommentClick = (postId) => {
    if (expandedPost === postId) {
      setExpandedPost(null); // Close comments if already open
    } else {
      setExpandedPost(postId); // Open comments
    }
    setNewComment(''); // Clear comment input
  };

  const handleAddComment = async (postId) => {
    if (!newComment.trim() || !user.id) return;

    setIsCommenting(true);
    try {
      const { error } = await supabase
        .from('comments')
        .insert([{
          post_id: postId,
          user_id: user.id,
          content: newComment.trim()
        }]);

      if (error) {
        console.error('Error adding comment:', error);
        setStatusMessageWithAutoHide('error', 'Failed to add comment. Please try again.');
        return;
      }

      // Get the post details for notifications
      const post = posts.find(p => p.id === postId);
      const senderName = user.full_name || user.username || user.email?.split('@')[0];

      // Create notification for the post owner (if not commenting on your own post)
      if (post && post.user_id !== user.id) {
        await createNotification(
          post.user_id,
          user.id,
          'comment',
          `${senderName} commented on your post`,
          `${senderName} commented: "${newComment.trim()}"`,
          postId
        );
      }

      // Create notifications for users who previously commented on this post
      if (post && post.comments) {
        const uniqueCommenters = [...new Set(post.comments.map(c => c.user_id))];
        for (const commenterId of uniqueCommenters) {
          if (commenterId !== user.id && commenterId !== post.user_id) {
            await createNotification(
              commenterId,
              user.id,
              'comment_reply',
              `${senderName} also commented on a post`,
              `${senderName} also commented on a post you commented on`,
              postId
            );
          }
        }
      }

      // Clear the comment input immediately
      setNewComment('');
      
      // Refresh the posts data to show the new comment
      await fetchPosts();
      
      setStatusMessageWithAutoHide('success', 'Comment added successfully!');
    } catch (error) {
      console.error('Error adding comment:', error);
      setStatusMessageWithAutoHide('error', 'Failed to add comment');
    } finally {
      setIsCommenting(false);
    }
  };

  // Following/Followers functions
  const fetchFollowers = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoadingFollowers(true);
    try {
      // Check if user is authenticated first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No active session, skipping followers fetch');
        setFollowers([]);
        return;
      }

      const { data, error } = await supabase
        .from('followers')
        .select(`
          follower_id,
          users!followers_follower_id_fkey(id, email, username, full_name, avatar_url)
        `)
        .eq('following_id', user.id);

      if (error) {
        console.error('Error fetching followers:', error);
        // Handle authentication errors
        await handleAuthError(error);
        // Don't show error to user for this, just set empty array
        setFollowers([]);
        return;
      }

      setFollowers(data || []);
    } catch (error) {
      console.error('Error fetching followers:', error);
      await handleAuthError(error);
      setFollowers([]);
    } finally {
      setIsLoadingFollowers(false);
    }
  }, [user?.id, handleAuthError]);

  const fetchFollowing = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoadingFollowing(true);
    try {
      // Check if user is authenticated first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No active session, skipping following fetch');
        setFollowing([]);
        return;
      }

      const { data, error } = await supabase
        .from('followers')
        .select(`
          following_id,
          users!followers_following_id_fkey(id, email, username, full_name, avatar_url)
        `)
        .eq('follower_id', user.id);

      if (error) {
        console.error('Error fetching following:', error);
        // Handle authentication errors
        await handleAuthError(error);
        // Don't show error to user for this, just set empty array
        setFollowing([]);
        return;
      }

      setFollowing(data || []);
    } catch (error) {
      console.error('Error fetching following:', error);
      await handleAuthError(error);
      setFollowing([]);
    } finally {
      setIsLoadingFollowing(false);
    }
  }, [user?.id, handleAuthError]);

  const handleFollow = async (userId) => {
    if (!user?.id) {
      console.error('No current user ID available');
      return;
    }

    if (!userId) {
      console.error('No target user ID provided');
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error('Invalid user ID format:', userId);
      setStatusMessageWithAutoHide('error', 'Invalid user ID format');
      return;
    }

    // Prevent following yourself
    if (userId === user.id) {
      console.error('Cannot follow yourself');
      setStatusMessageWithAutoHide('error', 'You cannot follow yourself');
      return;
    }

    // Debug authentication
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Current session:', session ? 'Authenticated' : 'Not authenticated');
    console.log('Current user ID:', user.id);
    console.log('Target user ID:', userId);

    // Test if we can read from followers table (should work if authenticated)
    const { error: testError } = await supabase
      .from('followers')
      .select('*')
      .limit(1);
    console.log('Test read from followers:', testError ? 'Failed' : 'Success', testError);

    console.log('Attempting to follow user:', { follower_id: user.id, following_id: userId });

    try {
      const { error } = await supabase
        .from('followers')
        .insert([{
          follower_id: user.id,
          following_id: userId
        }]);

      if (error) {
        console.error('Supabase error following user:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        if (error.code === '23505') {
          // Unique constraint violation - already following
          setStatusMessageWithAutoHide('info', 'You are already following this user');
        } else {
          setStatusMessageWithAutoHide('error', `Failed to follow user: ${error.message}`);
        }
        return;
      }

      setStatusMessageWithAutoHide('success', 'User followed successfully!');
      fetchFollowers();
      fetchFollowing();
      
      // Create notification for the followed user
      const senderName = user.full_name || user.username || user.email?.split('@')[0];
      await createNotification(
        userId,
        user.id,
        'follow',
        `${senderName} started following you`,
        `${senderName} started following you`,
        null
      );
      
      // Refresh the selected user's data if profile modal is open
      if (showUserProfile && selectedUser) {
        try {
          const { data: freshUserData, error } = await supabase
            .from('users')
            .select('id, email, username, full_name, avatar_url, followers_count, following_count, created_at')
            .eq('id', selectedUser.id)
            .single();

          if (!error && freshUserData) {
            setSelectedUser(freshUserData);
          }
        } catch (error) {
          console.error('Error refreshing user data:', error);
        }
      }
    } catch (error) {
      console.error('Exception following user:', error);
      setStatusMessageWithAutoHide('error', 'Failed to follow user');
    }
  };

  const handleUnfollow = async (userId) => {
    if (!user?.id) {
      console.error('No current user ID available');
      return;
    }

    if (!userId) {
      console.error('No target user ID provided');
      return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error('Invalid user ID format:', userId);
      setStatusMessageWithAutoHide('error', 'Invalid user ID format');
      return;
    }

    // Prevent unfollowing yourself
    if (userId === user.id) {
      console.error('Cannot unfollow yourself');
      setStatusMessageWithAutoHide('error', 'You cannot unfollow yourself');
      return;
    }

    console.log('Attempting to unfollow user:', { follower_id: user.id, following_id: userId });

    try {
      const { error } = await supabase
        .from('followers')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', userId);

      if (error) {
        console.error('Supabase error unfollowing user:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        setStatusMessageWithAutoHide('error', `Failed to unfollow user: ${error.message}`);
        return;
      }

      setStatusMessageWithAutoHide('success', 'User unfollowed successfully!');
      fetchFollowers();
      fetchFollowing();
      
      // Refresh the selected user's data if profile modal is open
      if (showUserProfile && selectedUser) {
        try {
          const { data: freshUserData, error } = await supabase
            .from('users')
            .select('id, email, username, full_name, avatar_url, followers_count, following_count, created_at')
            .eq('id', selectedUser.id)
            .single();

          if (!error && freshUserData) {
            setSelectedUser(freshUserData);
          }
        } catch (error) {
          console.error('Error refreshing user data:', error);
        }
      }
    } catch (error) {
      console.error('Exception unfollowing user:', error);
      setStatusMessageWithAutoHide('error', 'Failed to unfollow user');
    }
  };

  const isFollowing = (userId) => {
    return following.some(followingItem => followingItem.following_id === userId);
  };

  const handleUserProfileClick = async (userData) => {
    console.log('User profile clicked:', {
      id: userData?.id,
      email: userData?.email,
      username: userData?.username,
      full_name: userData?.full_name
    });
    
    // Fetch fresh user data with current follower/following counts
    try {
      const { data: freshUserData, error } = await supabase
        .from('users')
        .select('id, email, username, full_name, avatar_url, followers_count, following_count, created_at')
        .eq('id', userData.id)
        .single();

      if (error) {
        console.error('Error fetching fresh user data:', error);
        setSelectedUser(userData); // Fallback to original data
      } else {
        setSelectedUser(freshUserData);
      }
    } catch (error) {
      console.error('Error fetching fresh user data:', error);
      setSelectedUser(userData); // Fallback to original data
    }
    
    setShowUserProfile(true);
  };

  // Notification functions
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoadingNotifications(true);
    try {
      // Check if user is authenticated first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No active session, skipping notifications fetch');
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          sender:users!notifications_sender_id_fkey(id, email, username, full_name, avatar_url)
        `)
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching notifications:', error);
        // Handle authentication errors
        await handleAuthError(error);
        // Don't show error to user for this, just set empty arrays
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      setNotifications(data || []);
      
      // Count unread notifications
      const unreadCount = (data || []).filter(notification => !notification.is_read).length;
      console.log('Fetched notifications:', data?.length || 0, 'Unread count:', unreadCount);
      setUnreadCount(unreadCount);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      await handleAuthError(error);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [user?.id, handleAuthError]);

  const markNotificationAsRead = async (notificationId) => {
    console.log('Marking notification as read:', notificationId);
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }

      console.log('Successfully marked notification as read');
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return;
      }

      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const formatNotificationTime = (dateString) => {
    const now = new Date();
    const notificationDate = new Date(dateString);
    const diffInSeconds = Math.floor((now - notificationDate) / 1000);
    
    if (diffInSeconds < 60) return 'now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return notificationDate.toLocaleDateString();
  };

  // Load following/followers data when user changes
  useEffect(() => {
    if (user?.id && !notificationsFetchedRef.current) {
      notificationsFetchedRef.current = true;
      fetchFollowers();
      fetchFollowing();
      fetchNotifications();
      
      // Fetch user's post count for dashboard stats
      fetchUserPostCount().then(count => setUserPostCount(count));
      
      // Set up real-time subscription for notifications
      const notificationsSubscription = supabase
        .channel('notifications')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notifications',
            filter: `recipient_id=eq.${user.id}`
          }, 
          (payload) => {
            console.log('New notification received:', payload);
            // Only refresh if it's a new notification for this user
            if (payload.new && payload.new.recipient_id === user.id) {
              fetchNotifications(); // Refresh notifications
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(notificationsSubscription);
      };
    }
  }, [user?.id, fetchFollowers, fetchFollowing, fetchNotifications, fetchUserPostCount]);

  // Reset notifications fetched ref when user changes
  useEffect(() => {
    notificationsFetchedRef.current = false;
  }, [user?.id]);

  // Show loading state while user data is being processed
  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Setting up your dashboard...</p>
        <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
          Please wait while we prepare your account
        </p>
      </div>
    );
  }

  // Show message if no user (shouldn't happen due to redirect, but just in case)
  if (!user) {
    return (
      <div className="dashboard-error">
        <p>Please sign in to access your dashboard.</p>
      </div>
    );
  }

  return (
    <div className={`user-dashboard ${animateIn ? 'animate-in' : ''}`}>
      {/* Enhanced Header with Animations */}
      <div className={`user-header ${fadeIn ? 'fade-in' : ''}`}>
        <div className="user-title">
          <h1 className="gradient-text">User Dashboard</h1>
          <p className="current-user">
            Welcome back, {user.email}
            {isRefreshingUserData && (
              <span className="refreshing-indicator" title="Refreshing user data...">
                🔄
              </span>
            )}
          </p>
        </div>
        
        <div className="header-actions">
          <div className="tab-buttons">
            <button 
              className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''} ${slideIn ? 'slide-in' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            <button 
              className={`tab-button ${activeTab === 'posts' ? 'active' : ''} ${slideIn ? 'slide-in' : ''}`}
              onClick={() => setActiveTab('posts')}
            >
              Posts
            </button>
            <button 
              className={`tab-button ${activeTab === 'profile' ? 'active' : ''} ${slideIn ? 'slide-in' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              Profile
            </button>
          </div>
          
          <div className="header-controls">

            <button 
              className="notification-button"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              🔔
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount}</span>
              )}
            </button>
            <button onClick={handleSignOut} className="sign-out-button">
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Status Messages */}
      {statusMessage.message && (
        <div className={`status-message ${statusMessage.type} ${pulse ? 'pulse' : ''}`}>
          {statusMessage.message}
        </div>
      )}

      {/* Enhanced Dashboard Content */}
      {activeTab === 'dashboard' && (
        <div className={`dashboard-content ${fadeIn ? 'fade-in' : ''}`}>
          <div className="welcome-section glass-effect">
            <h2 className="gradient-text">Welcome to The Social Network</h2>
            <p>You've been approved! This is your personal dashboard.</p>
            <p>Create posts and interact with the community.</p>
            <div className="welcome-stats">
              <div className="stat-card">
                <span className="stat-number">{userPostCount}</span>
                <span className="stat-label">Posts</span>
              </div>
              <div className="stat-card clickable" onClick={() => setShowFollowersModal(true)}>
                <span className="stat-number">{user.followers_count || 0}</span>
                <span className="stat-label">Followers</span>
              </div>
              <div className="stat-card clickable" onClick={() => setShowFollowingModal(true)}>
                <span className="stat-number">{user.following_count || 0}</span>
                <span className="stat-label">Following</span>
              </div>

            </div>
          </div>

          <div className="user-info glass-effect">
            <h3>Your Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Email:</span>
                <span className="info-value">{user.email}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Member since:</span>
                <span className="info-value">{new Date(user.created_at).toLocaleDateString()}</span>
              </div>
              {user.last_login && (
                <div className="info-item">
                  <span className="info-label">Last login:</span>
                  <span className="info-value">{new Date(user.last_login).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Posts Section */}
      {activeTab === 'posts' && (
        <div className={`posts-content ${fadeIn ? 'fade-in' : ''}`}>
          <div className="create-post-section glass-effect">
            <h2 className="gradient-text">What's happening?</h2>
            <form onSubmit={handleCreatePost} className="create-post-form">
              <div className="post-input-container">
                <textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                  placeholder="What's happening?"
                  className="post-textarea"
                  rows="3"
                  required
                  disabled={isCreatingPost}
                  maxLength="280"
                />
                
                {/* File upload section */}
                <div className="file-upload-section">
                  <div className="upload-buttons">
                    <label className="upload-button">
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileSelect}
                        disabled={isCreatingPost}
                        style={{ display: 'none' }}
                      />
                      📷 Photo
                    </label>
                    <label className="upload-button">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileSelect}
                        disabled={isCreatingPost}
                        style={{ display: 'none' }}
                      />
                      🎥 Video
                    </label>
                    {selectedFile && (
                      <button
                        type="button"
                        onClick={clearFileUpload}
                        className="clear-upload-button"
                        disabled={isCreatingPost}
                      >
                        ❌ Clear
                      </button>
                    )}
                  </div>
                  
                  {/* File preview */}
                  {filePreview && (
                    <div className="file-preview">
                      {selectedFile?.type.startsWith('image/') ? (
                        <img src={filePreview} alt="Preview" className="preview-image" />
                      ) : (
                        <video src={filePreview} controls className="preview-video" />
                      )}
                      <div className="file-info">
                        <span>{selectedFile?.name}</span>
                        <span>{(selectedFile?.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="post-input-footer">
                  <div className="post-input-info">
                    <span className="character-count">{newPost.content.length}/280</span>

                  </div>
                  <button 
                    type="submit" 
                    className={`create-post-button ${isCreatingPost ? 'submitting' : ''} ${pulse ? 'pulse' : ''}`}
                    disabled={isCreatingPost || !newPost.content.trim()}
                  >
                    {isCreatingPost ? (uploadingFile ? 'Uploading...' : 'Posting...') : 'Post'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="posts-section glass-effect">
            <h2 className="gradient-text">Feed</h2>
            <div className="posts-list">
              {posts.map((post, index) => (
                <div 
                  key={post.id} 
                  className="post-card"
                  data-post-id={post.id}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="post-avatar">
                    <img 
                      src={post.users?.avatar_url || 'https://ui-avatars.com/api/?name=User&background=random'} 
                      alt="Avatar" 
                      className="avatar-image clickable"
                      onClick={() => handleUserProfileClick(post.users)}
                      onError={(e) => {
                        console.error('Failed to load post avatar:', post.users?.avatar_url);
                        e.target.src = 'https://ui-avatars.com/api/?name=User&background=random';
                      }}
                    />
                  </div>
                  <div className="post-content">
                    <div className="post-header">
                      <div className="post-user-info">
                        <span 
                          className="post-name clickable"
                          onClick={() => handleUserProfileClick(post.users)}
                        >
                          {post.users?.full_name || post.users?.username || post.users?.email}
                        </span>
                        <span 
                          className="post-username clickable"
                          onClick={() => handleUserProfileClick(post.users)}
                        >
                          @{post.users?.username || post.users?.email?.split('@')[0]}
                        </span>
                        <span className="post-time">· {formatTimeAgo(post.created_at)}</span>
                      </div>
                    </div>
                    <div className="post-text">
                      <p>{post.content}</p>
                      {post.image_url && post.media_type === 'image' && (
                        <img 
                          src={post.image_url} 
                          alt="Post" 
                          className="post-image clickable"
                          onClick={() => handleImagePreview(post.image_url)}
                        />
                      )}
                      {post.video_url && post.media_type === 'video' && (
                        <video 
                          src={post.video_url} 
                          controls 
                          className="post-video"
                          preload="metadata"
                        />
                      )}

                    </div>
                    <div className="post-actions">
                      <button
                        onClick={() => handleCommentClick(post.id)}
                        className="action-button comment-button"
                      >
                        <span className="action-icon">💬</span>
                        <span className="action-count">{post.comments?.length || 0}</span>
                      </button>
                      <button
                        onClick={() => isPostLiked(post) ? handleUnlikePost(post.id) : handleLikePost(post.id)}
                        className={`action-button like-button ${isPostLiked(post) ? 'liked' : ''} ${pulse ? 'pulse' : ''}`}
                      >
                        <span className="action-icon">{isPostLiked(post) ? '❤️' : '🤍'}</span>
                        <span className="action-count">{post.post_likes?.length || 0}</span>
                      </button>
                      <button
                        onClick={() => handleReportPost(post)}
                        className="action-button report-button"
                      >
                        <span className="action-icon">⚠️</span>
                      </button>
                    </div>
                    
                    {/* Comments Section */}
                    {expandedPost === post.id && (
                      <div className="comments-section">
                        <div className="comment-input-container">
                          <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Write a comment..."
                            className="comment-textarea"
                            rows="2"
                            maxLength="280"
                          />
                          <button
                            onClick={() => handleAddComment(post.id)}
                            className="comment-submit-button"
                            disabled={!newComment.trim() || isCommenting}
                          >
                            {isCommenting ? 'Posting...' : 'Reply'}
                          </button>
                        </div>
                        <div className="comments-list">
                          {post.comments?.map((comment) => (
                            <div key={comment.id} className="comment-item">
                              <div className="comment-avatar">
                                <img 
                                  src={comment.users?.avatar_url || 'https://ui-avatars.com/api/?name=User&background=random&size=32'} 
                                  alt="Avatar" 
                                  className="comment-avatar-image clickable"
                                  onClick={() => handleUserProfileClick(comment.users)}
                                  onError={(e) => {
                                    console.error('Failed to load comment avatar:', comment.users?.avatar_url);
                                    e.target.src = 'https://ui-avatars.com/api/?name=User&background=random&size=32';
                                  }}
                                />
                              </div>
                              <div className="comment-content">
                                <div className="comment-header">
                                  <span 
                                    className="comment-name clickable"
                                    onClick={() => handleUserProfileClick(comment.users)}
                                  >
                                    {comment.users?.full_name || comment.users?.username || comment.users?.email}
                                  </span>
                                  <span className="comment-time">· {formatTimeAgo(comment.created_at)}</span>
                                </div>
                                <p className="comment-text">{comment.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {posts.length === 0 && (
                <div className="no-posts glass-effect">
                  <p>No posts yet. Be the first to create one!</p>
                  <button 
                    onClick={() => setActiveTab('posts')} 
                    className="create-first-post-button"
                  >
                    Create Your First Post
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Profile Section */}
      {activeTab === 'profile' && (
        <div className={`profile-content ${fadeIn ? 'fade-in' : ''}`}>
          <div className="profile-section glass-effect">
            <h2 className="gradient-text">Profile Settings</h2>
            <form onSubmit={handleUpdateProfile} className="profile-form">
              <div className="profile-avatar-section">
                <div className="avatar-container" onClick={() => document.getElementById('avatar-upload').click()}>
                  <img 
                    src={profile.avatar_url || 'https://ui-avatars.com/api/?name=User&background=random&size=100'} 
                    alt="Profile" 
                    className="profile-avatar"
                    onError={(e) => {
                      console.error('Failed to load avatar:', profile.avatar_url);
                      e.target.src = 'https://ui-avatars.com/api/?name=User&background=random&size=100';
                    }}
                  />
                  <div className="avatar-overlay">
                    <span>Change</span>
                  </div>
                </div>
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  style={{ display: 'none' }}
                />
                <div className="upload-info">
                  <p>Click the image above to upload a new profile picture</p>
                  <p className="upload-hint">Supported formats: JPG, PNG, GIF (max 5MB)</p>
                </div>
              </div>
              
              <div className="profile-input-group">
                <label>Display Name</label>
                <input
                  type="text"
                  value={profile.full_name}
                  onChange={(e) => setProfile({...profile, full_name: e.target.value})}
                  placeholder="Your display name"
                  className="profile-input"
                />
              </div>

              <div className="profile-input-group">
                <label>Username</label>
                <input
                  type="text"
                  value={profile.username}
                  onChange={(e) => setProfile({...profile, username: e.target.value})}
                  placeholder="Your username (optional)"
                  className="profile-input"
                />
              </div>

              <div className="profile-input-group">
                <label>Email</label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="profile-input disabled"
                />
                <small>Email cannot be changed</small>
              </div>

              <button 
                type="submit" 
                className={`update-profile-button ${isEditingProfile ? 'submitting' : ''} ${pulse ? 'pulse' : ''}`}
                disabled={isEditingProfile}
              >
                {isEditingProfile ? 'Updating...' : 'Update Profile'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Followers Modal */}
      {showFollowersModal && (
        <div className="modal-overlay" onClick={() => setShowFollowersModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Followers</h3>
              <button className="close-button" onClick={() => setShowFollowersModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {isLoadingFollowers ? (
                <div className="loading-spinner"></div>
              ) : followers.length > 0 ? (
                <div className="followers-list">
                  {followers.map((follower) => (
                    <div key={follower.id} className="follower-item">
                      <div className="follower-avatar">
                        <img 
                          src={follower.users?.avatar_url || 'https://ui-avatars.com/api/?name=User&background=random'} 
                          alt="Avatar" 
                          className="avatar-image clickable"
                          onClick={() => handleUserProfileClick(follower.users)}
                        />
                      </div>
                      <div className="follower-info">
                        <span 
                          className="follower-name clickable"
                          onClick={() => handleUserProfileClick(follower.users)}
                        >
                          {follower.users?.full_name || follower.users?.username || follower.users?.email}
                        </span>
                        <span 
                          className="follower-username clickable"
                          onClick={() => handleUserProfileClick(follower.users)}
                        >
                          @{follower.users?.username || follower.users?.email?.split('@')[0]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No followers yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Following Modal */}
      {showFollowingModal && (
        <div className="modal-overlay" onClick={() => setShowFollowingModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Following</h3>
              <button className="close-button" onClick={() => setShowFollowingModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {isLoadingFollowing ? (
                <div className="loading-spinner"></div>
              ) : following.length > 0 ? (
                <div className="following-list">
                  {following.map((followedUser) => (
                    <div key={followedUser.id} className="following-item">
                      <div className="following-avatar">
                        <img 
                          src={followedUser.users?.avatar_url || 'https://ui-avatars.com/api/?name=User&background=random'} 
                          alt="Avatar" 
                          className="avatar-image clickable"
                          onClick={() => handleUserProfileClick(followedUser.users)}
                        />
                      </div>
                      <div className="following-info">
                        <span 
                          className="following-name clickable"
                          onClick={() => handleUserProfileClick(followedUser.users)}
                        >
                          {followedUser.users?.full_name || followedUser.users?.username || followedUser.users?.email}
                        </span>
                        <span 
                          className="following-username clickable"
                          onClick={() => handleUserProfileClick(followedUser.users)}
                        >
                          @{followedUser.users?.username || followedUser.users?.email?.split('@')[0]}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnfollow(followedUser.following_id)}
                        className="unfollow-button"
                      >
                        Unfollow
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Not following anyone yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotifications && (
        <div className="modal-overlay" onClick={() => setShowNotifications(false)}>
          <div className="modal-content notifications-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Notifications</h3>
              <div className="notification-actions">
                {unreadCount > 0 && (
                  <button 
                    className="mark-all-read-button"
                    onClick={markAllNotificationsAsRead}
                  >
                    Mark all read
                  </button>
                )}
                <button className="close-button" onClick={() => setShowNotifications(false)}>×</button>
              </div>
            </div>
            <div className="modal-body">
              {isLoadingNotifications ? (
                <div className="loading-spinner"></div>
              ) : notifications.length > 0 ? (
                <div className="notifications-list">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      className={`notification-item ${!notification.is_read ? 'unread' : ''} notification-type-${notification.type}`}
                      onClick={() => markNotificationAsRead(notification.id)}
                    >
                      <div className="notification-avatar">
                        <img 
                          src={notification.sender?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(notification.sender?.full_name || notification.sender?.username || notification.sender?.email?.split('@')[0] || 'User')}&background=random`} 
                          alt="Avatar" 
                          className="avatar-image clickable"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (notification.sender) {
                              handleUserProfileClick(notification.sender);
                            }
                          }}
                        />
                        <div className={`notification-type-icon ${notification.type}`}>
                          {notification.type === 'like' && '❤️'}
                          {notification.type === 'comment' && '💬'}
                          {notification.type === 'comment_reply' && '↩️'}
                          {notification.type === 'follow' && '👥'}
                        </div>
                      </div>
                      <div className="notification-content">
                        <div className="notification-header">
                          <span className="notification-title">{notification.title}</span>
                          <span className="notification-time">{formatNotificationTime(notification.created_at)}</span>
                        </div>
                        <p className="notification-message">{notification.message}</p>
                      </div>
                      {!notification.is_read && (
                        <div className="unread-indicator"></div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-notifications">
                  <p>No notifications yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {showUserProfile && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowUserProfile(false)}>
          <div className="modal-content user-profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>User Profile</h3>
              <button className="close-button" onClick={() => setShowUserProfile(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="user-profile-content">
                <div className="user-profile-avatar">
                  <img 
                    src={selectedUser.avatar_url || 'https://ui-avatars.com/api/?name=User&background=random&size=100'} 
                    alt="Avatar" 
                    className="profile-avatar-large"
                  />
                </div>
                <div className="user-profile-info">
                  <h4 className="user-profile-name">
                    {selectedUser.full_name || selectedUser.username || selectedUser.email}
                  </h4>
                  <p className="user-profile-username">
                    @{selectedUser.username || selectedUser.email?.split('@')[0]}
                  </p>
                  {selectedUser.created_at && (
                    <p className="user-profile-joined">
                      Joined {new Date(selectedUser.created_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long' 
                      })}
                    </p>
                  )}
                  <div className="user-profile-stats">
                    <div className="profile-stat">
                      <span className="stat-number">{selectedUser.followers_count || 0}</span>
                      <span className="stat-label">Followers</span>
                    </div>
                    <div className="profile-stat">
                      <span className="stat-number">{selectedUser.following_count || 0}</span>
                      <span className="stat-label">Following</span>
                    </div>
                  </div>
                  
                  {selectedUser.id && selectedUser.id !== user?.id ? (
                    <button
                      onClick={() => {
                        console.log('Profile modal button clicked:', { 
                          selectedUserId: selectedUser.id, 
                          currentUserId: user?.id, 
                          isFollowing: isFollowing(selectedUser.id) 
                        });
                        if (isFollowing(selectedUser.id)) {
                          handleUnfollow(selectedUser.id);
                        } else {
                          handleFollow(selectedUser.id);
                        }
                        setShowUserProfile(false);
                      }}
                      className={`follow-button profile-follow-button ${isFollowing(selectedUser.id) ? 'following' : ''}`}
                    >
                      {isFollowing(selectedUser.id) ? 'Unfollow' : 'Follow'}
                    </button>
                  ) : selectedUser.id === user?.id ? (
                    <div style={{ color: '#666', fontSize: '14px' }}>This is your profile</div>
                  ) : (
                    <div style={{ color: '#666', fontSize: '14px' }}>Invalid user data</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {showImagePreview && (
        <div className="image-preview-modal" onClick={closeImagePreview}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={closeImagePreview}>×</button>
            <img src={imagePreviewUrl} alt="Preview" className="preview-image" />
          </div>
        </div>
      )}

      {/* Report Post Modal */}
      {showReportModal && selectedPostForReport && (
        <ReportPost
          post={selectedPostForReport}
          onClose={handleCloseReportModal}
          onReportSubmitted={handleReportSubmitted}
        />
      )}



      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      )}
    </div>
  );
}

export default UserDashboard;


