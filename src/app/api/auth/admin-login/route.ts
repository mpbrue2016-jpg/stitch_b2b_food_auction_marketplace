import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { formatCpf } from '@/lib/format';
import { buildAuditHash, extractClientIp, isValidCpfDigits, safeCompareSecrets } from '@/lib/security';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { isSupabaseServerConfigured, mapDbProfileToUserProfile } from '@/lib/supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function applyCookies(
  response: NextResponse,
  pendingCookies: Array<{ name: string; value: string; options: CookieOptions }>
): NextResponse {
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}

export async function GET() {
  return NextResponse.json(
    {
      exclusiveKeyRequired: Boolean(process.env.ADMIN_EXCLUSIVE_PASSWORD?.trim()),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function POST(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json(
      { error: 'Supabase não configurado no ambiente.' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const rawCpf = typeof body?.cpf === 'string' ? body.cpf : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const exclusiveInput =
      typeof body?.exclusivePassword === 'string'
        ? body.exclusivePassword
        : typeof body?.exclusiveKey === 'string'
        ? body.exclusiveKey
        : '';

    if (!isValidCpfDigits(rawCpf)) {
      return NextResponse.json(
        { error: 'Informe um CPF válido com 11 dígitos e dígitos verificadores corretos.' },
        { status: 400 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Informe o e-mail e a senha do Administrador.' },
        { status: 400 }
      );
    }

    const configuredExclusiveSecret = process.env.ADMIN_EXCLUSIVE_PASSWORD?.trim();
    if (configuredExclusiveSecret) {
      if (!exclusiveInput || !safeCompareSecrets(exclusiveInput, configuredExclusiveSecret)) {
        return NextResponse.json(
          { error: 'Senha exclusiva de cofre administrativo inválida.' },
          { status: 401 }
        );
      }
    }

    const cookieStore = cookies();
    const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    });

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return applyCookies(
        NextResponse.json(
          { error: authError?.message || 'Credenciais de administrador inválidas.' },
          { status: 401 }
        ),
        pendingCookies
      );
    }

    const { data: profileRow, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileErr || !profileRow) {
      await supabase.auth.signOut();
      return applyCookies(
        NextResponse.json(
          { error: 'Perfil administrativo não localizado no banco de dados.' },
          { status: 403 }
        ),
        pendingCookies
      );
    }

    if (profileRow.role !== 'admin') {
      await supabase.auth.signOut();
      return applyCookies(
        NextResponse.json(
          {
            error:
              'Acesso restrito ao Administrador Master. Contas de Comprador ou Fornecedor devem entrar com CNPJ.',
          },
          { status: 403 }
        ),
        pendingCookies
      );
    }

    const cleanInputCpf = rawCpf.replace(/\D/g, '');
    const formattedCpf = formatCpf(cleanInputCpf);
    const dbCpfDigits = String(profileRow.cpf || '').replace(/\D/g, '');

    if (dbCpfDigits && dbCpfDigits !== cleanInputCpf) {
      await supabase.auth.signOut();
      return applyCookies(
        NextResponse.json(
          { error: 'O CPF informado não corresponde ao titular desta conta administrativa.' },
          { status: 403 }
        ),
        pendingCookies
      );
    }

    let finalProfileRow = profileRow as Record<string, unknown>;

    // Vincula CPF no primeiro acesso se ainda não estiver preenchido e limpa CNPJ placeholder se aplicável
    if (!dbCpfDigits) {
      const patchPayload: Record<string, unknown> = {
        cpf: formattedCpf,
      };
      if (String(profileRow.cnpj || '').startsWith('PEND-')) {
        patchPayload.cnpj = null;
      }

      const dbWriter = isSupabaseAdminConfigured ? createAdminSupabaseClient() : supabase;
      const { data: updatedRow, error: updateErr } = await dbWriter
        .from('profiles')
        .update(patchPayload)
        .eq('id', authData.user.id)
        .select('*')
        .maybeSingle();

      if (updateErr) {
        await supabase.auth.signOut();
        return applyCookies(
          NextResponse.json(
            {
              error:
                'Não foi possível validar/vincular o CPF administrativo. Verifique se a migração 20261119000000_admin_cpf_support.sql foi aplicada no Supabase.',
            },
            { status: 409 }
          ),
          pendingCookies
        );
      }

      if (updatedRow) {
        finalProfileRow = updatedRow as Record<string, unknown>;
      }
    }

    if (isSupabaseAdminConfigured) {
      try {
        const admin = createAdminSupabaseClient();
        await admin.from('audit_worm_logs').insert({
          tipo_evento: 'admin_login_cpf',
          protocolo: `ADMIN-${formattedCpf}`,
          payload_json: {
            adminId: authData.user.id,
            email,
            cpf: formattedCpf,
            ip: extractClientIp(req),
            exclusiveKeyVerified: Boolean(configuredExclusiveSecret),
          },
          merkle_root_hash: buildAuditHash(authData.user.id, 'admin_login_cpf', {
            cpf: formattedCpf,
          }),
          responsavel_id: authData.user.id,
        });
      } catch {
        // Auditoria best-effort não bloqueia login
      }
    }

    return applyCookies(
      NextResponse.json({
        message: 'Administrador Master autenticado com CPF e senha exclusiva.',
        profile: mapDbProfileToUserProfile(finalProfileRow),
      }),
      pendingCookies
    );
  } catch (err) {
    console.error('Erro em POST /api/auth/admin-login:', err);
    return NextResponse.json(
      { error: 'Erro interno ao autenticar Administrador Master.' },
      { status: 500 }
    );
  }
}
