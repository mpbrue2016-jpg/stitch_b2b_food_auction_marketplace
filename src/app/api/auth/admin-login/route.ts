import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  assertSoleAdminAuthRequest,
  normalizeAdminCpfDigits,
  normalizeAdminEmail,
  SOLE_ADMIN_CPF_FORMATTED,
  SOLE_ADMIN_EMAIL,
} from '@/lib/auth-admin';
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
    const email = normalizeAdminEmail(typeof body?.email === 'string' ? body.email : '');
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

    // Restrição fixa obrigatória: somente mpbrue2016@gmail.com + CPF 11567025854
    const soleCheck = assertSoleAdminAuthRequest({ email, cpf: rawCpf });
    if (!soleCheck.ok) {
      return NextResponse.json({ error: soleCheck.error }, { status: 403 });
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
      email: SOLE_ADMIN_EMAIL,
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

    if (normalizeAdminEmail(authData.user.email) !== SOLE_ADMIN_EMAIL) {
      await supabase.auth.signOut();
      return applyCookies(
        NextResponse.json(
          { error: 'Identidade autenticada não autorizada para o perfil administrativo.' },
          { status: 403 }
        ),
        pendingCookies
      );
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : supabase;
    const { data: profileRow, error: profileErr } = await dbClient
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileErr && profileErr.code !== 'PGRST116') {
      await supabase.auth.signOut();
      return applyCookies(
        NextResponse.json(
          { error: 'Erro ao consultar perfil administrativo no banco de dados.' },
          { status: 500 }
        ),
        pendingCookies
      );
    }

    const dbCpfDigits = normalizeAdminCpfDigits(profileRow?.cpf ? String(profileRow.cpf) : null);
    if (dbCpfDigits && dbCpfDigits !== soleCheck.cpfDigits) {
      await supabase.auth.signOut();
      return applyCookies(
        NextResponse.json(
          { error: 'O CPF cadastrado no banco não corresponde ao titular administrativo único.' },
          { status: 403 }
        ),
        pendingCookies
      );
    }

    let finalProfileRow = (profileRow || null) as Record<string, unknown> | null;

    // Garante vínculo e atualização idempotente do perfil único do Administrador Master (sem CNPJ, CPF fixo)
    const needsSync =
      !finalProfileRow ||
      finalProfileRow.role !== 'admin' ||
      !dbCpfDigits ||
      finalProfileRow.cnpj !== null ||
      finalProfileRow.is_demo === true;

    if (needsSync) {
      const adminUpsertPayload: Record<string, unknown> = {
        id: authData.user.id,
        email: SOLE_ADMIN_EMAIL,
        role: 'admin',
        tipo_pessoa: 'PF',
        perfil_comercial: 'admin',
        is_demo: false,
        cpf: SOLE_ADMIN_CPF_FORMATTED,
        cnpj: null,
        razao_social:
          (finalProfileRow?.razao_social as string | undefined) ||
          'Administração Master Varejista Online',
        nome_fantasia:
          (finalProfileRow?.nome_fantasia as string | undefined) || 'Admin Master',
        status_aprovacao: 'aprovado',
        limite_credito_escrow: 0,
      };

      let { data: syncedRow, error: syncErr } = await dbClient
        .from('profiles')
        .upsert(adminUpsertPayload, { onConflict: 'id' })
        .select('*')
        .maybeSingle();

      // Fallback caso colunas de 20261120000000 ainda não existam, mantendo obrigatoriamente cpf e role = admin
      if (syncErr && syncErr.code === '42703' && !syncErr.message?.includes('cpf')) {
        delete adminUpsertPayload.tipo_pessoa;
        delete adminUpsertPayload.perfil_comercial;
        delete adminUpsertPayload.is_demo;
        const retry = await dbClient
          .from('profiles')
          .upsert(adminUpsertPayload, { onConflict: 'id' })
          .select('*')
          .maybeSingle();
        syncedRow = retry.data;
        syncErr = retry.error;
      }

      if (syncErr || !syncedRow) {
        await supabase.auth.signOut();
        return applyCookies(
          NextResponse.json(
            {
              error:
                'Não foi possível sincronizar o perfil administrativo no banco. Aplique as migrations 20261119000000_admin_cpf_support.sql, 20261120000000_demo_vs_real_separation.sql e 20261121000000_sole_admin_restriction.sql no Supabase.',
            },
            { status: 409 }
          ),
          pendingCookies
        );
      }

      finalProfileRow = syncedRow as Record<string, unknown>;
    }

    if (isSupabaseAdminConfigured) {
      try {
        const admin = createAdminSupabaseClient();
        await admin.from('audit_worm_logs').insert({
          tipo_evento: 'admin_login_cpf',
          protocolo: `ADMIN-${SOLE_ADMIN_CPF_FORMATTED}`,
          payload_json: {
            adminId: authData.user.id,
            email: SOLE_ADMIN_EMAIL,
            cpf: SOLE_ADMIN_CPF_FORMATTED,
            ip: extractClientIp(req),
            exclusiveKeyVerified: Boolean(configuredExclusiveSecret),
          },
          merkle_root_hash: buildAuditHash(authData.user.id, 'admin_login_cpf', {
            cpf: SOLE_ADMIN_CPF_FORMATTED,
          }),
          responsavel_id: authData.user.id,
        });
      } catch {
        // Auditoria best-effort não bloqueia login
      }
    }

    if (!finalProfileRow) {
      await supabase.auth.signOut();
      return applyCookies(
        NextResponse.json(
          { error: 'Perfil administrativo não encontrado após sincronização.' },
          { status: 403 }
        ),
        pendingCookies
      );
    }

    const mapped = mapDbProfileToUserProfile(finalProfileRow);
    if (mapped.role !== 'admin') {
      await supabase.auth.signOut();
      return applyCookies(
        NextResponse.json(
          { error: 'Restrição administrativa não satisfeita no perfil.' },
          { status: 403 }
        ),
        pendingCookies
      );
    }

    return applyCookies(
      NextResponse.json({
        message: 'Administrador Master único autenticado com CPF e e-mail fixos autorizados.',
        profile: mapped,
        session: authData.session
          ? {
              access_token: authData.session.access_token,
              refresh_token: authData.session.refresh_token,
            }
          : null,
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
