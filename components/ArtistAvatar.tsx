'use client';

import React from 'react';
import { useArtworkSrc } from '../hooks/use-artwork-src';

interface ArtistAvatarProps {
  url?: string;
  fileId?: string;
  name: string;
  /** Tailwind size class for the circular avatar, e.g. "w-10 h-10". */
  sizeClassName?: string;
  /** Extra container classes (ring, shadow, border, etc.). */
  containerClassName?: string;
}

/**
 * Circular artist avatar. Falls back to the artist's initial when no profile
 * image is available (CDN URL or locally stored file). Used in the home list,
 * grid, and anywhere else a compact artist representation is needed.
 */
export function ArtistAvatar({
  url,
  fileId,
  name,
  sizeClassName = 'w-10 h-10',
  containerClassName = 'bg-[var(--bg)] border border-[var(--border-light)]',
}: ArtistAvatarProps) {
  const src = useArtworkSrc(url, fileId);
  return (
    <div
      className={`${sizeClassName} shrink-0 rounded-full ${containerClassName} overflow-hidden flex items-center justify-center`}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-sm font-bold text-[var(--text)] uppercase">
          {(name || '?').charAt(0)}
        </span>
      )}
    </div>
  );
}
