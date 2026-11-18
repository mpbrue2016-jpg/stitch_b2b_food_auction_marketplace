import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isConfiguredSupabaseEnv } from '@/lib/supabase/config';

const PROTECTED_PREFIXES = ['/painel', '/checkout', '/pedidos', '/produtos/novo'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isConfiguredSupabaseEnv(supabaseUrl, supabaseAnonKey)) {
    if (isProtected) {
      const loginUrl = new URL('/login', request.url);
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

  let user: { id: string } | null = null;
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser ? { id: authUser.id } : null;
  } catch {
    user = null;
  }

  if (!isProtected) {
    return response;
  }

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  let role = 'comprador';
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status_aprovacao')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role) {
      role = String(profile.role);
    }
  } catch {
    role = 'comprador';
  }

  // RBAC de rotas operacionais
  if (
    (pathname.startsWith('/painel/admin') || pathname.startsWith('/painel/comissoes')) &&
    role !== 'admin'
  ) {
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
