import { NextResponse } from 'next/server';
import {
  getAuthenticatedUserAndProfile,
  isSupabaseServerConfigured,
  mapDbProfileToUserProfile,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { isAuthorizedAdminProfile } from '@/lib/auth-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 503 });
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
    const [
      { data: profiles },
      { data: docs },
      { data: wormLogs },
      { data: webhooks },
      { data: auctionsRows },
      { data: ordersRows },
      { data: proposalsRows },
    ] = await Promise.all([
      dbClient.from('profiles').select('*').order('created_at', { ascending: false }).limit(80),
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
      dbClient.from('auctions').select('id, is_demo').limit(300),
      dbClient.from('orders').select('id, is_demo, valor_total_arremate').limit(300),
      dbClient.from('negotiation_proposals').select('id, is_demo').limit(300),
    ]);

    const mappedProfiles = (profiles || []).map((p) =>
      mapDbProfileToUserProfile(p as Record<string, unknown>)
    );

    const realProfiles = mappedProfiles.filter((p) => !p.isDemo);
    const demoProfiles = mappedProfiles.filter((p) => Boolean(p.isDemo));

    const realOrders = (ordersRows || []).filter((o) => !(o as { is_demo?: boolean }).is_demo);
    const demoOrders = (ordersRows || []).filter((o) => Boolean((o as { is_demo?: boolean }).is_demo));

    const realAuctions = (auctionsRows || []).filter((a) => !(a as { is_demo?: boolean }).is_demo);
    const demoAuctions = (auctionsRows || []).filter((a) => Boolean((a as { is_demo?: boolean }).is_demo));

    const realProposals = (proposalsRows || []).filter((p) => !(p as { is_demo?: boolean }).is_demo);
    const demoProposals = (proposalsRows || []).filter((p) => Boolean((p as { is_demo?: boolean }).is_demo));

    const realVolumeEscrow = realOrders.reduce(
      (sum, o) => sum + Number((o as { valor_total_arremate?: number }).valor_total_arremate || 0),
      0
    );

    return NextResponse.json({
      profiles: realProfiles,
      demoProfiles,
      documents: docs || [],
      wormLogs: wormLogs || [],
      webhooks: webhooks || [],
      separacao: {
        real: {
          usuarios: realProfiles.length,
          lotes: realAuctions.length,
          pedidos: realOrders.length,
          propostas: realProposals.length,
          volumeEscrow: Number(realVolumeEscrow.toFixed(2)),
        },
        modelo: {
          usuarios: demoProfiles.length,
          lotes: demoAuctions.length,
          pedidos: demoOrders.length,
          propostas: demoProposals.length,
        },
      },
    });
  } catch (err) {
    console.error('Erro em GET /api/admin/overview:', err);
    return NextResponse.json({ error: 'Erro interno ao carregar governança.' }, { status: 500 });
  }
}
