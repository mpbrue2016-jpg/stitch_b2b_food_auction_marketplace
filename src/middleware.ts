import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAuthorizedAdminProfile } from '@/lib/auth-admin';
import { isConfiguredSupabaseEnv } from '@/lib/supabase/config';

const STRICT_ADMIN_PREFIXES = ['/painel/admin'];
const DEMO_EXPLORABLE_PREFIXES = [
  '/painel/comprador',
  '/painel/fornecedor',
  '/painel/comissoes',
  '/checkout',
  '/pedidos',
  '/produtos/novo',
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;
  const envParam = request.nextUrl.searchParams.get('env');

  const isStrictAdmin = STRICT_ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isDemoExplorable = DEMO_EXPLORABLE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isProtected = isStrictAdmin || isDemoExplorable;

  if (!isConfiguredSupabaseEnv(supabaseUrl, supabaseAnonKey)) {
    if (isStrictAdmin || (isDemoExplorable && envParam === 'original')) {
      const loginUrl = new URL('/login', request.url);
      if (isStrictAdmin) loginUrl.searchParams.set('tab', 'admin');
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  let user: { id: string; email?: string } | null = null;
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser ? { id: authUser.id, email: authUser.email } : null;
  } catch {
    user = null;
  }

  if (!isProtected) {
    return response;
  }

  if (!user) {
    // Visitante pode explorar fluxos em Ambiente Modelo sem login, exceto Painel Admin Master
    // ou quando exigir explicitamente ?env=original
    if (isDemoExplorable && envParam !== 'original') {
      return response;
    }
    const loginUrl = new URL('/login', request.url);
    if (isStrictAdmin) {
      loginUrl.searchParams.set('tab', 'admin');
    }
    loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  let role = 'comprador';
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status_aprovacao, email, cpf, is_demo')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role) {
      const rawRole = String(profile.role);
      if (rawRole === 'admin') {
        role = isAuthorizedAdminProfile({
          role: rawRole,
          email: String(profile.email || user.email || ''),
          cpf: profile.cpf ? String(profile.cpf) : null,
          is_demo: Boolean(profile.is_demo),
        })
          ? 'admin'
          : 'comprador';
      } else {
        role = rawRole;
      }
    }
  } catch {
    role = 'comprador';
  }

  // Painel Admin Master é sempre restrito à role admin
  if (isStrictAdmin && role !== 'admin') {
    const target = role === 'fornecedor' ? '/painel/fornecedor' : '/painel/comprador';
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Se o usuário logado pediu explícito ?env=modelo nas telas exploráveis, permite visualização didática
  if (envParam === 'modelo' && isDemoExplorable) {
    return response;
  }

  if (pathname.startsWith('/painel/comissoes') && role !== 'admin' && envParam !== 'modelo') {
    const target = role === 'fornecedor' ? '/painel/fornecedor' : '/painel/comprador';
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (
    (pathname.startsWith('/painel/fornecedor') || pathname.startsWith('/produtos/novo')) &&
    role !== 'fornecedor' &&
    role !== 'admin'
  ) {
    return NextResponse.redirect(new URL('/painel/comprador', request.url));
  }

  if (pathname.startsWith('/painel/comprador') && role === 'fornecedor') {
    return NextResponse.redirect(new URL('/painel/fornecedor', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
