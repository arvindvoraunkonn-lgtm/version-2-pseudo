'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { JasmineFolder, JasmineEntry } from '../lib/types';
import { MarkdownPreview } from './MarkdownPreview';
import { TypedConfirmModal } from './ConfirmModal';
import {
  searchItunes,
  upgradeArtworkUrl,
  findBestItunesMatch,
} from '../lib/itunes';
import { loadViewPref, saveViewPref } from '../lib/view-prefs';
import {
  Search,
  X,
  Folder,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Music,
  Clock,
  FileText,
  Trash2,
  Plus,
  GripVertical,
  LayoutList,
  LayoutGrid,
  FileText as FileTextIcon,
  Table,
} from 'lucide-react';

// ===========================================================================
// Types
// ===========================================================================

interface LrclibResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

/**
 * Combined search result — merges lrclib lyrics data with iTunes artwork
 * and metadata. The `source` field tells us where the data came from so
 * the UI can show "no lyrics" for iTunes-only results.
 */
interface CombinedResult {
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  plainLyrics?: string;
  syncedLyrics?: string;
  artworkUrl?: string;
  genre?: string;
  releaseDate?: string;
  hasLyrics: boolean;
  hasSynced: boolean;
  hasPlain: boolean;
  source: 'lrclib' | 'itunes' | 'merged';
}

/**
 * Normalize a track/artist name into a dedup key.
 * Lowercases, strips all non-alphanumeric chars. Used to detect when a
 * lrclib-only result and a merged result refer to the same song (so we
 * can drop the duplicate lrclib-only entry).
 */
