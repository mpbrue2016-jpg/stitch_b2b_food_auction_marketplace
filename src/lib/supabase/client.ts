import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isConfiguredSupabaseEnv } from './config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = isConfiguredSupabaseEnv(supabaseUrl, supabaseAnonKey);

const globalForSupabase = globalThis as typeof globalThis & {
  __varejistaSupabaseBrowserClient?: SupabaseClient;
  __varejistaSupabaseServerFallbackClient?: SupabaseClient;
};

export function createClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    if (typeof window !== 'undefined') {
      if (!globalForSupabase.__varejistaSupabaseBrowserClient) {
        globalForSupabase.__varejistaSupabaseBrowserClient = createBrowserClient(
          'https://placeholder-project.supabase.co',
          'placeholder-anon-key',
          { isSingleton: true }
        );
      }
      return globalForSupabase.__varejistaSupabaseBrowserClient;
    }
    if (!globalForSupabase.__varejistaSupabaseServerFallbackClient) {
      globalForSupabase.__varejistaSupabaseServerFallbackClient = createBrowserClient(
        'https://placeholder-project.supabase.co',
        'placeholder-anon-key',
        { isSingleton: false }
      );
    }
    return globalForSupabase.__varejistaSupabaseServerFallbackClient;
  }

  if (typeof window === 'undefined') {
    if (!globalForSupabase.__varejistaSupabaseServerFallbackClient) {
      globalForSupabase.__varejistaSupabaseServerFallbackClient = createBrowserClient(
        supabaseUrl,
        supabaseAnonKey,
        { isSingleton: false }
      );
    }
    return globalForSupabase.__varejistaSupabaseServerFallbackClient;
  }

  if (!globalForSupabase.__varejistaSupabaseBrowserClient) {
    globalForSupabase.__varejistaSupabaseBrowserClient = createBrowserClient(
      supabaseUrl,
      supabaseAnonKey,
      { isSingleton: true }
    );
  }

  return globalForSupabase.__varejistaSupabaseBrowserClient;
}
