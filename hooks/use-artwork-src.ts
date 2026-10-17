'use client';

import { useEffect, useState } from 'react';
import { getBlobUrlForFileId } from '../lib/db';

/**
 * Resolves a displayable image `src` from any combination of:
 *   - `url`: a direct CDN / remote URL (preferred if present)
 *   - `fileId`: a stored IndexedDB blob id (used as a fallback when no URL is provided)
 *
 * Returns `null` while resolving or when there is nothing to display, so the
 * caller can render a placeholder.
 *
 * The blob URLs returned by `getBlobUrlForFileId` are cached globally inside
 * `lib/db.ts`, so multiple components resolving the same fileId share a single
 * object URL — no leaks.
 */
export function useArtworkSrc(
  url?: string,
  fileId?: string
): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (url) {
      // Remote URL wins; no need to hit IndexedDB.
      setSrc(url);
      return () => {
        mounted = false;
      };
    }

    if (!fileId) {
      setSrc(null);
      return () => {
        mounted = false;
      };
    }

    setSrc(null);
    getBlobUrlForFileId(fileId)
      .then((blobUrl) => {
        if (mounted) setSrc(blobUrl);
      })
      .catch(() => {
        if (mounted) setSrc(null);
      });

    return () => {
      mounted = false;
    };
  }, [url, fileId]);

  return src;
}
