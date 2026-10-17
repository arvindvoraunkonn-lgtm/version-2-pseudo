'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Artist, Release, TrackItem, Achievement, NoteDocument, LyricsDocument, FeaturePerson } from '../lib/types';
import { Search, X, Music, Award, FileText, Mic, User, Disc3 } from 'lucide-react';

export type UniversalSearchResult = {
  type: 'artist' | 'release' | 'track' | 'achievement' | 'note' | 'lyrics' | 'feature';
  id: string;
  title: string;
  subtitle?: string;
  artistId?: string;
  releaseId?: string;
};

interface UniversalSearchProps {
  isOpen: boolean;
  artists: Artist[];
  releases: Release[];
  achievements: Achievement[];
  notes: NoteDocument[];
  lyrics: LyricsDocument[];
  features: FeaturePerson[];
  onClose: () => void;
  onSelectArtist: (artist: Artist) => void;
  onSelectRelease: (release: Release) => void;
  onSelectAchievement: (artistId: string, achievementId: string) => void;
  onSelectNote: (note: NoteDocument) => void;
  onSelectLyrics: (artistId: string, lyricsId: string) => void;
  onSelectFeature: (featureId: string) => void;
}

/**
 * Universal search overlay. Opens via a search button in the TopNav.
 * Searches across:
 *   - artists (by name / actual name / genre / label)
 *   - releases (by title / genre / year)
 *   - tracks (by title, within albums/eps)
 *   - achievements (by title / note)
 *   - notes (by title / body)
 *   - lyrics (by fileName / lyrics text)
 *   - features (by name / role)
 *
 * Results are grouped by type. Clicking a result fires the appropriate
 * navigation callback (sets selected artist + active page).
 *
 * Keyboard: Esc closes, Enter selects first result.
 */
