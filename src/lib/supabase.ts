import { createClient, isSupabaseConfigured } from './supabase/client';

export { isSupabaseConfigured };
export const supabase = createClient();
