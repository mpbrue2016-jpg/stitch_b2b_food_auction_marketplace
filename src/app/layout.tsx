import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Varejista Online | Marketplace B2B de Alimentos, Bebidas & Leilões de Estoque',
  description:
    'O maior marketplace B2B de liquidez de estoque, giro rápido (FEFO) e leilões industriais de alimentos com custódia escrow segregada.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={plusJakartaSans.variable}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface text-on-surface antialiased min-h-screen flex flex-col font-sans">
        <Header />
        <main className="flex-1 pt-[156px] w-full">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
