import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
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
    url: 'https://rifxmarketing.com',
    siteName: 'Rifx Marketing',
    images: [
      {
        url: 'https://rifxmarketing.com/og-image.jpg',
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
    images: ['https://rifxmarketing.com/twitter-image.jpg'],
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
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

import Header from './components/Header';
import Footer from './components/Footer';
import AnimatedCursor from './components/AnimatedCursor';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="scroll-smooth">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#0b1229] text-white overflow-x-hidden min-h-screen flex flex-col">
        <AnimatedCursor />
        <Header />
        <div className="flex-grow">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
