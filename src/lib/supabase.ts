import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient, isSupabaseConfigured } from './supabase/client';

const globalForSupabaseExport = globalThis as typeof globalThis & {
  __varejistaSupabaseSharedInstance?: SupabaseClient;
};

export function getSupabaseClient(): SupabaseClient {
  if (!globalForSupabaseExport.__varejistaSupabaseSharedInstance) {
    globalForSupabaseExport.__varejistaSupabaseSharedInstance = createClient();
  }
  return globalForSupabaseExport.__varejistaSupabaseSharedInstance;
}

export { isSupabaseConfigured };
export const supabase: SupabaseClient = getSupabaseClient();
