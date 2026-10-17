'use client';

import React, { useState } from 'react';
import {
  TypeBeatSample,
  ArtworkIdea,
  MusicVideoIdea,
  CustomMiscEntry,
  MoodboardFolder,
  MoodboardItem,
} from '../lib/types';
import { ButtonConfirmModal, TypedConfirmModal } from './ConfirmModal';
import { CustomDropdown } from './CustomDropdown';
import { Play, Folder, Film, Lightbulb, Music } from 'lucide-react';
import { AudioPlaybackState } from './AudioPlayer';

interface MiscViewProps {
  typeBeats: TypeBeatSample[];
  artworkIdeas: ArtworkIdea[];
  videoIdeas: MusicVideoIdea[];
  miscCustom: CustomMiscEntry[];
  moodboardFolders: MoodboardFolder[];
  moodboardItems: MoodboardItem[];
  onAddBeat: (b: TypeBeatSample) => void;
  onDeleteBeat: (id: string) => void;
  onAddArtworkIdea: (a: ArtworkIdea) => void;
  onDeleteArtworkIdea: (id: string) => void;
  onAddVideoIdea: (v: MusicVideoIdea) => void;
  onDeleteVideoIdea: (id: string) => void;
  onAddCustomEntry: (c: CustomMiscEntry) => void;
  onDeleteCustomEntry: (id: string) => void;
  onAddFolder: (f: MoodboardFolder) => void;
  onDeleteFolder: (id: string) => void;
  onAddItemToFolder: (item: MoodboardItem) => void;
  onDeleteItemFromFolder: (id: string) => void;
  onPlayAudio: (audio: AudioPlaybackState) => void;
}

type MiscTab = 'beats' | 'ideas' | 'moodboard';

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11
      ? `https://www.youtube-nocookie.com/embed/${match[2]}`
      : null;
  } catch {
    return null;
  }
}

