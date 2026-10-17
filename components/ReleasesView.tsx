'use client';

import React, { useState, useEffect } from 'react';
import { Release, TrackItem, CreditItem, ReleaseType } from '../lib/types';
import { MAJOR_GENRES, getSubGenresForGenre } from '../lib/genres';
import { CustomDropdown } from './CustomDropdown';
import { ButtonConfirmModal, TypedConfirmModal } from './ConfirmModal';
import { saveFileToDb, getBlobUrlForFileId } from '../lib/db';
import { AudioPlaybackState } from './AudioPlayer';
import { LayoutList, LayoutGrid, FileText, Play } from 'lucide-react';
import { Artwork } from './Artwork';
import { ReleaseDetailModal } from './ReleaseDetailModal';
import { loadViewPref, saveViewPref } from '../lib/view-prefs';

interface ReleasesViewProps {
  artistId: string;
  isReleasedFilter: boolean; // true = release, false = unreleased
  releases: Release[];
  onAddRelease: (release: Release, imageBlob?: File) => void;
  onUpdateRelease: (release: Release, imageBlob?: File) => void;
  onDeleteRelease: (id: string) => void;
  onPlayAudio: (audio: AudioPlaybackState) => void;
  customGenres: { [genre: string]: string[] };
  onAddCustomGenre: (genre: string, subGenre?: string) => void;
}

