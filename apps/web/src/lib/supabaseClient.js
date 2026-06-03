import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://evrscfmdbguruwjcckfw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2cnNjZm1kYmd1cnV3amNja2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4OTA5ODMsImV4cCI6MjA5NTQ2Njk4M30.MnoWP0L5wVwCGCkCDq4AAL3tDx_azvaPfJbzPpKbl78';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
});
