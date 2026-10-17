'use client';

import React, { useState, useEffect, useRef } from 'react';
import { NoteDocument } from '../lib/types';
import { ButtonConfirmModal, TypedConfirmModal } from './ConfirmModal';
import { MarkdownPreview } from './MarkdownPreview';

interface NotesViewProps {
  artistId: string;
  notesList: NoteDocument[];
  onAddNote: (note: NoteDocument) => void;
  onUpdateNote: (note: NoteDocument) => void;
  onDeleteNote: (id: string) => void;
}

export function NotesView({
  artistId,
  notesList,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
}: NotesViewProps) {
  const [selectedNote, setSelectedNote] = useState<NoteDocument | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  // When 'edit' | 'preview' | 'split' — controls how the writing mode shows.
  // 'edit' = textarea only, 'preview' = markdown render only,
  // 'split' = side-by-side editor + live preview.
  const [writeMode, setWriteMode] = useState<'edit' | 'preview' | 'split'>('edit');

  // Modals
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<NoteDocument | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [body, setBody] = useState('');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentNotes = notesList.filter((n) => !n.artistId || n.artistId === artistId);

  const handleStartAdd = () => {
    setTitle('');
    setDate(new Date().toISOString().slice(0, 10));
    setBody('');
    setSelectedNote(null);
    setIsCreating(true);
    setIsEditing(true); // new notes open directly to write full screen
    setWriteMode('edit');
  };

  const handleOpenNote = (note: NoteDocument) => {
    setSelectedNote(note);
    setTitle(note.title);
    setDate(note.date);
    setBody(note.body);
    setIsEditing(false); // opens in view mode first!
    setIsCreating(false);
    setWriteMode('edit');
  };

  const handleRequestEdit = () => {
    setShowEditConfirm(true);
  };

  const handleConfirmEdit = () => {
    setShowEditConfirm(false);
    setIsEditing(true);
  };

  const handleSave = (silent = false) => {
    if (!title.trim() && !body.trim()) return;

    const noteTitle = title.trim() || 'untitled';
    const noteDate = date || new Date().toISOString().slice(0, 10);

    if (isCreating || !selectedNote) {
      const newNote: NoteDocument = {
        id: 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        artistId,
        title: noteTitle,
        date: noteDate,
        body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onAddNote(newNote);
      setSelectedNote(newNote);
      setIsCreating(false);
    } else {
      const updated: NoteDocument = {
        ...selectedNote,
        title: noteTitle,
        date: noteDate,
        body,
        updatedAt: new Date().toISOString(),
      };
      onUpdateNote(updated);
      setSelectedNote(updated);
    }

    if (!silent) {
      setIsEditing(false);
    }
  };

  const saveRef = useRef(handleSave);
  useEffect(() => {
    saveRef.current = handleSave;
  });

  // Auto-save debounce effect while editing
  useEffect(() => {
    if (!isEditing) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveRef.current(true);
    }, 2500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [title, date, body, isEditing]);

  // FULL SCREEN WRITING MODE (no container, nothing else on screen)
  if (isEditing) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--bg)] text-[var(--text)] flex flex-col p-3 overflow-hidden">
        {/* Title at top, date (auto), body in markdown */}
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)] mb-2 shrink-0 gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title"
              className="font-medium text-xs border-b border-dashed border-[var(--border-light)] pb-0.5 bg-transparent text-[var(--text)] focus:outline-none flex-1 min-w-0"
            />
            <span className="text-[10px] text-[var(--text-faint)] font-mono shrink-0">{date}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Write mode switcher: Edit / Split / Preview */}
            <div className="flex items-center border border-[var(--border-light)] rounded-[2px] p-0.5">
              {(['edit', 'split', 'preview'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setWriteMode(m)}
                  className={`px-1.5 py-0.5 text-[10px] rounded-[2px] cursor-pointer capitalize ${
                    writeMode === m
                      ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                      : 'bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                  title={m === 'split' ? 'Editor + live preview' : m === 'preview' ? 'Markdown preview only' : 'Editor only'}
                >
                  {m}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                if (isCreating) setSelectedNote(null);
              }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleSave(false)}
              className="px-2.5 py-1 text-xs bg-[var(--accent)] text-[var(--accent-text)] border border-[var(--border)] rounded-[3px] cursor-pointer hover:bg-[var(--accent-hover)]"
            >
              Done
            </button>
          </div>
        </div>

        {/* Body: editor, split, or preview depending on writeMode */}
        {writeMode === 'edit' && (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            autoFocus
            placeholder="Write in markdown... (### heading, **bold**, - list, [link](url), ```code```)"
            className="w-full flex-1 p-0 text-xs font-mono leading-relaxed bg-transparent text-[var(--text)] border-none resize-none focus:outline-none"
          />
        )}
        {writeMode === 'preview' && (
          <div className="w-full flex-1 overflow-y-auto pr-2">
            <MarkdownPreview content={body} />
          </div>
        )}
        {writeMode === 'split' && (
          <div className="flex-1 flex gap-2 overflow-hidden">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              autoFocus
              placeholder="Write in markdown... (### heading, **bold**, - list, [link](url), ```code```)"
              className="flex-1 p-0 text-xs font-mono leading-relaxed bg-transparent text-[var(--text)] border-none resize-none focus:outline-none"
            />
            <div className="w-1 bg-[var(--bg-hover)]" />
            <div className="flex-1 overflow-y-auto pr-2">
              <MarkdownPreview content={body} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // VIEW MODE (selected note preview)
  if (selectedNote) {
    return (
      <div className="w-full max-w-lg mx-auto p-3 text-xs">
        {/* Top controls */}
        <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)] mb-3">
          <button
            type="button"
            onClick={() => setSelectedNote(null)}
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
              onClick={() => setConfirmDeleteNote(selectedNote)}
              className="text-[11px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Title at the top, date (auto), body below */}
        <div className="space-y-3">
          <div className="border-b border-[var(--border-light)] pb-1">
            <h2 className="font-semibold text-sm text-[var(--text)]">{selectedNote.title}</h2>
            <div className="text-[10px] text-[var(--text-faint)] font-mono mt-0.5">{selectedNote.date}</div>
          </div>
          {selectedNote.body ? (
            <MarkdownPreview content={selectedNote.body} />
          ) : (
            <div className="text-[var(--text-faint)] italic text-xs">(Empty note)</div>
          )}
        </div>

        {/* Button Confirm Modal (Yes on left, No on right) */}
        <ButtonConfirmModal
          isOpen={showEditConfirm}
          title={`Edit note "${selectedNote.title}"?`}
          onConfirm={handleConfirmEdit}
          onCancel={() => setShowEditConfirm(false)}
        />

        {/* Typed Delete Confirmation */}
        <TypedConfirmModal
          isOpen={!!confirmDeleteNote}
          title={confirmDeleteNote ? `Delete note "${confirmDeleteNote.title}"` : ''}
          expectedText="Delete"
          onConfirm={() => {
            if (confirmDeleteNote) {
              onDeleteNote(confirmDeleteNote.id);
              setSelectedNote(null);
              setConfirmDeleteNote(null);
            }
          }}
          onCancel={() => setConfirmDeleteNote(null)}
        />
      </div>
    );
  }

  // NOTES LIST VIEW (page shows only notes list and an Add button)
  return (
    <div className="w-full max-w-lg mx-auto p-3 text-xs">
      <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)] mb-3">
        <span className="font-semibold text-[var(--text)]">Notes</span>
        <button
          type="button"
          onClick={handleStartAdd}
          className="px-2 py-0.5 border border-[var(--border)] bg-[var(--bg)] rounded-[3px] text-[11px] text-[var(--text)] hover:bg-[var(--bg-hover)] cursor-pointer"
        >
          + Add
        </button>
      </div>

      {currentNotes.length === 0 ? (
        <div className="py-8 text-center text-[var(--text-faint)] text-xs">No notes added yet</div>
      ) : (
        <div className="divide-y divide-[var(--border-light)]">
          {currentNotes.map((note) => (
            <div
              key={note.id}
              className="py-2 flex items-center justify-between gap-2 hover:bg-[var(--bg-secondary)]"
            >
              <button
                type="button"
                onClick={() => handleOpenNote(note)}
                className="text-left flex-1 min-w-0 cursor-pointer"
              >
                <div className="font-medium text-[var(--text)] truncate">{note.title}</div>
                <div className="text-[10px] text-[var(--text-faint)] truncate font-mono">
                  {note.date} · {note.body.slice(0, 50).replace(/\n/g, ' ') || '(Empty)'}
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
