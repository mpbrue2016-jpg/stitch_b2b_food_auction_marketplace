'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CART_UPDATED_EVENT, getCartItems, syncCartFromServer } from '@/lib/cart-store';
import { useAuth } from '@/components/AuthProvider';
import { ProductCategory } from '@/lib/types';

function getInitials(name?: string | null): string {
  if (!name) return 'VO';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export const Header: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, notifications, loading: authLoading, signOut } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [activeLotsCount, setActiveLotsCount] = useState<number | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('todas');

  useEffect(() => {
    const syncCartCount = () => {
      const items = getCartItems();
      setCartCount(items.reduce((acc, item) => acc + item.quantidade, 0));
    };

    syncCartCount();
    window.addEventListener(CART_UPDATED_EVENT, syncCartCount);

    let active = true;
    Promise.all([
      fetch('/api/lotes', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)),
      fetch('/api/categorias', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([lotsData, catsData]) => {
        if (!active) return;
        if (Array.isArray(lotsData?.lots)) {
          const openLots = lotsData.lots.filter(
            (l: { terminaEm: string; status: string }) =>
              l.status !== 'encerrado' &&
              l.status !== 'homologado' &&
              new Date(l.terminaEm).getTime() > Date.now()
          );
          setActiveLotsCount(openLots.length);
        }
        if (Array.isArray(catsData?.categories)) {
          setCategories(catsData.categories);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
      window.removeEventListener(CART_UPDATED_EVENT, syncCartCount);
    };
  }, [pathname]);

  useEffect(() => {
    if (user) {
      void syncCartFromServer();
    }
  }, [user]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (searchCategory !== 'todas') params.set('categoria', searchCategory);
    const qs = params.toString();
    setMobileMenuOpen(false);
    router.push(qs ? `/catalogo?${qs}` : '/catalogo');
  };

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
    router.push('/');
  };

  const panelHref =
    profile?.role === 'admin'
      ? '/painel/admin'
      : profile?.role === 'fornecedor'
      ? '/painel/fornecedor'
      : '/painel/comprador';

  const roleLabel =
    profile?.role === 'admin'
      ? 'Admin Master'
      : profile?.role === 'fornecedor'
      ? 'Fornecedor'
      : 'Comprador';

  const unreadNotifCount = notifications.filter((n) => !n.lido).length;

  const navLinks = [
    { label: 'Todos os Lotes', href: '/catalogo' },
    { label: 'Leilões ao Vivo', href: '/leiloes', isLive: true },
    { label: 'Cerealista & Grãos', href: '/catalogo?categoria=cerealista' },
    { label: 'Hortifruti', href: '/catalogo?categoria=hortifruti' },
    { label: 'Higiene & Limpeza', href: '/catalogo?categoria=higiene-limpeza' },
    { label: 'Ofertas & Negociação', href: '/negociacoes' },
    { label: 'Validade Próxima (FEFO)', href: '/catalogo?filtro=validade_proxima' },
    { label: 'Giro Rápido', href: '/catalogo?filtro=giro_rapido' },
    { label: 'Painel Comprador', href: '/painel/comprador' },
    { label: 'Painel Indústria', href: '/painel/fornecedor' },
    { label: 'Painel Admin', href: '/painel/admin' },
    { label: 'Comissões & Split', href: '/painel/comissoes' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      {/* Top Banner Operacional B2B */}
      <div className="bg-surface-container-high text-on-surface-variant text-[10px] sm:text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-9">
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-1.5 text-secondary font-semibold">
              <span className="material-symbols-outlined text-[16px]">verified_user</span>
              <span>Ambiente Seguro B2B • CNPJ Verificado</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">trending_up</span>
              <span>
                Pregões Ativos:{' '}
                <strong>
                  {activeLotsCount !== null
                    ? `${activeLotsCount} ${activeLotsCount === 1 ? 'lote aberto' : 'lotes abertos'}`
                    : 'Pregão em tempo real'}
                </strong>
              </span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">location_on</span>
              <span>Raio SP • Grande São Paulo / Interior (300km)</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/pedidos" className="hover:text-primary transition-colors hidden sm:inline">
              Histórico de Pedidos
            </Link>
            {user && profile ? (
              <div className="flex items-center gap-2.5">
                <Link
                  href={panelHref}
                  className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full bg-surface-container-lowest text-primary font-bold shadow-sm"
                >
                  {roleLabel}
                </Link>
                {unreadNotifCount > 0 && (
                  <Link
                    href={panelHref}
                    className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-tertiary"
                    title="Notificações não lidas"
                  >
                    <span className="material-symbols-outlined text-[14px]">notifications_active</span>
                    <span>{unreadNotifCount}</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="hover:text-error font-semibold transition-colors text-[10px] sm:text-xs"
                >
                  Sair
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/login" className="hover:text-primary font-semibold transition-colors">
                  Entrar
                </Link>
                <Link
                  href="/cadastro"
                  className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full bg-primary text-white font-bold shadow-sm hover:bg-primary-container transition-colors"
                >
                  Cadastrar CNPJ
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="bg-surface-container-lowest border-b border-surface-container">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 h-20">
          {/* Logo B2B */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary font-extrabold text-lg shadow-sm">
              VO
            </div>
            <div>
              <span className="font-extrabold text-xl sm:text-2xl text-primary tracking-tight block leading-none">
                Varejista<span className="text-secondary">Online</span>
              </span>
              <span className="text-[10px] text-on-surface-variant tracking-wider uppercase font-semibold block mt-1">
                Alimentos · Cerealista · Hortifruti · Higiene
              </span>
            </div>
          </Link>

          {/* Search Bar - Desktop */}
          <form onSubmit={handleSearch} className="flex-1 max-w-2xl hidden md:flex items-center">
            <div className="w-full flex items-center bg-surface-container-low rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary border border-outline-variant/30">
              <div className="flex items-center gap-1 pr-3 text-on-surface-variant border-r border-outline-variant/40">
                <span className="material-symbols-outlined text-[18px]">category</span>
                <select
                  value={searchCategory}
                  onChange={(e) => setSearchCategory(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-on-surface focus:outline-none cursor-pointer"
                >
                  <option value="todas">Todos os Lotes</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 flex items-center px-3 gap-2">
                <span className="material-symbols-outlined text-outline text-[20px]">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar grãos, hortifruti, higiene, marca ou EAN..."
                  className="w-full bg-transparent text-sm text-on-surface placeholder:text-outline focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="bg-primary hover:bg-primary-container text-on-primary text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1 shrink-0 shadow-sm"
              >
                <span>Buscar</span>
              </button>
            </div>
          </form>

          {/* CTAs & Profile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/produtos/novo"
              className="hidden lg:flex items-center gap-1.5 bg-secondary hover:bg-secondary-container text-on-secondary hover:text-on-secondary-container text-xs font-bold px-4 py-2.5 rounded-lg transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Anunciar Estoque</span>
            </Link>

            <Link
              href="/carrinho"
              className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-surface-container text-on-surface-variant transition-colors relative"
              title="Carrinho de Compras / Lotes Arrematados"
            >
              <span className="material-symbols-outlined text-[22px]">shopping_cart</span>
              {cartCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>

            <Link
              href="/leiloes"
              className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-surface-container text-on-surface-variant transition-colors relative"
              title="Meus Lances & Disputas"
            >
              <span className="material-symbols-outlined text-[22px]">gavel</span>
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
            </Link>

            {/* User Profile Pill */}
            {user && profile ? (
              <Link
                href={panelHref}
                className="flex items-center gap-2 pl-2 border-l border-surface-container-high hover:opacity-90 transition-opacity"
              >
                <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-xs">
                  {getInitials(profile.nomeFantasia || profile.razaoSocial)}
                </div>
                <div className="hidden xl:block text-left text-xs max-w-[160px]">
                  <span className="font-bold text-on-surface block leading-tight truncate">
                    {profile.nomeFantasia || profile.razaoSocial}
                  </span>
                  <span
                    className={`text-[10px] font-bold block leading-tight ${
                      profile.statusAprovacao === 'aprovado' ? 'text-secondary' : 'text-tertiary'
                    }`}
                  >
                    {profile.statusAprovacao === 'aprovado'
                      ? `${roleLabel} • Homologado`
                      : `${roleLabel} • KYC em Análise`}
                  </span>
                </div>
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 pl-2 border-l border-surface-container-high hover:opacity-90 transition-opacity"
              >
                <div className="w-8 h-8 rounded-full bg-surface-container text-primary flex items-center justify-center font-bold text-xs">
                  <span className="material-symbols-outlined text-[18px]">person</span>
                </div>
                <div className="hidden xl:block text-left text-xs">
                  <span className="font-bold text-on-surface block leading-tight">
                    {authLoading ? 'Verificando...' : 'Acessar Conta'}
                  </span>
                  <span className="text-[10px] text-primary font-bold block leading-tight">
                    Login / Cadastro B2B
                  </span>
                </div>
              </Link>
            )}

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-10 h-10 rounded-lg flex items-center justify-center hover:bg-surface-container text-on-surface"
              aria-label="Abrir menu"
            >
              <span className="material-symbols-outlined text-[24px]">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Subnav Navigation Bar (Horizontal Scrollable) */}
      <div className="bg-surface-container-lowest border-b border-surface-container/60 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 h-11 min-w-max text-xs font-semibold">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-bold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                {link.isLive && (
                  <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                )}
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-surface-container-lowest border-b border-surface-container p-4 space-y-3">
          <form onSubmit={handleSearch} className="flex items-center bg-surface-container-low rounded-lg px-3 py-2">
            <span className="material-symbols-outlined text-outline text-[18px] mr-2">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produtos, EAN ou lotes..."
              className="w-full bg-transparent text-xs text-on-surface focus:outline-none"
            />
          </form>
          <div className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-on-surface hover:bg-surface-container flex items-center justify-between"
              >
                <span>{link.label}</span>
                {link.isLive && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-bold">
                    AO VIVO
                  </span>
                )}
              </Link>
            ))}
            <Link
              href="/produtos/novo"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 text-center bg-secondary text-white text-xs font-bold py-2.5 rounded-lg"
            >
              + Anunciar Novo Estoque
            </Link>
            {user ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-1 text-center bg-error-container text-on-error-container text-xs font-bold py-2 rounded-lg"
              >
                Encerrar Sessão
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-1 text-center bg-primary text-white text-xs font-bold py-2 rounded-lg"
              >
                Entrar / Cadastrar CNPJ
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
