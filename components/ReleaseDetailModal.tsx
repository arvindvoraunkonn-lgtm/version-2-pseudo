'use client';

import React from 'react';
import { Release } from '../lib/types';
import { Play, ExternalLink, X } from 'lucide-react';
import { Artwork } from './Artwork';
import { getBlobUrlForFileId } from '../lib/db';
import { AudioPlaybackState } from './AudioPlayer';

interface ReleaseDetailModalProps {
  release: Release | null;
  onClose: () => void;
  onPlayAudio: (audio: AudioPlaybackState) => void;
}

/**
 * Full-screen detail modal for a release. Opens when the user clicks a
 * release card in the grid / list / discography views. Shows everything:
 * artwork, basic info, single-specific info (features, beat, music video),
 * tracks list with per-track artwork, and credits.
 *
 * Reuses the same `<Artwork>` component so locally-stored image blobs
 * resolve correctly.
 */
export function ReleaseDetailModal({
  release,
  onClose,
  onPlayAudio,
}: ReleaseDetailModalProps) {
  if (!release) return null;

  const playTrack = async (track: { audioFileId?: string; audioUrl?: string; beatUrl?: string; title: string }) => {
    if (track.audioFileId) {
      const url = await getBlobUrlForFileId(track.audioFileId);
      if (url) {
        onPlayAudio({ src: url, title: track.title, subTitle: release.title });
        return;
      }
    }
    if (track.audioUrl) {
      onPlayAudio({ src: track.audioUrl, title: track.title, subTitle: release.title });
      return;
    }
    if (track.beatUrl) {
      onPlayAudio({ src: track.beatUrl, title: track.title, subTitle: `beat: ${release.title}` });
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-start sm:items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg)] rounded-[6px] p-3 sm:p-4 max-w-lg w-full my-4 space-y-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
          <span className="font-semibold text-[var(--text)] text-sm">{release.title}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer p-1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Artwork + basic info */}
        <div className="flex items-start gap-3">
          <Artwork
            url={release.artworkUrl}
            fileId={release.artworkFileId}
            alt={release.title}
            sizeClassName="w-24 h-24 sm:w-28 sm:h-28"
            containerClassName="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[3px]"
            iconClassName="w-8 h-8"
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <h3 className="text-base font-bold text-[var(--text)] leading-tight break-words">{release.title}</h3>
            <div className="text-[11px] text-[var(--text-muted)]">
              <span className="capitalize">{release.type}</span>
              {release.year && <span> · {release.year}</span>}
              <span> · {release.isReleased ? 'Released' : 'Unreleased'}</span>
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              {release.genre || 'no genre'}
              {release.subGenre ? ` · ${release.subGenre}` : ''}
            </div>
            {release.tracks && release.tracks.length > 0 && (
              <div className="text-[11px] text-[var(--text-faint)]">{release.tracks.length} tracks</div>
            )}
          </div>
        </div>

        {/* Single-specific info */}
        {release.type === 'single' && (
          <div className="space-y-1 text-[11px] text-[var(--text-muted)] pl-1 border-l-2 border-[var(--border)]">
            {release.hasFeatures && release.featureNames && release.featureNames.length > 0 && (
              <div>
                <span className="font-medium text-[var(--text)]">Features: </span>
                {release.featureNames.join(', ')}
              </div>
            )}
            {release.beatType && release.beatType !== 'none' && (
              <div>
                <span className="font-medium text-[var(--text)]">Beat: </span>
                {release.beatType}
                {release.beatUrl && (
                  <span className="ml-1">
                    (
                    <a
                      href={release.beatUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline inline-flex items-center gap-0.5"
                    >
                      link <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    )
                  </span>
                )}
              </div>
            )}
            {release.musicVideoKind && (
              <div>
                <span className="font-medium text-[var(--text)]">Music video: </span>
                {release.musicVideoKind}
                <span className="text-[var(--text-muted)] ml-1">
                  [{release.musicVideoDone ? 'done' : 'in progress'},{' '}
                  {release.musicVideoUploaded ? 'uploaded' : 'not uploaded'}]
                </span>
              </div>
            )}
            {release.musicVideoUrl && (
              <div>
                <a
                  href={release.musicVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline inline-flex items-center gap-0.5"
                >
                  Video link <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            )}
          </div>
        )}

        {/* Tracks list (album / ep / mixtape) */}
        {release.tracks && release.tracks.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-[var(--border-light)]">
            <div className="text-[11px] font-medium text-[var(--text)]">tracks ({release.tracks.length})</div>
            <div className="divide-y divide-[var(--border-light)]">
              {release.tracks.map((t) => (
                <div key={t.id} className="py-1 flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <Artwork
                      url={t.artworkUrl}
                      fileId={t.artworkFileId}
                      alt={t.title}
                      sizeClassName="w-8 h-8"
                      containerClassName="bg-[var(--bg-hover)] border border-[var(--border-light)]"
                      iconClassName="w-3 h-3"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[var(--text-faint)] shrink-0">{t.trackNumber}.</span>
                        <span className="text-[var(--text)] truncate">{t.title}</span>
                      </div>
                      {t.duration && (
                        <span className="text-[var(--text-faint)] text-[10px] ml-5">[{t.duration}]</span>
                      )}
                    </div>
                  </div>
                  {(t.audioFileId || t.audioUrl || t.beatUrl) && (
                    <button
                      type="button"
                      onClick={() => playTrack(t)}
                      className="p-0.5 text-[var(--text)] hover:text-[var(--text-muted)] cursor-pointer shrink-0"
                      title="Play audio"
                    >
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Credits */}
        {release.credits && release.credits.length > 0 && (
          <div className="pt-1 border-t border-[var(--border-light)] text-[11px] space-y-0.5">
            <div className="font-medium text-[var(--text)]">Credits</div>
            {release.credits.map((c) => (
              <div key={c.id} className="text-[var(--text-muted)]">
                <span className="font-medium text-[var(--text)]">{c.role}: </span>
                <span>{c.name}</span>
                {c.profileUrls?.[0] && (
                  <span className="ml-1">
                    (
                    <a
                      href={c.profileUrls[0]}
                      target="_blank"
                      rel="noreferrer"
                      className="underline inline-flex items-center gap-0.5"
                    >
                      profile <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    )
                  </span>
                )}
                {c.email && <span className="text-[var(--text-faint)] ml-1">&lt;{c.email}&gt;</span>}
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {release.notes && (
          <div className="pt-1 border-t border-[var(--border-light)] text-[11px] space-y-0.5">
            <div className="font-medium text-[var(--text)]">Notes</div>
            <div className="text-[var(--text-muted)] whitespace-pre-wrap">{release.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-[var(--border-light)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-[var(--bg)] text-[var(--text)] border border-[var(--border-light)] rounded-[3px] text-xs hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
