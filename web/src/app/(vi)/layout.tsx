import type { ReactNode } from 'react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeScript } from '@/components/ThemeScript';
import '../globals.css';

/**
 * Fonts are downloaded at build time and served from our own origin, so the
 * published site makes no request to Google and has no external dependency at
 * runtime — which matters for a static site meant to work anywhere.
 *
 * Inter carries the Vietnamese subset; the Vietnamese pages genuinely need the
 * diacritic glyphs rather than falling back mid-word.
 */
const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
});

/** Mono is only ever used for repo names and figures, so Latin is enough. */
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

/**
 * One root layout per locale, via route groups. A nested layout cannot change
 * <html lang>, and serving Vietnamese content marked as English is both an SEO
 * mistake and an accessibility one — screen readers would read it with the
 * wrong pronunciation.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${inter.variable} ${jetbrains.variable}`}>
      <body>
        <ThemeScript />
        {children}
      </body>
    </html>
  );
}
