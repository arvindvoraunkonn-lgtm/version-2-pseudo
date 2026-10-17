'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { DaisyEntry } from '../lib/types';
import { MarkdownPreview } from './MarkdownPreview';
import {
  searchItunes,
  searchItunesRandom,
  searchItunesByEntity,
  lookupAlbumTracks,
  upgradeArtworkUrl,
  findBestItunesMatch,
  type ItunesTrack,
} from '../lib/itunes';
import { loadViewPref, saveViewPref } from '../lib/view-prefs';
import {
  X,
  Clock,
  FileText,
  GripVertical,
  LayoutList,
  LayoutGrid,
  FileText as FileTextIcon,
  BadgeCheck,
  ExternalLink,
} from 'lucide-react';

// ===========================================================================
// Types
// ===========================================================================

interface DaisyViewProps {
  entries: DaisyEntry[];
  onAddEntry: (entry: DaisyEntry) => void;
  onUpdateEntry: (entry: DaisyEntry) => void;
  onDeleteEntry: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
}

/**
 * A random song from iTunes (real title + real artist + artwork).
 */
interface RandomSong {
  trackId: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  artworkUrl?: string;
  genre?: string;
  releaseDate?: string;
}

/**
 * DAISY — two panels:
 *
 * 1. Random: fetches batches of real songs from iTunes using random search
 *    terms. Displayed as a plain text list (no per-row buttons). Click a
 *    line to open a movable lyrics/artwork window. Check lines to save
 *    in bulk.
 *
 * 2. Discography: search by Artist / Album / EP / Single. Results are
 *    shown as plain text lists. Clicking an artist shows their full
 *    discography as a plain text list.
 *
 * Everything is a clean list — no button-heavy rows. The only buttons are
 * the tab switcher, the search submit, and the "Load more" / "Save" text
 * links.
 */

type DiscographyCategory = 'artist' | 'album' | 'song';

interface DiscographyArtist {
  artistId: number;
  artistName: string;
  primaryGenreName?: string;
  // Apple Music verified artists have an artistLinkUrl pointing to
  // music.apple.com — used to show the verification badge + profile link.
  artistLinkUrl?: string;
}

interface DiscographyAlbum {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl?: string;
  trackCount?: number;
  releaseDate?: string;
  genre?: string;
  collectionType?: string; // 'Album', 'EP', 'Single', etc.
  explicitness?: string;
}

interface DiscographyTrack {
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  artworkUrl?: string;
  genre?: string;
  releaseDate?: string;
  // Optional: collectionId for the album this track belongs to
  collectionId?: number;
  trackNumber?: number;
}

export function DaisyView({
  entries,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onDeleteMany,
}: DaisyViewProps) {
  const [tab, setTab] = useState<'random' | 'discography' | 'saved'>('random');

  return (
    <div className="w-full max-w-3xl mx-auto p-3 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)] mb-3">
        <span className="font-semibold text-[var(--text)]">DAISY</span>
        <span className="text-[10px] text-[var(--text-faint)]">{entries.length} saved</span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-3 border border-[var(--border-light)] rounded-[3px] p-0.5">
        <button
          type="button"
          onClick={() => setTab('random')}
          className={`flex-1 py-1.5 text-[11px] rounded-[2px] cursor-pointer whitespace-nowrap ${
            tab === 'random' ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'bg-[var(--bg)] text-[var(--text-muted)]'
          }`}
        >
          Random
        </button>
        <button
          type="button"
          onClick={() => setTab('discography')}
          className={`flex-1 py-1.5 text-[11px] rounded-[2px] cursor-pointer whitespace-nowrap ${
            tab === 'discography' ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'bg-[var(--bg)] text-[var(--text-muted)]'
          }`}
        >
          Discography
        </button>
        <button
          type="button"
          onClick={() => setTab('saved')}
          className={`flex-1 py-1.5 text-[11px] rounded-[2px] cursor-pointer whitespace-nowrap ${
            tab === 'saved' ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'bg-[var(--bg)] text-[var(--text-muted)]'
          }`}
        >
          Saved ({entries.length})
        </button>
      </div>

      {tab === 'random' && (
        <RandomTab onAddEntry={onAddEntry} />
      )}
      {tab === 'discography' && (
        <DiscographyTab onAddEntry={onAddEntry} />
      )}
      {tab === 'saved' && (
        <SavedTab
          entries={entries}
          onUpdateEntry={onUpdateEntry}
          onDeleteEntry={onDeleteEntry}
          onDeleteMany={onDeleteMany}
        />
      )}
    </div>
  );
}

// ===========================================================================
// RandomTab — fetches random real songs from iTunes, displays as plain list
// ===========================================================================

interface RandomTabProps {
  onAddEntry: (entry: DaisyEntry) => void;
}

