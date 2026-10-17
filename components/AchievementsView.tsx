'use client';

import React, { useState, useEffect } from 'react';
import { Achievement, AchievementAttachment, Release, NoteDocument } from '../lib/types';
import { ButtonConfirmModal, TypedConfirmModal } from './ConfirmModal';
import { saveFileToDb, getBlobUrlForFileId, deleteFileFromDb } from '../lib/db';
import { NotesPickerModal } from './NotesPickerModal';
import { X, Paperclip, Link as LinkIcon, FileText, Music as MusicIcon, ExternalLink } from 'lucide-react';

interface AchievementsViewProps {
  artistId: string;
  achievements: Achievement[];
  releases: Release[];
  notes: NoteDocument[];
  onAdd: (achievement: Achievement) => void;
  onUpdate: (achievement: Achievement) => void;
  onDelete: (id: string) => void;
}

/**
 * Achievements timeline with rich metadata per entry:
 *   - Local file attachments (image or any file from disk / Google Drive downloads)
 *   - External URL attachments (e.g. Google Drive shareable links)
 *   - Link to a release and optionally a specific track within it
 *   - Multi-select link to notes (via NotesPickerModal with search)
 *
 * Lock-bug note: previous implementation's modal flow could leave the page
 * in a non-interactive state when a typed-confirm modal was cancelled
 * mid-edit. This rewrite consolidates all form state into a single
 * `formData` object, resets cleanly on open/close, and uses unique state
 * slots for each modal so they cannot overlap.
 */