export function UniversalSearch({
  isOpen,
  artists,
  releases,
  achievements,
  notes,
  lyrics,
  features,
  onClose,
  onSelectArtist,
  onSelectRelease,
  onSelectAchievement,
  onSelectNote,
  onSelectLyrics,
  onSelectFeature,
}: UniversalSearchProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset query each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      // Focus on next tick to avoid race with display:none
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const results = useMemo<UniversalSearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const out: UniversalSearchResult[] = [];

    // Artists
    for (const a of artists) {
      const hay = `${a.name} ${a.actualName} ${a.genre} ${a.subGenre} ${a.label} ${a.distributor} ${a.style}`.toLowerCase();
      if (hay.includes(q)) {
        out.push({
          type: 'artist',
          id: a.id,
          title: a.name,
          subtitle: a.actualName ? `Actual: ${a.actualName}` : a.genre || 'Artist',
        });
      }
    }

    // Releases
    for (const r of releases) {
      const hay = `${r.title} ${r.type} ${r.genre} ${r.subGenre} ${r.year}`.toLowerCase();
      if (hay.includes(q)) {
        const artist = artists.find((a) => a.id === r.artistId);
        out.push({
          type: 'release',
          id: r.id,
          title: r.title,
          subtitle: `${r.type}${r.year ? ` · ${r.year}` : ''}${
            artist ? ` · ${artist.name}` : ''
          }`,
          artistId: r.artistId,
        });
      }
      // Tracks inside this release
      if (r.tracks) {
        for (const t of r.tracks) {
          if ((t.title || '').toLowerCase().includes(q)) {
            const artist = artists.find((a) => a.id === r.artistId);
            out.push({
              type: 'track',
              id: t.id,
              title: t.title,
              subtitle: `Track from: ${r.title}${artist ? ` · ${artist.name}` : ''}`,
              artistId: r.artistId,
              releaseId: r.id,
            });
          }
        }
      }
    }

    // Achievements
    for (const ach of achievements) {
      const hay = `${ach.title} ${ach.note}`.toLowerCase();
      if (hay.includes(q)) {
        const artist = artists.find((a) => a.id === ach.artistId);
        out.push({
          type: 'achievement',
          id: ach.id,
          title: ach.title,
          subtitle: `${ach.date}${artist ? ` · ${artist.name}` : ''}`,
          artistId: ach.artistId,
        });
      }
    }

    // Notes
    for (const n of notes) {
      const hay = `${n.title} ${n.body}`.toLowerCase();
      if (hay.includes(q)) {
        const artist = artists.find((a) => a.id === n.artistId);
        out.push({
          type: 'note',
          id: n.id,
          title: n.title || 'Untitled note',
          subtitle: `${n.date}${artist ? ` · ${artist.name}` : ' · shared'}`,
          artistId: n.artistId,
        });
      }
    }

    // Lyrics
    for (const l of lyrics) {
      const hay = `${l.fileName} ${l.lyrics}`.toLowerCase();
      if (hay.includes(q)) {
        const artist = artists.find((a) => a.id === l.artistId);
        out.push({
          type: 'lyrics',
          id: l.id,
          title: l.fileName,
          subtitle: artist ? artist.name : 'Lyrics',
          artistId: l.artistId,
        });
      }
    }

    // Features (people)
    for (const f of features) {
      const hay = `${f.name} ${f.role} ${f.notes || ''}`.toLowerCase();
      if (hay.includes(q)) {
        out.push({
          type: 'feature',
          id: f.id,
          title: f.name,
          subtitle: f.role,
        });
      }
    }

    // Cap results so the list stays snappy
    return out.slice(0, 60);
  }, [query, artists, releases, achievements, notes, lyrics, features]);

  // Group results by type for display.
  // NOTE: This useMemo MUST be called before the `if (!isOpen) return null`
  // early return below, otherwise React throws a "rendered more hooks than
  // during the previous render" error when the modal opens (because the
  // number of hooks would change between renders).
  const grouped = useMemo(() => {
    const groups: Record<string, UniversalSearchResult[]> = {};
    for (const r of results) {
      (groups[r.type] = groups[r.type] || []).push(r);
    }
    return groups;
  }, [results]);

  const groupOrder: { type: UniversalSearchResult['type']; label: string; Icon: any }[] = [
    { type: 'artist', label: 'Artists', Icon: User },
    { type: 'release', label: 'Releases', Icon: Disc3 },
    { type: 'track', label: 'Tracks', Icon: Music },
    { type: 'achievement', label: 'Achievements', Icon: Award },
    { type: 'note', label: 'Notes', Icon: FileText },
    { type: 'lyrics', label: 'Lyrics', Icon: Mic },
    { type: 'feature', label: 'Features', Icon: User },
  ];

  if (!isOpen) return null;

  const handleSelect = (r: UniversalSearchResult) => {
    switch (r.type) {
      case 'artist': {
        const a = artists.find((x) => x.id === r.id);
        if (a) {
          onSelectArtist(a);
          onClose();
        }
        break;
      }
      case 'release':
      case 'track': {
        const rel = releases.find((x) => x.id === r.releaseId || x.id === r.id);
        if (rel) {
          onSelectRelease(rel);
          onClose();
        }
        break;
      }
      case 'achievement': {
        if (r.artistId && r.id) {
          onSelectAchievement(r.artistId, r.id);
          onClose();
        }
        break;
      }
      case 'note': {
        const n = notes.find((x) => x.id === r.id);
        if (n) {
          onSelectNote(n);
          onClose();
        }
        break;
      }
      case 'lyrics': {
        if (r.artistId && r.id) {
          onSelectLyrics(r.artistId, r.id);
          onClose();
        }
        break;
      }
      case 'feature': {
        onSelectFeature(r.id);
        onClose();
        break;
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg)] rounded-[6px] w-full max-w-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 p-2 border-b border-[var(--border)]">
          <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search artists, releases, tracks, achievements, notes, lyrics, features..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-sm text-[var(--text)] bg-transparent focus:outline-none min-w-0"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer p-1 shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[70vh] overflow-y-auto">
          {query.trim() === '' ? (
            <div className="p-6 text-center text-[var(--text-faint)] text-xs">
              Start typing to search across everything in this app.
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-[var(--text-faint)] text-xs">
              No results for &quot;{query}&quot;
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-light)]">
              {groupOrder.map(({ type, label, Icon }) => {
                const group = grouped[type];
                if (!group || group.length === 0) return null;
                return (
                  <div key={type}>
                    <div className="px-3 py-1.5 bg-[var(--bg-secondary)] text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                      <Icon className="w-3 h-3" />
                      {label} ({group.length})
                    </div>
                    <div className="divide-y divide-[var(--border-light)]">
                      {group.map((r) => (
                        <button
                          key={`${r.type}-${r.id}`}
                          type="button"
                          onClick={() => handleSelect(r)}
                          className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] cursor-pointer flex items-center gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-[var(--text)] truncate">
                              {r.title}
                            </div>
                            {r.subtitle && (
                              <div className="text-[10px] text-[var(--text-faint)] truncate">
                                {r.subtitle}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