export function MiscView({
  typeBeats,
  artworkIdeas,
  videoIdeas,
  miscCustom,
  moodboardFolders,
  moodboardItems,
  onAddBeat,
  onDeleteBeat,
  onAddArtworkIdea,
  onDeleteArtworkIdea,
  onAddVideoIdea,
  onDeleteVideoIdea,
  onAddCustomEntry,
  onDeleteCustomEntry,
  onAddFolder,
  onDeleteFolder,
  onAddItemToFolder,
  onDeleteItemFromFolder,
  onPlayAudio,
}: MiscViewProps) {
  const [tab, setTab] = useState<MiscTab>('beats');

  // Beats form
  const [isAddingBeat, setIsAddingBeat] = useState(false);
  const [beatTitle, setBeatTitle] = useState('');
  const [beatUrl, setBeatUrl] = useState('');
  const [beatArtworkUrl, setBeatArtworkUrl] = useState('');
  const [beatColorTag, setBeatColorTag] = useState('#ff3b30'); // The only place with color!
  const [beatUseColor, setBeatUseColor] = useState(true);
  const [beatLyricsStatus, setBeatLyricsStatus] = useState<'available' | 'not available'>('not available');
  const [beatLyricsText, setBeatLyricsText] = useState('');
  const [beatForArtist, setBeatForArtist] = useState('');

  // Ideas form
  const [ideaType, setIdeaType] = useState<'artwork' | 'video' | 'custom'>('artwork');
  const [isAddingIdea, setIsAddingIdea] = useState(false);
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaUrl, setIdeaUrl] = useState('');
  const [ideaNotes, setIdeaNotes] = useState('');

  // Moodboard state
  const [activeFolderId, setActiveFolderId] = useState<string | null>(
    moodboardFolders[0]?.id || null
  );
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemTitle, setItemTitle] = useState('');
  const [itemType, setItemType] = useState<'youtube' | 'video' | 'image' | 'audio' | 'link' | 'note'>('youtube');
  const [itemUrl, setItemUrl] = useState('');
  const [itemNotes, setItemNotes] = useState('');

  // Deletion modals
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    type: 'beat' | 'artworkIdea' | 'videoIdea' | 'custom' | 'folder' | 'item';
  } | null>(null);

  const handleSaveBeat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!beatTitle.trim() || !beatUrl.trim()) return;
    const newBeat: TypeBeatSample = {
      id: 'beat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title: beatTitle.trim(),
      url: beatUrl.trim(),
      artworkUrl: !beatUseColor ? beatArtworkUrl.trim() : undefined,
      colorTag: beatUseColor ? beatColorTag : undefined,
      lyricsStatus: beatLyricsStatus,
      lyricsText: beatLyricsStatus === 'available' ? beatLyricsText : undefined,
      forArtist: beatForArtist.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    onAddBeat(newBeat);
    setIsAddingBeat(false);
    setBeatTitle('');
    setBeatUrl('');
    setBeatLyricsText('');
    setBeatForArtist('');
  };

  const handleSaveIdea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ideaTitle.trim()) return;

    if (ideaType === 'artwork') {
      onAddArtworkIdea({
        id: 'art_idea_' + Date.now(),
        title: ideaTitle.trim(),
        url: ideaUrl.trim(),
        notes: ideaNotes.trim(),
        createdAt: new Date().toISOString(),
      });
    } else if (ideaType === 'video') {
      onAddVideoIdea({
        id: 'vid_idea_' + Date.now(),
        title: ideaTitle.trim(),
        concept: ideaNotes.trim(),
        referenceUrl: ideaUrl.trim(),
        createdAt: new Date().toISOString(),
      });
    } else {
      onAddCustomEntry({
        id: 'misc_' + Date.now(),
        title: ideaTitle.trim(),
        url: ideaUrl.trim(),
        notes: ideaNotes.trim(),
        createdAt: new Date().toISOString(),
      });
    }

    setIsAddingIdea(false);
    setIdeaTitle('');
    setIdeaUrl('');
    setIdeaNotes('');
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const newFolder: MoodboardFolder = {
      id: 'fld_' + Date.now(),
      name: newFolderName.trim(),
      createdAt: new Date().toISOString(),
    };
    onAddFolder(newFolder);
    setActiveFolderId(newFolder.id);
    setIsAddingFolder(false);
    setNewFolderName('');
  };

  const handleSaveMoodboardItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFolderId || !itemTitle.trim()) return;
    const newItem: MoodboardItem = {
      id: 'mb_item_' + Date.now(),
      folderId: activeFolderId,
      title: itemTitle.trim(),
      type: itemType,
      url: itemUrl.trim(),
      notes: itemNotes.trim(),
      createdAt: new Date().toISOString(),
    };
    onAddItemToFolder(newItem);
    setIsAddingItem(false);
    setItemTitle('');
    setItemUrl('');
    setItemNotes('');
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    switch (deleteTarget.type) {
      case 'beat':
        onDeleteBeat(deleteTarget.id);
        break;
      case 'artworkIdea':
        onDeleteArtworkIdea(deleteTarget.id);
        break;
      case 'videoIdea':
        onDeleteVideoIdea(deleteTarget.id);
        break;
      case 'custom':
        onDeleteCustomEntry(deleteTarget.id);
        break;
      case 'folder':
        onDeleteFolder(deleteTarget.id);
        if (activeFolderId === deleteTarget.id) setActiveFolderId(null);
        break;
      case 'item':
        onDeleteItemFromFolder(deleteTarget.id);
        break;
    }
    setDeleteTarget(null);
  };

  return (
    <div className="w-full max-w-lg mx-auto p-3 text-xs space-y-3">
      {/* Top Nav for Miscellaneous */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)]">
        <span className="font-semibold text-[var(--text)]">Miscellaneous</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab('beats')}
            className={`px-1.5 py-0.5 rounded-[2px] border cursor-pointer text-[11px] ${
              tab === 'beats'
                ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]'
                : 'bg-[var(--bg)] text-[var(--text-muted)] border-[var(--border-light)]'
            }`}
          >
            Type beats
          </button>
          <button
            type="button"
            onClick={() => setTab('ideas')}
            className={`px-1.5 py-0.5 rounded-[2px] border cursor-pointer text-[11px] ${
              tab === 'ideas'
                ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]'
                : 'bg-[var(--bg)] text-[var(--text-muted)] border-[var(--border-light)]'
            }`}
          >
            Ideas
          </button>
          <button
            type="button"
            onClick={() => setTab('moodboard')}
            className={`px-1.5 py-0.5 rounded-[2px] border cursor-pointer text-[11px] ${
              tab === 'moodboard'
                ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]'
                : 'bg-[var(--bg)] text-[var(--text-muted)] border-[var(--border-light)]'
            }`}
          >
            Mood board
          </button>
        </div>
      </div>

      {/* 1. TYPE BEATS / INSTRUMENTALS / SAMPLES */}
      {tab === 'beats' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-muted)]">Shared type beats &amp; samples</span>
            {!isAddingBeat && (
              <button
                type="button"
                onClick={() => setIsAddingBeat(true)}
                className="px-2 py-0.5 border border-[var(--border)] bg-[var(--bg)] rounded-[3px] text-[10px] text-[var(--text)] hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                + Add beat
              </button>
            )}
          </div>

          {isAddingBeat && (
            <form onSubmit={handleSaveBeat} className="p-2 border border-[var(--border)] rounded-[3px] space-y-2 bg-[var(--bg-secondary)]">
              <div className="flex justify-between items-center text-[11px] font-medium text-[var(--text)]">
                <span>New type beat / sample</span>
                <button
                  type="button"
                  onClick={() => setIsAddingBeat(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Title</label>
                <input
                  type="text"
                  required
                  value={beatTitle}
                  onChange={(e) => setBeatTitle(e.target.value)}
                  className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Audio / streaming url</label>
                <input
                  type="url"
                  required
                  value={beatUrl}
                  onChange={(e) => setBeatUrl(e.target.value)}
                  className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                />
              </div>

              {/* Artwork or 1:1 Color tag */}
              <div className="p-1.5 border border-[var(--border-light)] rounded-[2px] space-y-1.5 bg-[var(--bg)]">
                <div className="text-[10px] font-medium text-[var(--text)]">Visual tag (artwork or 1:1 colour tag)</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBeatUseColor(true)}
                    className={`px-2 py-0.5 border rounded-[2px] cursor-pointer text-[10px] ${
                      beatUseColor ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]' : 'bg-[var(--bg)] text-[var(--text)] border-[var(--border-light)]'
                    }`}
                  >
                    1:1 colour tag
                  </button>
                  <button
                    type="button"
                    onClick={() => setBeatUseColor(false)}
                    className={`px-2 py-0.5 border rounded-[2px] cursor-pointer text-[10px] ${
                      !beatUseColor ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]' : 'bg-[var(--bg)] text-[var(--text)] border-[var(--border-light)]'
                    }`}
                  >
                    Artwork url
                  </button>
                </div>

                {beatUseColor ? (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="color"
                      value={beatColorTag}
                      onChange={(e) => setBeatColorTag(e.target.value)}
                      className="w-8 h-8 rounded-[2px] border border-[var(--border-light)] cursor-pointer p-0"
                    />
                    <span className="text-[10px] text-[var(--text-muted)]">
                      chosen colour tag: {beatColorTag} (only place with colour in app)
                    </span>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[9px] text-[var(--text-muted)] mb-0.5">Artwork url</label>
                    <input
                      type="url"
                      value={beatArtworkUrl}
                      onChange={(e) => setBeatArtworkUrl(e.target.value)}
                      className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Lyrics status</label>
                  <CustomDropdown
                    value={beatLyricsStatus}
                    options={['not available', 'available']}
                    onChange={(val) => setBeatLyricsStatus(val as any)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">For whom (pseudonymous artist)</label>
                  <input
                    type="text"
                    value={beatForArtist}
                    onChange={(e) => setBeatForArtist(e.target.value)}
                    className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                  />
                </div>
              </div>

              {beatLyricsStatus === 'available' && (
                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Lyrics text</label>
                  <textarea
                    rows={2}
                    value={beatLyricsText}
                    onChange={(e) => setBeatLyricsText(e.target.value)}
                    className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-1 bg-[var(--accent)] text-[var(--accent-text)] border border-[var(--border)] rounded-[3px] text-xs hover:bg-[var(--accent-hover)] cursor-pointer"
              >
                Save beat
              </button>
            </form>
          )}

          {typeBeats.length === 0 && !isAddingBeat && (
            <div className="py-6 text-center text-[var(--text-faint)]">No type beats or samples collected</div>
          )}

          <div className="divide-y divide-[var(--border-light)]">
            {typeBeats.map((b) => (
              <div key={b.id} className="py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {/* 1:1 Visual Tag (Color Tag OR Artwork) */}
                  {b.colorTag ? (
                    <div
                      style={{ backgroundColor: b.colorTag }}
                      className="w-7 h-7 aspect-square rounded-[2px] shrink-0 border border-black/20"
                    />
                  ) : b.artworkUrl ? (
                    <img
                      src={b.artworkUrl}
                      alt={b.title}
                      className="w-7 h-7 aspect-square object-cover rounded-[2px] shrink-0 border border-[var(--border-light)]"
                    />
                  ) : (
                    <div className="w-7 h-7 aspect-square bg-[var(--bg-hover)] rounded-[2px] shrink-0 flex items-center justify-center">
                      <Music className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="font-medium text-[var(--text)] truncate">{b.title}</div>
                    <div className="text-[10px] text-[var(--text-muted)] truncate">
                      {b.forArtist ? `for: ${b.forArtist} · ` : ''}lyrics: {b.lyricsStatus}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onPlayAudio({ src: b.url, title: b.title, subTitle: b.forArtist || 'Sample' })}
                    className="p-1 border border-[var(--border)] rounded-[2px] hover:bg-[var(--bg-hover)] cursor-pointer"
                    title="Play sample"
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ id: b.id, name: b.title, type: 'beat' })}
                    className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer ml-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. IDEAS: ARTWORK, MUSIC VIDEO, CUSTOM */}
      {tab === 'ideas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setIdeaType('artwork')}
                className={`px-1.5 py-0.5 rounded-[2px] cursor-pointer ${
                  ideaType === 'artwork' ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                Artwork ideas
              </button>
              <button
                type="button"
                onClick={() => setIdeaType('video')}
                className={`px-1.5 py-0.5 rounded-[2px] cursor-pointer ${
                  ideaType === 'video' ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                Music videos
              </button>
              <button
                type="button"
                onClick={() => setIdeaType('custom')}
                className={`px-1.5 py-0.5 rounded-[2px] cursor-pointer ${
                  ideaType === 'custom' ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                Custom entries
              </button>
            </div>
            {!isAddingIdea && (
              <button
                type="button"
                onClick={() => setIsAddingIdea(true)}
                className="px-2 py-0.5 border border-[var(--border)] bg-[var(--bg)] rounded-[3px] text-[10px] text-[var(--text)] hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                + add
              </button>
            )}
          </div>

          {isAddingIdea && (
            <form onSubmit={handleSaveIdea} className="p-2 border border-[var(--border)] rounded-[3px] space-y-2 bg-[var(--bg-secondary)]">
              <div className="flex justify-between items-center text-[11px] font-medium text-[var(--text)]">
                <span>new {ideaType} entry</span>
                <button
                  type="button"
                  onClick={() => setIsAddingIdea(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Title</label>
                <input
                  type="text"
                  required
                  value={ideaTitle}
                  onChange={(e) => setIdeaTitle(e.target.value)}
                  className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Url / reference link</label>
                <input
                  type="url"
                  value={ideaUrl}
                  onChange={(e) => setIdeaUrl(e.target.value)}
                  className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Notes / concept</label>
                <textarea
                  rows={2}
                  value={ideaNotes}
                  onChange={(e) => setIdeaNotes(e.target.value)}
                  className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-1 bg-[var(--accent)] text-[var(--accent-text)] border border-[var(--border)] rounded-[3px] text-xs hover:bg-[var(--accent-hover)] cursor-pointer"
              >
                Save
              </button>
            </form>
          )}

          {/* List ideas based on selected sub-type */}
          {ideaType === 'artwork' && (
            <div className="divide-y divide-[var(--border-light)]">
              {artworkIdeas.length === 0 && !isAddingIdea && (
                <div className="py-6 text-center text-[var(--text-faint)]">No artwork ideas</div>
              )}
              {artworkIdeas.map((ai) => (
                <div key={ai.id} className="py-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-[var(--text)]">{ai.title}</div>
                    {ai.url && (
                      <a href={ai.url} target="_blank" rel="noreferrer" className="text-[10px] text-[var(--text-muted)] underline">
                        {ai.url}
                      </a>
                    )}
                    {ai.notes && <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{ai.notes}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ id: ai.id, name: ai.title, type: 'artworkIdea' })}
                    className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          {ideaType === 'video' && (
            <div className="divide-y divide-[var(--border-light)]">
              {videoIdeas.length === 0 && !isAddingIdea && (
                <div className="py-6 text-center text-[var(--text-faint)]">No video ideas</div>
              )}
              {videoIdeas.map((vi) => (
                <div key={vi.id} className="py-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-[var(--text)]">{vi.title}</div>
                    {vi.referenceUrl && (
                      <a href={vi.referenceUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[var(--text-muted)] underline">
                        {vi.referenceUrl}
                      </a>
                    )}
                    {vi.concept && <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{vi.concept}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ id: vi.id, name: vi.title, type: 'videoIdea' })}
                    className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          {ideaType === 'custom' && (
            <div className="divide-y divide-[var(--border-light)]">
              {miscCustom.length === 0 && !isAddingIdea && (
                <div className="py-6 text-center text-[var(--text-faint)]">No custom entries</div>
              )}
              {miscCustom.map((ci) => (
                <div key={ci.id} className="py-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-[var(--text)]">{ci.title}</div>
                    {ci.url && (
                      <a href={ci.url} target="_blank" rel="noreferrer" className="text-[10px] text-[var(--text-muted)] underline">
                        {ci.url}
                      </a>
                    )}
                    {ci.notes && <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{ci.notes}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ id: ci.id, name: ci.title, type: 'custom' })}
                    className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. INSPIRATION / MOOD BOARD */}
      {tab === 'moodboard' && (
        <div className="space-y-3">
          {/* Folders row */}
          <div className="flex items-center justify-between pb-1 border-b border-[var(--border-light)]">
            <span className="text-[11px] font-medium text-[var(--text)]">Folders:</span>
            {!isAddingFolder && (
              <button
                type="button"
                onClick={() => setIsAddingFolder(true)}
                className="text-[10px] underline text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              >
                + new folder
              </button>
            )}
          </div>

          {isAddingFolder && (
            <form onSubmit={handleCreateFolder} className="flex gap-1 py-1">
              <input
                type="text"
                required
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
                className="flex-1 border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
              />
              <button
                type="submit"
                className="px-2 py-0.5 bg-[var(--accent)] text-[var(--accent-text)] text-xs rounded-[2px] cursor-pointer"
              >
                Ok
              </button>
              <button
                type="button"
                onClick={() => setIsAddingFolder(false)}
                className="px-1.5 py-0.5 border border-[var(--border-light)] text-[var(--text-muted)] text-xs rounded-[2px] cursor-pointer"
              >
                x
              </button>
            </form>
          )}

          {/* Folder tabs */}
          <div className="flex flex-wrap gap-1">
            {moodboardFolders.map((f) => (
              <div key={f.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setActiveFolderId(f.id)}
                  className={`px-2 py-1 text-xs rounded-[2px] border cursor-pointer ${
                    activeFolderId === f.id
                      ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]'
                      : 'bg-[var(--bg)] text-[var(--text-muted)] border-[var(--border-light)] hover:border-[var(--border-light)]'
                  }`}
                >
                  {f.name}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget({ id: f.id, name: f.name, type: 'folder' })}
                  className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] ml-0.5 p-0.5"
                  title="Delete folder"
                >
                  x
                </button>
              </div>
            ))}
          </div>

          {/* Items inside active folder */}
          {activeFolderId && (
            <div className="pt-2 border-t border-[var(--border-light)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--text)]">
                  items in {moodboardFolders.find((f) => f.id === activeFolderId)?.name}
                </span>
                {!isAddingItem && (
                  <button
                    type="button"
                    onClick={() => setIsAddingItem(true)}
                    className="px-2 py-0.5 border border-[var(--border)] bg-[var(--bg)] rounded-[3px] text-[10px] text-[var(--text)] hover:bg-[var(--bg-hover)] cursor-pointer"
                  >
                    + add item
                  </button>
                )}
              </div>

              {isAddingItem && (
                <form onSubmit={handleSaveMoodboardItem} className="p-2 border border-[var(--border)] rounded-[3px] space-y-2 bg-[var(--bg-secondary)]">
                  <div className="flex justify-between items-center text-[11px] font-medium text-[var(--text)]">
                    <span>Add to folder</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingItem(false)}
                      className="text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Title</label>
                    <input
                      type="text"
                      required
                      value={itemTitle}
                      onChange={(e) => setItemTitle(e.target.value)}
                      className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Type</label>
                    <CustomDropdown
                      value={itemType}
                      options={['youtube', 'video', 'image', 'audio', 'link', 'note']}
                      onChange={(val) => setItemType(val as any)}
                    />
                  </div>

                  {itemType !== 'note' && (
                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">
                        {itemType === 'youtube' ? 'youtube url' : 'media / link url'}
                      </label>
                      <input
                        type="url"
                        required
                        value={itemUrl}
                        onChange={(e) => setItemUrl(e.target.value)}
                        className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Notes</label>
                    <textarea
                      rows={2}
                      value={itemNotes}
                      onChange={(e) => setItemNotes(e.target.value)}
                      className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-1 bg-[var(--accent)] text-[var(--accent-text)] border border-[var(--border)] rounded-[3px] text-xs hover:bg-[var(--accent-hover)] cursor-pointer"
                  >
                    Save item
                  </button>
                </form>
              )}

              {/* Items display */}
              <div className="space-y-3">
                {moodboardItems
                  .filter((it) => it.folderId === activeFolderId)
                  .map((it) => {
                    const ytEmbed = it.type === 'youtube' ? getYouTubeEmbedUrl(it.url) : null;
                    return (
                      <div key={it.id} className="p-2 border border-[var(--border-light)] rounded-[3px] bg-[var(--bg)] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-[var(--text)]">{it.title}</span>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: it.id, name: it.title, type: 'item' })}
                            className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>

                        {/* YouTube Embed without problems */}
                        {ytEmbed && (
                          <div className="aspect-video w-full bg-black rounded-[2px] overflow-hidden">
                            <iframe
                              src={ytEmbed}
                              title={it.title}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="w-full h-full border-0"
                            />
                          </div>
                        )}

                        {/* CDN Video */}
                        {it.type === 'video' && it.url && (
                          <div className="aspect-video w-full bg-black rounded-[2px] overflow-hidden">
                            <video
                              src={it.url}
                              controls
                              className="w-full h-full"
                            />
                          </div>
                        )}

                        {/* Image */}
                        {it.type === 'image' && it.url && (
                          <div className="aspect-square max-w-[200px] bg-[var(--bg-hover)] rounded-[2px] overflow-hidden border border-[var(--border-light)]">
                            <img src={it.url} alt={it.title} className="w-full h-full object-cover" />
                          </div>
                        )}

                        {/* Audio sample */}
                        {it.type === 'audio' && it.url && (
                          <audio src={it.url} controls className="w-full h-8" />
                        )}

                        {/* Link */}
                        {it.type === 'link' && it.url && (
                          <a href={it.url} target="_blank" rel="noreferrer" className="text-[11px] underline text-[var(--text-muted)] block truncate">
                            {it.url}
                          </a>
                        )}

                        {it.notes && (
                          <div className="text-[11px] text-[var(--text-muted)]">{it.notes}</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Typed Confirmation for Deleting Target */}
      <TypedConfirmModal
        isOpen={!!deleteTarget}
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : ''}
        expectedText="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
