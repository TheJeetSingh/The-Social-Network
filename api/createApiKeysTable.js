import { supabase } from '../supabaseClient';

export async function createApiKeysTable() {
  try {
    console.log('Creating API keys table...');
    
    // Create the api_keys table
    const { error } = await supabase.rpc('create_api_keys_table', {
      sql: `
        CREATE TABLE IF NOT EXISTS api_keys (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          api_key TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_used_at TIMESTAMP WITH TIME ZONE,
          usage_count INTEGER DEFAULT 0
        );
        
        -- Create index for faster lookups
        CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
        CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(api_key);
        
        -- Create RLS policies
        ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
        
        -- Users can only see their own API keys
        CREATE POLICY "Users can view own api keys" ON api_keys
          FOR SELECT USING (auth.uid() = user_id);
        
        -- Users can insert their own API keys
        CREATE POLICY "Users can insert own api keys" ON api_keys
          FOR INSERT WITH CHECK (auth.uid() = user_id);
        
        -- Users can update their own API keys
        CREATE POLICY "Users can update own api keys" ON api_keys
          FOR UPDATE USING (auth.uid() = user_id);
        
        -- Users can delete their own API keys
        CREATE POLICY "Users can delete own api keys" ON api_keys
          FOR DELETE USING (auth.uid() = user_id);
      `
    });

    if (error) {
      console.error('Error creating API keys table:', error);
      throw error;
    }

    console.log('✅ API keys table created successfully');
    return true;
  } catch (error) {
    console.error('Failed to create API keys table:', error);
    return false;
  }
}

// Alternative approach using direct SQL if RPC doesn't work
export async function createApiKeysTableDirect() {
  try {
    console.log('Creating API keys table using direct SQL...');
    
    // First, let's check if the table exists
    const { data: existingTables, error: checkError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'api_keys');

    if (checkError) {
      console.log('Could not check existing tables, proceeding with creation...');
    } else if (existingTables && existingTables.length > 0) {
      console.log('API keys table already exists');
      return true;
    }

    // Since we can't create tables directly from the client,
    // we'll create a simple structure that can be used
    // The actual table creation should be done in Supabase dashboard
    
    console.log('⚠️  Please create the api_keys table manually in Supabase dashboard with the following SQL:');
    console.log(`
      CREATE TABLE api_keys (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        api_key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_used_at TIMESTAMP WITH TIME ZONE,
        usage_count INTEGER DEFAULT 0
      );
      
      CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
      CREATE INDEX idx_api_keys_key ON api_keys(api_key);
      
      ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Users can view own api keys" ON api_keys
        FOR SELECT USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can insert own api keys" ON api_keys
        FOR INSERT WITH CHECK (auth.uid() = user_id);
      
      CREATE POLICY "Users can update own api keys" ON api_keys
        FOR UPDATE USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can delete own api keys" ON api_keys
        FOR DELETE USING (auth.uid() = user_id);
    `);
    
    return false;
  } catch (error) {
    console.error('Failed to create API keys table:', error);
    return false;
  }
}

// Function to check if API keys table exists
export async function checkApiKeysTable() {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('API keys table does not exist or is not accessible');
      return false;
    }
    
    console.log('✅ API keys table exists and is accessible');
    return true;
  } catch (error) {
    console.log('API keys table check failed:', error);
    return false;
  }
} 