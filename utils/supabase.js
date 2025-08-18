import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@env";

// Debug logging
console.log('Environment variables loaded:', {
  SUPABASE_URL: SUPABASE_URL ? 'Present' : 'Missing',
  SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? 'Present' : 'Missing'
});

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
