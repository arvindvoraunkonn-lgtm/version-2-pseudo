'use client';

/**
 * iTunes Search API helper.
 *
 * Uses JSONP (script tag injection) instead of fetch() because the iTunes
 * Search API doesn't reliably send CORS headers for browser requests.
 * JSONP works by creating a <script> tag with a `callback=` parameter —
 * iTunes wraps the JSON response in a function call that we define on
 * `window`. This bypasses CORS entirely.
 *
 * Endpoint: https://itunes.apple.com/search?term=...&entity=song&limit=25&callback=...
 *
 * No API key required — the iTunes Search API is public and free for
 * low-volume use (rate-limited to ~20 requests/minute per IP).
 */

export interface ItunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string; // album
  artworkUrl100?: string;
  trackTimeMillis?: number;
  primaryGenreName?: string;
  releaseDate?: string;
  trackExplicitness?: string;
  collectionPrice?: number;
  country?: string;
}

interface ItunesSearchResponse {
  resultCount: number;
  results: ItunesTrack[];
}

/**
 * Search the iTunes catalog for song tracks matching `term`.
 * Returns up to `limit` results (default 25).
 *
 * Resolves to an empty array on error (never throws) so the caller can
 * always render search results even if iTunes is unreachable — lyrics
 * from lrclib will still show, just without artwork.
 */
export function searchItunes(term: string, limit: number = 25): Promise<ItunesTrack[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !term.trim()) {
      resolve([]);
      return;
    }

    const callbackName =
      'itunes_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const script = document.createElement('script');

    let settled = false;

    const cleanup = () => {
      delete (window as any)[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    (window as any)[callbackName] = (data: ItunesSearchResponse) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(data?.results || []);
    };

    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve([]); // resolve empty on error, don't throw
    };

    script.src = `https://itunes.apple.com/search?term=${encodeURIComponent(
      term
    )}&entity=song&limit=${limit}&callback=${callbackName}`;

    document.body.appendChild(script);

    // Timeout after 10s — iTunes can be slow
    setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve([]);
    }, 10000);
  });
}

/**
 * Fetch a batch of random real songs from iTunes.
 *
 * Instead of generating fake titles, we search iTunes with random 2-letter
 * strings (e.g. "ab", "qx", "zm") which return a wide variety of real songs
 * from real artists. The results are shuffled client-side so each call
 * returns a different set.
 *
 * `excludeIds` — a Set of trackIds already shown (prevents duplicates across
 * loads). Pass the same Set on each call and it will be mutated in-place to
 * include the newly returned trackIds.
 *
 * Returns up to `count` unique ItunesTrack objects.
 */
export async function searchItunesRandom(
  count: number,
  excludeIds: Set<number>
): Promise<ItunesTrack[]> {
  // Random 2-letter search terms — diverse enough to get different songs
  // each time, short enough that iTunes returns many results.
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const randomTerm = (): string => {
    return (
      letters[Math.floor(Math.random() * 26)] +
      letters[Math.floor(Math.random() * 26)]
    );
  };

  const out: ItunesTrack[] = [];
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts && out.length < count; attempt++) {
    const term = randomTerm();
    const results = await searchItunes(term, 200);

    // Shuffle results so we get different songs each call
    const shuffled = results
      .filter((r) => !excludeIds.has(r.trackId))
      .sort(() => Math.random() - 0.5);

    for (const r of shuffled) {
      if (out.length >= count) break;
      excludeIds.add(r.trackId);
      out.push(r);
    }
  }

  return out;
}

/**
 * Search iTunes by entity type (song, album, musicArtist).
 * Used by the DAISY discography tab to search by Artist / Album / EP / Single.
 *
 * Returns raw iTunes results (the caller handles display).
 */
export async function searchItunesByEntity(
  term: string,
  entity: 'musicArtist' | 'album' | 'song'
): Promise<any[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !term.trim()) {
      resolve([]);
      return;
    }

    const callbackName =
      'itunes_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      delete (window as any)[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    (window as any)[callbackName] = (data: any) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(data?.results || []);
    };

    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve([]);
    };

    script.src = `https://itunes.apple.com/search?term=${encodeURIComponent(
      term
    )}&entity=${entity}&limit=50&callback=${callbackName}`;

    document.body.appendChild(script);

    setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve([]);
    }, 10000);
  });
}

/**
 * Lookup an iTunes collection (album) by its collectionId and return all
 * songs on that album. Uses the /lookup endpoint with entity=song.
 *
 * The first result is the collection metadata (wrapperType=collection);
 * the remaining results are tracks (wrapperType=track), already ordered
 * by discNumber + trackNumber.
 *
 * Used by DAISY's album view — when the user clicks an album, this fetches
 * all tracks on that album.
 */
export async function lookupAlbumTracks(collectionId: number): Promise<ItunesTrack[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve([]);
      return;
    }

    const callbackName =
      'itunes_lookup_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      delete (window as any)[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    (window as any)[callbackName] = (data: any) => {
      if (settled) return;
      settled = true;
      cleanup();
      // Filter to only track wrapperType (skip the collection metadata)
      const tracks = (data?.results || []).filter(
        (r: any) => r.wrapperType === 'track'
      );
      resolve(tracks);
    };

    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve([]);
    };

    script.src = `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&limit=200&callback=${callbackName}`;

    document.body.appendChild(script);

    setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve([]);
    }, 10000);
  });
}

