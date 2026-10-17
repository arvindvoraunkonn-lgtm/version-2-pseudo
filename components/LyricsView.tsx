'use client';

import React, { useState, useRef, useEffect } from 'react';
import { LyricsDocument } from '../lib/types';
import { ButtonConfirmModal, TypedConfirmModal } from './ConfirmModal';
import { MarkdownPreview } from './MarkdownPreview';

interface LyricsViewProps {
  artistId: string;
  lyricsList: LyricsDocument[];
  onAddLyrics: (lyrics: LyricsDocument) => void;
  onUpdateLyrics: (lyrics: LyricsDocument) => void;
  onDeleteLyrics: (id: string) => void;
}

const STRUCTURE_TAGS = [
  'Verse',
  'Verse 1',
  'Verse 2',
  'Pre-chorus',
  'Chorus',
  'Hook',
  'Bridge',
  'Intro',
  'Outro',
  'Instrumental',
  'Breakdown',
  'Drop',
  'Refrain',
];

export function LyricsView({
  artistId,
  lyricsList,
  onAddLyrics,
  onUpdateLyrics,
  onDeleteLyrics,
}: LyricsViewProps) {
  const [selectedLyrics, setSelectedLyrics] = useState<LyricsDocument | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Modals
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<LyricsDocument | null>(null);

  // Form states
  const [fileName, setFileName] = useState('');
  const [lyricsContent, setLyricsContent] = useState('');

  // Slash menu state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashCursorPos, setSlashCursorPos] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Floating slash menu position (draggable). Defaults to top-center.
  const [slashMenuPos, setSlashMenuPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [slashMenuDragging, setSlashMenuDragging] = useState(false);
  const slashMenuDragStart = useRef<{ x: number; y: number; ox: number; oy: number }>({
    x: 0,
    y: 0,
    ox: 0,
    oy: 0,
  });

  // Write mode: 'edit' = textarea only, 'split' = editor + live preview
  const [writeMode, setWriteMode] = useState<'edit' | 'split'>('edit');

  const currentLyrics = lyricsList.filter((l) => l.artistId === artistId);

  const handleStartCreate = () => {
    setFileName('new_lyrics.txt');
    setLyricsContent('');
    setSelectedLyrics(null);
    setIsCreating(true);
    setIsEditing(true); // new files open directly to write
  };

  const handleOpenDoc = (doc: LyricsDocument) => {
    setSelectedLyrics(doc);
    setFileName(doc.fileName);
    setLyricsContent(doc.lyrics);
    setIsEditing(false); // opens in view mode first!
    setIsCreating(false);
  };

  const handleRequestEdit = () => {
    setShowEditConfirm(true);
  };

  const handleConfirmEdit = () => {
    setShowEditConfirm(false);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!fileName.trim()) return;

    if (isCreating || !selectedLyrics) {
      const newDoc: LyricsDocument = {
        id: 'lyr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        artistId,
        fileName: fileName.trim(),
        lyrics: lyricsContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onAddLyrics(newDoc);
      setSelectedLyrics(newDoc);
    } else {
      const updated: LyricsDocument = {
        ...selectedLyrics,
        fileName: fileName.trim(),
        lyrics: lyricsContent,
        updatedAt: new Date().toISOString(),
      };
      onUpdateLyrics(updated);
      setSelectedLyrics(updated);
    }

    setIsEditing(false);
    setIsCreating(false);
  };

  // Slash menu handler
  const handleLyricsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setLyricsContent(val);

    // check if user just typed '/'
    if (pos > 0 && val[pos - 1] === '/') {
      setShowSlashMenu(true);
      setSlashCursorPos(pos - 1);
    } else {
      setShowSlashMenu(false);
      setSlashCursorPos(null);
    }
  };

  const insertStructureTag = (tag: string) => {
    if (slashCursorPos === null) return;
    const before = lyricsContent.slice(0, slashCursorPos);
    const after = lyricsContent.slice(slashCursorPos + 1);
    const tagText = `[${tag}]\n`;
    const newContent = before + tagText + after;
    setLyricsContent(newContent);
    setShowSlashMenu(false);
    setSlashCursorPos(null);

    // Focus back on textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const nextPos = before.length + tagText.length;
        textareaRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 0);
  };

  // FULL SCREEN WRITING MODE (editing/creating)
  if (isEditing) {
    // Drag handlers for the floating slash menu
    const startSlashDrag = (clientX: number, clientY: number) => {
      setSlashMenuDragging(true);
      slashMenuDragStart.current = {
        x: clientX,
        y: clientY,
        ox: slashMenuPos.x,
        oy: slashMenuPos.y,
      };
    };
    const moveSlashDrag = (clientX: number, clientY: number) => {
      if (!slashMenuDragging) return;
      const dx = clientX - slashMenuDragStart.current.x;
      const dy = clientY - slashMenuDragStart.current.y;
      setSlashMenuPos({
        x: slashMenuDragStart.current.ox + dx,
        y: slashMenuDragStart.current.oy + dy,
      });
    };
    const endSlashDrag = () => setSlashMenuDragging(false);

    return (
      <div className="fixed inset-0 z-50 bg-[var(--bg)] text-[var(--text)] flex flex-col p-3 overflow-hidden">
        {/* File name at top, controls at top, nothing at bottom */}
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)] mb-2 shrink-0 gap-2">
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="File name"
            className="font-medium text-xs border-b border-dashed border-[var(--border-light)] pb-0.5 bg-transparent text-[var(--text)] focus:outline-none flex-1 min-w-0"
          />
          <div className="flex items-center gap-2 shrink-0">
            {/* Write mode switcher */}
            <div className="flex items-center border border-[var(--border-light)] rounded-[2px] p-0.5">
              {(['edit', 'split'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setWriteMode(m)}
                  className={`px-1.5 py-0.5 text-[10px] rounded-[2px] cursor-pointer capitalize ${
                    writeMode === m
                      ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                      : 'bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                  title={m === 'split' ? 'Editor + live markdown preview' : 'Editor only'}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                if (isCreating) setSelectedLyrics(null);
              }}
              className="px-2 py-0.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-2.5 py-1 text-xs bg-[var(--accent)] text-[var(--accent-text)] border border-[var(--border)] rounded-[3px] cursor-pointer hover:bg-[var(--accent-hover)]"
            >
              Save
            </button>
          </div>
        </div>

        {/* Body: editor, or split with live preview */}
        {writeMode === 'edit' ? (
          <textarea
            ref={textareaRef}
            value={lyricsContent}
            onChange={handleLyricsChange}
            autoFocus
            placeholder="Write lyrics here... type '/' to insert structure tags like [Chorus], [Verse], etc. Markdown supported: ### heading, **bold**, etc."
            className="w-full flex-1 p-0 text-xs font-mono leading-relaxed bg-transparent text-[var(--text)] border-none resize-none focus:outline-none"
          />
        ) : (
          <div className="flex-1 flex gap-2 overflow-hidden">
            <textarea
              ref={textareaRef}
              value={lyricsContent}
              onChange={handleLyricsChange}
              autoFocus
              placeholder="Write lyrics here... type '/' to insert structure tags like [Chorus], [Verse], etc. Markdown supported: ### heading, **bold**, etc."
              className="flex-1 p-0 text-xs font-mono leading-relaxed bg-transparent text-[var(--text)] border-none resize-none focus:outline-none"
            />
            <div className="w-1 bg-[var(--bg-hover)]" />
            <div className="flex-1 overflow-y-auto pr-2">
              <MarkdownPreview content={lyricsContent} />
            </div>
          </div>
        )}

        {/* Floating structure menu — draggable, opens when user types '/' */}
        {showSlashMenu && (
          <div
            className="fixed z-[60] border border-[var(--border)] bg-[var(--bg)] rounded-[4px] p-1.5 max-w-[280px] min-w-[220px] shadow-md select-none"
            style={{
              top: slashMenuPos.y || 80,
              left: slashMenuPos.x || 24,
            }}
          >
            {/* Header (drag handle) */}
            <div
              className="flex items-center justify-between pb-1 mb-1 border-b border-[var(--border-light)] cursor-move"
              onMouseDown={(e) => startSlashDrag(e.clientX, e.clientY)}
              onMouseMove={(e) => moveSlashDrag(e.clientX, e.clientY)}
              onMouseUp={endSlashDrag}
              onMouseLeave={endSlashDrag}
              onTouchStart={(e) => {
                if (e.touches[0]) startSlashDrag(e.touches[0].clientX, e.touches[0].clientY);
              }}
              onTouchMove={(e) => {
                if (e.touches[0]) moveSlashDrag(e.touches[0].clientX, e.touches[0].clientY);
              }}
              onTouchEnd={endSlashDrag}
            >
              <span className="text-[10px] text-[var(--text-muted)] font-medium">Structure — drag to move</span>
              <button
                type="button"
                onClick={() => {
                  setShowSlashMenu(false);
                  setSlashCursorPos(null);
                }}
                className="text-[var(--text-faint)] hover:text-[var(--text)] cursor-pointer p-0.5"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
              {STRUCTURE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertStructureTag(tag)}
                  className="text-left px-1.5 py-1 text-[11px] hover:bg-[var(--bg-hover)] rounded-[2px] cursor-pointer"
                >
                  [{tag}]
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // VIEW MODE (selected document)
  if (selectedLyrics) {
    return (
      <div className="w-full max-w-lg mx-auto p-3 text-xs">
        {/* Top controls */}
        <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)] mb-3">
          <button
            type="button"
            onClick={() => setSelectedLyrics(null)}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
          >
            Back to list
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRequestEdit}
              className="px-2 py-0.5 border border-[var(--border)] bg-[var(--bg)] rounded-[3px] text-[11px] text-[var(--text)] hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteDoc(selectedLyrics)}
              className="text-[11px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>

        {/* View Document: File name at top, lyrics below */}
        <div className="space-y-3">
          <div className="font-semibold text-sm text-[var(--text)] border-b border-[var(--border-light)] pb-1">
            {selectedLyrics.fileName}
          </div>
          {selectedLyrics.lyrics ? (
            <MarkdownPreview content={selectedLyrics.lyrics} />
          ) : (
            <div className="text-[var(--text-faint)] italic text-xs">(Empty lyrics document)</div>
          )}
        </div>

        {/* Button Confirm Modal (Yes on left, No on right) */}
        <ButtonConfirmModal
          isOpen={showEditConfirm}
          title={`Edit "${selectedLyrics.fileName}"?`}
          onConfirm={handleConfirmEdit}
          onCancel={() => setShowEditConfirm(false)}
        />

        {/* Typed Delete Confirmation */}
        <TypedConfirmModal
          isOpen={!!confirmDeleteDoc}
          title={confirmDeleteDoc ? `Delete "${confirmDeleteDoc.fileName}"` : ''}
          expectedText="Delete"
          onConfirm={() => {
            if (confirmDeleteDoc) {
              onDeleteLyrics(confirmDeleteDoc.id);
              setSelectedLyrics(null);
              setConfirmDeleteDoc(null);
            }
          }}
          onCancel={() => setConfirmDeleteDoc(null)}
        />
      </div>
    );
  }

  // LIST VIEW: dedicated page showing lyrics files list and add button
  return (
    <div className="w-full max-w-lg mx-auto p-3 text-xs">
      <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)] mb-3">
        <span className="font-semibold text-[var(--text)]">Lyrics</span>
        <button
          type="button"
          onClick={handleStartCreate}
          className="px-2 py-0.5 border border-[var(--border)] bg-[var(--bg)] rounded-[3px] text-[11px] text-[var(--text)] hover:bg-[var(--bg-hover)] cursor-pointer"
        >
          + Add
        </button>
      </div>

      {currentLyrics.length === 0 ? (
        <div className="py-8 text-center text-[var(--text-faint)] text-xs">No lyrics added yet</div>
      ) : (
        <div className="divide-y divide-[var(--border-light)]">
          {currentLyrics.map((doc) => (
            <div
              key={doc.id}
              className="py-2 flex items-center justify-between gap-2 hover:bg-[var(--bg-secondary)]"
            >
              <button
                type="button"
                onClick={() => handleOpenDoc(doc)}
                className="text-left flex-1 min-w-0 cursor-pointer"
              >
                <div className="font-medium text-[var(--text)] truncate">{doc.fileName}</div>
                <div className="text-[10px] text-[var(--text-faint)] truncate font-mono">
                  {doc.lyrics.slice(0, 60).replace(/\n/g, ' ') || '(Empty)'}
                </div>
              </button>
              <span className="text-[10px] text-[var(--text-faint)] shrink-0">View</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