function RandomTab({ onAddEntry }: RandomTabProps) {
  const [songs, setSongs] = useState<RandomSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set()); // trackIds
  const [windowSong, setWindowSong] = useState<RandomSong | null>(null);
  const [lookupData, setLookupData] = useState<{
    plainLyrics?: string;
    syncedLyrics?: string;
    preferSynced?: boolean;
  } | null>(null);
  const [looking, setLooking] = useState(false);

  // Track seen trackIds to prevent duplicates across loads
  const seenIds = useRef<Set<number>>(new Set());

  // Fetch initial batch on mount
  useEffect(() => {
    loadMore(20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(async (count: number) => {
    setLoading(true);
    try {
      const results = await searchItunesRandom(count, seenIds.current);
      const mapped: RandomSong[] = results.map((r) => ({
        trackId: r.trackId,
        trackName: r.trackName,
        artistName: r.artistName,
        albumName: r.collectionName,
        duration: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : undefined,
        artworkUrl: upgradeArtworkUrl(r.artworkUrl100),
        genre: r.primaryGenreName,
        releaseDate: r.releaseDate,
      }));
      setSongs((prev) => [...prev, ...mapped]);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleSelected = useCallback((trackId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }, []);

  const handleSaveSelected = useCallback(() => {
    const toSave = songs.filter((s) => selected.has(s.trackId));
    for (const s of toSave) {
      const entry: DaisyEntry = {
        id: 'daisyentry_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        title: s.trackName,
        artistName: s.artistName,
        albumName: s.albumName,
        duration: s.duration,
        artworkUrl: s.artworkUrl,
        genre: s.genre,
        createdAt: new Date().toISOString(),
      };
      onAddEntry(entry);
    }
    // Remove saved songs from the list
    setSongs((prev) => prev.filter((s) => !selected.has(s.trackId)));
    setSelected(new Set());
  }, [songs, selected, onAddEntry]);

  // Open the movable window for a song — fetches lyrics on demand
  const handleOpenSong = useCallback(async (song: RandomSong) => {
    setWindowSong(song);
    setLookupData(null);
    setLooking(true);
    try {
      // Search lrclib for lyrics
      const params = new URLSearchParams({
        track_name: song.trackName,
        artist_name: song.artistName,
      });
      const res = await fetch(`https://lrclib.net/api/search?${params}`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        const lrc = data.find((l: any) => l.syncedLyrics) || data.find((l: any) => l.plainLyrics);
        if (lrc) {
          setLookupData({
            plainLyrics: lrc.plainLyrics || undefined,
            syncedLyrics: lrc.syncedLyrics || undefined,
            preferSynced: !!lrc.syncedLyrics,
          });
        }
      }
    } catch {
      // ignore
    } finally {
      setLooking(false);
    }
  }, []);

  const stripLrc = useCallback((lrc: string): string => {
    return lrc
      .split('\n')
      .map((line) => line.replace(/^\s*\[\d+:\d+(?:\.\d+)?\]\s*/g, ''))
      .join('\n')
      .trim();
  }, []);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
      {/* Minimal top bar: only save link when something is selected */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between py-1 px-2 mb-2 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-[3px] shrink-0">
          <span className="text-[10px] text-[var(--text-muted)]">{selected.size} selected</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleSaveSelected}
              className="text-[10px] text-[var(--text)] hover:text-[var(--text)] underline cursor-pointer font-medium"
            >
              Save {selected.size} → Saved
            </button>
          </div>
        </div>
      )}

      {/* Scrollable container — the list scrolls inside here, not the page */}
      <div className="flex-1 overflow-y-auto border border-[var(--border-light)] rounded-[3px] bg-[var(--bg)]">
        {songs.length === 0 && !loading ? (
          <div className="py-12 text-center text-[var(--text-faint)]">
            Loading random songs from iTunes...
          </div>
        ) : (
          <>
            <div className="divide-y divide-[var(--border-light)]">
              {songs.map((s) => {
                const isSelected = selected.has(s.trackId);
                return (
                  <div
                    key={s.trackId}
                    className={`py-1.5 px-2 flex items-center gap-2 cursor-pointer ${
                      isSelected ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-secondary)]'
                    }`}
                    onClick={() => toggleSelected(s.trackId)}
                    onDoubleClick={() => handleOpenSong(s)}
                  >
                    {/* Selection dot */}
                    <div
                      className={`w-3 h-3 rounded-full border shrink-0 ${
                        isSelected
                          ? 'bg-[var(--accent)] border-[var(--border)]'
                          : 'border-[var(--border-light)] bg-[var(--bg)]'
                      }`}
                    />

                    {/* Title + artist as plain text */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSong(s);
                      }}
                      className="flex-1 text-left min-w-0"
                    >
                      <span className="text-[var(--text)]">{s.trackName}</span>
                      <span className="text-[var(--text-faint)]"> — {s.artistName}</span>
                      {s.duration && (
                        <span className="text-[var(--text-faint)] ml-2 font-mono text-[10px]">
                          {Math.floor(s.duration / 60)}:{String(s.duration % 60).padStart(2, '0')}
                        </span>
                      )}
                    </button>

                    {/* Artwork thumbnail (small, no border, non-interactive) */}
                    {s.artworkUrl && (
                      <img
                        src={s.artworkUrl}
                        alt=""
                        className="w-7 h-7 rounded-[2px] object-cover shrink-0 pointer-events-none"
                        loading="lazy"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Load more link — inside the scrollable container */}
            {songs.length > 0 && (
              <button
                type="button"
                onClick={() => loadMore(20)}
                disabled={loading}
                className="w-full py-3 text-center text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer text-[11px] underline disabled:opacity-40 border-t border-[var(--border-light)]"
              >
                {loading ? 'Loading...' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Movable lyrics window */}
      {windowSong && (
        <MovableWindow
          title={windowSong.trackName}
          artist={windowSong.artistName}
          album={windowSong.albumName}
          duration={windowSong.duration}
          artworkUrl={windowSong.artworkUrl}
          genre={windowSong.genre}
          looking={looking}
          lookupData={lookupData}
          stripLrc={stripLrc}
          onClose={() => {
            setWindowSong(null);
            setLookupData(null);
          }}
          onSave={() => {
            const entry: DaisyEntry = {
              id: 'daisyentry_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              title: windowSong.trackName,
              artistName: windowSong.artistName,
              albumName: windowSong.albumName,
              duration: windowSong.duration,
              artworkUrl: windowSong.artworkUrl,
              plainLyrics: lookupData?.plainLyrics,
              syncedLyrics: lookupData?.syncedLyrics,
              preferSynced: lookupData?.preferSynced,
              genre: windowSong.genre,
              createdAt: new Date().toISOString(),
            };
            onAddEntry(entry);
            setWindowSong(null);
            setLookupData(null);
          }}
        />
      )}
    </div>
  );
}

// ===========================================================================
// DiscographyTab — search by Artist / Album / EP, plain text lists
// ===========================================================================

interface DiscographyTabProps {
  onAddEntry: (entry: DaisyEntry) => void;
}

function DiscographyTab({ onAddEntry }: DiscographyTabProps) {
  const [category, setCategory] = useState<DiscographyCategory>('artist');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Search results
  const [artists, setArtists] = useState<DiscographyArtist[]>([]);
  const [albums, setAlbums] = useState<DiscographyAlbum[]>([]);
  const [tracks, setTracks] = useState<DiscographyTrack[]>([]);

  // When an artist is clicked, we fetch their full discography (albums)
  const [selectedArtist, setSelectedArtist] = useState<DiscographyArtist | null>(null);
  const [artistLoading, setArtistLoading] = useState(false);
  const [artistAlbums, setArtistAlbums] = useState<DiscographyAlbum[]>([]);

  // When an album is clicked, we fetch its tracks via lookup API
  const [selectedAlbum, setSelectedAlbum] = useState<DiscographyAlbum | null>(null);
  const [albumLoading, setAlbumLoading] = useState(false);
  const [albumTracks, setAlbumTracks] = useState<DiscographyTrack[]>([]);

  // View mode for results (persists across sessions)
  const [viewMode, setViewMode] = useState<'normal' | 'list' | 'grid'>(() => {
    const saved = loadViewPref('daisy.discography', 'normal');
    if (saved === 'normal' || saved === 'list' || saved === 'grid') return saved;
    return 'normal';
  });
  useEffect(() => {
    saveViewPref('daisy.discography', viewMode);
  }, [viewMode]);

  // Window for viewing a track
  const [windowTrack, setWindowTrack] = useState<DiscographyTrack | null>(null);
  const [lookupData, setLookupData] = useState<{
    plainLyrics?: string;
    syncedLyrics?: string;
    preferSynced?: boolean;
  } | null>(null);
  const [looking, setLooking] = useState(false);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    setHasSearched(true);
    setSelectedArtist(null);
    setSelectedAlbum(null);
    setArtists([]);
    setAlbums([]);
    setTracks([]);
    setArtistAlbums([]);
    setAlbumTracks([]);

    try {
      if (category === 'artist') {
        const results = await searchItunesByEntity(q, 'musicArtist');
        setArtists(
          results.map((r: any) => ({
            artistId: r.artistId,
            artistName: r.artistName,
            primaryGenreName: r.primaryGenreName,
            artistLinkUrl: r.artistLinkUrl,
          }))
        );
      } else if (category === 'album') {
        // Fetch ALBUMS (collections), not songs
        const results = await searchItunesByEntity(q, 'album');
        const mapped: DiscographyAlbum[] = results.map((r: any) => ({
          collectionId: r.collectionId,
          collectionName: r.collectionName,
          artistName: r.artistName,
          artworkUrl: upgradeArtworkUrl(r.artworkUrl100),
          trackCount: r.trackCount,
          releaseDate: r.releaseDate,
          genre: r.primaryGenreName,
          collectionType: r.collectionType,
          explicitness: r.collectionExplicitness,
        }));

        // Deduplicate by collectionId (same album may appear multiple times
        // for explicit/cleaned versions)
        const seen = new Set<number>();
        const deduped = mapped.filter((a) => {
          if (seen.has(a.collectionId)) return false;
          seen.add(a.collectionId);
          return true;
        });

        // Sort by release date (newest first)
        deduped.sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));
        setAlbums(deduped);
      } else {
        // Song search
        const results = await searchItunesByEntity(q, 'song');
        const mapped: DiscographyTrack[] = results.map((r: any) => ({
          trackName: r.trackName,
          artistName: r.artistName,
          albumName: r.collectionName,
          duration: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : undefined,
          artworkUrl: upgradeArtworkUrl(r.artworkUrl100),
          genre: r.primaryGenreName,
          releaseDate: r.releaseDate,
          collectionId: r.collectionId,
          trackNumber: r.trackNumber,
        }));
        setTracks(mapped);
      }
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [query, category]);

  // When an artist is clicked, fetch their full album discography
  const handleArtistClick = useCallback(async (artist: DiscographyArtist) => {
    setSelectedArtist(artist);
    setSelectedAlbum(null);
    setArtistLoading(true);
    setArtistAlbums([]);
    setAlbumTracks([]);
    try {
      const results = await searchItunesByEntity(artist.artistName, 'album');
      const mapped: DiscographyAlbum[] = results.map((r: any) => ({
        collectionId: r.collectionId,
        collectionName: r.collectionName,
        artistName: r.artistName,
        artworkUrl: upgradeArtworkUrl(r.artworkUrl100),
        trackCount: r.trackCount,
        releaseDate: r.releaseDate,
        genre: r.primaryGenreName,
        collectionType: r.collectionType,
        explicitness: r.collectionExplicitness,
      }));

      // Deduplicate by collectionId
      const seen = new Set<number>();
      const deduped = mapped.filter((a) => {
        if (seen.has(a.collectionId)) return false;
        seen.add(a.collectionId);
        return true;
      });

      // Sort by release date (newest first)
      deduped.sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));
      setArtistAlbums(deduped);
    } finally {
      setArtistLoading(false);
    }
  }, []);

  // When an album is clicked, fetch all its tracks via lookup API
  const handleAlbumClick = useCallback(async (album: DiscographyAlbum) => {
    setSelectedAlbum(album);
    setAlbumLoading(true);
    setAlbumTracks([]);
    try {
      const trackResults = await lookupAlbumTracks(album.collectionId);
      const mapped: DiscographyTrack[] = trackResults.map((r: any) => ({
        trackName: r.trackName,
        artistName: r.artistName,
        albumName: r.collectionName || album.collectionName,
        duration: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : undefined,
        artworkUrl: upgradeArtworkUrl(r.artworkUrl100) || album.artworkUrl,
        genre: r.primaryGenreName,
        releaseDate: r.releaseDate,
        collectionId: r.collectionId,
        trackNumber: r.trackNumber,
      }));

      // Sort by track number
      mapped.sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
      setAlbumTracks(mapped);
    } finally {
      setAlbumLoading(false);
    }
  }, []);

  // Open track window — fetches lyrics on demand
  const handleOpenTrack = useCallback(async (track: DiscographyTrack) => {
    setWindowTrack(track);
    setLookupData(null);
    setLooking(true);
    try {
      const params = new URLSearchParams({
        track_name: track.trackName,
        artist_name: track.artistName,
      });
      const res = await fetch(`https://lrclib.net/api/search?${params}`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        const lrc = data.find((l: any) => l.syncedLyrics) || data.find((l: any) => l.plainLyrics);
        if (lrc) {
          setLookupData({
            plainLyrics: lrc.plainLyrics || undefined,
            syncedLyrics: lrc.syncedLyrics || undefined,
            preferSynced: !!lrc.syncedLyrics,
          });
        }
      }
    } catch {
      // ignore
    } finally {
      setLooking(false);
    }
  }, []);

  const stripLrc = useCallback((lrc: string): string => {
    return lrc
      .split('\n')
      .map((line) => line.replace(/^\s*\[\d+:\d+(?:\.\d+)?\]\s*/g, ''))
      .join('\n')
      .trim();
  }, []);

  const categoryLabels: { value: DiscographyCategory; label: string }[] = [
    { value: 'artist', label: 'Artist' },
    { value: 'album', label: 'Album / EP' },
    { value: 'song', label: 'Song' },
  ];

  // Helper to format duration
  const fmtDur = (d?: number) =>
    d ? `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}` : '';

  // Helper to format release year
  const fmtYear = (d?: string) => (d ? new Date(d).getFullYear() : '');

  // Is this artist verified on Apple Music?
  // Verified artists have an artistLinkUrl pointing to music.apple.com.
  const isVerified = (a: DiscographyArtist) =>
    !!a.artistLinkUrl && a.artistLinkUrl.includes('music.apple.com');

  // --- Determine what list to render (artist search / artist's albums / album's tracks / album results / song results) ---

  // The "current list" depends on which view we're in:
  // 1. If selectedAlbum is set → show that album's tracks
  // 2. Else if selectedArtist is set → show that artist's albums
  // 3. Else if category === 'artist' → show artist search results
  // 4. Else if category === 'album' → show album search results
  // 5. Else if category === 'song' → show song search results

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
      {/* Category selector + view mode switcher (always visible) */}
      <div className="flex items-center justify-between gap-2 py-1 flex-wrap shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[var(--text-faint)]">Search by:</span>
          {categoryLabels.map(({ value, label }) => (
            <label
              key={value}
              className={`text-[11px] cursor-pointer ${
                category === value ? 'text-[var(--text)] font-medium' : 'text-[var(--text-muted)]'
              }`}
            >
              <input
                type="radio"
                name="daisy-cat"
                value={value}
                checked={category === value}
                onChange={() => {
                  setCategory(value);
                  setSelectedArtist(null);
                  setSelectedAlbum(null);
                }}
                className="hidden"
              />
              {label}
            </label>
          ))}
        </div>

        {/* View mode switcher — only when there are results to display */}
        {(artists.length > 0 || albums.length > 0 || tracks.length > 0 || artistAlbums.length > 0 || albumTracks.length > 0) && (
          <div className="flex items-center border border-[var(--border-light)] rounded-[2px] p-0.5">
            {([
              { mode: 'normal' as const, Icon: FileTextIcon, label: 'Normal' },
              { mode: 'list' as const, Icon: LayoutList, label: 'List' },
              { mode: 'grid' as const, Icon: LayoutGrid, label: 'Grid' },
            ]).map(({ mode, Icon, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`p-1 rounded-[2px] cursor-pointer ${
                  viewMode === mode
                    ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                    : 'bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
                title={label}
                aria-label={label}
              >
                <Icon className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search input */}
      <form onSubmit={handleSearch} className="flex gap-1 shrink-0">
        <input
          type="text"
          placeholder={`Search by ${category}...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 border border-[var(--border-light)] px-2 py-1.5 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px] focus:outline-none focus:border-[var(--border)] min-w-0"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="px-3 py-1.5 bg-[var(--accent)] text-[var(--accent-text)] border border-[var(--border)] rounded-[2px] text-xs hover:bg-[var(--accent-hover)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
        >
          {searching ? '...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="p-2 border border-[var(--border-light)] bg-[var(--bg-secondary)] text-[var(--text-muted)] text-[11px] rounded-[2px]">
          {error}
        </div>
      )}

      {/* Breadcrumb / back navigation */}
      {selectedAlbum && (
        <div className="flex items-center gap-2 py-1">
          <button
            type="button"
            onClick={() => {
              setSelectedAlbum(null);
              setAlbumTracks([]);
            }}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
          >
            ← Back to {selectedArtist ? selectedArtist.artistName : 'albums'}
          </button>
        </div>
      )}
      {!selectedAlbum && selectedArtist && (
        <div className="flex items-center gap-2 py-1">
          <button
            type="button"
            onClick={() => {
              setSelectedArtist(null);
              setArtistAlbums([]);
            }}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
          >
            ← Back to artist results
          </button>
        </div>
      )}

      {/* Scrollable results container */}
      <div className="flex-1 overflow-y-auto border border-[var(--border-light)] rounded-[3px] bg-[var(--bg)] mt-2">

      {/* ====================================================== */}
      {/* VIEW: Selected album's tracks */}
      {/* ====================================================== */}
      {selectedAlbum && (
        <div className="space-y-1">
          {/* Album header */}
          <div className="flex items-center gap-2 py-2 border-b border-[var(--border-light)]">
            {selectedAlbum.artworkUrl && (
              <img
                src={selectedAlbum.artworkUrl}
                alt={selectedAlbum.collectionName}
                className="w-12 h-12 rounded-[3px] object-cover border border-[var(--border-light)] shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="font-medium text-[var(--text)] text-sm">{selectedAlbum.collectionName}</div>
              <div className="text-[10px] text-[var(--text-muted)]">
                {selectedAlbum.artistName}
                {selectedAlbum.trackCount ? ` · ${selectedAlbum.trackCount} tracks` : ''}
                {fmtYear(selectedAlbum.releaseDate) ? ` · ${fmtYear(selectedAlbum.releaseDate)}` : ''}
                {selectedAlbum.genre ? ` · ${selectedAlbum.genre}` : ''}
              </div>
            </div>
          </div>

          {albumLoading ? (
            <div className="py-4 text-center text-[var(--text-faint)]">Loading tracks...</div>
          ) : albumTracks.length === 0 ? (
            <div className="py-4 text-center text-[var(--text-faint)]">No tracks found for this album.</div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-1">
              {albumTracks.map((t, i) => (
                <TrackGridItem key={`${t.trackName}-${i}`} track={t} onClick={() => handleOpenTrack(t)} />
              ))}
            </div>
          ) : viewMode === 'list' ? (
            <div className="divide-y divide-[var(--border-light)]">
              {albumTracks.map((t, i) => (
                <TrackListItem key={`${t.trackName}-${i}`} track={t} onClick={() => handleOpenTrack(t)} />
              ))}
            </div>
          ) : (
            /* Normal view — compact rows with artwork */
            <div className="divide-y divide-[var(--border-light)]">
              {albumTracks.map((t, i) => (
                <TrackNormalItem key={`${t.trackName}-${i}`} track={t} onClick={() => handleOpenTrack(t)} fmtDur={fmtDur} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====================================================== */}
      {/* VIEW: Selected artist's albums (discography) */}
      {/* ====================================================== */}
      {!selectedAlbum && selectedArtist && (
        <div className="space-y-1">
          {/* Artist header with verification badge + Apple Music profile link */}
          <div className="flex items-center gap-2 py-2 border-b border-[var(--border-light)]">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="font-medium text-[var(--text)] text-sm">{selectedArtist.artistName}</span>
                {isVerified(selectedArtist) && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[var(--text)]"
                    title="Verified on Apple Music"
                  >
                    <BadgeCheck className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                {selectedArtist.primaryGenreName || ''}
                {isVerified(selectedArtist) && (
                  <>
                    {' · '}
                    <a
                      href={selectedArtist.artistLinkUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[var(--text)] underline inline-flex items-center gap-0.5"
                    >
                      Apple Music profile <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="text-[10px] text-[var(--text-faint)] py-1">
            {artistLoading ? 'Loading...' : `${artistAlbums.length} albums / EPs / singles`}
          </div>

          {artistLoading ? (
            <div className="py-4 text-center text-[var(--text-faint)]">Loading discography...</div>
          ) : artistAlbums.length === 0 ? (
            <div className="py-4 text-center text-[var(--text-faint)]">No albums found.</div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {artistAlbums.map((a) => (
                <AlbumGridItem key={a.collectionId} album={a} onClick={() => handleAlbumClick(a)} fmtYear={fmtYear} />
              ))}
            </div>
          ) : viewMode === 'list' ? (
            <div className="divide-y divide-[var(--border-light)]">
              {artistAlbums.map((a) => (
                <AlbumListItem key={a.collectionId} album={a} onClick={() => handleAlbumClick(a)} fmtYear={fmtYear} />
              ))}
            </div>
          ) : (
            /* Normal view — detailed cards */
            <div className="space-y-2">
              {artistAlbums.map((a) => (
                <AlbumNormalItem key={a.collectionId} album={a} onClick={() => handleAlbumClick(a)} fmtYear={fmtYear} fmtDur={fmtDur} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====================================================== */}
      {/* VIEW: Artist search results (no artist selected) */}
      {/* ====================================================== */}
      {!selectedAlbum && !selectedArtist && category === 'artist' && artists.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-[var(--text-faint)] py-1">
            {artists.length} artists found — click to view discography
          </div>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-1">
              {artists.map((a) => (
                <ArtistGridItem key={a.artistId} artist={a} onClick={() => handleArtistClick(a)} isVerified={isVerified(a)} />
              ))}
            </div>
          ) : viewMode === 'list' ? (
            <div className="divide-y divide-[var(--border-light)]">
              {artists.map((a) => (
                <ArtistListItem key={a.artistId} artist={a} onClick={() => handleArtistClick(a)} isVerified={isVerified(a)} />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-light)]">
              {artists.map((a) => (
                <ArtistNormalItem key={a.artistId} artist={a} onClick={() => handleArtistClick(a)} isVerified={isVerified(a)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====================================================== */}
      {/* VIEW: Album search results (no album/artist selected) */}
      {/* ====================================================== */}
      {!selectedAlbum && !selectedArtist && category === 'album' && albums.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-[var(--text-faint)] py-1">
            {albums.length} albums found — click to view tracks
          </div>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {albums.map((a) => (
                <AlbumGridItem key={a.collectionId} album={a} onClick={() => handleAlbumClick(a)} fmtYear={fmtYear} />
              ))}
            </div>
          ) : viewMode === 'list' ? (
            <div className="divide-y divide-[var(--border-light)]">
              {albums.map((a) => (
                <AlbumListItem key={a.collectionId} album={a} onClick={() => handleAlbumClick(a)} fmtYear={fmtYear} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {albums.map((a) => (
                <AlbumNormalItem key={a.collectionId} album={a} onClick={() => handleAlbumClick(a)} fmtYear={fmtYear} fmtDur={fmtDur} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====================================================== */}
      {/* VIEW: Song search results */}
      {/* ====================================================== */}
      {!selectedAlbum && !selectedArtist && category === 'song' && tracks.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-[var(--text-faint)] py-1">
            {tracks.length} songs found — click to view
          </div>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-1">
              {tracks.map((t, i) => (
                <TrackGridItem key={`${t.trackName}-${i}`} track={t} onClick={() => handleOpenTrack(t)} />
              ))}
            </div>
          ) : viewMode === 'list' ? (
            <div className="divide-y divide-[var(--border-light)]">
              {tracks.map((t, i) => (
                <TrackListItem key={`${t.trackName}-${i}`} track={t} onClick={() => handleOpenTrack(t)} />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-light)]">
              {tracks.map((t, i) => (
                <TrackNormalItem key={`${t.trackName}-${i}`} track={t} onClick={() => handleOpenTrack(t)} fmtDur={fmtDur} />
              ))}
            </div>
          )}
        </div>
      )}

      {hasSearched && !searching && artists.length === 0 && albums.length === 0 && tracks.length === 0 && !selectedArtist && !selectedAlbum && !error && (
        <div className="py-6 text-center text-[var(--text-faint)]">
          No results for &quot;{query}&quot;
        </div>
      )}

      </div>
      {/* End scrollable results container */}

      {/* Movable lyrics window */}
      {windowTrack && (
        <MovableWindow
          title={windowTrack.trackName}
          artist={windowTrack.artistName}
          album={windowTrack.albumName}
          duration={windowTrack.duration}
          artworkUrl={windowTrack.artworkUrl}
          genre={windowTrack.genre}
          looking={looking}
          lookupData={lookupData}
          stripLrc={stripLrc}
          onClose={() => {
            setWindowTrack(null);
            setLookupData(null);
          }}
          onSave={() => {
            const entry: DaisyEntry = {
              id: 'daisyentry_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              title: windowTrack.trackName,
              artistName: windowTrack.artistName,
              albumName: windowTrack.albumName,
              duration: windowTrack.duration,
              artworkUrl: windowTrack.artworkUrl,
              plainLyrics: lookupData?.plainLyrics,
              syncedLyrics: lookupData?.syncedLyrics,
              preferSynced: lookupData?.preferSynced,
              genre: windowTrack.genre,
              createdAt: new Date().toISOString(),
            };
            onAddEntry(entry);
            setWindowTrack(null);
            setLookupData(null);
          }}
        />
      )}
    </div>
  );
}

// ===========================================================================
// Item renderers — memoized for performance
// ===========================================================================

// --- Artist items ---

const ArtistNormalItem = React.memo(function ArtistNormalItem({
  artist: a,
  onClick,
  isVerified,
}: {
  artist: DiscographyArtist;
  onClick: () => void;
  isVerified: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left py-1.5 cursor-pointer hover:bg-[var(--bg-secondary)] flex items-center gap-2"
    >
      <div className="w-8 h-8 rounded-full bg-[var(--bg-hover)] border border-[var(--border-light)] flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-[var(--text)] uppercase">
          {(a.artistName || '?').charAt(0)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-[var(--text)]">{a.artistName}</span>
          {isVerified && <BadgeCheck className="w-3 h-3 text-[var(--text)]" />}
        </div>
        {a.primaryGenreName && <span className="text-[var(--text-faint)] text-[10px]">{a.primaryGenreName}</span>}
      </div>
      {isVerified && (
        <a
          href={a.artistLinkUrl}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => e.stopPropagation()}
          className="text-[var(--text)] hover:opacity-70 p-1 shrink-0"
          title="Apple Music profile"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </button>
  );
});

const ArtistListItem = React.memo(function ArtistListItem({
  artist: a,
  onClick,
  isVerified,
}: {
  artist: DiscographyArtist;
  onClick: () => void;
  isVerified: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left py-1 cursor-pointer hover:bg-[var(--bg-secondary)]"
    >
      <span className="text-[var(--text)]">{a.artistName}</span>
      {isVerified && <BadgeCheck className="w-2.5 h-2.5 inline ml-1 text-[var(--text)]" />}
      {a.primaryGenreName && <span className="text-[var(--text-faint)]"> — {a.primaryGenreName}</span>}
    </button>
  );
});

const ArtistGridItem = React.memo(function ArtistGridItem({
  artist: a,
  onClick,
  isVerified,
}: {
  artist: DiscographyArtist;
  onClick: () => void;
  isVerified: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left p-2 border border-[var(--border-light)] rounded-[3px] hover:border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-full bg-[var(--bg-hover)] border border-[var(--border-light)] flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-[var(--text)] uppercase">
            {(a.artistName || '?').charAt(0)}
          </span>
        </div>
        <div className="font-medium text-[var(--text)] truncate flex items-center gap-1">
          {a.artistName}
          {isVerified && <BadgeCheck className="w-3 h-3 shrink-0" />}
        </div>
      </div>
      {a.primaryGenreName && <div className="text-[10px] text-[var(--text-muted)]">{a.primaryGenreName}</div>}
    </button>
  );
});

// --- Album items ---

const AlbumNormalItem = React.memo(function AlbumNormalItem({
  album: a,
  onClick,
  fmtYear,
  fmtDur,
}: {
  album: DiscographyAlbum;
  onClick: () => void;
  fmtYear: (d?: string) => number | string;
  fmtDur: (d?: number) => string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-2 border border-[var(--border-light)] rounded-[3px] hover:border-[var(--border)] hover:bg-[var(--bg-secondary)] cursor-pointer flex items-start gap-2"
    >
      {a.artworkUrl ? (
        <img src={a.artworkUrl} alt={a.collectionName} className="w-12 h-12 rounded-[2px] object-cover shrink-0" loading="lazy" />
      ) : (
        <div className="w-12 h-12 bg-[var(--bg-hover)] rounded-[2px] shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[var(--text)] text-xs truncate">{a.collectionName}</div>
        <div className="text-[10px] text-[var(--text-muted)] truncate">{a.artistName}</div>
        <div className="text-[9px] text-[var(--text-faint)] mt-0.5 flex items-center gap-1.5 flex-wrap">
          {a.collectionType && <span>{a.collectionType}</span>}
          {fmtYear(a.releaseDate) && <span>{fmtYear(a.releaseDate)}</span>}
          {a.trackCount && <span>{a.trackCount} tracks</span>}
          {a.genre && <span>{a.genre}</span>}
        </div>
      </div>
    </button>
  );
});

const AlbumListItem = React.memo(function AlbumListItem({
  album: a,
  onClick,
  fmtYear,
}: {
  album: DiscographyAlbum;
  onClick: () => void;
  fmtYear: (d?: string) => number | string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left py-1.5 cursor-pointer hover:bg-[var(--bg-secondary)] flex items-center gap-2"
    >
      {a.artworkUrl && (
        <img src={a.artworkUrl} alt={a.collectionName} className="w-8 h-8 rounded-[2px] object-cover shrink-0" loading="lazy" />
      )}
      <div className="flex-1 min-w-0">
        <span className="text-[var(--text)]">{a.collectionName}</span>
        <span className="text-[var(--text-faint)]"> — {a.artistName}</span>
        {fmtYear(a.releaseDate) && <span className="text-[var(--text-faint)] ml-2 text-[10px]">{fmtYear(a.releaseDate)}</span>}
      </div>
    </button>
  );
});

const AlbumGridItem = React.memo(function AlbumGridItem({
  album: a,
  onClick,
  fmtYear,
}: {
  album: DiscographyAlbum;
  onClick: () => void;
  fmtYear: (d?: string) => number | string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-[var(--border-light)] rounded-[3px] p-1.5 hover:border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer"
    >
      {a.artworkUrl ? (
        <img src={a.artworkUrl} alt={a.collectionName} className="w-full aspect-square rounded-[2px] object-cover mb-1" loading="lazy" />
      ) : (
        <div className="w-full aspect-square bg-[var(--bg-hover)] rounded-[2px] mb-1" />
      )}
      <div className="font-medium text-[var(--text)] truncate text-[10px]">{a.collectionName}</div>
      <div className="text-[9px] text-[var(--text-muted)] truncate">{a.artistName}</div>
      {fmtYear(a.releaseDate) && <div className="text-[9px] text-[var(--text-faint)]">{fmtYear(a.releaseDate)}</div>}
    </button>
  );
});

// --- Track items ---

const TrackNormalItem = React.memo(function TrackNormalItem({
  track: t,
  onClick,
  fmtDur,
}: {
  track: DiscographyTrack;
  onClick: () => void;
  fmtDur: (d?: number) => string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left py-1.5 cursor-pointer hover:bg-[var(--bg-secondary)] flex items-start gap-2"
    >
      {t.artworkUrl && (
        <img src={t.artworkUrl} alt="" className="w-8 h-8 rounded-[2px] object-cover shrink-0" loading="lazy" />
      )}
      <div className="flex-1 min-w-0">
        <span className="text-[var(--text)]">{t.trackName}</span>
        <span className="text-[var(--text-faint)]"> — {t.artistName}</span>
        {t.albumName && <span className="text-[var(--text-faint)]"> ({t.albumName})</span>}
        {t.duration && <span className="text-[var(--text-faint)] ml-2 font-mono text-[10px]">{fmtDur(t.duration)}</span>}
      </div>
    </button>
  );
});

const TrackListItem = React.memo(function TrackListItem({
  track: t,
  onClick,
}: {
  track: DiscographyTrack;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left py-1 cursor-pointer hover:bg-[var(--bg-secondary)]"
    >
      <span className="text-[var(--text)]">{t.trackName}</span>
      <span className="text-[var(--text-faint)]"> — {t.artistName}</span>
      {t.duration && (
        <span className="text-[var(--text-faint)] ml-2 font-mono text-[10px]">
          {Math.floor(t.duration / 60)}:{String(t.duration % 60).padStart(2, '0')}
        </span>
      )}
    </button>
  );
});

const TrackGridItem = React.memo(function TrackGridItem({
  track: t,
  onClick,
}: {
  track: DiscographyTrack;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left p-1.5 border border-[var(--border-light)] rounded-[3px] hover:border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer flex items-center gap-2"
    >
      {t.artworkUrl && (
        <img src={t.artworkUrl} alt="" className="w-10 h-10 rounded-[2px] object-cover shrink-0" loading="lazy" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[var(--text)] truncate text-[10px]">{t.trackName}</div>
        <div className="text-[9px] text-[var(--text-muted)] truncate">{t.artistName}</div>
      </div>
    </button>
  );
});

// ===========================================================================
// SavedTab — plain text list of saved DaisyEntries
// ===========================================================================

interface SavedTabProps {
  entries: DaisyEntry[];
  onUpdateEntry: (entry: DaisyEntry) => void;
  onDeleteEntry: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
}

function SavedTab({ entries, onUpdateEntry, onDeleteEntry, onDeleteMany }: SavedTabProps) {
  const [windowEntry, setWindowEntry] = useState<DaisyEntry | null>(null);
  const [savedSelected, setSavedSelected] = useState<Set<string>>(new Set());

  const stripLrc = useCallback((lrc: string): string => {
    return lrc
      .split('\n')
      .map((line) => line.replace(/^\s*\[\d+:\d+(?:\.\d+)?\]\s*/g, ''))
      .join('\n')
      .trim();
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSavedSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (entries.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--text-faint)]">
        No saved titles yet. Browse the Random tab or search an artist in the Discography tab.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {savedSelected.size > 0 && (
        <div className="flex items-center justify-between py-1 px-2 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-[3px]">
          <span className="text-[10px] text-[var(--text-muted)]">{savedSelected.size} selected</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSavedSelected(new Set())}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                onDeleteMany(Array.from(savedSelected));
                setSavedSelected(new Set());
              }}
              className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer"
            >
              Delete selected
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-[var(--border-light)]">
        {entries.map((e) => {
          const isSelected = savedSelected.has(e.id);
          return (
            <div
              key={e.id}
              className={`py-1.5 flex items-center gap-2 cursor-pointer ${
                isSelected ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-secondary)]'
              }`}
              onClick={() => toggleSelected(e.id)}
              onDoubleClick={() => setWindowEntry(e)}
            >
              <div
                className={`w-3 h-3 rounded-full border shrink-0 ${
                  isSelected ? 'bg-[var(--accent)] border-[var(--border)]' : 'border-[var(--border-light)] bg-[var(--bg)]'
                }`}
              />
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  setWindowEntry(e);
                }}
                className="flex-1 text-left min-w-0"
              >
                <span className="text-[var(--text)]">{e.title}</span>
                {e.artistName && <span className="text-[var(--text-faint)]"> — {e.artistName}</span>}
                {e.duration && (
                  <span className="text-[var(--text-faint)] ml-2 font-mono text-[10px]">
                    {Math.floor(e.duration / 60)}:{String(e.duration % 60).padStart(2, '0')}
                  </span>
                )}
              </button>
              {e.artworkUrl && (
                <img
                  src={e.artworkUrl}
                  alt=""
                  className="w-6 h-6 rounded-[2px] object-cover shrink-0 pointer-events-none"
                  loading="lazy"
                />
              )}
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onDeleteEntry(e.id);
                }}
                className="text-[var(--text-faint)] hover:text-[var(--text)] cursor-pointer p-0.5 shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Movable lyrics window for saved entry */}
      {windowEntry && (
        <MovableSavedWindow
          entry={windowEntry}
          onClose={() => setWindowEntry(null)}
          onUpdateEntry={onUpdateEntry}
          stripLrc={stripLrc}
        />
      )}
    </div>
  );
}

// ===========================================================================
// MovableWindow — shared by Random and Discography tabs
// ===========================================================================

interface MovableWindowProps {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  artworkUrl?: string;
  genre?: string;
  looking: boolean;
  lookupData: {
    plainLyrics?: string;
    syncedLyrics?: string;
    preferSynced?: boolean;
  } | null;
  stripLrc: (lrc: string) => string;
  onClose: () => void;
  onSave: () => void;
}

function MovableWindow({
  title,
  artist,
  album,
  duration,
  artworkUrl,
  genre,
  looking,
  lookupData,
  stripLrc,
  onClose,
  onSave,
}: MovableWindowProps) {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return { x: 8, y: 8 };
    }
    return { x: 60, y: 60 };
  });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [preferSynced, setPreferSynced] = useState(lookupData?.preferSynced ?? false);

  useEffect(() => {
    setPreferSynced(lookupData?.preferSynced ?? false);
  }, [lookupData]);

  const startDrag = (cx: number, cy: number) => {
    setDragging(true);
    dragStart.current = { x: cx, y: cy, ox: pos.x, oy: pos.y };
  };
  const moveDrag = (cx: number, cy: number) => {
    if (!dragging) return;
    const dx = cx - dragStart.current.x;
    const dy = cy - dragStart.current.y;
    let nx = dragStart.current.ox + dx;
    let ny = dragStart.current.oy + dy;
    if (typeof window !== 'undefined') {
      nx = Math.max(0, Math.min(window.innerWidth - 100, nx));
      ny = Math.max(0, Math.min(window.innerHeight - 40, ny));
    }
    setPos({ x: nx, y: ny });
  };
  const endDrag = () => setDragging(false);

  const showSynced = preferSynced && lookupData?.syncedLyrics;
  const showPlain = !showSynced && lookupData?.plainLyrics;
  const lyricsText = showSynced
    ? stripLrc(lookupData!.syncedLyrics!)
    : showPlain
    ? lookupData!.plainLyrics!
    : '';

  return (
    <div
      className="fixed z-[65] bg-[var(--bg)] border border-[var(--border)] rounded-[4px] shadow-xl flex flex-col overflow-hidden"
      style={{
        top: `${pos.y}px`,
        left: `${pos.x}px`,
        width: 'min(560px, calc(100vw - 16px))',
        maxHeight: 'calc(100vh - 16px)',
      }}
    >
      {/* Header — drag handle */}
      <div
        className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-[var(--border)] bg-[var(--bg-secondary)] cursor-move select-none"
        onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
        onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onTouchStart={(e) => e.touches[0] && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => e.touches[0] && moveDrag(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={endDrag}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <GripVertical className="w-3 h-3 text-[var(--text-faint)] shrink-0" />
          {artworkUrl && (
            <img src={artworkUrl} alt={title} className="w-7 h-7 rounded-[2px] object-cover border border-[var(--border-light)] shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[var(--text)] truncate">{title}</div>
            <div className="text-[9px] text-[var(--text-muted)] truncate">
              {artist}
              {album ? ` · ${album}` : ''}
              {duration ? ` · ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : ''}
            </div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer p-1 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 max-h-[55vh]">
        {looking ? (
          <div className="text-[var(--text-faint)] text-[11px] italic">Looking up lyrics...</div>
        ) : lookupData?.plainLyrics && lookupData.syncedLyrics ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-[var(--text-muted)]">View:</span>
              <button
                type="button"
                onClick={() => setPreferSynced(true)}
                className={`px-2 py-0.5 text-[10px] border rounded-[2px] cursor-pointer ${preferSynced ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]' : 'bg-[var(--bg)] text-[var(--text)] border-[var(--border-light)]'}`}
              >
                <Clock className="w-2.5 h-2.5 inline mr-0.5" /> Synced
              </button>
              <button
                type="button"
                onClick={() => setPreferSynced(false)}
                className={`px-2 py-0.5 text-[10px] border rounded-[2px] cursor-pointer ${!preferSynced ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]' : 'bg-[var(--bg)] text-[var(--text)] border-[var(--border-light)]'}`}
              >
                <FileText className="w-2.5 h-2.5 inline mr-0.5" /> Plain
              </button>
            </div>
            <MarkdownPreview content={lyricsText} />
          </>
        ) : lyricsText ? (
          <MarkdownPreview content={lyricsText} />
        ) : (
          <div className="text-[var(--text-faint)] text-[11px] italic">No lyrics found for this track.</div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border-light)] p-2 bg-[var(--bg-secondary)] flex items-center justify-between gap-2">
        <span className="text-[10px] text-[var(--text-muted)]">
          {genre || ''}
        </span>
        <button
          type="button"
          onClick={onSave}
          className="text-[11px] text-[var(--text)] hover:text-[var(--text)] underline cursor-pointer font-medium"
        >
          Save →
        </button>
      </div>
    </div>
  );
}

// ===========================================================================
// MovableSavedWindow — for viewing a saved DaisyEntry (with note editing)
// ===========================================================================

interface MovableSavedWindowProps {
  entry: DaisyEntry;
  onClose: () => void;
  onUpdateEntry: (entry: DaisyEntry) => void;
  stripLrc: (lrc: string) => string;
}

function MovableSavedWindow({
  entry: initialEntry,
  onClose,
  onUpdateEntry,
  stripLrc,
}: MovableSavedWindowProps) {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return { x: 8, y: 8 };
    }
    return { x: 60, y: 60 };
  });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [entry, setEntry] = useState(initialEntry);
  const [preferSynced, setPreferSynced] = useState(!!initialEntry.preferSynced);

  useEffect(() => {
    setEntry(initialEntry);
    setPreferSynced(!!initialEntry.preferSynced);
  }, [initialEntry]);

  const startDrag = (cx: number, cy: number) => {
    setDragging(true);
    dragStart.current = { x: cx, y: cy, ox: pos.x, oy: pos.y };
  };
  const moveDrag = (cx: number, cy: number) => {
    if (!dragging) return;
    const dx = cx - dragStart.current.x;
    const dy = cy - dragStart.current.y;
    let nx = dragStart.current.ox + dx;
    let ny = dragStart.current.oy + dy;
    if (typeof window !== 'undefined') {
      nx = Math.max(0, Math.min(window.innerWidth - 100, nx));
      ny = Math.max(0, Math.min(window.innerHeight - 40, ny));
    }
    setPos({ x: nx, y: ny });
  };
  const endDrag = () => setDragging(false);

  const updateEntry = (updates: Partial<DaisyEntry>) => {
    const next = { ...entry, ...updates };
    setEntry(next);
    onUpdateEntry(next);
  };

  const showSynced = preferSynced && entry.syncedLyrics;
  const showPlain = !showSynced && entry.plainLyrics;
  const lyricsText = showSynced
    ? stripLrc(entry.syncedLyrics!)
    : showPlain
    ? entry.plainLyrics!
    : '';

  return (
    <div
      className="fixed z-[65] bg-[var(--bg)] border border-[var(--border)] rounded-[4px] shadow-xl flex flex-col overflow-hidden"
      style={{
        top: `${pos.y}px`,
        left: `${pos.x}px`,
        width: 'min(560px, calc(100vw - 16px))',
        maxHeight: 'calc(100vh - 16px)',
      }}
    >
      {/* Header — drag handle */}
      <div
        className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-[var(--border)] bg-[var(--bg-secondary)] cursor-move select-none"
        onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
        onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onTouchStart={(e) => e.touches[0] && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => e.touches[0] && moveDrag(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={endDrag}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <GripVertical className="w-3 h-3 text-[var(--text-faint)] shrink-0" />
          {entry.artworkUrl && (
            <img src={entry.artworkUrl} alt={entry.title} className="w-7 h-7 rounded-[2px] object-cover border border-[var(--border-light)] shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[var(--text)] truncate">{entry.title}</div>
            <div className="text-[9px] text-[var(--text-muted)] truncate">
              {entry.artistName || '—'}
              {entry.albumName ? ` · ${entry.albumName}` : ''}
            </div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer p-1 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 max-h-[50vh]">
        {entry.plainLyrics && entry.syncedLyrics && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-[var(--text-muted)]">View:</span>
            <button
              type="button"
              onClick={() => { setPreferSynced(true); updateEntry({ preferSynced: true }); }}
              className={`px-2 py-0.5 text-[10px] border rounded-[2px] cursor-pointer ${preferSynced ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]' : 'bg-[var(--bg)] text-[var(--text)] border-[var(--border-light)]'}`}
            >
              <Clock className="w-2.5 h-2.5 inline mr-0.5" /> Synced
            </button>
            <button
              type="button"
              onClick={() => { setPreferSynced(false); updateEntry({ preferSynced: false }); }}
              className={`px-2 py-0.5 text-[10px] border rounded-[2px] cursor-pointer ${!preferSynced ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]' : 'bg-[var(--bg)] text-[var(--text)] border-[var(--border-light)]'}`}
            >
              <FileText className="w-2.5 h-2.5 inline mr-0.5" /> Plain
            </button>
          </div>
        )}
        {lyricsText ? (
          <MarkdownPreview content={lyricsText} />
        ) : (
          <div className="text-[var(--text-faint)] text-[11px] italic">No lyrics saved with this title.</div>
        )}
      </div>

      {/* Footer — note */}
      <div className="border-t border-[var(--border-light)] p-2 bg-[var(--bg-secondary)]">
        <textarea
          placeholder="Add a note..."
          value={entry.note || ''}
          onChange={(e) => updateEntry({ note: e.target.value })}
          rows={2}
          className="w-full border border-[var(--border-light)] p-1.5 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px] focus:outline-none focus:border-[var(--border)]"
        />
      </div>
    </div>
  );
}