function normalizeKey(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

type ViewMode = 'grid' | 'normal' | 'list' | 'database';

type WindowPayload =
  | { kind: 'entry'; entry: JasmineEntry }
  | { kind: 'search'; result: CombinedResult };

interface JasmineViewProps {
  folders: JasmineFolder[];
  entries: JasmineEntry[];
  onAddFolder: (folder: JasmineFolder) => void;
  onDeleteFolder: (id: string) => void;
  onAddEntry: (entry: JasmineEntry) => void;
  onUpdateEntry: (entry: JasmineEntry) => void;
  onDeleteEntry: (id: string) => void;
}

// ===========================================================================
// Main component
// ===========================================================================

export function JasmineView({
  folders,
  entries,
  onAddFolder,
  onDeleteFolder,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
}: JasmineViewProps) {
  // --- Folder tree state ---
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | undefined>(undefined);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<JasmineFolder | null>(null);

  // --- Search state ---
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<CombinedResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // --- View mode for the main panel: 'saved' (default) shows saved entries
  // of the active folder; 'search' shows the search results panel.
  // The two are mutually exclusive so the user never sees both at once —
  // clicking a folder switches to 'saved', typing+searching switches to 'search'.
  const [panelMode, setPanelMode] = useState<'saved' | 'search'>('saved');

  // --- Save modal state ---
  const [pendingSave, setPendingSave] = useState<CombinedResult | null>(null);
  const [saveFolderId, setSaveFolderId] = useState<string | undefined>(undefined);
  const [savePreferSynced, setSavePreferSynced] = useState(true);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<JasmineEntry | null>(null);

  // --- Movable lyrics window ---
  const [windowPayload, setWindowPayload] = useState<WindowPayload | null>(null);

  // --- Mobile panel switcher ---
  const [mobilePanel, setMobilePanel] = useState<'folders' | 'lyrics'>('lyrics');

  // --- View mode (persists across sessions) ---
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = loadViewPref('jasmine.entries', 'database');
    if (saved === 'grid' || saved === 'normal' || saved === 'list' || saved === 'database') return saved;
    return 'database';
  });
  useEffect(() => {
    saveViewPref('jasmine.entries', viewMode);
  }, [viewMode]);

  // --- Derived data (memoized to prevent flickering) ---
  const visibleEntries = useMemo(() => {
    if (activeFolderId === null) return entries;
    return entries.filter((e) => e.folderId === activeFolderId);
  }, [entries, activeFolderId]);

  const folderTree = useMemo(() => {
    const byParent: Record<string, JasmineFolder[]> = {};
    for (const f of folders) {
      const key = f.parentId || '__root__';
      (byParent[key] = byParent[key] || []).push(f);
    }
    const sortByName = (arr: JasmineFolder[]) =>
      arr.slice().sort((a, b) => a.name.localeCompare(b.name));
    const build = (parentId?: string): JasmineFolder[] => {
      const key = parentId || '__root__';
      return sortByName(byParent[key] || []);
    };
    return { roots: build(undefined), build };
  }, [folders]);

  const flatFolderOptions = useMemo(() => {
    const out: { id: string; label: string; depth: number }[] = [];
    const walk = (parentId: string | undefined, depth: number) => {
      const children = folders
        .filter((f) => (f.parentId || undefined) === parentId)
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const f of children) {
        out.push({ id: f.id, label: f.name, depth });
        walk(f.id, depth + 1);
      }
    };
    walk(undefined, 0);
    return out;
  }, [folders]);

  const activeFolder = folders.find((f) => f.id === activeFolderId) || null;

  // --- Stable callbacks (prevent child re-renders) ---
  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    setHasSearched(true);
    // Switch the main panel to search-results mode (mutually exclusive
    // with the saved-entries view).
    setPanelMode('search');

    try {
      // Fire both searches in parallel for speed
      const [lrclibData, itunesData] = await Promise.all([
        fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
          headers: { Accept: 'application/json' },
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`lrclib ${r.status}`)))).catch((e) => {
          console.warn('lrclib search failed:', e);
          return [] as LrclibResult[];
        }),
        searchItunes(q, 25),
      ]);

      // Merge: for each lrclib result, find the BEST iTunes match using
      // duration + fuzzy track name + artist similarity + containment.
      // This handles cases where lrclib has "Artist - Title (Official Audio)"
      // and iTunes has clean "Title" — they should still match because
      // (a) durations are within ±2s and (b) the iTunes name is contained
      // in the lrclib name.
      const usedItunes = new Set<number>();
      const combined: CombinedResult[] = [];

      for (const lrc of (lrclibData as LrclibResult[]) || []) {
        const matchedItunes = findBestItunesMatch(
          {
            trackName: lrc.trackName,
            artistName: lrc.artistName,
            albumName: lrc.albumName,
            duration: lrc.duration,
          },
          itunesData.filter((it) => !usedItunes.has(it.trackId))
        );
        if (matchedItunes) {
          usedItunes.add(matchedItunes.trackId);
        }

        // Prefer the iTunes track name (cleaner — no "Artist - " prefix
        // or " (Official Audio)" suffix) when available.
        const displayTrackName = matchedItunes?.trackName || lrc.trackName;
        // Prefer iTunes album name (canonical release) over lrclib's.
        const displayAlbumName = matchedItunes?.collectionName || lrc.albumName;

        combined.push({
          trackName: displayTrackName,
          artistName: lrc.artistName,
          albumName: displayAlbumName,
          duration: lrc.duration,
          plainLyrics: lrc.plainLyrics || undefined,
          syncedLyrics: lrc.syncedLyrics || undefined,
          artworkUrl: upgradeArtworkUrl(matchedItunes?.artworkUrl100),
          genre: matchedItunes?.primaryGenreName,
          releaseDate: matchedItunes?.releaseDate,
          hasLyrics: !!(lrc.plainLyrics || lrc.syncedLyrics),
          hasSynced: !!lrc.syncedLyrics,
          hasPlain: !!lrc.plainLyrics,
          source: matchedItunes ? 'merged' : 'lrclib',
        });
      }

      // Also include iTunes results that didn't match any lrclib result.
      // BUT FIRST — try a targeted lrclib lookup for each unmatched iTunes
      // track using the CLEAN iTunes track_name + artist_name. This is the
      // key fix for "found artwork but no lyrics": the broad q= search may
      // have returned messy lrclib names like "Artist - Title (Official Audio)"
      // that failed to match the iTunes "Title" — but a targeted search with
      // the clean name + duration will find the exact lyrics.
      const unmatchedItunes = itunesData.filter((it) => !usedItunes.has(it.trackId));

      if (unmatchedItunes.length > 0) {
        // Batch targeted lookups (max 10 concurrent to be nice to lrclib).
        // Uses /api/search?track_name=X&artist_name=Y which is more precise
        // than the broad q= search.
        type LookupResult = { itunes: typeof itunesData[number]; lrc: LrclibResult | null };
        const lookupResults: LookupResult[] = await Promise.all(
          unmatchedItunes.slice(0, 10).map(async (it): Promise<LookupResult> => {
            const params = new URLSearchParams({
              track_name: it.trackName,
              artist_name: it.artistName,
            });
            try {
              const res = await fetch(`https://lrclib.net/api/search?${params}`, {
                headers: { Accept: 'application/json' },
              });
              if (!res.ok) return { itunes: it, lrc: null };
              const data = (await res.json()) as LrclibResult[];

              // Pick the best match by duration proximity (if available)
              let bestLrc: LrclibResult | null = null;
              let bestDurDiff = Infinity;
              const itDur = it.trackTimeMillis ? Math.round(it.trackTimeMillis / 1000) : undefined;

              for (const lrc of data || []) {
                if (!lrc.plainLyrics && !lrc.syncedLyrics) continue;
                if (itDur && lrc.duration) {
                  const diff = Math.abs(itDur - lrc.duration);
                  if (diff < bestDurDiff) {
                    bestDurDiff = diff;
                    bestLrc = lrc;
                  }
                } else if (!bestLrc) {
                  bestLrc = lrc;
                }
              }

              // Only accept if duration is within ±5 seconds (or no
              // duration to compare — trust the name match alone).
              if (
                bestLrc &&
                itDur &&
                bestLrc.duration &&
                Math.abs(itDur - bestLrc.duration) > 5
              ) {
                bestLrc = null; // duration mismatch — likely different song
              }

              return { itunes: it, lrc: bestLrc };
            } catch {
              return { itunes: it, lrc: null };
            }
          })
        );

        // Merge any found lyrics with the iTunes metadata
        for (const { itunes: it, lrc } of lookupResults) {
          if (lrc && (lrc.plainLyrics || lrc.syncedLyrics)) {
            // Found lyrics via targeted lookup! Merge into a combined result.
            combined.push({
              trackName: it.trackName,
              artistName: it.artistName,
              albumName: it.collectionName || lrc.albumName,
              duration: it.trackTimeMillis ? Math.round(it.trackTimeMillis / 1000) : lrc.duration,
              plainLyrics: lrc.plainLyrics || undefined,
              syncedLyrics: lrc.syncedLyrics || undefined,
              artworkUrl: upgradeArtworkUrl(it.artworkUrl100),
              genre: it.primaryGenreName,
              releaseDate: it.releaseDate,
              hasLyrics: true,
              hasSynced: !!lrc.syncedLyrics,
              hasPlain: !!lrc.plainLyrics,
              source: 'merged',
            });
            usedItunes.add(it.trackId);
          }
        }
      }

      // Add remaining unmatched iTunes tracks (still no lyrics even after
      // the targeted lookup — these show with artwork but "no lyrics")
      for (const it of itunesData) {
        if (usedItunes.has(it.trackId)) continue;
        combined.push({
          trackName: it.trackName,
          artistName: it.artistName,
          albumName: it.collectionName,
          duration: it.trackTimeMillis ? Math.round(it.trackTimeMillis / 1000) : undefined,
          artworkUrl: upgradeArtworkUrl(it.artworkUrl100),
          genre: it.primaryGenreName,
          releaseDate: it.releaseDate,
          hasLyrics: false,
          hasSynced: false,
          hasPlain: false,
          source: 'itunes',
        });
      }

      // Deduplicate: remove lrclib-only results that have the SAME lyrics
      // as a merged result (prevents showing the same lyrics twice — once
      // with artwork, once without). Matches by normalized track + artist.
      const mergedKeys = new Set(
        combined
          .filter((r) => r.source === 'merged')
          .map((r) => `${normalizeKey(r.trackName)}|${normalizeKey(r.artistName)}`)
      );
      const dedupedCombined = combined.filter((r) => {
        if (r.source !== 'lrclib') return true; // keep merged + itunes
        const key = `${normalizeKey(r.trackName)}|${normalizeKey(r.artistName)}`;
        return !mergedKeys.has(key); // drop lrclib-only if merged version exists
      });

      // Sort: results with synced lyrics first, then plain, then no lyrics
      dedupedCombined.sort((a, b) => {
        if (a.hasSynced !== b.hasSynced) return a.hasSynced ? -1 : 1;
        if (a.hasPlain !== b.hasPlain) return a.hasPlain ? -1 : 1;
        if (a.hasLyrics !== b.hasLyrics) return a.hasLyrics ? -1 : 1;
        return 0;
      });

      setSearchResults(dedupedCombined);
    } catch (err: any) {
      setSearchError(err.message || 'Search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleCreateFolder = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const folder: JasmineFolder = {
      id: 'jasfolder_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: newFolderName.trim(),
      parentId: newFolderParentId,
      createdAt: new Date().toISOString(),
    };
    onAddFolder(folder);
    if (newFolderParentId) {
      setExpandedFolders((prev) => new Set(prev).add(newFolderParentId));
    }
    setNewFolderName('');
    setIsAddingFolder(false);
    setNewFolderParentId(undefined);
  }, [newFolderName, newFolderParentId, onAddFolder]);

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openFolder = useCallback((id: string | null) => {
    setActiveFolderId(id);
    setPanelMode('saved');
    setMobilePanel('lyrics');
  }, []);

  const handleSavePending = useCallback(() => {
    if (!pendingSave) return;
    const entry: JasmineEntry = {
      id: 'jasentry_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      folderId: saveFolderId,
      trackName: pendingSave.trackName,
      artistName: pendingSave.artistName,
      albumName: pendingSave.albumName,
      duration: pendingSave.duration,
      plainLyrics: pendingSave.plainLyrics,
      syncedLyrics: pendingSave.syncedLyrics,
      preferSynced: savePreferSynced && !!pendingSave.syncedLyrics,
      artworkUrl: pendingSave.artworkUrl,
      genre: pendingSave.genre,
      releaseDate: pendingSave.releaseDate,
      createdAt: new Date().toISOString(),
    };
    onAddEntry(entry);
    setPendingSave(null);
    setSaveFolderId(undefined);
    setSavePreferSynced(true);
  }, [pendingSave, saveFolderId, savePreferSynced, onAddEntry]);

  // --- LRC → readable text ---
  const stripLrcTimestamps = useCallback((lrc: string): string => {
    return lrc
      .split('\n')
      .map((line) => line.replace(/^\s*\[\d+:\d+(?:\.\d+)?\]\s*/g, ''))
      .join('\n')
      .trim();
  }, []);

  // --- Folder tree rendering (memoized via component) ---
  const renderFolder = useCallback(
    (folder: JasmineFolder, depth: number): React.ReactNode => {
      const children = folderTree.build(folder.id);
      return (
        <FolderTreeItem
          key={folder.id}
          folder={folder}
          depth={depth}
          childrenFolders={children}
          isExpanded={expandedFolders.has(folder.id)}
          isActive={activeFolderId === folder.id}
          entryCount={entries.filter((e) => e.folderId === folder.id).length}
          onToggle={toggleFolder}
          onOpen={openFolder}
          onDelete={setConfirmDeleteFolder}
          renderChildren={renderFolder}
        />
      );
    },
    [folderTree, expandedFolders, activeFolderId, entries, toggleFolder, openFolder]
  );

  // --- View mode buttons ---
  const viewModeButtons: { mode: ViewMode; Icon: any; label: string }[] = [
    { mode: 'grid', Icon: LayoutGrid, label: 'Grid' },
    { mode: 'normal', Icon: FileTextIcon, label: 'Normal' },
    { mode: 'list', Icon: LayoutList, label: 'List' },
    { mode: 'database', Icon: Table, label: 'Database' },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto p-3 text-xs">
      {/* Top controls */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)] mb-3 gap-2">
        <span className="font-semibold text-[var(--text)]">JASmine</span>
        <div className="flex items-center gap-2">
          {/* View mode switcher */}
          <div className="flex items-center border border-[var(--border-light)] rounded-[2px] p-0.5">
            {viewModeButtons.map(({ mode, Icon, label }) => (
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
          <button
            type="button"
            onClick={() => {
              setIsAddingFolder(true);
              setNewFolderParentId(activeFolderId || undefined);
            }}
            className="px-2 py-0.5 border border-[var(--border)] bg-[var(--bg)] rounded-[3px] text-[11px] text-[var(--text)] hover:bg-[var(--bg-hover)] cursor-pointer inline-flex items-center gap-1 shrink-0"
          >
            <FolderPlus className="w-3 h-3" /> New folder
          </button>
        </div>
      </div>

      {/* Mobile panel switcher */}
      <div className="sm:hidden flex items-center gap-1 mb-3 border border-[var(--border-light)] rounded-[3px] p-0.5">
        <button
          type="button"
          onClick={() => setMobilePanel('folders')}
          className={`flex-1 py-1 text-[11px] rounded-[2px] cursor-pointer ${
            mobilePanel === 'folders' ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'bg-[var(--bg)] text-[var(--text-muted)]'
          }`}
        >
          Folders
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel('lyrics')}
          className={`flex-1 py-1 text-[11px] rounded-[2px] cursor-pointer ${
            mobilePanel === 'lyrics' ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'bg-[var(--bg)] text-[var(--text-muted)]'
          }`}
        >
          Lyrics
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] md:grid-cols-[220px_1fr] gap-3">
        {/* LEFT RAIL — folder tree */}
        <div
          className={`border border-[var(--border-light)] rounded-[3px] bg-[var(--bg-secondary)] p-1 max-h-[70vh] overflow-y-auto ${
            mobilePanel === 'folders' ? 'block' : 'hidden sm:block'
          }`}
        >
          <div
            className={`flex items-center gap-1 px-1 py-1 cursor-pointer rounded-[2px] hover:bg-[var(--bg-hover)] ${
              activeFolderId === null ? 'bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent)]' : ''
            }`}
            onClick={() => openFolder(null)}
          >
            <span className="w-[14px] shrink-0" />
            <Music
              className={`w-3 h-3 shrink-0 ${activeFolderId === null ? 'text-[var(--accent-text)]' : 'text-[var(--text-muted)]'}`}
            />
            <span className="text-[11px] truncate flex-1">All lyrics</span>
            <span className={`text-[9px] shrink-0 ${activeFolderId === null ? 'text-[var(--accent-text)]/70' : 'text-[var(--text-faint)]'}`}>
              {entries.length}
            </span>
          </div>

          {folderTree.roots.map((f) => renderFolder(f, 0))}

          {isAddingFolder && (
            <form onSubmit={handleCreateFolder} className="px-1 py-1 space-y-1">
              <input
                type="text"
                autoFocus
                required
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-[11px] rounded-[2px]"
              />
              <select
                value={newFolderParentId || ''}
                onChange={(e) => setNewFolderParentId(e.target.value || undefined)}
                className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-[10px] rounded-[2px] cursor-pointer"
              >
                <option value="">Root level</option>
                {flatFolderOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {'— '.repeat(o.depth)}
                    {o.label}
                  </option>
                ))}
              </select>
              <div className="flex gap-1">
                <button
                  type="submit"
                  className="flex-1 px-2 py-0.5 bg-[var(--accent)] text-[var(--accent-text)] rounded-[2px] text-[10px] cursor-pointer"
                >
                  Ok
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingFolder(false);
                    setNewFolderName('');
                    setNewFolderParentId(undefined);
                  }}
                  className="px-2 py-0.5 border border-[var(--border-light)] text-[var(--text)] rounded-[2px] text-[10px] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {folders.length === 0 && !isAddingFolder && (
            <div className="p-2 text-[10px] text-[var(--text-faint)] text-center">
              No folders yet. Create one to organize saved lyrics.
            </div>
          )}
        </div>

        {/* MAIN — search + entries */}
        <div
          className={`space-y-3 min-w-0 ${
            mobilePanel === 'lyrics' ? 'block' : 'hidden sm:block'
          }`}
        >
          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex gap-1">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-faint)]" />
              <input
                type="text"
                placeholder="Search lyrics — song, artist, or album..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full border border-[var(--border-light)] pl-7 pr-2 py-1.5 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px] focus:outline-none focus:border-[var(--border)]"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="px-3 py-1.5 bg-[var(--accent)] text-[var(--accent-text)] border border-[var(--border)] rounded-[2px] text-xs hover:bg-[var(--accent-hover)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {searching ? '...' : 'Search'}
            </button>
          </form>

          {searchError && (
            <div className="p-2 border border-[var(--border-light)] bg-[var(--bg-secondary)] text-[var(--text-muted)] text-[11px] rounded-[2px]">
              Search error: {searchError}
            </div>
          )}

          {/* Mode indicator + switcher.
              When in 'search' mode, show a "Back to {folder name}" button so the
              user can return to browsing saved entries. */}
          {panelMode === 'search' ? (
            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
              <span className="uppercase tracking-wider font-semibold">
                Search results {searchResults.length > 0 && `(${searchResults.length})`}
              </span>
              <button
                type="button"
                onClick={() => setPanelMode('saved')}
                className="text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
              >
                ← Back to {activeFolder ? activeFolder.name : 'all lyrics'}
              </button>
            </div>
          ) : null}

          {/* SEARCH RESULTS — only when in search mode */}
          {panelMode === 'search' && searchResults.length > 0 && (
            <SearchResultsView
              results={searchResults}
              viewMode={viewMode}
              onSelect={(r) => setWindowPayload({ kind: 'search', result: r })}
              onSave={(r) => {
                setPendingSave(r);
                setSaveFolderId(activeFolderId || undefined);
                setSavePreferSynced(r.hasSynced);
              }}
            />
          )}

          {panelMode === 'search' && hasSearched && !searching && searchResults.length === 0 && !searchError && (
            <div className="py-6 text-center text-[var(--text-faint)] text-[11px]">
              No lyrics found for &quot;{query}&quot;
            </div>
          )}

          {/* SAVED ENTRIES — only when in saved mode (browsing folders) */}
          {panelMode === 'saved' && (
            <EntriesView
              entries={visibleEntries}
              viewMode={viewMode}
              activeFolderName={activeFolder?.name || null}
              totalEntriesCount={entries.length}
              onSelect={(e) => setWindowPayload({ kind: 'entry', entry: e })}
              onDelete={(e) => setConfirmDeleteEntry(e)}
            />
          )}
        </div>
      </div>

      {/* Movable lyrics window */}
      {windowPayload && (
        <MovableLyricsWindow
          payload={windowPayload}
          folders={folders}
          flatFolderOptions={flatFolderOptions}
          onClose={() => setWindowPayload(null)}
          onUpdateEntry={onUpdateEntry}
          onDeleteEntry={(id) => {
            onDeleteEntry(id);
            setWindowPayload(null);
          }}
          stripLrcTimestamps={stripLrcTimestamps}
        />
      )}

      {/* Save modal */}
      {pendingSave && (
        <SaveModal
          result={pendingSave}
          saveFolderId={saveFolderId}
          setSaveFolderId={setSaveFolderId}
          savePreferSynced={savePreferSynced}
          setSavePreferSynced={setSavePreferSynced}
          flatFolderOptions={flatFolderOptions}
          onConfirm={handleSavePending}
          onCancel={() => setPendingSave(null)}
        />
      )}

      {/* Delete folder confirmation */}
      <TypedConfirmModal
        isOpen={!!confirmDeleteFolder}
        title={confirmDeleteFolder ? `Delete folder "${confirmDeleteFolder.name}"` : ''}
        expectedText="Delete"
        onConfirm={() => {
          if (confirmDeleteFolder) {
            onDeleteFolder(confirmDeleteFolder.id);
            if (activeFolderId === confirmDeleteFolder.id) setActiveFolderId(null);
            setConfirmDeleteFolder(null);
          }
        }}
        onCancel={() => setConfirmDeleteFolder(null)}
      />

      {/* Delete entry confirmation */}
      <TypedConfirmModal
        isOpen={!!confirmDeleteEntry}
        title={confirmDeleteEntry ? `Delete "${confirmDeleteEntry.trackName}"` : ''}
        expectedText="Delete"
        onConfirm={() => {
          if (confirmDeleteEntry) {
            onDeleteEntry(confirmDeleteEntry.id);
            setWindowPayload(null);
            setConfirmDeleteEntry(null);
          }
        }}
        onCancel={() => setConfirmDeleteEntry(null)}
      />
    </div>
  );
}

