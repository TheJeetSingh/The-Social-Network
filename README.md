# The Social Network

A modern, passwordless social networking platform built with React and Supabase, featuring OAuth authentication, real-time posts, and comprehensive admin controls.

## Description

The Social Network is an exclusive, invite-only social platform that prioritizes user privacy and seamless authentication. Built with modern web technologies, it offers a streamlined user experience with passwordless authentication through magic links and OAuth providers, comprehensive content moderation tools, and real-time social interactions.

### Key Features
- **Passwordless Authentication**: Magic links and Google OAuth for seamless sign-in
- **Exclusive Access**: Admin-controlled user management and waitlist system
- **Content Moderation**: Built-in post reporting and admin review system
- **Real-time Updates**: Live post creation and social interactions
- **Responsive Design**: Modern, mobile-friendly interface
- **Secure Database**: Row Level Security (RLS) for data protection

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Features](#features)
- [Authentication](#authentication)
- [Database Schema](#database-schema)
- [Admin Dashboard](#admin-dashboard)
- [API Server](#api-server)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account
- Google Cloud Console account (for OAuth)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd thesocialnetwork
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   
   Create a `.env` file in the root directory:
   ```env
   REACT_APP_SUPABASE_URL=your_supabase_project_url
   REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Supabase Setup**
   
   - Create a new Supabase project
   - Set up the database schema (see [Database Schema](#database-schema))
   - Configure authentication providers
   - Set up Row Level Security policies

5. **Google OAuth Configuration**
   
   - Create a Google Cloud Console project
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs:
     - `http://localhost:3000/auth-callback` (development)
     - `https://yourdomain.com/auth-callback` (production)

6. **Start the development server**
   ```bash
   npm start
   ```

## Usage

### For Users

1. **Sign Up/Sign In**
   - Visit the landing page
   - Choose between Google OAuth or email magic link
   - Complete authentication flow
   - Access your personalized dashboard

2. **Creating Posts**
   - Navigate to your dashboard
   - Use the post creation form
   - Add text content
   - Submit to share with the community

3. **Reporting Content**
   - Click the ⚠️ icon on any post
   - Select a reason for reporting
   - Add optional description
   - Submit for admin review

### For Admins

1. **Access Admin Dashboard**
   - Sign in with admin credentials
   - Navigate to `/admin`
   - Manage users and content reports

2. **User Management**
   - View all registered users
   - Add/remove admin privileges
   - Monitor user activity

3. **Content Moderation**
   - Review reported posts
   - Dismiss false reports
   - Remove inappropriate content
   - Track moderation actions

## Features

### Authentication System
- **Magic Link Authentication**: Passwordless email-based sign-in
- **Google OAuth**: One-click sign-in with Google accounts
- **Session Management**: Secure session handling with Supabase
- **Role-based Access**: Admin and user role differentiation

### User Dashboard
- **Post Creation**: Real-time post publishing
- **Content Feed**: View posts from the community
- **Profile Management**: User profile and settings
- **Report System**: Flag inappropriate content

### Admin Dashboard
- **User Management**: Add/remove users and admins
- **Content Moderation**: Review and act on reported posts
- **Analytics**: Track user activity and reports
- **System Controls**: Manage platform settings

### Security Features
- **Row Level Security**: Database-level access control
- **Input Validation**: Client and server-side validation
- **XSS Protection**: Sanitized content rendering
- **CSRF Protection**: Secure form submissions

## Authentication

### Magic Link Flow
1. User enters email address
2. System checks user status (admin/user/waitlist)
3. Magic link sent to email
4. User clicks link to authenticate
5. Redirected to appropriate dashboard

### OAuth Flow
1. User clicks Google sign-in button
2. Redirected to Google OAuth
3. User authorizes application
4. Redirected to `/auth-callback`
5. User account created/authenticated
6. Redirected to dashboard

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Admins Table
```sql
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Posts Table
```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Post Reports Table
```sql
CREATE TABLE post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  resolved_by UUID REFERENCES admins(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row Level Security Policies

#### Users Table Policies
```sql
-- Users can read their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- Admins can read all user data
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins WHERE email = auth.jwt() ->> 'email'
    )
  );
```

#### Posts Table Policies
```sql
-- Users can create posts
CREATE POLICY "Users can create posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read all posts
CREATE POLICY "Users can view all posts" ON posts
  FOR SELECT USING (true);

-- Users can update their own posts
CREATE POLICY "Users can update own posts" ON posts
  FOR UPDATE USING (auth.uid() = user_id);
```

#### Post Reports Table Policies
```sql
-- Users can create reports
CREATE POLICY "Users can create reports" ON post_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Users can view their own reports
CREATE POLICY "Users can view own reports" ON post_reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- Admins can view all reports
CREATE POLICY "Admins can view all reports" ON post_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins WHERE email = auth.jwt() ->> 'email'
    )
  );

-- Admins can update reports
CREATE POLICY "Admins can update reports" ON post_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM admins WHERE email = auth.jwt() ->> 'email'
    )
  );
