import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedUserAndProfile,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

export async function GET() {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json(
      { error: 'Supabase não configurado no ambiente.', notifications: [] },
      { status: 503 }
    );
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user) {
      return NextResponse.json(
        { error: 'Autenticação obrigatória.', notifications: [] },
        { status: 401 }
      );
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const { data, error } = await dbClient
      .from('notifications')
      .select('id, titulo, mensagem, canal, lido, created_at')
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      return NextResponse.json({ error: error.message, notifications: [] }, { status: 500 });
    }

    return NextResponse.json({ notifications: data || [] });
  } catch (err) {
    console.error('Erro em GET /api/notificacoes:', err);
    return NextResponse.json({ error: 'Erro interno ao consultar notificações.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado no ambiente.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user) {
      return NextResponse.json({ error: 'Autenticação obrigatória.' }, { status: 401 });
    }

    const body = await req.json();
    const { notificationId, markAll } = body;

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;

    if (markAll) {
      const { error } = await dbClient
        .from('notifications')
        .update({ lido: true })
        .eq('user_id', ctx.user.id)
        .eq('lido', false);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else if (notificationId) {
      const { error } = await dbClient
        .from('notifications')
        .update({ lido: true })
        .eq('id', notificationId)
        .eq('user_id', ctx.user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      return NextResponse.json(
        { error: 'Informe notificationId ou markAll=true.' },
        { status: 400 }
      );
    }

    const { data: updatedList } = await dbClient
      .from('notifications')
      .select('id, titulo, mensagem, canal, lido, created_at')
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    return NextResponse.json({
      message: 'Notificações atualizadas.',
      notifications: updatedList || [],
    });
  } catch (err) {
    console.error('Erro em PATCH /api/notificacoes:', err);
    return NextResponse.json({ error: 'Erro interno ao atualizar notificações.' }, { status: 500 });
  }
}