// ===========================================================================
// FolderTreeItem — memoized to prevent flickering when other folders change
// ===========================================================================

interface FolderTreeItemProps {
  folder: JasmineFolder;
  depth: number;
  childrenFolders: JasmineFolder[];
  isExpanded: boolean;
  isActive: boolean;
  entryCount: number;
  onToggle: (id: string) => void;
  onOpen: (id: string | null) => void;
  onDelete: (folder: JasmineFolder) => void;
  renderChildren: (folder: JasmineFolder, depth: number) => React.ReactNode;
}

const FolderTreeItem = React.memo(function FolderTreeItem({
  folder,
  depth,
  childrenFolders,
  isExpanded,
  isActive,
  entryCount,
  onToggle,
  onOpen,
  onDelete,
  renderChildren,
}: FolderTreeItemProps) {
  return (
    <div>
      <div
        className={`flex items-center gap-1 px-1 py-1 cursor-pointer rounded-[2px] hover:bg-[var(--bg-hover)] ${
          isActive ? 'bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent)]' : ''
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => onOpen(folder.id)}
      >
        {childrenFolders.length > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(folder.id);
            }}
            className={`shrink-0 p-0.5 ${isActive ? 'text-[var(--accent-text)]' : 'text-[var(--text-faint)] hover:text-[var(--text)]'}`}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <span className="w-[14px] shrink-0" />
        )}
        <Folder className={`w-3 h-3 shrink-0 ${isActive ? 'text-[var(--accent-text)]' : 'text-[var(--text-muted)]'}`} />
        <span className="text-[11px] truncate flex-1">{folder.name}</span>
        <span className={`text-[9px] shrink-0 ${isActive ? 'text-[var(--accent-text)]/70' : 'text-[var(--text-faint)]'}`}>
          {entryCount}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(folder);
          }}
          className={`shrink-0 p-0.5 ${
            isActive ? 'text-white/70 hover:text-white' : 'text-[var(--text-faint)] hover:text-[var(--text)]'
          }`}
          aria-label="Delete folder"
          title="Delete folder"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>
      {isExpanded && childrenFolders.length > 0 && (
        <div>{childrenFolders.map((c) => renderChildren(c, depth + 1))}</div>
      )}
    </div>
  );
});

// ===========================================================================
// ArtworkThumb — memoized image with fallback placeholder
// ===========================================================================

const ArtworkThumb = React.memo(function ArtworkThumb({
  url,
  alt,
  sizeClassName,
  rounded = '2px',
}: {
  url?: string;
  alt: string;
  sizeClassName: string;
  rounded?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setErrored(false);
  }, [url]);

  return (
    <div
      className={`${sizeClassName} shrink-0 bg-[var(--bg-hover)] border border-[var(--border-light)] overflow-hidden flex items-center justify-center`}
      style={{ borderRadius: rounded }}
    >
      {url && !errored ? (
        <>
          {!loaded && <Music className="w-3 h-3 text-[var(--text-faint)] absolute" />}
          <img
            src={url}
            alt={alt}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
            className={`w-full h-full object-cover transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      ) : (
        <Music className="w-3 h-3 text-[var(--text-faint)]" />
      )}
    </div>
  );
});

