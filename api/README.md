# The Social Network API

This folder contains all the API-related code for The Social Network project, organized for easy deployment to Vercel.

## Files Overview

- `api-server.js` - Main API server with authentication and rate limiting
- `simple-api-server.js` - Simplified API server for testing and production
- `package.json` - API dependencies and scripts
- `supabaseClient.js` - Supabase client configuration
- `createApiKeysTable.js` - Utility for creating API keys table
- `vercel.json` - Vercel deployment configuration
- `.env.example` - Example environment variables

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   ```
   REACT_APP_SUPABASE_URL=your_supabase_url
   REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
   PORT=3001
   ```

3. Run the API server:
   ```bash
   npm start
   ```

## API Endpoints

### Authentication Required
All endpoints require a valid API key in the Authorization header:
```
Authorization: Bearer your_api_key_here
```

### Available Endpoints

#### Posts
- `GET /v1/posts` - Get all posts with pagination
  - Query params: `page`, `limit`, `sort` (newest, oldest, popular)
  - Returns: `{ data: [...], pagination: {...} }`

- `GET /v1/posts/:postId` - Get a specific post with comments
  - Returns: `{ ...post, comments: [...], likes_count: number }`

#### Users
- `GET /v1/users/:userId` - Get a specific user profile by ID or username
  - Supports both UUID and username (e.g., `/v1/users/jet` or `/v1/users/9d45f6d9-f243-4957-a410-5601439fa0cc`)
  - Returns: `{ id, username, full_name, avatar_url, created_at, posts_count, followers_count, following_count }`

- `GET /v1/users/search/:username` - Search users by username (partial match)
  - Returns: `{ data: [...], total: number }`

- `GET /v1/users/:userId/posts` - Get posts by a specific user (by ID or username)
  - Query params: `page`, `limit`
  - Returns: `{ data: [...], pagination: {...} }`

#### Analytics
- `GET /v1/analytics/stats` - Get platform statistics
  - Returns: `{ total_users, total_posts, total_comments, total_likes, engagement_rate }`

- `GET /v1/analytics/trending` - Get trending topics
  - Returns: `{ data: [...], count: number }`

#### Reports
- `GET /v1/reports` - Get content reports
  - Returns: `{ data: [...], count: number }`

#### Health Check
- `GET /v1/health` - Health check endpoint (no auth required)
  - Returns: `{ success: true, message: '...', timestamp: '...', version: '1.0.0' }`

## User-Friendly Features

### Username Support
The API now supports both UUID and username identifiers for better user experience:

- **User Profiles**: `/v1/users/jet` or `/v1/users/9d45f6d9-f243-4957-a410-5601439fa0cc`
- **User Posts**: `/v1/users/jet/posts` or `/v1/users/9d45f6d9-f243-4957-a410-5601439fa0cc/posts`
- **User Search**: `/v1/users/search/jet` (partial match)

### JSON Prettification
All responses are automatically prettified with proper indentation for better readability.

## Response Format

All endpoints return JSON responses. The format matches the DeveloperPortal.js expectations:

### Posts List
```json
{
  "data": [
    {
      "id": "post-id",
      "content": "Post content",
      "created_at": "2024-01-01T00:00:00Z",
      "user": {
        "id": "user-id",
        "username": "username",
        "full_name": "Full Name"
      },
      "likes_count": 0,
      "comments_count": 0
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

### Single Post
```json
{
  "id": "post-id",
  "content": "Post content",
  "created_at": "2024-01-01T00:00:00Z",
  "user": {
    "id": "user-id",
    "username": "username",
    "full_name": "Full Name"
  },
  "comments": [
    {
      "id": "comment-id",
      "content": "Comment content",
      "created_at": "2024-01-01T00:00:00Z",
      "user": {
        "id": "user-id",
        "username": "username"
      }
    }
  ],
  "likes_count": 0
}
```

### User Profile
```json
{
  "id": "user-id",
  "username": "username",
  "full_name": "Full Name",
  "avatar_url": "https://...",
  "created_at": "2024-01-01T00:00:00Z",
  "posts_count": 5,
  "followers_count": 10,
  "following_count": 8
}
```

### User Search
```json
{
  "data": [
    {
      "id": "user-id",
      "username": "username",
      "full_name": "Full Name",
      "avatar_url": "https://...",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
        "avatar_url": "avatar-url"
      },
      "likes_count": 10,
      "comments_count": 5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### Single Post
```json
{
  "id": "post-id",
  "content": "Post content",
  "title": "Post title",
  "created_at": "2024-01-01T00:00:00Z",
  "user_id": "user-id",
  "users": {
    "username": "username",
    "full_name": "Full Name",
    "avatar_url": "avatar-url"
  },
  "comments": [
    {
      "id": "comment-id",
      "content": "Comment content",
      "created_at": "2024-01-01T00:00:00Z",
      "user_id": "user-id",
      "users": {
        "username": "username",
        "full_name": "Full Name",
        "avatar_url": "avatar-url"
      }
    }
  ],
  "likes_count": 10
}
```

### User Profile
```json
{
  "id": "user-id",
  "username": "username",
  "full_name": "Full Name",
  "avatar_url": "avatar-url",
  "followers_count": 100,
  "following_count": 50,
  "created_at": "2024-01-01T00:00:00Z"
}
```

## Rate Limiting

- 100 requests per 15 minutes per IP address
- Rate limit applies to all `/v1/` endpoints except `/v1/health`

## Deployment to Vercel

### Step 1: Prepare Your Code
1. Make sure all sensitive files are removed (api.log, .env)
2. Update `.env.example` with your production values
3. Test locally to ensure everything works

### Step 2: Push to Git
```bash
# Add all files to git
git add .

# Commit your changes
git commit -m "Add API server for deployment"

# Push to your repository
git push origin main
```

### Step 3: Deploy to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your Git repository
4. Set the root directory to `/api` (or deploy just the api folder)
5. Configure environment variables in Vercel dashboard:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
6. Deploy!

### Step 4: Update API Base URL
After deployment, update your `DeveloperPortal.js` with the new API base URL:
```javascript
const API_BASE = 'https://your-vercel-app.vercel.app/v1';
```

## Development

For development with auto-restart:
```bash
npm run dev
```

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized (invalid API key)
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error

Error responses include a message:
```json
{
  "error": "Error message here"
}
``` 