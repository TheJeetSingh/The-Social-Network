import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Debug logging to ensure environment variables are loaded
console.log('🔧 Supabase initialization...');
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Anon Key (first 20 chars):', supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'NOT LOADED');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Please check your .env file contains:');
  console.error('REACT_APP_SUPABASE_URL=your_supabase_url');
  console.error('REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key');
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

// Test the connection immediately
console.log('🧪 Testing Supabase connection...');
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('❌ Supabase connection error:', error);
  } else {
    console.log('✅ Supabase client initialized successfully');
    if (data.session) {
      console.log('👤 Active session found for:', data.session.user.email);
    } else {
      console.log('👤 No active session found');
    }
  }
}).catch((error) => {
  console.error('❌ Failed to test Supabase connection:', error);
}); 