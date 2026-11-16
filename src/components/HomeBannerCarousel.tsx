'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Pause, Play, ArrowRight } from 'lucide-react';
import { DEFAULT_HOME_BANNERS } from '@/lib/marketplace-store';
import { HomeBanner } from '@/lib/types';

const FALLBACK_BANNER_IMAGE = '/images/banners/banner-atacado-pallets.jpg';

export const HomeBannerCarousel: React.FC = () => {
  const [banners, setBanners] = useState<HomeBanner[]>(() =>
    DEFAULT_HOME_BANNERS.filter((b) => b.ativo)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mq.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/banners?activeOnly=1', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && Array.isArray(data?.banners)) {
          setBanners(data.banners);
          setCurrentIndex(0);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const total = banners.length;
  const safeIndex = total > 0 ? currentIndex % total : 0;
  const activeBanner = banners[safeIndex];

  const goNext = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (total <= 1 || isPaused || prefersReducedMotion || !activeBanner) return;
    const delayMs = Math.max(3, activeBanner.intervaloSegundos || 6) * 1000;
    const timer = setTimeout(goNext, delayMs);
    return () => clearTimeout(timer);
  }, [total, isPaused, prefersReducedMotion, activeBanner, safeIndex, goNext]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || total <= 1) return;
    const deltaX = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) > 40) {
      if (deltaX < 0) goNext();
      else goPrev();
    }
  };

  if (total === 0 || !activeBanner) {
    return null;
  }

  return (
    <section
      aria-label="Destaques e Campanhas Varejista Online"
      className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 w-full"
    >
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full min-h-[260px] sm:min-h-[320px] lg:min-h-[380px] rounded-2xl overflow-hidden bg-slate-900 shadow-lg border border-outline-variant/30 group"
      >
        {/* Background Slides */}
        {banners.map((banner, idx) => {
          const isCurrent = idx === safeIndex;
          const imgSrc = failedImages[banner.id] ? FALLBACK_BANNER_IMAGE : banner.imagemUrl;
          return (
            <div
              key={banner.id}
              aria-hidden={!isCurrent}
              className={`absolute inset-0 transition-opacity duration-500 ease-out ${
                isCurrent ? 'opacity-100 z-0' : 'opacity-0 pointer-events-none -z-10'
              }`}
            >
              <Image
                src={imgSrc}
                alt={banner.titulo}
                fill
                priority={idx === 0}
                sizes="(max-width: 768px) 100vw, 1280px"
                quality={90}
                referrerPolicy="no-referrer"
                onError={() =>
                  setFailedImages((prev) => ({
                    ...prev,
                    [banner.id]: true,
                  }))
                }
                className="object-cover img-sharp"
              />
              {/* Measured WCAG AA contrast scrim */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/25 sm:from-black/80 sm:via-black/50 sm:to-black/15" />
            </div>
          );
        })}

        {/* Foreground Content */}
        <div className="relative z-10 h-full min-h-[260px] sm:min-h-[320px] lg:min-h-[380px] flex flex-col justify-between p-5 sm:p-8 lg:p-10">
          <div className="max-w-2xl space-y-2.5 sm:space-y-3 my-auto">
            <p className="text-xs sm:text-sm font-semibold text-white/85 tracking-wide">
              {activeBanner.eyebrow}
            </p>
            <h2 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight text-balance">
              {activeBanner.titulo}
            </h2>
            {activeBanner.subtitulo && (
              <p className="text-xs sm:text-sm lg:text-base text-white/90 leading-relaxed max-w-xl line-clamp-3 sm:line-clamp-none">
                {activeBanner.subtitulo}
              </p>
            )}
            <div className="pt-2">
              <Link
                href={activeBanner.ctaHref}
                className="inline-flex items-center gap-2 px-5 py-2.5 sm:py-3 rounded-xl bg-secondary hover:bg-secondary-container text-white hover:text-on-secondary-container font-bold text-xs sm:text-sm shadow-md transition-colors whitespace-nowrap"
              >
                <span>{activeBanner.ctaLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Bottom Controls Bar */}
          {total > 1 && (
            <div className="flex items-center justify-between gap-4 pt-4">
              {/* Slide Dots */}
              <div className="flex items-center gap-2" role="tablist" aria-label="Selecionar banner">
                {banners.map((banner, idx) => {
                  const selected = idx === safeIndex;
                  return (
                    <button
                      key={banner.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-label={`Ir para banner ${idx + 1}: ${banner.titulo}`}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                        selected ? 'w-8 bg-white' : 'w-2.5 bg-white/45 hover:bg-white/75'
                      }`}
                    />
                  );
                })}
                <span className="ml-2 text-[11px] font-mono tabular-nums text-white/80">
                  {String(safeIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                </span>
              </div>

              {/* Navigation & Pause Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsPaused((prev) => !prev)}
                  aria-label={isPaused ? 'Retomar rotação automática' : 'Pausar rotação automática'}
                  className="w-10 h-10 rounded-xl bg-black/45 hover:bg-black/70 text-white border border-white/20 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Banner anterior"
                  className="w-10 h-10 rounded-xl bg-black/45 hover:bg-black/70 text-white border border-white/20 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Próximo banner"
                  className="w-10 h-10 rounded-xl bg-black/45 hover:bg-black/70 text-white border border-white/20 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
