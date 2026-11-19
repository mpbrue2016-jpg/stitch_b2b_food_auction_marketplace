import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedUserAndProfile,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { mapDbAuctionToAuctionLot } from '@/lib/supabase/mappers';

function isDemoLotId(id: string): boolean {
  return id.startsWith('demo-') || id.startsWith('a1000000-');
}

async function loadUserOpenCart(
  dbClient: ReturnType<typeof createAdminSupabaseClient>,
  userId: string
) {
  let { data: cart } = await dbClient
    .from('carts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'aberto')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cart) {
    const { data: created } = await dbClient
      .from('carts')
      .insert({ user_id: userId, status: 'aberto', total_itens: 0, valor_total: 0 })
      .select('*')
      .single();
    cart = created;
  }

  if (!cart) return { cart: null, items: [] };

  const { data: itemRows } = await dbClient
    .from('cart_items')
    .select('*, products(*, auctions(*, products(*)))')
    .eq('cart_id', cart.id)
    .order('created_at', { ascending: true });

  const items = [];
  for (const row of itemRows || []) {
    const product = (row.products || {}) as Record<string, unknown>;
    if (product.is_demo) continue;
    const auctionsList = Array.isArray(product.auctions) ? product.auctions : [];
    const auctionRow = auctionsList[0] as Record<string, unknown> | undefined;
    if (!auctionRow || auctionRow.is_demo) continue;
    const lot = mapDbAuctionToAuctionLot({ ...auctionRow, products: product });
    const qty = Math.max(1, Number(row.quantidade ?? 1));
    const unitLotPrice = lot.precoArremateImediato ?? lot.lanceAtual;
    items.push({
      lot,
      quantidade: qty,
      precoTotal: Number((qty * unitLotPrice).toFixed(2)),
    });
  }

  return { cart, items };
}

