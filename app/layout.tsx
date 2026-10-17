import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Pseudonymous',
  description: 'a mobile-first e-ink document app for managing music artists, releases, lyrics, notes, artworks, achievements, and assets.',
  openGraph: {
    title: 'Pseudonymous',
    description: 'a mobile-first e-ink document app for managing music artists, releases, lyrics, notes, artworks, achievements, and assets.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pseudonymous',
    description: 'a mobile-first e-ink document app for managing music artists, releases, lyrics, notes, artworks, achievements, and assets.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
