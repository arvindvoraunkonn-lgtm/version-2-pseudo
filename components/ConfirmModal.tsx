'use client';

import React, { useState } from 'react';

export interface TypedConfirmProps {
  isOpen: boolean;
  title: string;
  expectedText: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TypedConfirmModal({
  isOpen,
  title,
  expectedText,
  onConfirm,
  onCancel,
}: TypedConfirmProps) {
  const [typed, setTyped] = useState('');

  if (!isOpen) return null;

  const isMatch = typed.trim().toLowerCase() === expectedText.toLowerCase();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isMatch) {
      setTyped('');
      onConfirm();
    }
  };

  const handleClose = () => {
    setTyped('');
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
      <div className="w-full max-w-sm bg-[var(--bg)] border border-[var(--border)] p-3 rounded-[3px] text-xs">
        <div className="mb-2 text-[var(--text)] font-medium leading-tight">{title}</div>
        <div className="mb-2 text-[var(--text-muted)] text-[11px]">
          Type &quot;{expectedText}&quot; to confirm:
        </div>
        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            className="w-full border border-[var(--border-light)] p-1.5 text-xs text-[var(--text)] bg-[var(--bg)] rounded-[2px]"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="px-2.5 py-1 text-xs border border-[var(--border-light)] text-[var(--text-muted)] rounded-[3px] cursor-pointer hover:bg-[var(--bg-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isMatch}
              className="px-2.5 py-1 text-xs bg-[var(--accent)] text-[var(--accent-text)] border border-[var(--border)] rounded-[3px] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export interface ButtonConfirmProps {
  isOpen: boolean;
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Button confirmation asking whether to edit or proceed.
 * CRITICAL RULE: "Yes" is on the left and "No" is on the right, to avoid muscle memory.
 */
export function ButtonConfirmModal({
  isOpen,
  title,
  onConfirm,
  onCancel,
}: ButtonConfirmProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
      <div className="w-full max-w-xs bg-[var(--bg)] border border-[var(--border)] p-3 rounded-[3px] text-xs">
        <div className="mb-3 text-[var(--text)] leading-tight">{title}</div>
        <div className="flex items-center gap-2">
          {/* YES ON LEFT */}
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-1.5 px-3 bg-[var(--accent)] text-[var(--accent-text)] text-xs border border-[var(--border)] rounded-[3px] cursor-pointer hover:bg-[var(--accent-hover)]"
          >
            Yes
          </button>
          {/* NO ON RIGHT */}
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-1.5 px-3 bg-[var(--bg)] text-[var(--text)] text-xs border border-[var(--border-light)] rounded-[3px] cursor-pointer hover:bg-[var(--bg-hover)]"
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
}
