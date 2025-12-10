import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tuedlrtbnlguhnudttac.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1ZWRscnRibmxndWhudWR0dGFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMDIxMTksImV4cCI6MjA2NTY3ODExOX0.gaFB265jH4Ubuv5Oh9xCoR2ksWbN7UJoSHSigwoOF7U';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
});