/**
 * Upgrade an iTunes artwork URL to a higher resolution.
 *
 * iTunes returns `100x100bb.jpg` by default. We replace the size token
 * with `600x600` for crisp display on retina screens without making the
 * file unnecessarily large.
 *
 * Example:
 *   https://is1-ssl.mzstatic.com/.../100x100bb.jpg
 *   → https://is1-ssl.mzstatic.com/.../600x600bb.jpg
 */
export function upgradeArtworkUrl(url: string | undefined, size: number = 600): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/\d+x\d+bb\.(jpg|png|jpeg)/i, `/${size}x${size}bb.$1`);
}

/**
 * Normalize a track/artist name for fuzzy matching between lrclib and
 * iTunes results. Lowercases, removes all non-alphanumeric characters,
 * and trims. This handles minor differences like "Try Me!" vs "Try Me"
 * or "The Weeknd" vs "the weeknd".
 */
export function normalizeForMatch(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Levenshtein distance — count of single-character edits needed to turn
 * string `a` into string `b`. Used for fuzzy matching when exact
 * normalized equality fails (e.g. "Try Me" vs "Try Me (Demo)").
 *
 * Classic dynamic programming implementation. Bounded by the shorter
 * string length so it stays fast for typical track/artist names.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) prev[i] = i;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/**
 * Similarity ratio between two normalized strings, 0..1.
 * 1 = identical, 0 = completely different. Uses Levenshtein distance
 * normalized by the longer string's length.
 */
export function similarity(a: string, b: string): number {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (!na && !nb) return 1;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

/**
 * Check if a lrclib result and an iTunes track refer to the same song.
 *
 * Matching strategy (in priority order):
 *   1. **Duration match** — if both have durations and they're within ±2
 *      seconds, that's strong evidence it's the same recording. Combined
 *      with a fuzzy name match, this is highly reliable.
 *   2. **Fuzzy track name + artist** — uses similarity ratio (≥0.7) to
 *      handle cases like "Try Me" vs "Try Me (Official Audio)" or
 *      "The Weeknd - Try Me" vs "Try Me".
 *   3. **Substring containment** — if the iTunes track name is contained
 *      in the lrclib track name (after normalization), they're likely the
 *      same song (lrclib often has prefixes like "Artist - " or suffixes
 *      like " (Official Audio)").
 *
 * All three signals are combined: a match is declared when at least
 * 2 of the 3 conditions hold, OR when duration matches exactly AND
 * one of the name conditions holds.
 */
export function isSameTrack(
  lrc: { trackName: string; artistName: string; albumName?: string; duration?: number },
  it: { trackName: string; artistName: string; collectionName?: string; trackTimeMillis?: number }
): boolean {
  const lrcDur = lrc.duration;
  const itDur = it.trackTimeMillis ? Math.round(it.trackTimeMillis / 1000) : undefined;

  // Track name fuzzy match
  const trackSim = similarity(lrc.trackName, it.trackName);
  const trackMatch = trackSim >= 0.7;

  // Substring containment (iTunes name inside lrclib name, handles
  // "Try Me" contained in "The Weeknd - Try Me (Official Audio)")
  const lrcNorm = normalizeForMatch(lrc.trackName);
  const itNorm = normalizeForMatch(it.trackName);
  const containment = itNorm.length > 0 && lrcNorm.includes(itNorm);

  // Artist name match (fuzzy)
  const artistMatch = similarity(lrc.artistName, it.artistName) >= 0.7;

  // Duration match (±2 seconds)
  const durationMatch =
    lrcDur !== undefined && itDur !== undefined && Math.abs(lrcDur - itDur) <= 2;

  // Strong name signal: track matches via fuzzy OR containment
  const nameMatch = trackMatch || containment;

  if (durationMatch && nameMatch && artistMatch) return true;
  if (durationMatch && nameMatch) return true;
  if (nameMatch && artistMatch) return true;
  return false;
}

/**
 * Find the best iTunes match for a lrclib result, or undefined if no
 * good match exists. "Best" = highest combined similarity score.
 *
 * Used when there are multiple iTunes results for the same track
 * (e.g. explicit + cleaned versions) — we pick the closest one.
 */
export function findBestItunesMatch(
  lrc: { trackName: string; artistName: string; albumName?: string; duration?: number },
  itunes: ItunesTrack[]
): ItunesTrack | undefined {
  let best: ItunesTrack | undefined;
  let bestScore = 0;
  for (const it of itunes) {
    if (!isSameTrack(lrc, it)) continue;
    let score = similarity(lrc.trackName, it.trackName);
    if (lrc.duration && it.trackTimeMillis) {
      const itDur = Math.round(it.trackTimeMillis / 1000);
      if (Math.abs(lrc.duration - itDur) <= 2) score += 0.5;
    }
    if (score > bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}
