import { NextResponse } from 'next/server';
import {
  getAuthenticatedUserAndProfile,
  isSupabaseServerConfigured,
  mapDbProfileToUserProfile,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

export async function GET() {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json({ error: 'Autenticação obrigatória.' }, { status: 401 });
    }
    if (ctx.profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso restrito a administradores.' },
        { status: 403 }
      );
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const [{ data: profiles }, { data: docs }, { data: wormLogs }, { data: webhooks }] =
      await Promise.all([
        dbClient.from('profiles').select('*').order('created_at', { ascending: false }).limit(50),
        dbClient
          .from('user_documents')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        dbClient
          .from('audit_worm_logs')
          .select('id, tipo_evento, protocolo, merkle_root_hash, responsavel_id, created_at')
          .order('created_at', { ascending: false })
          .limit(30),
        dbClient
          .from('webhooks_logs')
          .select('id, endpoint, metodo, status_code, tempo_resposta_ms, created_at')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

    return NextResponse.json({
      profiles: (profiles || []).map((p) =>
        mapDbProfileToUserProfile(p as Record<string, unknown>)
      ),
      documents: docs || [],
      wormLogs: wormLogs || [],
      webhooks: webhooks || [],
    });
  } catch (err) {
    console.error('Erro em GET /api/admin/overview:', err);
    return NextResponse.json({ error: 'Erro interno ao carregar governança.' }, { status: 500 });
  }
}
