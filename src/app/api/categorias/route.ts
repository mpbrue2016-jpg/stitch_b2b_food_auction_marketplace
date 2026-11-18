import { NextResponse } from 'next/server';
import { createServerSupabaseClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { mapDbCategoryToProductCategory } from '@/lib/supabase/mappers';

export async function GET() {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json(
      { error: 'Supabase não configurado no ambiente.', categories: [] },
      { status: 503 }
    );
  }

  try {
    const supabase = createServerSupabaseClient();
    const [{ data: categoriesRows, error }, { data: auctionsRows }] = await Promise.all([
      supabase.from('categories').select('*').eq('ativo', true).order('nome', { ascending: true }),
      supabase
        .from('auctions')
        .select('id, status, products(categoria_id)')
        .in('status', ['ativo', 'reta_final']),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message, categories: [] }, { status: 500 });
    }

    const counts = new Map<string, number>();
    for (const a of auctionsRows || []) {
      const prod = (a.products || {}) as { categoria_id?: string };
      if (prod.categoria_id) {
        counts.set(prod.categoria_id, (counts.get(prod.categoria_id) || 0) + 1);
      }
    }

    const categories = (categoriesRows || []).map((row) =>
      mapDbCategoryToProductCategory(row as Record<string, unknown>, counts.get(String(row.id)) || 0)
    );

    return NextResponse.json({ categories });
  } catch (err) {
    console.error('Erro ao buscar categorias:', err);
    return NextResponse.json(
      { error: 'Erro interno ao consultar categorias.', categories: [] },
      { status: 500 }
    );
  }
}
