import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { mapDbCategoryToProductCategory } from '@/lib/supabase/mappers';
import { DEMO_CATEGORIES, getDemoLots } from '@/lib/demo-data';

function countDemoCategories() {
  const demoLots = getDemoLots();
  const slugCount = new Map<string, number>();
  for (const lot of demoLots) {
    const key = lot.produto.categoriaId;
    slugCount.set(key, (slugCount.get(key) || 0) + 1);
  }
  return DEMO_CATEGORIES.map((cat) => ({
    ...cat,
    totalLotes: slugCount.get(cat.slug) ?? slugCount.get(cat.id) ?? cat.totalLotes,
    isDemo: true,
  }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const envParam = searchParams.get('env');
  const envMode: 'modelo' | 'original' = envParam === 'original' ? 'original' : 'modelo';

  if (!isSupabaseServerConfigured) {
    return NextResponse.json({
      categories: envMode === 'modelo' ? countDemoCategories() : DEMO_CATEGORIES.map((c) => ({ ...c, totalLotes: 0, isDemo: false })),
    });
  }

  try {
    const supabase = createServerSupabaseClient();
    const [{ data: categoriesRows, error }, { data: auctionsRows }] = await Promise.all([
      supabase.from('categories').select('*').eq('ativo', true).order('nome', { ascending: true }),
      supabase
        .from('auctions')
        .select('id, status, is_demo, products(categoria_id, is_demo)')
        .in('status', ['ativo', 'reta_final']),
    ]);

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42703') {
        return NextResponse.json({
          categories:
            envMode === 'modelo'
              ? countDemoCategories()
              : DEMO_CATEGORIES.map((c) => ({ ...c, totalLotes: 0, isDemo: false })),
        });
      }
      return NextResponse.json({ error: error.message, categories: [] }, { status: 500 });
    }

    const counts = new Map<string, number>();
    for (const a of auctionsRows || []) {
      const prod = (a.products || {}) as { categoria_id?: string; is_demo?: boolean };
      const rowIsDemo = Boolean((a as { is_demo?: boolean }).is_demo || prod.is_demo);
      if (envMode === 'original' && rowIsDemo) continue;
      if (envMode === 'modelo' && !rowIsDemo) continue;
      if (prod.categoria_id) {
        counts.set(prod.categoria_id, (counts.get(prod.categoria_id) || 0) + 1);
      }
    }

    if (!categoriesRows || categoriesRows.length === 0) {
      return NextResponse.json({
        categories:
          envMode === 'modelo'
            ? countDemoCategories()
            : DEMO_CATEGORIES.map((c) => ({ ...c, totalLotes: 0, isDemo: false })),
        env: envMode,
      });
    }

    const categories = (categoriesRows || []).map((row) => {
      const cat = mapDbCategoryToProductCategory(
        row as Record<string, unknown>,
        counts.get(String(row.id)) || 0
      );
      if (envMode === 'modelo' && cat.totalLotes === 0) {
        const demoFallback = countDemoCategories().find((d) => d.slug === cat.slug);
        return {
          ...cat,
          totalLotes: demoFallback?.totalLotes ?? 0,
          isDemo: true,
        };
      }
      return {
        ...cat,
        isDemo: envMode === 'modelo',
      };
    });

    if (envMode === 'modelo' && categories.every((c) => c.totalLotes === 0)) {
      return NextResponse.json({ categories: countDemoCategories() });
    }

    return NextResponse.json({ categories, env: envMode });
  } catch (err) {
    console.error('Erro ao buscar categorias:', err);
    return NextResponse.json({
      categories:
        envMode === 'modelo'
          ? countDemoCategories()
          : DEMO_CATEGORIES.map((c) => ({ ...c, totalLotes: 0, isDemo: false })),
    });
  }
}