export function ReleasesView({
  artistId,
  isReleasedFilter,
  releases,
  onAddRelease,
  onUpdateRelease,
  onDeleteRelease,
  onPlayAudio,
  customGenres,
  onAddCustomGenre,
}: ReleasesViewProps) {
  // Persist view mode across page navigations. Key differs per filter so
  // released/unreleased can each remember their own view preference.
  const viewPrefKey = `releases.${isReleasedFilter ? 'released' : 'unreleased'}`;
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'normal'>(
    () => {
      const saved = loadViewPref(viewPrefKey, 'normal');
      if (saved === 'list' || saved === 'grid' || saved === 'normal') return saved;
      return 'normal';
    }
  );
  useEffect(() => {
    saveViewPref(viewPrefKey, viewMode);
  }, [viewPrefKey, viewMode]);

  const [isCreating, setIsCreating] = useState(false);
  const [editingRelease, setEditingRelease] = useState<Release | null>(null);
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);

  // Detail modal — opens when user clicks a release card in list/grid view
  const [detailRelease, setDetailRelease] = useState<Release | null>(null);

  // Modals
  const [confirmEditRelease, setConfirmEditRelease] = useState<Release | null>(null);
  const [confirmDeleteRelease, setConfirmDeleteRelease] = useState<Release | null>(null);

  // Filter releases for this artist and released/unreleased status
  const currentReleases = releases.filter(
    (r) => r.artistId === artistId && r.isReleased === isReleasedFilter
  );

  // Form State
  const [formType, setFormType] = useState<ReleaseType>('single');
  const [formTitle, setFormTitle] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formGenre, setFormGenre] = useState('');
  const [formSubGenre, setFormSubGenre] = useState('');
  const [formArtworkUrl, setFormArtworkUrl] = useState('');
  const [formArtworkFile, setFormArtworkFile] = useState<File | null>(null);
  const [formIsReleased, setFormIsReleased] = useState(isReleasedFilter);

  // Single specific
  const [formHasFeatures, setFormHasFeatures] = useState(false);
  const [formFeatureNames, setFormFeatureNames] = useState('');
  const [formBeatType, setFormBeatType] = useState('none');
  const [formBeatUrl, setFormBeatUrl] = useState('');
  const [formCredits, setFormCredits] = useState<CreditItem[]>([]);
  const [formMusicVideoDone, setFormMusicVideoDone] = useState(false);
  const [formMusicVideoUploaded, setFormMusicVideoUploaded] = useState(false);
  const [formMusicVideoKind, setFormMusicVideoKind] = useState('music video');

  // Album/EP specific
  const [formTracks, setFormTracks] = useState<TrackItem[]>([]);
  const [formTrackCountInput, setFormTrackCountInput] = useState('1');

  // Genre helpers
  const builtInGenreList = MAJOR_GENRES.map((g) => g.genre);
  const customGenreList = Object.keys(customGenres);
  const allGenres = Array.from(new Set([...builtInGenreList, ...customGenreList]));
  const availableSubGenres = formGenre ? getSubGenresForGenre(formGenre, customGenres) : [];

  const handleStartCreate = () => {
    setIsCreating(true);
    setEditingRelease(null);
    setFormType('single');
    setFormTitle('');
    setFormYear(new Date().getFullYear().toString());
    setFormGenre('');
    setFormSubGenre('');
    setFormArtworkUrl('');
    setFormArtworkFile(null);
    setFormIsReleased(isReleasedFilter);
    setFormHasFeatures(false);
    setFormFeatureNames('');
    setFormBeatType('none');
    setFormBeatUrl('');
    setFormCredits([
      {
        id: 'c1',
        role: 'lyricist/author',
        name: '',
        profileUrls: [''],
        email: '',
      },
      {
        id: 'c2',
        role: 'composer',
        name: '',
        profileUrls: [''],
        email: '',
      },
    ]);
    setFormMusicVideoDone(false);
    setFormMusicVideoUploaded(false);
    setFormMusicVideoKind('music video');
    setFormTracks([]);
    setFormTrackCountInput('1');
  };

  const handleStartEdit = (release: Release) => {
    setConfirmEditRelease(release);
  };

  const handleConfirmEdit = () => {
    if (!confirmEditRelease) return;
    const r = confirmEditRelease;
    setEditingRelease(r);
    setIsCreating(false);
    setFormType(r.type);
    setFormTitle(r.title);
    setFormYear(r.year || r.releaseDate || '');
    setFormGenre(r.genre);
    setFormSubGenre(r.subGenre);
    setFormArtworkUrl(r.artworkUrl || '');
    setFormArtworkFile(null);
    setFormIsReleased(r.isReleased);
    setFormHasFeatures(!!r.hasFeatures);
    setFormFeatureNames((r.featureNames || []).join(', '));
    setFormBeatType(r.beatType || 'none');
    setFormBeatUrl(r.beatUrl || '');
    setFormCredits(r.credits || []);
    setFormMusicVideoDone(!!r.musicVideoDone);
    setFormMusicVideoUploaded(!!r.musicVideoUploaded);
    setFormMusicVideoKind(r.musicVideoKind || 'music video');
    setFormTracks(r.tracks || []);
    setFormTrackCountInput(String(r.tracks?.length || 1));
    setConfirmEditRelease(null);
  };

  // Adjust track count slots
  const handleTrackCountChange = (countStr: string) => {
    setFormTrackCountInput(countStr);
    const count = parseInt(countStr, 10);
    if (!isNaN(count) && count >= 0 && count <= 999) {
      if (count > formTracks.length) {
        const added: TrackItem[] = [];
        for (let i = formTracks.length + 1; i <= count; i++) {
          added.push({
            id: 'trk_' + Date.now() + '_' + i,
            trackNumber: i,
            title: `track ${i}`,
          });
        }
        setFormTracks([...formTracks, ...added]);
      } else if (count < formTracks.length) {
        setFormTracks(formTracks.slice(0, count));
      }
    }
  };

  const handleAddSingleTrack = () => {
    const nextNum = formTracks.length + 1;
    const newTrk: TrackItem = {
      id: 'trk_' + Date.now() + '_' + nextNum,
      trackNumber: nextNum,
      title: `track ${nextNum}`,
    };
    const updated = [...formTracks, newTrk];
    setFormTracks(updated);
    setFormTrackCountInput(String(updated.length));
  };

  const handleRemoveTrack = (index: number) => {
    const updated = formTracks
      .filter((_, idx) => idx !== index)
      .map((t, idx) => ({ ...t, trackNumber: idx + 1 }));
    setFormTracks(updated);
    setFormTrackCountInput(String(updated.length));
  };

  const handleUpdateTrack = (index: number, updates: Partial<TrackItem>) => {
    const updated = [...formTracks];
    updated[index] = { ...updated[index], ...updates };
    setFormTracks(updated);
  };

  const handleTrackAudioUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileId = 'aud_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    await saveFileToDb(fileId, file, file.name);
    handleUpdateTrack(index, {
      audioFileId: fileId,
      audioFileName: file.name,
    });
  };

  const handleTrackArtworkUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileId = 'art_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    await saveFileToDb(fileId, file, file.name);
    handleUpdateTrack(index, {
      artworkFileId: fileId,
    });
  };

  // Credits helpers
  const handleAddCredit = () => {
    setFormCredits([
      ...formCredits,
      {
        id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        role: 'other credit',
        name: '',
        profileUrls: [''],
        email: '',
      },
    ]);
  };

  const handleUpdateCredit = (index: number, updates: Partial<CreditItem>) => {
    const updated = [...formCredits];
    updated[index] = { ...updated[index], ...updates };
    setFormCredits(updated);
  };

  const handleRemoveCredit = (index: number) => {
    setFormCredits(formCredits.filter((_, idx) => idx !== index));
  };

  // Form submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    let artworkFileId: string | undefined = editingRelease?.artworkFileId;
    if (formArtworkFile) {
      artworkFileId = 'art_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      await saveFileToDb(artworkFileId, formArtworkFile, formArtworkFile.name);
    }

    const featureNamesList = formHasFeatures
      ? formFeatureNames.split(',').map((f) => f.trim()).filter(Boolean)
      : [];

    const isSingle = formType === 'single';

    const releaseData: Release = {
      id: editingRelease
        ? editingRelease.id
        : 'rel_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      artistId,
      title: formTitle.trim(),
      type: formType,
      isReleased: formIsReleased,
      year: formYear.trim(),
      genre: formGenre.trim(),
      subGenre: formSubGenre.trim(),
      artworkUrl: formArtworkUrl.trim(),
      artworkFileId,
      hasFeatures: formHasFeatures,
      featureNames: featureNamesList,
      beatType: formBeatType,
      beatUrl: formBeatUrl.trim(),
      credits: formCredits,
      musicVideoDone: formMusicVideoDone,
      musicVideoUploaded: formMusicVideoUploaded,
      musicVideoKind: formMusicVideoKind,
      tracks: isSingle
        ? [
            {
              id: 'trk_single_' + Date.now(),
              trackNumber: 1,
              title: formTitle.trim(),
              artworkUrl: formArtworkUrl.trim(),
              artworkFileId,
              credits: formCredits,
              beatType: formBeatType,
              beatUrl: formBeatUrl.trim(),
            },
          ]
        : formTracks,
      trackCount: isSingle ? 1 : formTracks.length,
      createdAt: editingRelease ? editingRelease.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (editingRelease) {
      onUpdateRelease(releaseData, formArtworkFile || undefined);
    } else {
      onAddRelease(releaseData, formArtworkFile || undefined);
    }

    setIsCreating(false);
    setEditingRelease(null);
  };

  const playTrackAudio = async (track: TrackItem, releaseTitle: string) => {
    if (track.audioFileId) {
      const url = await getBlobUrlForFileId(track.audioFileId);
      if (url) {
        onPlayAudio({
          src: url,
          title: track.title,
          subTitle: releaseTitle,
        });
      }
    } else if (track.audioUrl) {
      onPlayAudio({
        src: track.audioUrl,
        title: track.title,
        subTitle: releaseTitle,
      });
    } else if (track.beatUrl) {
      onPlayAudio({
        src: track.beatUrl,
        title: track.title,
        subTitle: `beat: ${track.beatType || ''}`,
      });
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto p-3 text-xs">
      {/* Top Controls & View Switcher */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)] mb-3">
        <span className="font-semibold text-[var(--text)]">
          {isReleasedFilter ? 'Release' : 'Unreleased'}
        </span>

        {!isCreating && !editingRelease && (
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-[var(--border-light)] rounded-[2px] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1 rounded-[2px] cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                    : 'bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
                title="List view"
              >
                <LayoutList className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded-[2px] cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                    : 'bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('normal')}
                className={`p-1 rounded-[2px] cursor-pointer ${
                  viewMode === 'normal'
                    ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                    : 'bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
                title="Detailed view"
              >
                <FileText className="w-3 h-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleStartCreate}
              className="px-2 py-0.5 border border-[var(--border)] bg-[var(--bg)] rounded-[3px] text-[11px] text-[var(--text)] hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              + Add
            </button>
          </div>
        )}
      </div>

      {/* CREATE / EDIT FORM */}
      {(isCreating || editingRelease) && (
        <form onSubmit={handleFormSubmit} className="space-y-3 p-2 border border-[var(--border)] rounded-[3px] bg-[var(--bg-secondary)]">
          <div className="flex justify-between items-center pb-1 border-b border-[var(--border-light)]">
            <span className="font-semibold text-[var(--text)]">
              {editingRelease ? 'edit release' : 'new release'}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingRelease(null);
              }}
              className="text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer text-[11px]"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Type</label>
              <CustomDropdown
                value={formType}
                options={['single', 'album', 'ep', 'mixtape']}
                onChange={(val) => setFormType(val)}
                allowCustom
                emptyLabel="Select type"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Status</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setFormIsReleased(true)}
                  className={`flex-1 py-1 px-1 text-[11px] border rounded-[2px] cursor-pointer ${
                    formIsReleased
                      ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]'
                      : 'bg-[var(--bg)] text-[var(--text)] border-[var(--border-light)]'
                  }`}
                >
                  Released
                </button>
                <button
                  type="button"
                  onClick={() => setFormIsReleased(false)}
                  className={`flex-1 py-1 px-1 text-[11px] border rounded-[2px] cursor-pointer ${
                    !formIsReleased
                      ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]'
                      : 'bg-[var(--bg)] text-[var(--text)] border-[var(--border-light)]'
                  }`}
                >
                  Unreleased
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Title</label>
            <input
              type="text"
              required
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Year / date</label>
              <input
                type="text"
                value={formYear}
                onChange={(e) => setFormYear(e.target.value)}
                className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Genre</label>
              <CustomDropdown
                value={formGenre}
                options={allGenres}
                onChange={(val) => {
                  setFormGenre(val);
                  setFormSubGenre('');
                  if (!allGenres.includes(val)) onAddCustomGenre(val);
                }}
                allowCustom
                emptyLabel="Select"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Sub genre</label>
              <CustomDropdown
                value={formSubGenre}
                options={availableSubGenres}
                onChange={(val) => {
                  setFormSubGenre(val);
                  if (formGenre && !availableSubGenres.includes(val)) onAddCustomGenre(formGenre, val);
                }}
                allowCustom
                disabled={!formGenre}
                emptyLabel="Select"
              />
            </div>
          </div>

          {/* Artwork: CDN URL or local image upload */}
          <div className="border-t border-[var(--border-light)] pt-2 space-y-1">
            <label className="block text-[10px] text-[var(--text-muted)]">Artwork (cdn url or local file)</label>
            <input
              type="url"
              value={formArtworkUrl}
              onChange={(e) => setFormArtworkUrl(e.target.value)}
              className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
            />
            <div className="pt-0.5">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFormArtworkFile(e.target.files?.[0] || null)}
                className="text-[11px] text-[var(--text-muted)]"
              />
            </div>
          </div>

          {/* SINGLE SPECIFIC FIELDS */}
          {formType === 'single' ? (
            <div className="border-t border-[var(--border-light)] pt-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-muted)]">Features:</span>
                <button
                  type="button"
                  onClick={() => setFormHasFeatures(true)}
                  className={`px-2 py-0.5 border rounded-[2px] cursor-pointer ${
                    formHasFeatures
                      ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]'
                      : 'bg-[var(--bg)] text-[var(--text)] border-[var(--border-light)]'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setFormHasFeatures(false)}
                  className={`px-2 py-0.5 border rounded-[2px] cursor-pointer ${
                    !formHasFeatures
                      ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]'
                      : 'bg-[var(--bg)] text-[var(--text)] border-[var(--border-light)]'
                  }`}
                >
                  No
                </button>
              </div>

              {formHasFeatures && (
                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">
                    feature names (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formFeatureNames}
                    onChange={(e) => setFormFeatureNames(e.target.value)}
                    className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Beat / instrumental</label>
                  <CustomDropdown
                    value={formBeatType}
                    options={['type beat', 'custom produced', 'cdn url', 'bandlab', 'none']}
                    onChange={(val) => setFormBeatType(val)}
                    allowCustom
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Beat link / url</label>
                  <input
                    type="url"
                    value={formBeatUrl}
                    onChange={(e) => setFormBeatUrl(e.target.value)}
                    className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                  />
                </div>
              </div>

              {/* Music video */}
              <div className="p-1.5 border border-[var(--border-light)] rounded-[2px] space-y-1.5">
                <div className="text-[10px] font-medium text-[var(--text)]">Music video</div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formMusicVideoDone}
                      onChange={(e) => setFormMusicVideoDone(e.target.checked)}
                      className="accent-[var(--accent)]"
                    />
                    Done
                  </label>
                  <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formMusicVideoUploaded}
                      onChange={(e) => setFormMusicVideoUploaded(e.target.checked)}
                      className="accent-[var(--accent)]"
                    />
                    Uploaded
                  </label>
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Kind</label>
                  <CustomDropdown
                    value={formMusicVideoKind}
                    options={[
                      'visualiser',
                      'music video',
                      'video with artwork',
                      'official release',
                      'lyric video',
                    ]}
                    onChange={(val) => setFormMusicVideoKind(val)}
                    allowCustom
                  />
                </div>
              </div>
            </div>
          ) : (
            /* ALBUM / EP / MIXTAPE TRACKS */
            <div className="border-t border-[var(--border-light)] pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-medium text-[var(--text)]">Tracks:</span>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={formTrackCountInput}
                    onChange={(e) => handleTrackCountChange(e.target.value)}
                    className="w-14 border border-[var(--border-light)] p-0.5 text-center bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                  />
                  <span className="text-[10px] text-[var(--text-faint)]">Slots</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddSingleTrack}
                  className="text-[11px] underline text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                >
                  + Add track
                </button>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {formTracks.map((trk, idx) => (
                  <div
                    key={trk.id || idx}
                    className="p-1.5 border border-[var(--border-light)] rounded-[2px] bg-[var(--bg)] space-y-1"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-[10px] font-mono text-[var(--text-faint)] w-4">
                          {trk.trackNumber}.
                        </span>
                        <input
                          type="text"
                          value={trk.title}
                          onChange={(e) => handleUpdateTrack(idx, { title: e.target.value })}
                          className="flex-1 border border-[var(--border-light)] p-0.5 text-xs bg-[var(--bg)] text-[var(--text)] rounded-[2px]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTrack(idx)}
                        className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer ml-1"
                      >
                        x
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      <div>
                        <span className="text-[var(--text-muted)] block">audio file (mp3/wav/flac)</span>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={(e) => handleTrackAudioUpload(idx, e)}
                          className="text-[10px] text-[var(--text-muted)] w-full"
                        />
                        {trk.audioFileName && (
                          <span className="text-[9px] text-[var(--text)] truncate block">
                            {trk.audioFileName}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] block">Track artwork</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleTrackArtworkUpload(idx, e)}
                          className="text-[10px] text-[var(--text-muted)] w-full"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CREDITS SECTION */}
          <div className="border-t border-[var(--border-light)] pt-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[var(--text)]">Credits</span>
              <button
                type="button"
                onClick={handleAddCredit}
                className="text-[11px] underline text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              >
                + Add credit
              </button>
            </div>

            <div className="space-y-1.5">
              {formCredits.map((c, cIdx) => (
                <div key={c.id || cIdx} className="p-1.5 border border-[var(--border-light)] rounded-[2px] bg-[var(--bg)] space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="w-1/2">
                      <CustomDropdown
                        value={c.role}
                        options={[
                          'lyricist/author',
                          'composer',
                          'additional composer',
                          'producer',
                          'mixing engineer',
                          'mastering engineer',
                          'other credit',
                        ]}
                        onChange={(val) => handleUpdateCredit(cIdx, { role: val })}
                        allowCustom
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCredit(cIdx)}
                      className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                  <div>
                    <label className="block text-[9px] text-[var(--text-muted)]">Name</label>
                    <input
                      type="text"
                      value={c.name}
                      onChange={(e) => handleUpdateCredit(cIdx, { name: e.target.value })}
                      className="w-full border border-[var(--border-light)] p-0.5 text-xs bg-[var(--bg)] text-[var(--text)] rounded-[2px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <label className="block text-[9px] text-[var(--text-muted)]">Profile urls</label>
                      <input
                        type="text"
                        value={c.profileUrls?.[0] || ''}
                        onChange={(e) => handleUpdateCredit(cIdx, { profileUrls: [e.target.value] })}
                        className="w-full border border-[var(--border-light)] p-0.5 text-xs bg-[var(--bg)] text-[var(--text)] rounded-[2px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-[var(--text-muted)]">Email</label>
                      <input
                        type="email"
                        value={c.email || ''}
                        onChange={(e) => handleUpdateCredit(cIdx, { email: e.target.value })}
                        className="w-full border border-[var(--border-light)] p-0.5 text-xs bg-[var(--bg)] text-[var(--text)] rounded-[2px]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-1.5 bg-[var(--accent)] text-[var(--accent-text)] border border-[var(--border)] rounded-[3px] text-xs hover:bg-[var(--accent-hover)] cursor-pointer"
            >
              Save release
            </button>
          </div>
        </form>
      )}

      {/* RELEASES LIST / GRID / NORMAL */}
      {!isCreating && !editingRelease && currentReleases.length === 0 && (
        <div className="py-8 text-center text-[var(--text-faint)] text-xs">
          no {isReleasedFilter ? 'released' : 'unreleased'} music
        </div>
      )}

      {!isCreating && !editingRelease && currentReleases.length > 0 && (
        <div className="space-y-4">
          {/* 1. LIST VIEW */}
          {viewMode === 'list' && (
            <div className="divide-y divide-[var(--border-light)]">
              {currentReleases.map((rel) => (
                <div
                  key={rel.id}
                  className="py-2 flex items-center justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() => setDetailRelease(rel)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 cursor-pointer"
                  >
                    <Artwork
                      url={rel.artworkUrl}
                      fileId={rel.artworkFileId}
                      alt={rel.title}
                      sizeClassName="w-10 h-10"
                      iconClassName="w-3.5 h-3.5"
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--text)] truncate">{rel.title}</div>
                      <div className="text-[11px] text-[var(--text-muted)] truncate">
                        {rel.type}
                        {rel.year ? ` · ${rel.year}` : ''}
                        {rel.genre ? ` · ${rel.genre}` : ''}
                        {rel.tracks && rel.tracks.length > 0 ? ` · ${rel.tracks.length} tracks` : ''}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(rel)}
                      className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteRelease(rel)}
                      className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* GRID VIEW (1:1 square image display) */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 gap-2">
              {currentReleases.map((rel) => (
                <div
                  key={rel.id}
                  className="border border-[var(--border-light)] rounded-[3px] p-2 space-y-1.5 bg-[var(--bg)]"
                >
                  {/* 1:1 Square artwork — clickable to open detail */}
                  <button
                    type="button"
                    onClick={() => setDetailRelease(rel)}
                    className="block w-full cursor-pointer hover:opacity-90"
                  >
                    <Artwork
                      url={rel.artworkUrl}
                      fileId={rel.artworkFileId}
                      alt={rel.title}
                      sizeClassName="w-full"
                      containerClassName="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[2px]"
                      iconClassName="w-6 h-6"
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailRelease(rel)}
                    className="min-w-0 block w-full text-left cursor-pointer hover:opacity-80"
                  >
                    <div className="font-medium text-[var(--text)] truncate text-xs">{rel.title}</div>
                    <div className="text-[10px] text-[var(--text-muted)] truncate">
                      {rel.type} {rel.year ? `(${rel.year})` : ''}
                    </div>
                  </button>

                  <div className="flex items-center justify-between pt-1 border-t border-[var(--border-light)]">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(rel)}
                      className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteRelease(rel)}
                      className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 3. NORMAL (DETAILED) VIEW */}
          {viewMode === 'normal' && (
            <div className="space-y-6">
              {currentReleases.map((rel) => (
                <article
                  key={rel.id}
                  className="border-b border-[var(--border-light)] pb-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailRelease(rel)}
                      className="flex items-start gap-2.5 text-left cursor-pointer hover:opacity-80 min-w-0 flex-1"
                    >
                      {/* 1:1 Square artwork (CDN URL or local file) */}
                      <Artwork
                        url={rel.artworkUrl}
                        fileId={rel.artworkFileId}
                        alt={rel.title}
                        sizeClassName="w-16 h-16"
                        iconClassName="w-6 h-6"
                      />

                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[var(--text)] leading-tight">{rel.title}</h3>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          <span>{rel.type}</span>
                          {rel.year && <span> · {rel.year}</span>}
                          <span> · {rel.isReleased ? 'Released' : 'Unreleased'}</span>
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {rel.genre} {rel.subGenre ? `(${rel.subGenre})` : ''}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(rel)}
                        className="px-2 py-0.5 border border-[var(--border)] bg-[var(--bg)] rounded-[2px] text-[10px] text-[var(--text)] hover:bg-[var(--bg-hover)] cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteRelease(rel)}
                        className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Single info */}
                  {rel.type === 'single' && (
                    <div className="space-y-1 text-[11px] text-[var(--text-muted)] pl-1 border-l-2 border-[var(--border)]">
                      {rel.hasFeatures && rel.featureNames && rel.featureNames.length > 0 && (
                        <div>
                          <span className="font-medium text-[var(--text)]">Features: </span>
                          {rel.featureNames.join(', ')}
                        </div>
                      )}
                      {rel.beatType && rel.beatType !== 'none' && (
                        <div>
                          <span className="font-medium text-[var(--text)]">Beat: </span>
                          {rel.beatType}
                          {rel.beatUrl && (
                            <span className="ml-1">
                              (
                              <a
                                href={rel.beatUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="underline"
                              >
                                Link
                              </a>
                              )
                            </span>
                          )}
                        </div>
                      )}
                      {rel.musicVideoKind && (
                        <div>
                          <span className="font-medium text-[var(--text)]">Music video: </span>
                          {rel.musicVideoKind}
                          <span className="text-[var(--text-muted)] ml-1">
                            [{rel.musicVideoDone ? 'done' : 'in progress'},{' '}
                            {rel.musicVideoUploaded ? 'uploaded' : 'not uploaded'}]
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Album / EP Tracks */}
                  {rel.tracks && rel.tracks.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="text-[11px] font-medium text-[var(--text)]">Tracks ({rel.tracks.length})</div>
                      <div className="divide-y divide-[var(--border-light)]">
                        {rel.tracks.map((t) => (
                          <div
                            key={t.id}
                            className="py-1 flex items-center justify-between text-[11px] gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {/* Per-track artwork thumbnail (if uploaded) */}
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
                                onClick={() => playTrackAudio(t, rel.title)}
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
                  {rel.credits && rel.credits.length > 0 && (
                    <div className="pt-1 text-[11px] space-y-0.5">
                      <div className="font-medium text-[var(--text)]">Credits</div>
                      {rel.credits.map((c) => (
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
                                className="underline"
                              >
                                Profile
                              </a>
                              )
                            </span>
                          )}
                          {c.email && <span className="text-[var(--text-faint)] ml-1">&lt;{c.email}&gt;</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Button Confirmation for Editing Release (Yes on left, No on right) */}
      <ButtonConfirmModal
        isOpen={!!confirmEditRelease}
        title={`edit "${confirmEditRelease?.title}"?`}
        onConfirm={handleConfirmEdit}
        onCancel={() => setConfirmEditRelease(null)}
      />

      {/* Typed Confirmation for Deleting Release */}
      <TypedConfirmModal
        isOpen={!!confirmDeleteRelease}
        title={confirmDeleteRelease ? `Delete "${confirmDeleteRelease.title}"` : ''}
        expectedText="Delete"
        onConfirm={() => {
          if (confirmDeleteRelease) {
            onDeleteRelease(confirmDeleteRelease.id);
            setConfirmDeleteRelease(null);
          }
        }}
        onCancel={() => setConfirmDeleteRelease(null)}
      />

      {/* Release detail modal — opens when a release card is clicked in list/grid/normal views */}
      <ReleaseDetailModal
        release={detailRelease}
        onClose={() => setDetailRelease(null)}
        onPlayAudio={onPlayAudio}
      />
    </div>
  );
}
