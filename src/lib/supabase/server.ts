import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseJsClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';
import type { UserProfile } from '@/lib/types';
import { isConfiguredSupabaseEnv } from './config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseServerConfigured = isConfiguredSupabaseEnv(supabaseUrl, supabaseAnonKey);

export function createServerSupabaseClient(): SupabaseClient {
  if (!isSupabaseServerConfigured) {
    throw new Error(
      'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no ambiente.'
    );
  }

  const headerList = headers();
  const authHeader = headerList.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      return createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });
    }
  }

  const cookieStore = cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called inside Server Component where mutating cookies is a no-op
        }
      },
    },
  });
}

export interface AuthSessionContext {
  supabase: SupabaseClient;
  user: User | null;
  profile: UserProfile | null;
}

export function mapDbProfileToUserProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    email: String(row.email || ''),
    role: (row.role as UserProfile['role']) || 'comprador',
    cnpj: String(row.cnpj || ''),
    razaoSocial: String(row.razao_social || ''),
    nomeFantasia: String(row.nome_fantasia || ''),
    inscricaoEstadual: row.inscricao_estadual ? String(row.inscricao_estadual) : undefined,
    telefone: row.telefone ? String(row.telefone) : undefined,
    endereco: {
      cidade: String(row.cidade || 'São Paulo'),
      uf: String(row.uf || 'SP'),
      cep: String(row.cep || ''),
      logradouro: String(row.logradouro || ''),
    },
    limiteCreditoEscrow: Number(row.limite_credito_escrow ?? 0),
    statusAprovacao: (row.status_aprovacao as UserProfile['statusAprovacao']) || 'em_analise',
    dataCadastro: String(row.created_at || new Date().toISOString()),
  };
}

export async function getAuthenticatedUserAndProfile(): Promise<AuthSessionContext | null> {
  if (!isSupabaseServerConfigured) {
    return null;
  }

  const supabase = createServerSupabaseClient();
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { supabase, user: null, profile: null };
    }

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    return {
      supabase,
      user,
      profile: profileRow ? mapDbProfileToUserProfile(profileRow as Record<string, unknown>) : null,
    };
  } catch (err) {
    console.error('Erro de rede ao validar sessão no Supabase:', err);
    return { supabase, user: null, profile: null };
  }
}
