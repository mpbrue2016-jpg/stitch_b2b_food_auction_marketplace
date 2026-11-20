import { NextResponse } from 'next/server';
import {
  getAuthenticatedUserAndProfile,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { isAuthorizedAdminProfile } from '@/lib/auth-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error: 'Variáveis NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes.',
      },
      { status: 503 }
    );
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json({ error: 'Autenticação obrigatória.' }, { status: 401 });
    }
    if (!isAuthorizedAdminProfile(ctx.profile)) {
      return NextResponse.json(
        { error: 'Acesso restrito ao Administrador Master único autorizado.' },
        { status: 403 }
      );
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const startedAt = Date.now();
    const { count, error: dbErr } = await dbClient
      .from('categories')
      .select('*', { count: 'exact', head: true });
    const latencyMs = Date.now() - startedAt;

    const { error: schemaErr } = await dbClient
      .from('auctions')
      .select('id, is_demo')
      .limit(1);

    const schemaReady = !schemaErr;

    return NextResponse.json({
      ok: !dbErr,
      configured: true,
      adminKeyConfigured: isSupabaseAdminConfigured,
      schemaReady,
      schemaMessage: schemaErr
        ? 'Migrations de separação (is_demo) pendentes no SQL Editor.'
        : 'Schema completo sincronizado (is_demo ativo).',
      latencyMs,
      categoriesCount: count ?? 0,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erro em GET /api/admin/health:', err);
    return NextResponse.json(
      { ok: false, error: 'Falha ao consultar integridade do Supabase.' },
      { status: 500 }
    );
  }
}
