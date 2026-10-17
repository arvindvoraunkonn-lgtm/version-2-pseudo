'use client';

import React, { useState, useEffect } from 'react';
import { ArtworkEntry } from '../lib/types';
import { saveFileToDb, getBlobUrlForFileId } from '../lib/db';
import { TypedConfirmModal } from './ConfirmModal';
import { LayoutList, LayoutGrid, Image as ImageIcon } from 'lucide-react';
import { loadViewPref, saveViewPref } from '../lib/view-prefs';

interface ArtworksViewProps {
  artistId: string;
  artworks: ArtworkEntry[];
  onAddArtwork: (art: ArtworkEntry) => void;
  onDeleteArtwork: (id: string) => void;
}

export function ArtworksView({
  artistId,
  artworks,
  onAddArtwork,
  onDeleteArtwork,
}: ArtworksViewProps) {
  // Persist view mode across page navigations
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    () => {
      const saved = loadViewPref('artworks', 'grid');
      if (saved === 'list' || saved === 'grid') return saved;
      return 'grid';
    }
  );
  useEffect(() => {
    saveViewPref('artworks', viewMode);
  }, [viewMode]);
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [confirmDeleteArt, setConfirmDeleteArt] = useState<ArtworkEntry | null>(null);
  const [resolvedUrls, setResolvedUrls] = useState<{ [id: string]: string }>({});

  // Filter artworks for this artist or associated with artist
  const currentArtworks = artworks.filter((a) => !a.artistId || a.artistId === artistId);

  // Resolve blob URLs for stored files
  useEffect(() => {
    let isMounted = true;
    async function resolveAll() {
      const mapping: { [id: string]: string } = {};
      for (const a of currentArtworks) {
        if (a.imageUrl) {
          mapping[a.id] = a.imageUrl;
        } else if (a.imageFileId) {
          const blobUrl = await getBlobUrlForFileId(a.imageFileId);
          if (blobUrl) mapping[a.id] = blobUrl;
        }
      }
      if (isMounted) setResolvedUrls(mapping);
    }
    resolveAll();
    return () => {
      isMounted = false;
    };
  }, [currentArtworks]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !file && !url.trim()) return;

    let imageFileId: string | undefined;
    if (file) {
      imageFileId = 'art_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      await saveFileToDb(imageFileId, file, file.name);
    }

    const newArt: ArtworkEntry = {
      id: 'art_entry_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      artistId,
      title: title.trim() || file?.name || 'untitled',
      imageUrl: url.trim() || undefined,
      imageFileId,
      sourceType: 'standalone',
      createdAt: new Date().toISOString(),
    };

    onAddArtwork(newArt);
    setIsAdding(false);
    setTitle('');
    setUrl('');
    setFile(null);
  };

  return (
    <div className="w-full max-w-lg mx-auto p-3 text-xs">
      {/* Top Controls */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)] mb-3">
        <span className="font-semibold text-[var(--text)]">Artworks</span>

        {!isAdding && (
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-[var(--border-light)] rounded-[2px] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded-[2px] cursor-pointer ${
                  viewMode === 'grid' ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'bg-[var(--bg)] text-[var(--text-muted)]'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1 rounded-[2px] cursor-pointer ${
                  viewMode === 'list' ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'bg-[var(--bg)] text-[var(--text-muted)]'
                }`}
                title="List view"
              >
                <LayoutList className="w-3 h-3" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="px-2 py-0.5 border border-[var(--border)] bg-[var(--bg)] rounded-[3px] text-[11px] text-[var(--text)] hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              + Add
            </button>
          </div>
        )}
      </div>

      {/* Add Form */}
      {isAdding && (
        <form onSubmit={handleSave} className="p-2 border border-[var(--border)] rounded-[3px] space-y-2 mb-4 bg-[var(--bg-secondary)]">
          <div className="flex justify-between items-center text-[11px] font-medium text-[var(--text)]">
            <span>Add artwork</span>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
            />
          </div>

          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Cdn image url</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
            />
          </div>

          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Or local image file</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-[11px] text-[var(--text-muted)]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-1 bg-[var(--accent)] text-[var(--accent-text)] border border-[var(--border)] rounded-[3px] text-xs hover:bg-[var(--accent-hover)] cursor-pointer"
          >
            Save artwork
          </button>
        </form>
      )}

      {currentArtworks.length === 0 && !isAdding && (
        <div className="py-8 text-center text-[var(--text-faint)] text-xs">No artworks found</div>
      )}

      {/* 1:1 Squares Grid */}
      {viewMode === 'grid' && currentArtworks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {currentArtworks.map((art) => {
            const imgSrc = resolvedUrls[art.id];
            return (
              <div
                key={art.id}
                className="group relative border border-[var(--border-light)] rounded-[2px] overflow-hidden bg-[var(--bg)]"
              >
                {/* 1:1 square container */}
                <div className="aspect-square w-full bg-[var(--bg-hover)] flex items-center justify-center overflow-hidden">
                  {imgSrc ? (
                    <img
                      src={imgSrc}
                      alt={art.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-[var(--text-faint)]" />
                  )}
                </div>

                <div className="p-1 flex items-center justify-between text-[10px]">
                  <span className="truncate text-[var(--text)] font-medium">{art.title}</span>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteArt(art)}
                    className="text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer ml-1 shrink-0"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 1:1 Squares List */}
      {viewMode === 'list' && currentArtworks.length > 0 && (
        <div className="divide-y divide-[var(--border-light)]">
          {currentArtworks.map((art) => {
            const imgSrc = resolvedUrls[art.id];
            return (
              <div
                key={art.id}
                className="py-2 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-12 h-12 shrink-0 aspect-square bg-[var(--bg-hover)] border border-[var(--border-light)] overflow-hidden flex items-center justify-center">
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={art.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-[var(--text-faint)]" />
                    )}
                  </div>
                  <div className="truncate">
                    <div className="font-medium text-[var(--text)] truncate">{art.title}</div>
                    <div className="text-[10px] text-[var(--text-faint)]">
                      {art.sourceType ? `Source: ${art.sourceType}` : 'Standalone'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmDeleteArt(art)}
                  className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer shrink-0"
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Typed delete confirmation */}
      <TypedConfirmModal
        isOpen={!!confirmDeleteArt}
        title={confirmDeleteArt ? `Delete artwork "${confirmDeleteArt.title}"` : ''}
        expectedText="Delete"
        onConfirm={() => {
          if (confirmDeleteArt) {
            onDeleteArtwork(confirmDeleteArt.id);
            setConfirmDeleteArt(null);
          }
        }}
        onCancel={() => setConfirmDeleteArt(null)}
      />
    </div>
  );
}
