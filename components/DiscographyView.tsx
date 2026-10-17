'use client';

import React, { useState } from 'react';
import { Release } from '../lib/types';
import { Play } from 'lucide-react';
import { AudioPlaybackState } from './AudioPlayer';
import { getBlobUrlForFileId } from '../lib/db';
import { Artwork } from './Artwork';
import { ReleaseDetailModal } from './ReleaseDetailModal';

interface DiscographyViewProps {
  artistId: string;
  releases: Release[];
  onPlayAudio: (audio: AudioPlaybackState) => void;
  onSelectRelease?: (release: Release) => void;
}

export function DiscographyView({
  artistId,
  releases,
  onPlayAudio,
}: DiscographyViewProps) {
  const [detailRelease, setDetailRelease] = useState<Release | null>(null);

  const artistReleases = releases
    .filter((r) => r.artistId === artistId)
    .sort((a, b) => (b.year || '').localeCompare(a.year || ''));

  const albumsAndEps = artistReleases.filter(
    (r) => r.type === 'album' || r.type === 'ep' || r.type === 'mixtape'
  );
  const singles = artistReleases.filter((r) => r.type === 'single');
  const others = artistReleases.filter(
    (r) => r.type !== 'album' && r.type !== 'ep' && r.type !== 'mixtape' && r.type !== 'single'
  );

  const handlePlay = async (audioFileId?: string, audioUrl?: string, title?: string, subTitle?: string) => {
    if (audioFileId) {
      const url = await getBlobUrlForFileId(audioFileId);
      if (url) onPlayAudio({ src: url, title: title || 'track', subTitle });
    } else if (audioUrl) {
      onPlayAudio({ src: audioUrl, title: title || 'track', subTitle });
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto p-3 text-xs space-y-4">
      <div className="pb-1.5 border-b border-[var(--border)]">
        <h2 className="font-semibold text-[var(--text)]">Discography</h2>
      </div>

      {artistReleases.length === 0 ? (
        <div className="py-8 text-center text-[var(--text-faint)] text-xs">No releases recorded yet</div>
      ) : (
        <div className="space-y-6">
          {/* Albums, EPs & Mixtapes */}
          {albumsAndEps.length > 0 && (
            <section className="space-y-3">
              <div className="text-[11px] font-semibold text-[var(--text)] uppercase tracking-wider pb-1 border-b border-[var(--border-light)]">
                albums, eps &amp; mixtapes ({albumsAndEps.length})
              </div>
              <div className="space-y-4">
                {albumsAndEps.map((rel) => (
                  <div key={rel.id} className="border-b border-[var(--border-light)] pb-3 space-y-1.5">
                    <div className="flex items-start justify-between">
                      <button
                        type="button"
                        onClick={() => setDetailRelease(rel)}
                        className="flex items-start gap-2 text-left cursor-pointer hover:opacity-80 min-w-0 flex-1"
                      >
                        <Artwork
                          url={rel.artworkUrl}
                          fileId={rel.artworkFileId}
                          alt={rel.title}
                          sizeClassName="w-12 h-12"
                          iconClassName="w-4 h-4"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-[var(--text)] text-xs leading-tight truncate">{rel.title}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {rel.type} {rel.year ? `· ${rel.year}` : ''} · {rel.isReleased ? 'Released' : 'Unreleased'}
                          </div>
                          <div className="text-[10px] text-[var(--text-faint)] truncate">{rel.genre} {rel.subGenre ? `(${rel.subGenre})` : ''}</div>
                        </div>
                      </button>
                      <span className="text-[10px] font-mono text-[var(--text-faint)] shrink-0">{rel.tracks?.length || 0} tracks</span>
                    </div>

                    {rel.tracks && rel.tracks.length > 0 && (
                      <div className="pl-14 text-[10px] space-y-0.5 text-[var(--text-muted)]">
                        {rel.tracks.map((t) => (
                          <div key={t.id} className="flex items-center justify-between py-0.5">
                            <span className="truncate flex items-center gap-1.5 min-w-0">
                              <span className="shrink-0 font-mono text-[var(--text-faint)]">{t.trackNumber}.</span>
                              <span className="truncate">{t.title}</span>
                            </span>
                            {(t.audioFileId || t.audioUrl || t.beatUrl) && (
                              <button
                                type="button"
                                onClick={() => handlePlay(t.audioFileId, t.audioUrl || t.beatUrl, t.title, rel.title)}
                                className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text)] p-0.5 shrink-0"
                              >
                                <Play className="w-2.5 h-2.5 fill-current" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Singles */}
          {singles.length > 0 && (
            <section className="space-y-2">
              <div className="text-[11px] font-semibold text-[var(--text)] uppercase tracking-wider pb-1 border-b border-[var(--border-light)]">
                singles ({singles.length})
              </div>
              <div className="divide-y divide-[var(--border-light)]">
                {singles.map((rel) => (
                  <div key={rel.id} className="py-2 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setDetailRelease(rel)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer hover:opacity-80"
                    >
                      <Artwork
                        url={rel.artworkUrl}
                        fileId={rel.artworkFileId}
                        alt={rel.title}
                        sizeClassName="w-8 h-8"
                        iconClassName="w-3 h-3"
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--text)] truncate">{rel.title}</div>
                        <div className="text-[10px] text-[var(--text-muted)] truncate">
                          {rel.year ? `${rel.year} · ` : ''}{rel.isReleased ? 'Released' : 'Unreleased'}
                          {rel.hasFeatures && rel.featureNames?.length ? ` (feat. ${rel.featureNames.join(', ')})` : ''}
                        </div>
                      </div>
                    </button>
                    {rel.beatUrl && (
                      <button
                        type="button"
                        onClick={() => handlePlay(undefined, rel.beatUrl, rel.title, 'beat')}
                        className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text)] p-1 shrink-0"
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Custom / Other Releases */}
          {others.length > 0 && (
            <section className="space-y-2">
              <div className="text-[11px] font-semibold text-[var(--text)] uppercase tracking-wider pb-1 border-b border-[var(--border-light)]">
                other projects ({others.length})
              </div>
              <div className="divide-y divide-[var(--border-light)]">
                {others.map((rel) => (
                  <div key={rel.id} className="py-2 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setDetailRelease(rel)}
                      className="text-left cursor-pointer hover:opacity-80 min-w-0"
                    >
                      <div className="font-medium text-[var(--text)]">{rel.title}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{rel.type} · {rel.year}</div>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Release detail modal */}
      <ReleaseDetailModal
        release={detailRelease}
        onClose={() => setDetailRelease(null)}
        onPlayAudio={onPlayAudio}
      />
    </div>
  );
}