export async function GET() {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado.', items: [] }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user) {
      return NextResponse.json({ error: 'Autenticação obrigatória.', items: [] }, { status: 401 });
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const { items } = await loadUserOpenCart(dbClient, ctx.user.id);
    return NextResponse.json({ items });
  } catch (err) {
    console.error('Erro em GET /api/carrinho:', err);
    return NextResponse.json({ error: 'Erro interno ao consultar carrinho.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user) {
      return NextResponse.json({ error: 'Autenticação obrigatória.' }, { status: 401 });
    }

    const body = await req.json();
    const { loteId, quantidade } = body;
    if (!loteId) {
      return NextResponse.json({ error: 'Parâmetro obrigatório: loteId.' }, { status: 400 });
    }

    if (isDemoLotId(String(loteId))) {
      return NextResponse.json(
        {
          error:
            'Lotes do Ambiente Modelo não podem ser adicionados ao carrinho oficial. Simule apenas no Ambiente Modelo.',
        },
        { status: 403 }
      );
    }

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const { data: auctionRow } = await dbClient
      .from('auctions')
      .select('*, products(*)')
      .eq('id', loteId)
      .maybeSingle();

    if (!auctionRow || !auctionRow.products) {
      return NextResponse.json({ error: 'Lote não localizado.' }, { status: 404 });
    }

    if (auctionRow.is_demo || (auctionRow.products as Record<string, unknown>).is_demo) {
      return NextResponse.json(
        { error: 'Lotes demonstrativos (MODELO) não podem compor pedidos reais no carrinho.' },
        { status: 403 }
      );
    }

    const lot = mapDbAuctionToAuctionLot(auctionRow as Record<string, unknown>);
    if (
      lot.status === 'homologado' ||
      lot.status === 'encerrado' ||
      lot.status === 'cancelado'
    ) {
      return NextResponse.json(
        { error: 'Este lote não está mais disponível para adição ao carrinho.' },
        { status: 409 }
      );
    }
    if (lot.produto.fornecedorId === ctx.user.id) {
      return NextResponse.json(
        { error: 'Fornecedor não pode adicionar o próprio lote ao carrinho de compra.' },
        { status: 403 }
      );
    }
    const unitLotPrice = lot.precoArremateImediato ?? lot.lanceAtual;
    const qtyToAdd = Math.max(1, Math.round(Number(quantidade || 1)));

    const { cart } = await loadUserOpenCart(dbClient, ctx.user.id);
    if (!cart) {
      return NextResponse.json({ error: 'Não foi possível iniciar carrinho.' }, { status: 500 });
    }

    const { data: existingItem } = await dbClient
      .from('cart_items')
      .select('*')
      .eq('cart_id', cart.id)
      .eq('product_id', lot.produto.id)
      .maybeSingle();

    if (existingItem) {
      const nextQty = Number(existingItem.quantidade) + qtyToAdd;
      await dbClient
        .from('cart_items')
        .update({
          quantidade: nextQty,
          valor_unitario: unitLotPrice,
          valor_total: Number((nextQty * unitLotPrice).toFixed(2)),
        })
        .eq('id', existingItem.id);
    } else {
      await dbClient.from('cart_items').insert({
        cart_id: cart.id,
        product_id: lot.produto.id,
        quantidade: qtyToAdd,
        valor_unitario: unitLotPrice,
        valor_total: Number((qtyToAdd * unitLotPrice).toFixed(2)),
      });
    }

    const { items } = await loadUserOpenCart(dbClient, ctx.user.id);
    const totalItens = items.reduce((acc, i) => acc + i.quantidade, 0);
    const valorTotal = Number(items.reduce((acc, i) => acc + i.precoTotal, 0).toFixed(2));
    await dbClient
      .from('carts')
      .update({ total_itens: totalItens, valor_total: valorTotal })
      .eq('id', cart.id);

    return NextResponse.json({ items }, { status: 201 });
  } catch (err) {
    console.error('Erro em POST /api/carrinho:', err);
    return NextResponse.json({ error: 'Erro interno ao atualizar carrinho.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user) {
      return NextResponse.json({ error: 'Autenticação obrigatória.' }, { status: 401 });
    }

    const body = await req.json();
    const { loteId, quantidade } = body;
    if (isDemoLotId(String(loteId || ''))) {
      return NextResponse.json(
        { error: 'Operação não permitida para lotes demonstrativos.' },
        { status: 403 }
      );
    }
    const nextQty = Math.max(1, Math.round(Number(quantidade || 1)));

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const { data: auctionRow } = await dbClient
      .from('auctions')
      .select('*, products(*)')
      .eq('id', loteId)
      .maybeSingle();

    if (!auctionRow || !auctionRow.products) {
      return NextResponse.json({ error: 'Lote não localizado.' }, { status: 404 });
    }

    if (auctionRow.is_demo || (auctionRow.products as Record<string, unknown>).is_demo) {
      return NextResponse.json(
        { error: 'Lotes demonstrativos não podem ser alterados no carrinho real.' },
        { status: 403 }
      );
    }

    const lot = mapDbAuctionToAuctionLot(auctionRow as Record<string, unknown>);
    const unitLotPrice = lot.precoArremateImediato ?? lot.lanceAtual;
    const { cart } = await loadUserOpenCart(dbClient, ctx.user.id);
    if (!cart) {
      return NextResponse.json({ items: [] });
    }

    await dbClient
      .from('cart_items')
      .update({
        quantidade: nextQty,
        valor_unitario: unitLotPrice,
        valor_total: Number((nextQty * unitLotPrice).toFixed(2)),
      })
      .eq('cart_id', cart.id)
      .eq('product_id', lot.produto.id);

    const { items } = await loadUserOpenCart(dbClient, ctx.user.id);
    const totalItens = items.reduce((acc, i) => acc + i.quantidade, 0);
    const valorTotal = Number(items.reduce((acc, i) => acc + i.precoTotal, 0).toFixed(2));
    await dbClient
      .from('carts')
      .update({ total_itens: totalItens, valor_total: valorTotal })
      .eq('id', cart.id);

    return NextResponse.json({ items });
  } catch (err) {
    console.error('Erro em PATCH /api/carrinho:', err);
    return NextResponse.json({ error: 'Erro interno ao atualizar quantidade.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 503 });
  }

  try {
    const ctx = await getAuthenticatedUserAndProfile();
    if (!ctx?.user) {
      return NextResponse.json({ error: 'Autenticação obrigatória.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const loteId = searchParams.get('loteId');
    const clearAll = searchParams.get('clear') === '1';

    const dbClient = isSupabaseAdminConfigured ? createAdminSupabaseClient() : ctx.supabase;
    const { cart } = await loadUserOpenCart(dbClient, ctx.user.id);
    if (!cart) {
      return NextResponse.json({ items: [] });
    }

    if (clearAll) {
      await dbClient.from('cart_items').delete().eq('cart_id', cart.id);
      await dbClient.from('carts').update({ total_itens: 0, valor_total: 0 }).eq('id', cart.id);
      return NextResponse.json({ items: [] });
    }

    if (loteId && !isDemoLotId(loteId)) {
      const { data: auctionRow } = await dbClient
        .from('auctions')
        .select('produto_id')
        .eq('id', loteId)
        .maybeSingle();

      if (auctionRow?.produto_id) {
        await dbClient
          .from('cart_items')
          .delete()
          .eq('cart_id', cart.id)
          .eq('product_id', auctionRow.produto_id);
      }
    }

    const { items } = await loadUserOpenCart(dbClient, ctx.user.id);
    const totalItens = items.reduce((acc, i) => acc + i.quantidade, 0);
    const valorTotal = Number(items.reduce((acc, i) => acc + i.precoTotal, 0).toFixed(2));
    await dbClient
      .from('carts')
      .update({ total_itens: totalItens, valor_total: valorTotal })
      .eq('id', cart.id);

    return NextResponse.json({ items });
  } catch (err) {
    console.error('Erro em DELETE /api/carrinho:', err);
    return NextResponse.json({ error: 'Erro interno ao remover item.' }, { status: 500 });
  }
}
