import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedUserAndProfile,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { isAuthorizedAdminProfile } from '@/lib/auth-admin';
import { buildAuditHash } from '@/lib/security';

export async function GET(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado no ambiente.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json({ error: 'Autenticação obrigatória.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get('id');
    if (!documentId) {
      return NextResponse.json({ error: 'Parâmetro obrigatório: id do documento.' }, { status: 400 });
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const { data: docRow, error: fetchErr } = await dbClient
      .from('user_documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle();

    if (fetchErr || !docRow) {
      return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
    }

    if (String(docRow.user_id) !== ctx.user.id && !isAuthorizedAdminProfile(ctx.profile)) {
      return NextResponse.json({ error: 'Acesso negado a este documento KYC.' }, { status: 403 });
    }

    const { data: signedData, error: signErr } = await dbClient.storage
      .from('kyc-docs')
      .createSignedUrl(String(docRow.storage_path), 900);

    if (signErr || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: signErr?.message || 'Não foi possível gerar link seguro do documento.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: signedData.signedUrl,
      document: docRow,
    });
  } catch (err) {
    console.error('Erro em GET /api/admin/documentos:', err);
    return NextResponse.json({ error: 'Erro interno ao consultar documento KYC.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado no ambiente.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json({ error: 'Autenticação obrigatória.' }, { status: 401 });
    }
    if (!isAuthorizedAdminProfile(ctx.profile)) {
      return NextResponse.json(
        { error: 'Apenas o Administrador Master autorizado pode homologar documentos KYC.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { documentId, statusValidacao, observacao } = body;

    if (!documentId || !['aprovado', 'rejeitado', 'em_analise'].includes(statusValidacao)) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: documentId e statusValidacao (aprovado | rejeitado | em_analise).' },
        { status: 400 }
      );
    }

    const obsTrimmed =
      typeof observacao === 'string' && observacao.trim() ? observacao.trim().slice(0, 240) : null;

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const { data: updatedDoc, error } = await dbClient
      .from('user_documents')
      .update({
        status_validacao: statusValidacao,
      })
      .eq('id', documentId)
      .select('*')
      .maybeSingle();

    if (error || !updatedDoc) {
      return NextResponse.json(
        { error: error?.message || 'Documento KYC não localizado.' },
        { status: 404 }
      );
    }

    await dbClient.from('notifications').insert({
      user_id: updatedDoc.user_id,
      titulo: `Documento KYC ${statusValidacao === 'aprovado' ? 'Aprovado' : statusValidacao === 'rejeitado' ? 'Recusado' : 'Em Análise'}`,
      mensagem: `O documento "${updatedDoc.nome_arquivo}" teve status atualizado para ${statusValidacao}.${obsTrimmed ? ` Obs: ${obsTrimmed}` : ''}`,
      canal: 'in_app',
    });

    await dbClient.from('audit_worm_logs').insert({
      tipo_evento: 'kyc_documento_revisado',
      protocolo: `DOC-${String(updatedDoc.id).slice(0, 8).toUpperCase()}`,
      payload_json: {
        documentId: updatedDoc.id,
        targetUserId: updatedDoc.user_id,
        statusValidacao,
        observacao: obsTrimmed,
        adminId: ctx.user.id,
      },
      merkle_root_hash: buildAuditHash(String(updatedDoc.id), 'kyc_documento_revisado', {
        statusValidacao,
      }),
      responsavel_id: ctx.user.id,
    });

    return NextResponse.json({
      message: `Documento "${updatedDoc.nome_arquivo}" atualizado para "${statusValidacao}".`,
      document: updatedDoc,
    });
  } catch (err) {
    console.error('Erro em PATCH /api/admin/documentos:', err);
    return NextResponse.json({ error: 'Erro interno ao atualizar documento KYC.' }, { status: 500 });
  }
}