// ===========================================================================
// SearchResultsView — renders search results in the selected view mode
// ===========================================================================

interface SearchResultsViewProps {
  results: CombinedResult[];
  viewMode: ViewMode;
  onSelect: (r: CombinedResult) => void;
  onSave: (r: CombinedResult) => void;
}

const SearchResultsView = React.memo(function SearchResultsView({
  results,
  viewMode,
  onSelect,
  onSave,
}: SearchResultsViewProps) {
  if (results.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
        Search results ({results.length}) — click to view lyrics
      </div>

      {/* DATABASE view — table with all columns */}
      {viewMode === 'database' && (
        <div className="border border-[var(--border-light)] rounded-[3px] overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-light)]">
              <tr className="text-left text-[var(--text-muted)] uppercase tracking-wider">
                <th className="p-1.5 font-semibold w-10">Art</th>
                <th className="p-1.5 font-semibold">Track</th>
                <th className="p-1.5 font-semibold">Artist</th>
                <th className="p-1.5 font-semibold hidden sm:table-cell">Album</th>
                <th className="p-1.5 font-semibold hidden md:table-cell">Genre</th>
                <th className="p-1.5 font-semibold text-right">Time</th>
                <th className="p-1.5 font-semibold text-center">Lyrics</th>
                <th className="p-1.5 font-semibold text-center">Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-light)]">
              {results.map((r, i) => (
                <tr
                  key={`${r.trackName}-${r.artistName}-${i}`}
                  className="hover:bg-[var(--bg-secondary)] cursor-pointer"
                  onClick={() => onSelect(r)}
                >
                  <td className="p-1.5">
                    <ArtworkThumb url={r.artworkUrl} alt={r.trackName} sizeClassName="w-8 h-8" />
                  </td>
                  <td className="p-1.5 font-medium text-[var(--text)] max-w-[120px] truncate">
                    {r.trackName}
                  </td>
                  <td className="p-1.5 text-[var(--text-muted)] max-w-[100px] truncate">{r.artistName}</td>
                  <td className="p-1.5 text-[var(--text-muted)] hidden sm:table-cell max-w-[100px] truncate">
                    {r.albumName || '—'}
                  </td>
                  <td className="p-1.5 text-[var(--text-muted)] hidden md:table-cell">
                    {r.genre || '—'}
                  </td>
                  <td className="p-1.5 text-right font-mono text-[var(--text-muted)]">
                    {r.duration
                      ? `${Math.floor(r.duration / 60)}:${String(r.duration % 60).padStart(2, '0')}`
                      : '—'}
                  </td>
                  <td className="p-1.5 text-center">
                    {r.hasSynced ? (
                      <span className="inline-flex items-center gap-0.5 text-[var(--text)]">
                        <Clock className="w-2.5 h-2.5" /> Synced
                      </span>
                    ) : r.hasPlain ? (
                      <span className="text-[var(--text-muted)]">Plain</span>
                    ) : (
                      <span className="text-[var(--text-faint)]">—</span>
                    )}
                  </td>
                  <td className="p-1.5 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSave(r);
                      }}
                      className="px-1.5 py-0.5 border border-[var(--border)] bg-[var(--bg)] rounded-[2px] text-[9px] text-[var(--text)] hover:bg-[var(--bg-hover)] cursor-pointer inline-flex items-center gap-0.5"
                    >
                      <Plus className="w-2 h-2" /> Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* GRID view — square artwork thumbnails */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {results.map((r, i) => (
            <div
              key={`${r.trackName}-${r.artistName}-${i}`}
              className="border border-[var(--border-light)] rounded-[3px] p-1.5 space-y-1 bg-[var(--bg)]"
            >
              <button
                type="button"
                onClick={() => onSelect(r)}
                className="block w-full cursor-pointer hover:opacity-90"
              >
                <ArtworkThumb url={r.artworkUrl} alt={r.trackName} sizeClassName="w-full aspect-square" rounded="3px" />
              </button>
              <button
                type="button"
                onClick={() => onSelect(r)}
                className="block w-full text-left cursor-pointer hover:opacity-80"
              >
                <div className="font-medium text-[var(--text)] truncate text-[10px]">{r.trackName}</div>
                <div className="text-[9px] text-[var(--text-muted)] truncate">{r.artistName}</div>
              </button>
              <div className="flex items-center justify-between pt-0.5 border-t border-[var(--border-light)]">
                <span className="text-[8px] text-[var(--text-faint)]">
                  {r.hasSynced ? 'Synced' : r.hasPlain ? 'Plain' : 'No lyrics'}
                </span>
                <button
                  type="button"
                  onClick={() => onSave(r)}
                  className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NORMAL view — detailed cards */}
      {viewMode === 'normal' && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={`${r.trackName}-${r.artistName}-${i}`}
              className="border border-[var(--border-light)] rounded-[3px] p-2 bg-[var(--bg)] flex items-start gap-2"
            >
              <button
                type="button"
                onClick={() => onSelect(r)}
                className="shrink-0 cursor-pointer hover:opacity-90"
              >
                <ArtworkThumb url={r.artworkUrl} alt={r.trackName} sizeClassName="w-14 h-14" rounded="3px" />
              </button>
              <button
                type="button"
                onClick={() => onSelect(r)}
                className="flex-1 text-left min-w-0 cursor-pointer hover:opacity-80"
              >
                <div className="font-bold text-[var(--text)] text-xs truncate">{r.trackName}</div>
                <div className="text-[10px] text-[var(--text-muted)] truncate">{r.artistName}</div>
                {r.albumName && (
                  <div className="text-[9px] text-[var(--text-faint)] truncate">Album: {r.albumName}</div>
                )}
                <div className="text-[9px] text-[var(--text-faint)] mt-0.5 flex items-center gap-1.5 flex-wrap">
                  {r.genre && <span>{r.genre}</span>}
                  {r.duration && (
                    <span className="font-mono">
                      {Math.floor(r.duration / 60)}:{String(r.duration % 60).padStart(2, '0')}
                    </span>
                  )}
                  {r.releaseDate && (
                    <span>{new Date(r.releaseDate).getFullYear()}</span>
                  )}
                </div>
                <div className="text-[9px] mt-0.5 flex items-center gap-1">
                  {r.hasSynced && (
                    <span className="inline-flex items-center gap-0.5 text-[var(--text)]">
                      <Clock className="w-2.5 h-2.5" /> Synced lyrics
                    </span>
                  )}
                  {r.hasPlain && !r.hasSynced && <span className="text-[var(--text-muted)]">Plain lyrics</span>}
                  {!r.hasLyrics && <span className="text-[var(--text-faint)]">No lyrics available</span>}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onSave(r)}
                className="px-2 py-0.5 border border-[var(--border)] bg-[var(--bg)] rounded-[2px] text-[10px] text-[var(--text)] hover:bg-[var(--bg-hover)] cursor-pointer inline-flex items-center gap-0.5 shrink-0"
              >
                <Plus className="w-2.5 h-2.5" /> Save
              </button>
            </div>
          ))}
        </div>
      )}

      {/* LIST view — compact rows */}
      {viewMode === 'list' && (
        <div className="divide-y divide-[var(--border-light)] border border-[var(--border-light)] rounded-[3px]">
          {results.map((r, i) => (
            <div
              key={`${r.trackName}-${r.artistName}-${i}`}
              className="py-1.5 px-2 flex items-center gap-2 hover:bg-[var(--bg-secondary)]"
            >
              <button
                type="button"
                onClick={() => onSelect(r)}
                className="flex items-center gap-2 flex-1 text-left min-w-0 cursor-pointer hover:opacity-80"
              >
                <ArtworkThumb url={r.artworkUrl} alt={r.trackName} sizeClassName="w-8 h-8" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[var(--text)] text-xs truncate">
                    {r.trackName}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] truncate">
                    {r.artistName}
                    {r.albumName ? ` · ${r.albumName}` : ''}
                    {r.duration
                      ? ` · ${Math.floor(r.duration / 60)}:${String(r.duration % 60).padStart(2, '0')}`
                      : ''}
                  </div>
                </div>
                <span className="text-[9px] text-[var(--text-faint)] shrink-0">
                  {r.hasSynced ? 'Synced' : r.hasPlain ? 'Plain' : 'No lyrics'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onSave(r)}
                className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer shrink-0"
              >
                Save
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ===========================================================================
// EntriesView — renders saved entries in the selected view mode
// ===========================================================================

interface EntriesViewProps {
  entries: JasmineEntry[];
  viewMode: ViewMode;
  activeFolderName: string | null;
  totalEntriesCount: number;
  onSelect: (e: JasmineEntry) => void;
  onDelete: (e: JasmineEntry) => void;
}

const EntriesView = React.memo(function EntriesView({
  entries: visibleEntries,
  viewMode,
  activeFolderName,
  totalEntriesCount,
  onSelect,
  onDelete,
}: EntriesViewProps) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
        {activeFolderName
          ? `Folder: ${activeFolderName} (${visibleEntries.length})`
          : `All saved lyrics (${totalEntriesCount})`}
      </div>

      {visibleEntries.length === 0 ? (
        <div className="py-6 text-center text-[var(--text-faint)] text-[11px]">
          {totalEntriesCount === 0
            ? 'No lyrics saved yet. Search above and save inspiration.'
            : 'No lyrics in this folder yet.'}
        </div>
      ) : viewMode === 'database' ? (
        <div className="border border-[var(--border-light)] rounded-[3px] overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-light)]">
              <tr className="text-left text-[var(--text-muted)] uppercase tracking-wider">
                <th className="p-1.5 font-semibold w-10">Art</th>
                <th className="p-1.5 font-semibold">Track</th>
                <th className="p-1.5 font-semibold">Artist</th>
                <th className="p-1.5 font-semibold hidden sm:table-cell">Album</th>
                <th className="p-1.5 font-semibold hidden md:table-cell">Genre</th>
                <th className="p-1.5 font-semibold text-right">Time</th>
                <th className="p-1.5 font-semibold text-center">Lyrics</th>
                <th className="p-1.5 font-semibold text-center">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-light)]">
              {visibleEntries.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-[var(--bg-secondary)] cursor-pointer"
                  onClick={() => onSelect(e)}
                >
                  <td className="p-1.5">
                    <ArtworkThumb url={e.artworkUrl} alt={e.trackName} sizeClassName="w-8 h-8" />
                  </td>
                  <td className="p-1.5 font-medium text-[var(--text)] max-w-[120px] truncate">
                    {e.trackName}
                  </td>
                  <td className="p-1.5 text-[var(--text-muted)] max-w-[100px] truncate">{e.artistName}</td>
                  <td className="p-1.5 text-[var(--text-muted)] hidden sm:table-cell max-w-[100px] truncate">
                    {e.albumName || '—'}
                  </td>
                  <td className="p-1.5 text-[var(--text-muted)] hidden md:table-cell">
                    {e.genre || '—'}
                  </td>
                  <td className="p-1.5 text-right font-mono text-[var(--text-muted)]">
                    {e.duration
                      ? `${Math.floor(e.duration / 60)}:${String(e.duration % 60).padStart(2, '0')}`
                      : '—'}
                  </td>
                  <td className="p-1.5 text-center">
                    {e.syncedLyrics ? (
                      <span className="inline-flex items-center gap-0.5 text-[var(--text)]">
                        <Clock className="w-2.5 h-2.5" /> Synced
                      </span>
                    ) : e.plainLyrics ? (
                      <span className="text-[var(--text-muted)]">Plain</span>
                    ) : (
                      <span className="text-[var(--text-faint)]">—</span>
                    )}
                  </td>
                  <td className="p-1.5 text-center">
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onDelete(e);
                      }}
                      className="text-[var(--text-faint)] hover:text-[var(--text)] cursor-pointer p-0.5"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {visibleEntries.map((e) => (
            <div
              key={e.id}
              className="border border-[var(--border-light)] rounded-[3px] p-1.5 space-y-1 bg-[var(--bg)]"
            >
              <button
                type="button"
                onClick={() => onSelect(e)}
                className="block w-full cursor-pointer hover:opacity-90"
              >
                <ArtworkThumb url={e.artworkUrl} alt={e.trackName} sizeClassName="w-full aspect-square" rounded="3px" />
              </button>
              <button
                type="button"
                onClick={() => onSelect(e)}
                className="block w-full text-left cursor-pointer hover:opacity-80"
              >
                <div className="font-medium text-[var(--text)] truncate text-[10px]">{e.trackName}</div>
                <div className="text-[9px] text-[var(--text-muted)] truncate">{e.artistName}</div>
              </button>
              <div className="flex items-center justify-between pt-0.5 border-t border-[var(--border-light)]">
                <span className="text-[8px] text-[var(--text-faint)]">
                  {e.syncedLyrics ? 'Synced' : e.plainLyrics ? 'Plain' : '—'}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(e)}
                  className="text-[var(--text-faint)] hover:text-[var(--text)] cursor-pointer p-0.5"
                  aria-label="Delete"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'normal' ? (
        <div className="space-y-2">
          {visibleEntries.map((e) => (
            <div
              key={e.id}
              className="border border-[var(--border-light)] rounded-[3px] p-2 bg-[var(--bg)] flex items-start gap-2"
            >
              <button
                type="button"
                onClick={() => onSelect(e)}
                className="shrink-0 cursor-pointer hover:opacity-90"
              >
                <ArtworkThumb url={e.artworkUrl} alt={e.trackName} sizeClassName="w-14 h-14" rounded="3px" />
              </button>
              <button
                type="button"
                onClick={() => onSelect(e)}
                className="flex-1 text-left min-w-0 cursor-pointer hover:opacity-80"
              >
                <div className="font-bold text-[var(--text)] text-xs truncate">{e.trackName}</div>
                <div className="text-[10px] text-[var(--text-muted)] truncate">{e.artistName}</div>
                {e.albumName && (
                  <div className="text-[9px] text-[var(--text-faint)] truncate">Album: {e.albumName}</div>
                )}
                <div className="text-[9px] text-[var(--text-faint)] mt-0.5 flex items-center gap-1.5 flex-wrap">
                  {e.genre && <span>{e.genre}</span>}
                  {e.duration && (
                    <span className="font-mono">
                      {Math.floor(e.duration / 60)}:{String(e.duration % 60).padStart(2, '0')}
                    </span>
                  )}
                  {e.releaseDate && <span>{new Date(e.releaseDate).getFullYear()}</span>}
                  {e.note && <span>· has note</span>}
                </div>
                <div className="text-[9px] mt-0.5 flex items-center gap-1">
                  {e.syncedLyrics && (
                    <span className="inline-flex items-center gap-0.5 text-[var(--text)]">
                      <Clock className="w-2.5 h-2.5" /> Synced lyrics
                    </span>
                  )}
                  {e.plainLyrics && !e.syncedLyrics && (
                    <span className="text-[var(--text-muted)]">Plain lyrics</span>
                  )}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onDelete(e)}
                className="text-[var(--text-faint)] hover:text-[var(--text)] cursor-pointer p-0.5 shrink-0"
                aria-label="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        // LIST view
        <div className="divide-y divide-[var(--border-light)] border border-[var(--border-light)] rounded-[3px]">
          {visibleEntries.map((e) => (
            <div
              key={e.id}
              className="py-1.5 px-2 flex items-center gap-2 hover:bg-[var(--bg-secondary)]"
            >
              <button
                type="button"
                onClick={() => onSelect(e)}
                className="flex items-center gap-2 flex-1 text-left min-w-0 cursor-pointer hover:opacity-80"
              >
                <ArtworkThumb url={e.artworkUrl} alt={e.trackName} sizeClassName="w-8 h-8" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[var(--text)] text-xs truncate">
                    {e.trackName}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] truncate">
                    {e.artistName}
                    {e.albumName ? ` · ${e.albumName}` : ''}
                    {e.duration
                      ? ` · ${Math.floor(e.duration / 60)}:${String(e.duration % 60).padStart(2, '0')}`
                      : ''}
                  </div>
                </div>
                <span className="text-[9px] text-[var(--text-faint)] shrink-0">
                  {e.syncedLyrics ? 'Synced' : e.plainLyrics ? 'Plain' : '—'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(e)}
                className="text-[var(--text-faint)] hover:text-[var(--text)] cursor-pointer p-0.5 shrink-0"
                aria-label="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ===========================================================================
// SaveModal — save a search result into a folder
// ===========================================================================

interface SaveModalProps {
  result: CombinedResult;
  saveFolderId: string | undefined;
  setSaveFolderId: (id: string | undefined) => void;
  savePreferSynced: boolean;
  setSavePreferSynced: (v: boolean) => void;
  flatFolderOptions: { id: string; label: string; depth: number }[];
  onConfirm: () => void;
  onCancel: () => void;
}

function SaveModal({
  result,
  saveFolderId,
  setSaveFolderId,
  savePreferSynced,
  setSavePreferSynced,
  flatFolderOptions,
  onConfirm,
  onCancel,
}: SaveModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-3"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--bg)] rounded-[6px] p-3 max-w-md w-full space-y-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
          <span className="font-semibold text-[var(--text)] text-sm">Save lyrics</span>
          <button
            type="button"
            onClick={onCancel}
            className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer p-1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {result.artworkUrl && (
            <img
              src={result.artworkUrl}
              alt={result.trackName}
              className="w-12 h-12 rounded-[2px] object-cover border border-[var(--border-light)] shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="font-medium text-[var(--text)] text-xs truncate">{result.trackName}</div>
            <div className="text-[10px] text-[var(--text-muted)] truncate">
              {result.artistName}
              {result.albumName ? ` · ${result.albumName}` : ''}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Save to folder</label>
          <select
            value={saveFolderId || ''}
            onChange={(e) => setSaveFolderId(e.target.value || undefined)}
            className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px] cursor-pointer"
          >
            <option value="">Root level (no folder)</option>
            {flatFolderOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {'— '.repeat(o.depth)}
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {result.hasSynced && result.hasPlain && (
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Default view</label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setSavePreferSynced(true)}
                className={`flex-1 py-1 px-2 text-[10px] border rounded-[2px] cursor-pointer ${
                  savePreferSynced
                    ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]'
                    : 'bg-[var(--bg)] text-[var(--text)] border-[var(--border-light)]'
                }`}
              >
                <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                Synced
              </button>
              <button
                type="button"
                onClick={() => setSavePreferSynced(false)}
                className={`flex-1 py-1 px-2 text-[10px] border rounded-[2px] cursor-pointer ${
                  !savePreferSynced
                    ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]'
                    : 'bg-[var(--bg)] text-[var(--text)] border-[var(--border-light)]'
                }`}
              >
                <FileText className="w-2.5 h-2.5 inline mr-0.5" />
                Plain
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-1.5 bg-[var(--accent)] text-[var(--accent-text)] border border-[var(--border)] rounded-[3px] text-xs hover:bg-[var(--accent-hover)] cursor-pointer"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 bg-[var(--bg)] text-[var(--text)] border border-[var(--border-light)] rounded-[3px] text-xs hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// MovableLyricsWindow — draggable window showing lyrics
// ===========================================================================

interface MovableLyricsWindowProps {
  payload: WindowPayload;
  folders: JasmineFolder[];
  flatFolderOptions: { id: string; label: string; depth: number }[];
  onClose: () => void;
  onUpdateEntry: (entry: JasmineEntry) => void;
  onDeleteEntry: (id: string) => void;
  stripLrcTimestamps: (lrc: string) => string;
}

function MovableLyricsWindow({
  payload,
  flatFolderOptions,
  onClose,
  onUpdateEntry,
  onDeleteEntry,
  stripLrcTimestamps,
}: MovableLyricsWindowProps) {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return { x: 8, y: 8 };
    }
    return { x: 60, y: 60 };
  });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number }>({
    x: 0,
    y: 0,
    ox: 0,
    oy: 0,
  });

  const [entry, setEntry] = useState<JasmineEntry | null>(
    payload.kind === 'entry' ? payload.entry : null
  );

  useEffect(() => {
    if (payload.kind === 'entry') {
      setEntry(payload.entry);
    } else {
      setEntry(null);
    }
  }, [payload]);

  const result = payload.kind === 'search' ? payload.result : null;
  const isEntry = !!entry;

  const [preferSynced, setPreferSynced] = useState<boolean>(
    entry?.preferSynced ?? !!result?.hasSynced
  );

  useEffect(() => {
    if (entry) setPreferSynced(entry.preferSynced ?? false);
    else if (result) setPreferSynced(result.hasSynced);
  }, [entry, result]);

  const lyricsSource: { plain?: string; synced?: string } = entry
    ? { plain: entry.plainLyrics, synced: entry.syncedLyrics }
    : { plain: result?.plainLyrics, synced: result?.syncedLyrics };

  const showSynced = preferSynced && lyricsSource.synced;
  const showPlain = !showSynced && lyricsSource.plain;
  const lyricsText = showSynced
    ? stripLrcTimestamps(lyricsSource.synced!)
    : showPlain
    ? lyricsSource.plain!
    : '';

  const headerTitle = entry?.trackName || result?.trackName || 'Lyrics';
  const headerSub = entry?.artistName || result?.artistName || '';
  const artworkUrl = entry?.artworkUrl || result?.artworkUrl;

  const startDrag = (clientX: number, clientY: number) => {
    setDragging(true);
    dragStart.current = { x: clientX, y: clientY, ox: pos.x, oy: pos.y };
  };
  const moveDrag = (clientX: number, clientY: number) => {
    if (!dragging) return;
    const dx = clientX - dragStart.current.x;
    const dy = clientY - dragStart.current.y;
    let nx = dragStart.current.ox + dx;
    let ny = dragStart.current.oy + dy;
    if (typeof window !== 'undefined') {
      nx = Math.max(0, Math.min(window.innerWidth - 100, nx));
      ny = Math.max(0, Math.min(window.innerHeight - 40, ny));
    }
    setPos({ x: nx, y: ny });
  };
  const endDrag = () => setDragging(false);

  const updateEntry = (updates: Partial<JasmineEntry>) => {
    if (!entry) return;
    const next = { ...entry, ...updates };
    setEntry(next);
    onUpdateEntry(next);
  };

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
        onTouchStart={(e) => {
          if (e.touches[0]) startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onTouchMove={(e) => {
          if (e.touches[0]) moveDrag(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onTouchEnd={endDrag}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <GripVertical className="w-3 h-3 text-[var(--text-faint)] shrink-0" />
          {artworkUrl && (
            <img
              src={artworkUrl}
              alt={headerTitle}
              className="w-7 h-7 rounded-[2px] object-cover border border-[var(--border-light)] shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[var(--text)] truncate">{headerTitle}</div>
            {headerSub && (
              <div className="text-[9px] text-[var(--text-muted)] truncate">{headerSub}</div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer p-1 shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 max-h-[55vh]">
        {/* Synced / Plain toggle if both available */}
        {lyricsSource.plain && lyricsSource.synced && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-[var(--text-muted)]">View:</span>
            <button
              type="button"
              onClick={() => {
                setPreferSynced(true);
                if (entry) updateEntry({ preferSynced: true });
              }}
              className={`px-2 py-0.5 text-[10px] border rounded-[2px] cursor-pointer ${
                preferSynced
                  ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]'
                  : 'bg-[var(--bg)] text-[var(--text)] border-[var(--border-light)]'
              }`}
            >
              <Clock className="w-2.5 h-2.5 inline mr-0.5" />
              Synced
            </button>
            <button
              type="button"
              onClick={() => {
                setPreferSynced(false);
                if (entry) updateEntry({ preferSynced: false });
              }}
              className={`px-2 py-0.5 text-[10px] border rounded-[2px] cursor-pointer ${
                !preferSynced
                  ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]'
                  : 'bg-[var(--bg)] text-[var(--text)] border-[var(--border-light)]'
              }`}
            >
              <FileText className="w-2.5 h-2.5 inline mr-0.5" />
              Plain
            </button>
          </div>
        )}

        {lyricsText ? (
          <MarkdownPreview content={lyricsText} />
        ) : (
          <div className="text-[var(--text-faint)] text-[11px] italic">
            No lyrics available (instrumental track or not synced).
          </div>
        )}
      </div>

      {/* Footer — entry-specific actions */}
      {isEntry && entry && (
        <div className="border-t border-[var(--border-light)] p-2 space-y-2 bg-[var(--bg-secondary)]">
          <textarea
            placeholder="Add a note about why you saved this..."
            value={entry.note || ''}
            onChange={(e) => updateEntry({ note: e.target.value })}
            rows={2}
            className="w-full border border-[var(--border-light)] p-1.5 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px] focus:outline-none focus:border-[var(--border)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={entry.folderId || ''}
              onChange={(e) => updateEntry({ folderId: e.target.value || undefined })}
              className="border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-[10px] rounded-[2px] cursor-pointer flex-1 min-w-[120px]"
            >
              <option value="">Root level</option>
              {flatFolderOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {'— '.repeat(o.depth)}
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onDeleteEntry(entry.id)}
              className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer inline-flex items-center gap-0.5 shrink-0"
            >
              <Trash2 className="w-2.5 h-2.5" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
