import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://rifx-marketing.com'),
  title: 'Rifx Marketing - Agencia de Marketing Espacial',
  description: 'Marketing digital de vanguardia que te hace brillar. Es hora de despegar.',
  keywords: ['marketing digital', 'agencia de marketing', 'SEO', 'redes sociales', 'publicidad online', 'marketing espacial'],
  authors: [{ name: 'Rifx Marketing' }],
  creator: 'Rifx Marketing',
  publisher: 'Rifx Marketing',
  formatDetection: {
    email: true,
    address: false,
    telephone: true,
  },
  openGraph: {
    title: 'Rifx Marketing - Agencia de Marketing Espacial',
    description: 'Marketing digital de vanguardia que te hace brillar. Es hora de despegar.',
    url: 'https://rifx-marketing.com',
    siteName: 'Rifx Marketing',
    images: [
      {
        url: '/images/rifx-logo-particles-clean.png',
        width: 1200,
        height: 630,
        alt: 'Rifx Marketing - Marketing Espacial',
      },
    ],
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rifx Marketing - Agencia de Marketing Espacial',
    description: 'Marketing digital de vanguardia que te hace brillar. Es hora de despegar.',
    images: ['/images/rifx-logo-particles-clean.png'],
    creator: '@rifxmarketing',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover' as const,
};

import Header from './components/Header';
import Footer from './components/Footer';
import AnimatedCursor from './components/AnimatedCursor';
import LenisProvider from './components/LenisProvider';
import GlobalTextReveal from './components/GlobalTextReveal';
import { Analytics } from '@vercel/analytics/next';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700;800;900&family=Montserrat:wght@400;600;700;800;900&family=Space+Grotesk:wght@300;400;500;600;700&family=Manrope:wght@200;400;600;700;800&family=Inter:wght@300;400;500;600;700&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#0C0C0C] text-[#D7E2EA] overflow-x-hidden min-h-screen flex flex-col font-['Kanit']">
        <LenisProvider>
          <GlobalTextReveal />
          <AnimatedCursor />
          <div className="flex-grow">
            {children}
          </div>
          <Footer />
        </LenisProvider>
        <Analytics />
      </body>
    </html>
  );
}
