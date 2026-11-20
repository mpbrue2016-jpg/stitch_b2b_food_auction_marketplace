import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isConfiguredSupabaseEnv } from './config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseAdminConfigured = isConfiguredSupabaseEnv(supabaseUrl, serviceRoleKey);

const globalForAdminSupabase = globalThis as typeof globalThis & {
  __varejistaSupabaseAdminClient?: SupabaseClient;
};

export function createAdminSupabaseClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY nunca pode ser instanciada no navegador.');
  }
  if (!isSupabaseAdminConfigured) {
    throw new Error(
      'Supabase Admin não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  if (!globalForAdminSupabase.__varejistaSupabaseAdminClient) {
    globalForAdminSupabase.__varejistaSupabaseAdminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return globalForAdminSupabase.__varejistaSupabaseAdminClient;
}
