import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://sjlgjxyrfrbldxqhffak.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_mTi96i7ZFid_DO_QDkH9jQ_GbK3HK9R";

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);