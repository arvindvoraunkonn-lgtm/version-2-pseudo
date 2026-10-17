'use client';

import React from 'react';
import { Music, Image as ImageIcon } from 'lucide-react';
import { useArtworkSrc } from '../hooks/use-artwork-src';

interface ArtworkProps {
  url?: string;
  fileId?: string;
  alt: string;
  /** Tailwind size classes for the square container, e.g. "w-12 h-12". Defaults to a small thumb. */
  sizeClassName?: string;
  /** Lucide icon to use as the placeholder when no artwork is available. */
  placeholderIcon?: 'music' | 'image';
  /** Extra classes for the container (border, rounding, etc.). */
  containerClassName?: string;
  /** Icon size class, defaults to "w-4 h-4". */
  iconClassName?: string;
}

/**
 * 1:1 square artwork renderer that knows how to display either a remote CDN
 * URL or a locally-stored IndexedDB file (resolved via `useArtworkSrc`).
 *
 * Used for releases (albums / eps / singles), individual tracks inside
 * albums, and standalone artworks. Keeps the placeholder consistent across
 * the whole app: high-contrast grey background with a small line icon.
 */
export function Artwork({
  url,
  fileId,
  alt,
  sizeClassName = 'w-12 h-12',
  placeholderIcon = 'music',
  containerClassName = 'bg-[var(--bg-hover)] border border-[var(--border-light)]',
  iconClassName = 'w-4 h-4',
}: ArtworkProps) {
  const src = useArtworkSrc(url, fileId);
  const Placeholder = placeholderIcon === 'image' ? ImageIcon : Music;

  return (
    <div
      className={`${sizeClassName} aspect-square ${containerClassName} overflow-hidden flex items-center justify-center shrink-0`}
    >
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <Placeholder className={`${iconClassName} text-[var(--text-faint)]`} />
      )}
    </div>
  );
}
