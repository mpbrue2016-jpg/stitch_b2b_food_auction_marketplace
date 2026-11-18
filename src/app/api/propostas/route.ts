import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedUserAndProfile,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { mapDbProposalToNegotiationProposal } from '@/lib/supabase/mappers';
import { buildAuditHash } from '@/lib/security';

const PROPOSAL_SELECT = `
  *,
  auctions(id, codigo_lote, produto_id, products(id, titulo, unidades_por_embalagem, fornecedor_id)),
  comprador:profiles!negotiation_proposals_comprador_id_fkey(id, nome_fantasia, razao_social),
  fornecedor:profiles!negotiation_proposals_fornecedor_id_fkey(id, nome_fantasia, razao_social)
`;

export async function GET(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json(
      { error: 'Supabase não configurado no ambiente.', proposals: [] },
      { status: 503 }
    );
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json(
        { error: 'Autenticação obrigatória para visualizar negociações.', proposals: [] },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const loteId = searchParams.get('loteId');

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    let query = dbClient
      .from('negotiation_proposals')
      .select(PROPOSAL_SELECT)
      .order('created_at', { ascending: false });

    if (ctx.profile.role !== 'admin') {
      query = query.or(`comprador_id.eq.${ctx.user.id},fornecedor_id.eq.${ctx.user.id}`);
    }

    if (loteId) {
      query = query.eq('auction_id', loteId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message, proposals: [] }, { status: 500 });
    }

    return NextResponse.json({
      proposals: (data || []).map((row) =>
        mapDbProposalToNegotiationProposal(row as Record<string, unknown>)
      ),
    });
  } catch (err) {
    console.error('Erro em GET /api/propostas:', err);
    return NextResponse.json({ error: 'Erro ao consultar negociações.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado no ambiente.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user || !ctx.profile) {
      return NextResponse.json(
        { error: 'Autenticação obrigatória para negociar lotes B2B.' },
        { status: 401 }
      );
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const body = await req.json();
    const { action, proposalId, counterPrice, newProposal } = body;

    if (action === 'counter' || action === 'accept' || action === 'reject') {
      if (!proposalId) {
        return NextResponse.json({ error: 'Informe proposalId.' }, { status: 400 });
      }

      const { data: existing, error: fetchErr } = await dbClient
        .from('negotiation_proposals')
        .select(PROPOSAL_SELECT)
        .eq('id', proposalId)
        .maybeSingle();

      if (fetchErr || !existing) {
        return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });
      }

      const isBuyer = String(existing.comprador_id) === ctx.user.id;
      const isSupplier = String(existing.fornecedor_id) === ctx.user.id;
      const isAdmin = ctx.profile.role === 'admin';

      if (!isBuyer && !isSupplier && !isAdmin) {
        return NextResponse.json(
          { error: 'Sem permissão para alterar esta proposta.' },
          { status: 403 }
        );
      }

      if (action === 'counter') {
        const parsedCounter = Number(counterPrice);
        if (!Number.isFinite(parsedCounter) || parsedCounter <= 0) {
          return NextResponse.json(
            { error: 'Informe um valor de contraproposta positivo.' },
            { status: 400 }
          );
        }
        if (existing.status === 'aceita' || existing.status === 'recusada') {
          return NextResponse.json(
            { error: 'Proposta já finalizada não pode receber contraproposta.' },
            { status: 409 }
          );
        }
        if (!isSupplier && !isAdmin) {
          return NextResponse.json(
            { error: 'Apenas o fornecedor do lote ou admin pode enviar contraproposta.' },
            { status: 403 }
          );
        }

        const { data: updated, error: updErr } = await dbClient
          .from('negotiation_proposals')
          .update({
            status: 'contraproposta',
            contraproposta_preco_unitario: Number(parsedCounter.toFixed(2)),
          })
          .eq('id', proposalId)
          .select(PROPOSAL_SELECT)
          .single();

        if (updErr || !updated) {
          return NextResponse.json({ error: updErr?.message || 'Erro ao atualizar proposta.' }, { status: 500 });
        }

        await dbClient.from('notifications').insert({
          user_id: existing.comprador_id,
          titulo: 'Nova Contraproposta B2B Recebida',
          mensagem: `O fornecedor enviou contraproposta de R$ ${parsedCounter.toFixed(2)}/un.`,
          canal: 'in_app',
        });

        return NextResponse.json({
          message: 'Contraproposta enviada com sucesso',
          proposal: mapDbProposalToNegotiationProposal(updated as Record<string, unknown>),
        });
      }

      if (action === 'accept') {
        if (existing.status === 'recusada') {
          return NextResponse.json(
            { error: 'Não é possível aceitar uma proposta já recusada.' },
            { status: 409 }
          );
        }
        if (existing.status === 'pendente' && isBuyer && !isAdmin) {
          return NextResponse.json(
            { error: 'Aguarde o aceite ou contraproposta do fornecedor.' },
            { status: 403 }
          );
        }
        if (existing.status === 'contraproposta' && isSupplier && !isBuyer && !isAdmin) {
          return NextResponse.json(
            { error: 'Aguarde o aceite do comprador para a contraproposta enviada.' },
            { status: 403 }
          );
        }

        const agreedUnitPrice =
          existing.status === 'contraproposta' && existing.contraproposta_preco_unitario
            ? Number(existing.contraproposta_preco_unitario)
            : Number(existing.preco_unitario_ofertado);

        const auction = (existing.auctions || {}) as Record<string, unknown>;
        const product = (auction.products || {}) as Record<string, unknown>;
        const unitsPerBox = Math.max(1, Number(product.unidades_por_embalagem ?? 1));
        const nextTotal = Number(
          (Number(existing.quantidade_caixas) * unitsPerBox * agreedUnitPrice).toFixed(2)
        );

        const { data: updated, error: updErr } = await dbClient
          .from('negotiation_proposals')
          .update({
            status: 'aceita',
            preco_unitario_ofertado: agreedUnitPrice,
            valor_total_proposta: nextTotal,
          })
          .eq('id', proposalId)
          .select(PROPOSAL_SELECT)
          .single();

        if (updErr || !updated) {
          return NextResponse.json({ error: updErr?.message || 'Erro ao aceitar proposta.' }, { status: 500 });
        }

        const notifyUserId =
          ctx.user.id === existing.fornecedor_id
            ? existing.comprador_id
            : existing.fornecedor_id;
        await dbClient.from('notifications').insert({
          user_id: notifyUserId,
          titulo:
            ctx.user.id === existing.fornecedor_id
              ? 'Proposta B2B Aceita pela Indústria'
              : 'Contraproposta Aceita pelo Comprador',
          mensagem:
            ctx.user.id === existing.fornecedor_id
              ? `Sua proposta de R$ ${nextTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi aceita. Finalize o pagamento na Mesa de Negociações.`
              : `O comprador aceitou sua contraproposta de R$ ${nextTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} e avançou para a custódia Escrow.`,
          canal: 'in_app',
        });

        await dbClient.from('audit_worm_logs').insert({
          tipo_evento: 'proposta_aceita',
          protocolo: `PROP-${proposalId}`,
          payload_json: { proposalId, actorId: ctx.user.id, valorTotal: nextTotal },
          merkle_root_hash: buildAuditHash(String(proposalId), 'proposta_aceita', { nextTotal }),
          responsavel_id: ctx.user.id,
        });

        return NextResponse.json({
          message: 'Proposta aceita! O lote foi reservado para checkout escrow.',
          proposal: mapDbProposalToNegotiationProposal(updated as Record<string, unknown>),
        });
      }

      if (action === 'reject') {
        if (existing.status === 'aceita') {
          return NextResponse.json(
            { error: 'Não é possível recusar uma proposta já aceita.' },
            { status: 409 }
          );
        }
        const { data: updated, error: updErr } = await dbClient
          .from('negotiation_proposals')
          .update({ status: 'recusada' })
          .eq('id', proposalId)
          .select(PROPOSAL_SELECT)
          .single();

        if (updErr || !updated) {
          return NextResponse.json({ error: updErr?.message || 'Erro ao recusar proposta.' }, { status: 500 });
        }

        return NextResponse.json({
          message: 'Proposta comercial recusada na mesa de negociação.',
          proposal: mapDbProposalToNegotiationProposal(updated as Record<string, unknown>),
        });
      }
    }

    // Criar nova proposta comercial
    if (newProposal) {
      const boxes = Number(newProposal.quantidadeCaixas);
      const unitPrice = Number(newProposal.precoUnitarioOfertado);
      const loteId = String(newProposal.loteId || '').trim();

      if (!loteId || !Number.isFinite(boxes) || boxes <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
        return NextResponse.json(
          { error: 'Parâmetros inválidos na proposta: informe lote, caixas e preço unitário positivos.' },
          { status: 400 }
        );
      }

      const { data: auctionRow, error: aucErr } = await dbClient
        .from('auctions')
        .select('id, codigo_lote, status, termina_em, products(id, titulo, unidades_por_embalagem, fornecedor_id)')
        .eq('id', loteId)
        .maybeSingle();

      if (aucErr || !auctionRow) {
        return NextResponse.json({ error: 'Lote informado não encontrado.' }, { status: 404 });
      }

      const aucStatus = String(auctionRow.status || '');
      const deadlineMs = auctionRow.termina_em ? new Date(String(auctionRow.termina_em)).getTime() : 0;
      if (
        aucStatus === 'homologado' ||
        aucStatus === 'encerrado' ||
        aucStatus === 'cancelado' ||
        (deadlineMs > 0 && deadlineMs <= Date.now())
      ) {
        return NextResponse.json(
          { error: 'Este lote já encerrou ou foi homologado e não aceita novas propostas.' },
          { status: 409 }
        );
      }

      const product = (auctionRow.products || {}) as Record<string, unknown>;
      const supplierId = String(product.fornecedor_id || '');
      if (!supplierId) {
        return NextResponse.json({ error: 'Fornecedor do lote não identificado.' }, { status: 400 });
      }
      if (supplierId === ctx.user.id) {
        return NextResponse.json(
          { error: 'Fornecedor não pode enviar proposta de compra para o próprio lote.' },
          { status: 403 }
        );
      }

      const unitsPerBox = Math.max(1, Number(product.unidades_por_embalagem ?? 1));
      const totalProposalValue = Number((boxes * unitsPerBox * unitPrice).toFixed(2));

      const { data: inserted, error: insErr } = await dbClient
        .from('negotiation_proposals')
        .insert({
          auction_id: loteId,
          comprador_id: ctx.user.id,
          fornecedor_id: supplierId,
          quantidade_caixas: Math.round(boxes),
          preco_unitario_ofertado: Number(unitPrice.toFixed(2)),
          valor_total_proposta: totalProposalValue,
          status: 'pendente',
          mensagem: String(
            newProposal.mensagem || 'Proposta de compra com retirada FOB agendada.'
          ).slice(0, 500),
        })
        .select(PROPOSAL_SELECT)
        .single();

      if (insErr || !inserted) {
        return NextResponse.json(
          { error: insErr?.message || 'Erro ao enviar proposta ao fornecedor.' },
          { status: 500 }
        );
      }

      await dbClient.from('notifications').insert({
        user_id: supplierId,
        titulo: `Nova Proposta Direta • ${auctionRow.codigo_lote}`,
        mensagem: `${ctx.profile.nomeFantasia} ofertou R$ ${unitPrice.toFixed(2)}/un para ${boxes} caixas.`,
        canal: 'in_app',
      });

      return NextResponse.json(
        {
          message: 'Proposta comercial enviada à indústria',
          proposal: mapDbProposalToNegotiationProposal(inserted as Record<string, unknown>),
        },
        { status: 201 }
      );
    }

    return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });
  } catch (err) {
    console.error('Erro na API de propostas:', err);
    return NextResponse.json({ error: 'Erro interno ao processar proposta' }, { status: 500 });
  }
}