```

## Admin Dashboard

### User Management
- View all registered users
- Add new admin users
- Remove admin privileges
- Monitor user activity

### Content Moderation
- Review reported posts
- Dismiss false reports
- Remove inappropriate content
- Track moderation history

### System Features
- Real-time updates
- Responsive design
- Bulk actions
- Search and filtering

## API Server

The API server is located in the `/api` folder and provides RESTful endpoints for external integrations. It's designed to be deployed independently to Vercel.

### Quick Start

1. **Navigate to the API folder**
   ```bash
   cd api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

4. **Run the server**
   ```bash
   npm start
   ```

### Deployment

The API folder is ready for Vercel deployment:

1. **Using the deployment script**
   ```bash
   cd api
   ./deploy.sh
   ```

2. **Manual deployment**
   ```bash
   cd api
   vercel --prod
   ```

### API Documentation

See the [API README](./api/README.md) for complete documentation including:
- Available endpoints
- Authentication requirements
- Rate limiting
- Environment variables

### Features
- **RESTful API**: Full CRUD operations for posts and users
- **User-Friendly URLs**: Support for both UUID and username identifiers
- **User Search**: Find users by username with partial matching
- **API Key Authentication**: Secure access control
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Request Logging**: Comprehensive analytics and monitoring
- **CORS Support**: Cross-origin resource sharing enabled
- **JSON Prettification**: Automatically formatted responses

## Deployment

### Vercel Deployment

1. **Connect Repository**
   - Link your GitHub repository to Vercel
   - Configure build settings

2. **Environment Variables**
   - Add `REACT_APP_SUPABASE_URL`
   - Add `REACT_APP_SUPABASE_ANON_KEY`

3. **Build Configuration**
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "build",
     "installCommand": "npm install"
   }
   ```

4. **Domain Configuration**
   - Update Supabase redirect URLs
   - Configure custom domain (optional)

### Production Checklist

- [ ] Environment variables configured
- [ ] Supabase project settings updated
- [ ] OAuth redirect URLs configured
- [ ] Database RLS policies enabled
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificates verified
- [ ] Performance monitoring enabled

## Contributing

We welcome contributions! Please follow these guidelines:

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style
- Use consistent formatting
- Follow React best practices
- Add comments for complex logic
- Use meaningful variable names

### Testing
- Test authentication flows
- Verify database operations
- Check responsive design
- Validate form submissions

### Pull Request Process
1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass
4. Update changelog
5. Request review from maintainers

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### License Terms
- **Use**: Free to use for personal and commercial projects
- **Modify**: Can be modified and distributed
- **Distribute**: Can be shared and redistributed
- **Attribution**: Must include original license and copyright notice

## Support

### Getting Help

- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Join community discussions for questions and ideas

### Common Issues

#### Authentication Problems
- Verify Supabase configuration
- Check OAuth redirect URLs
- Ensure environment variables are set

#### Database Errors
- Confirm RLS policies are enabled
- Check table permissions
- Verify user roles and access

#### Build Errors
- Clear node_modules and reinstall
- Check for ESLint warnings
- Verify all dependencies are installed

### Contact Information

- **GitHub**: [Project Repository](https://github.com/TheJeetSingh/The-Social-Network)
- **Issues**: [GitHub Issues](https://github.com/TheJeetSingh/The-Social-Network/issues)
- **Email**: 4lifeinstantkarma@gmail.com

### Roadmap

- [ ] Real-time messaging
- [ ] User profiles and avatars
- [ ] Post reactions and comments
- [ ] Advanced search functionality
- [ ] Mobile app development
- [ ] API documentation
- [ ] Third-party integrations

---

**Built with ❤️ using React, Supabase, and modern web technologies**