export function AchievementsView({
  artistId,
  achievements,
  releases,
  notes,
  onAdd,
  onUpdate,
  onDelete,
}: AchievementsViewProps) {
  // One mode at a time: 'view' | 'add' | 'edit'
  const [mode, setMode] = useState<'view' | 'add' | 'edit'>('view');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Confirm modals (each independent, cannot collide)
  const [confirmEditItem, setConfirmEditItem] = useState<Achievement | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<Achievement | null>(null);
  const [notesPickerOpen, setNotesPickerOpen] = useState(false);

  // Form data — single source of truth, reset on open
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [attachments, setAttachments] = useState<AchievementAttachment[]>([]);
  const [linkedReleaseId, setLinkedReleaseId] = useState<string | undefined>(undefined);
  const [linkedTrackId, setLinkedTrackId] = useState<string | undefined>(undefined);
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>([]);

  // Preview URLs for image attachments (local blob URLs for stored files)
  const [attachmentPreviews, setAttachmentPreviews] = useState<{ [id: string]: string }>({});

  const sortedAchievements = [...achievements].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const artistReleases = releases.filter((r) => r.artistId === artistId);
  const selectedRelease = artistReleases.find((r) => r.id === linkedReleaseId);

  // Reset form data when entering add or edit mode
  const resetForm = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setTitle('');
    setNote('');
    setAttachments([]);
    setLinkedReleaseId(undefined);
    setLinkedTrackId(undefined);
    setLinkedNoteIds([]);
    setAttachmentPreviews({});
  };

  const handleStartAdd = () => {
    resetForm();
    setEditingId(null);
    setMode('add');
  };

  const handleRequestEdit = (item: Achievement) => {
    setConfirmEditItem(item);
  };

  const handleConfirmEdit = () => {
    if (!confirmEditItem) return;
    const item = confirmEditItem;
    setEditingId(item.id);
    setDate(item.date);
    setTitle(item.title);
    setNote(item.note);
    setAttachments(item.attachments || []);
    setLinkedReleaseId(item.linkedReleaseId);
    setLinkedTrackId(item.linkedTrackId);
    setLinkedNoteIds(item.linkedNoteIds || []);
    setMode('edit');
    setConfirmEditItem(null);
  };

  const handleCancelForm = () => {
    // Discard any unsaved attachments to avoid orphaned files in IndexedDB
    if (mode === 'add' && attachments.length > 0) {
      for (const a of attachments) {
        if (a.fileId) deleteFileFromDb(a.fileId).catch(() => {});
      }
    }
    setMode('view');
    setEditingId(null);
  };

  // When a release is chosen, reset the track selection (tracks belong to specific releases)
  useEffect(() => {
    if (!linkedReleaseId && linkedTrackId) {
      setLinkedTrackId(undefined);
    } else if (linkedReleaseId && selectedRelease) {
      // If current track doesn't belong to this release, clear it
      const trackBelongsToRelease = selectedRelease.tracks?.some((t) => t.id === linkedTrackId);
      if (linkedTrackId && !trackBelongsToRelease) {
        setLinkedTrackId(undefined);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedReleaseId]);

  // Resolve blob URLs for any image attachments with fileId
  useEffect(() => {
    let mounted = true;
    async function resolve() {
      const mapping: { [id: string]: string } = {};
      for (const a of attachments) {
        if (a.fileId && a.fileType && a.fileType.startsWith('image/')) {
          const url = await getBlobUrlForFileId(a.fileId);
          if (url) mapping[a.id] = url;
        }
      }
      if (mounted) setAttachmentPreviews(mapping);
    }
    resolve();
    return () => {
      mounted = false;
    };
  }, [attachments]);

  // Attachment handlers
  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newAtts: AchievementAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const id = 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      await saveFileToDb(id, f, f.name);
      newAtts.push({
        id,
        fileId: id,
        fileName: f.name,
        fileType: f.type,
        title: f.name,
        createdAt: new Date().toISOString(),
      });
    }
    setAttachments((prev) => [...prev, ...newAtts]);
    // reset input so picking the same file twice still fires onChange
    e.target.value = '';
  };

  const handleAddUrl = () => {
    const url = window.prompt('Enter external URL (Google Drive, Dropbox, etc.):');
    if (!url || !url.trim()) return;
    const newAtt: AchievementAttachment = {
      id: 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      url: url.trim(),
      title: url.trim(),
      createdAt: new Date().toISOString(),
    };
    setAttachments((prev) => [...prev, newAtt]);
  };

  const handleRemoveAttachment = (attId: string) => {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === attId);
      if (att && att.fileId) {
        deleteFileFromDb(att.fileId).catch(() => {});
      }
      return prev.filter((a) => a.id !== attId);
    });
  };

  const handleOpenAttachment = (att: AchievementAttachment) => {
    if (att.url) {
      window.open(att.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (att.fileId) {
      getBlobUrlForFileId(att.fileId).then((url) => {
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      });
    }
  };

  // Notes picker confirm
  const handleNotesPickerConfirm = (selectedIds: string[]) => {
    setLinkedNoteIds(selectedIds);
    setNotesPickerOpen(false);
  };

  // Submit handlers
  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    const newEntry: Achievement = {
      id: 'ach_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      artistId,
      date,
      title: title.trim(),
      note: note.trim(),
      attachments: attachments.length > 0 ? attachments : undefined,
      linkedReleaseId,
      linkedTrackId,
      linkedNoteIds: linkedNoteIds.length > 0 ? linkedNoteIds : undefined,
      createdAt: new Date().toISOString(),
    };
    onAdd(newEntry);
    setMode('view');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !title.trim() || !date) return;
    const existing = achievements.find((a) => a.id === editingId);
    if (!existing) return;
    const updated: Achievement = {
      ...existing,
      date,
      title: title.trim(),
      note: note.trim(),
      attachments: attachments.length > 0 ? attachments : undefined,
      linkedReleaseId,
      linkedTrackId,
      linkedNoteIds: linkedNoteIds.length > 0 ? linkedNoteIds : undefined,
    };
    onUpdate(updated);
    setMode('view');
    setEditingId(null);
  };

  // ----- Render -----
  return (
    <div className="w-full max-w-md mx-auto p-3 text-xs">
      {/* Top controls */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)] mb-3">
        <span className="font-semibold text-[var(--text)]">Achievements</span>
        {mode === 'view' && (
          <button
            type="button"
            onClick={handleStartAdd}
            className="px-2 py-0.5 border border-[var(--border)] bg-[var(--bg)] rounded-[3px] text-[11px] text-[var(--text)] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            + Add
          </button>
        )}
      </div>

      {/* ADD / EDIT FORM */}
      {(mode === 'add' || mode === 'edit') && (
        <form
          onSubmit={mode === 'add' ? handleSaveAdd : handleSaveEdit}
          className="p-2 border border-[var(--border)] rounded-[3px] space-y-2 mb-4 bg-[var(--bg-secondary)]"
        >
          <div className="flex justify-between items-center text-[11px] font-medium text-[var(--text)]">
            <span>{mode === 'add' ? 'New achievement' : 'Edit achievement'}</span>
            <button
              type="button"
              onClick={handleCancelForm}
              className="text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Note</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
            />
          </div>

          {/* ATTACHMENTS */}
          <div className="border-t border-[var(--border-light)] pt-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-[var(--text)]">
                Attachments ({attachments.length})
              </span>
              <div className="flex items-center gap-2">
                <label className="text-[10px] underline text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer inline-flex items-center gap-0.5">
                  <Paperclip className="w-2.5 h-2.5" /> Add file
                  <input
                    type="file"
                    multiple
                    onChange={handleFilePick}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleAddUrl}
                  className="text-[10px] underline text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer inline-flex items-center gap-0.5"
                >
                  <LinkIcon className="w-2.5 h-2.5" /> Add URL
                </button>
              </div>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map((att) => {
                  const isImage = att.fileType?.startsWith('image/');
                  const preview = att.fileId ? attachmentPreviews[att.id] : null;
                  return (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 p-1 border border-[var(--border-light)] rounded-[2px] bg-[var(--bg)]"
                    >
                      {isImage && preview ? (
                        <img
                          src={preview}
                          alt={att.title || ''}
                          className="w-8 h-8 object-cover rounded-[2px] shrink-0 border border-[var(--border-light)]"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-[var(--bg-hover)] rounded-[2px] shrink-0 flex items-center justify-center border border-[var(--border-light)]">
                          <FileText className="w-3 h-3 text-[var(--text-muted)]" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenAttachment(att)}
                        className="flex-1 text-left min-w-0 hover:opacity-80 cursor-pointer"
                      >
                        <div className="text-[11px] text-[var(--text)] truncate">
                          {att.url ? att.url : att.fileName || att.title}
                        </div>
                        <div className="text-[9px] text-[var(--text-faint)] truncate">
                          {att.url ? 'External link' : att.fileType || 'File'}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="text-[var(--text-faint)] hover:text-[var(--text)] cursor-pointer p-0.5 shrink-0"
                        aria-label="Remove attachment"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* LINK TO RELEASE / TRACK */}
          <div className="border-t border-[var(--border-light)] pt-2 space-y-1.5">
            <div className="text-[10px] font-medium text-[var(--text)]">
              Linked release / track
            </div>
            <select
              value={linkedReleaseId || ''}
              onChange={(e) => setLinkedReleaseId(e.target.value || undefined)}
              className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px] cursor-pointer"
            >
              <option value="">No release linked</option>
              {artistReleases.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.type})
                </option>
              ))}
            </select>
            {linkedReleaseId && selectedRelease && selectedRelease.tracks && selectedRelease.tracks.length > 0 && (
              <select
                value={linkedTrackId || ''}
                onChange={(e) => setLinkedTrackId(e.target.value || undefined)}
                className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px] cursor-pointer"
              >
                <option value="">Whole release (no specific track)</option>
                {selectedRelease.tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.trackNumber}. {t.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* LINK TO NOTES */}
          <div className="border-t border-[var(--border-light)] pt-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-[var(--text)]">
                Linked notes ({linkedNoteIds.length})
              </span>
              <button
                type="button"
                onClick={() => setNotesPickerOpen(true)}
                className="text-[10px] underline text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer inline-flex items-center gap-0.5"
              >
                <FileText className="w-2.5 h-2.5" /> Pick notes
              </button>
            </div>
            {linkedNoteIds.length > 0 && (
              <div className="space-y-1">
                {linkedNoteIds.map((nid) => {
                  const n = notes.find((x) => x.id === nid);
                  if (!n) return null;
                  return (
                    <div
                      key={nid}
                      className="flex items-center gap-2 p-1 border border-[var(--border-light)] rounded-[2px] bg-[var(--bg)]"
                    >
                      <FileText className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-[var(--text)] truncate">
                          {n.title || 'Untitled'}
                        </div>
                        <div className="text-[9px] text-[var(--text-faint)] truncate">
                          {n.date}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setLinkedNoteIds((prev) => prev.filter((x) => x !== nid))
                        }
                        className="text-[var(--text-faint)] hover:text-[var(--text)] cursor-pointer p-0.5 shrink-0"
                        aria-label="Unlink note"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-1 bg-[var(--accent)] text-[var(--accent-text)] border border-[var(--border)] rounded-[3px] text-xs hover:bg-[var(--accent-hover)] cursor-pointer"
          >
            {mode === 'add' ? 'Save achievement' : 'Save changes'}
          </button>
        </form>
      )}

      {/* TIMELINE */}
      {mode === 'view' && sortedAchievements.length === 0 ? (
        <div className="py-8 text-center text-[var(--text-faint)] text-xs">No achievements yet</div>
      ) : (
        mode === 'view' && (
          <div className="relative border-l border-[var(--border-light)] ml-2 pl-3 space-y-4 py-1">
            {sortedAchievements.map((item) => {
              const linkedRel = item.linkedReleaseId
                ? releases.find((r) => r.id === item.linkedReleaseId)
                : null;
              const linkedTrack = linkedRel && item.linkedTrackId
                ? linkedRel.tracks?.find((t) => t.id === item.linkedTrackId)
                : null;
              const linkedNotesForItem = (item.linkedNoteIds || [])
                .map((nid) => notes.find((n) => n.id === nid))
                .filter(Boolean) as NoteDocument[];

              return (
                <div key={item.id} className="relative group">
                  {/* timeline node */}
                  <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-[var(--accent)] border border-[var(--bg)]" />

                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-mono text-[var(--text-muted)]">{item.date}</div>
                      <div className="font-medium text-[var(--text)] text-xs">{item.title}</div>
                      {item.note && (
                        <div className="text-[11px] text-[var(--text-muted)] whitespace-pre-wrap mt-0.5">
                          {item.note}
                        </div>
                      )}

                      {/* Attachments preview thumbnails */}
                      {item.attachments && item.attachments.length > 0 && (
                        <AchievementAttachments attachments={item.attachments} />
                      )}

                      {/* Linked release / track */}
                      {linkedRel && (
                        <div className="text-[10px] text-[var(--text-muted)] mt-1 flex items-center gap-1 flex-wrap">
                          <MusicIcon className="w-2.5 h-2.5 shrink-0" />
                          <span>Release:</span>
                          <span className="font-medium text-[var(--text)]">{linkedRel.title}</span>
                          {linkedTrack && (
                            <>
                              <span className="text-[var(--text-faint)]">·</span>
                              <span>Track: <span className="font-medium text-[var(--text)]">{linkedTrack.title}</span></span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Linked notes */}
                      {linkedNotesForItem.length > 0 && (
                        <div className="text-[10px] text-[var(--text-muted)] mt-1 flex items-center gap-1 flex-wrap">
                          <FileText className="w-2.5 h-2.5 shrink-0" />
                          <span>Notes:</span>
                          <span className="font-medium text-[var(--text)]">
                            {linkedNotesForItem.map((n) => n.title || 'Untitled').join(', ')}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => handleRequestEdit(item)}
                        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteItem(item)}
                        className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Confirm Edit Modal */}
      <ButtonConfirmModal
        isOpen={!!confirmEditItem}
        title="Edit this achievement?"
        onConfirm={handleConfirmEdit}
        onCancel={() => setConfirmEditItem(null)}
      />

      {/* Confirm Delete Modal */}
      <TypedConfirmModal
        isOpen={!!confirmDeleteItem}
        title={confirmDeleteItem ? `Delete "${confirmDeleteItem.title}"` : ''}
        expectedText="Delete"
        onConfirm={() => {
          if (confirmDeleteItem) {
            // Clean up any attached files from IndexedDB
            if (confirmDeleteItem.attachments) {
              for (const att of confirmDeleteItem.attachments) {
                if (att.fileId) deleteFileFromDb(att.fileId).catch(() => {});
              }
            }
            onDelete(confirmDeleteItem.id);
            setConfirmDeleteItem(null);
          }
        }}
        onCancel={() => setConfirmDeleteItem(null)}
      />

      {/* Notes Picker Modal */}
      <NotesPickerModal
        isOpen={notesPickerOpen}
        notes={notes}
        artistId={artistId}
        selectedIds={linkedNoteIds}
        onConfirm={handleNotesPickerConfirm}
        onCancel={() => setNotesPickerOpen(false)}
      />
    </div>
  );
}

/**
 * Renders attachment thumbnails for an achievement in view mode.
 * Images get a small thumbnail; other files show a file icon.
 * Clicking opens the attachment in a new tab.
 */
function AchievementAttachments({ attachments }: { attachments: AchievementAttachment[] }) {
  const [previews, setPreviews] = useState<{ [id: string]: string }>({});

  useEffect(() => {
    let mounted = true;
    async function resolve() {
      const mapping: { [id: string]: string } = {};
      for (const a of attachments) {
        if (a.fileId && a.fileType && a.fileType.startsWith('image/')) {
          const url = await getBlobUrlForFileId(a.fileId);
          if (url) mapping[a.id] = url;
        }
      }
      if (mounted) setPreviews(mapping);
    }
    resolve();
    return () => {
      mounted = false;
    };
  }, [attachments]);

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {attachments.map((att) => {
        const isImage = att.fileType?.startsWith('image/');
        const preview = att.fileId ? previews[att.id] : null;
        return (
          <button
            key={att.id}
            type="button"
            onClick={() => {
              if (att.url) {
                window.open(att.url, '_blank', 'noopener,noreferrer');
              } else if (att.fileId) {
                getBlobUrlForFileId(att.fileId).then((url) => {
                  if (url) window.open(url, '_blank', 'noopener,noreferrer');
                });
              }
            }}
            className="w-12 h-12 border border-[var(--border-light)] rounded-[2px] overflow-hidden bg-[var(--bg-hover)] flex items-center justify-center hover:opacity-80 cursor-pointer shrink-0 relative group"
            title={att.url || att.fileName || att.title || 'Attachment'}
          >
            {isImage && preview ? (
              <img src={preview} alt={att.title || ''} className="w-full h-full object-cover" />
            ) : att.url ? (
              <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
            ) : (
              <FileText className="w-3 h-3 text-[var(--text-muted)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
