import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AuthProvider } from '@/components/AuthProvider';
import { EnvironmentProvider } from '@/components/EnvironmentProvider';
import { EnvironmentModeBanner } from '@/components/DemoBadge';
import { SmartTutorialOverlay } from '@/components/SmartTutorialOverlay';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

const SITE_TITLE =
  'Varejista Online | Pregões B2B de Alimentos, Cerealista, Hortifruti & Higiene e Limpeza';
const SITE_DESCRIPTION =
  'O maior marketplace B2B de liquidez de estoque, giro rápido (FEFO) e leilões de alimentos, cerealista, hortifruti e higiene e limpeza com custódia escrow segregada.';

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Varejista Online',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={plusJakartaSans.variable}>
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface text-on-surface antialiased min-h-screen flex flex-col font-sans">
        <AuthProvider>
          <EnvironmentProvider>
            <Header />
            <main className="flex-1 pt-[160px] w-full">
              <EnvironmentModeBanner />
              {children}
            </main>
            <SmartTutorialOverlay />
            <Footer />
          </EnvironmentProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
