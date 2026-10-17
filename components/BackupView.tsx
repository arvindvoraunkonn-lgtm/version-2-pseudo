'use client';

import React, { useState } from 'react';
import { Artist, BackupLog } from '../lib/types';
import { AppDataStore } from '../lib/db';
import {
  generateArtistTxt,
  generateArtistCsv,
  generateArtistMd,
  createArtistBackupZip,
  createMetaBackupZip,
  importArtistBackupZip,
  importMetaBackupZip,
  triggerDownload,
} from '../lib/export-import';
import { TypedConfirmModal } from './ConfirmModal';
import { CustomDropdown } from './CustomDropdown';

interface BackupViewProps {
  appData: AppDataStore;
  selectedArtist: Artist | null;
  onUpdateAppData: (data: AppDataStore) => void;
  onImportArtistData: (imported: {
    artist: Artist;
    releases: any[];
    achievements: any[];
    lyrics: any[];
    notes: any[];
    artworks: any[];
  }) => void;
  onBack: () => void;
}

export function BackupView({
  appData,
  selectedArtist,
  onUpdateAppData,
  onImportArtistData,
  onBack,
}: BackupViewProps) {
  const [activeArtistId, setActiveArtistId] = useState<string>(
    selectedArtist?.id || appData.artists[0]?.id || ''
  );

  // Export Confirmation
  const [pendingExportAction, setPendingExportAction] = useState<(() => Promise<void>) | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Import states
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const currentArtist = appData.artists.find((a) => a.id === activeArtistId) || selectedArtist;
  const artistReleases = currentArtist
    ? appData.releases.filter((r) => r.artistId === currentArtist.id)
    : [];

  const requestExport = (action: () => Promise<void>) => {
    setPendingExportAction(() => action);
    setShowExportModal(true);
  };

  const handleConfirmExport = async () => {
    setShowExportModal(false);
    if (pendingExportAction) {
      try {
        await pendingExportAction();
        setExportNotice('Export completed');
        setTimeout(() => setExportNotice(null), 3000);
      } catch (err: any) {
        setExportNotice(`Export failed: ${err.message}`);
      }
      setPendingExportAction(null);
    }
  };

  // Text, CSV, Markdown Export
  const exportTxt = async () => {
    if (!currentArtist) return;
    const txt = generateArtistTxt(currentArtist, artistReleases);
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, `${currentArtist.name.toLowerCase().replace(/\s+/g, '_')}_summary.txt`);
  };

  const exportCsv = async () => {
    if (!currentArtist) return;
    const csv = generateArtistCsv(currentArtist, artistReleases);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, `${currentArtist.name.toLowerCase().replace(/\s+/g, '_')}_releases.csv`);
  };

  const exportMd = async () => {
    if (!currentArtist) return;
    const md = generateArtistMd(currentArtist, artistReleases);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    triggerDownload(blob, `${currentArtist.name.toLowerCase().replace(/\s+/g, '_')}_summary.md`);
  };

  // Isolated Artist ZIP Backup
  const exportArtistZip = async () => {
    if (!currentArtist) return;
    const { blob, fileName, log } = await createArtistBackupZip(currentArtist, appData);
    triggerDownload(blob, fileName);
    // record log
    onUpdateAppData({
      ...appData,
      backupLogs: [log, ...appData.backupLogs],
    });
  };

  // Full Meta Backup ZIP
  const exportMetaZip = async () => {
    const { blob, fileName, log } = await createMetaBackupZip(appData);
    triggerDownload(blob, fileName);
    // record log
    onUpdateAppData({
      ...appData,
      backupLogs: [log, ...appData.backupLogs],
    });
  };

  // Import Handlers
  const handleImportArtistFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImportMessage('Importing artist backup...');
      const imported = await importArtistBackupZip(file);
      onImportArtistData(imported);
      setImportMessage(`Imported artist "${imported.artist.name}" successfully`);
    } catch (err: any) {
      setImportMessage(`Import error: ${err.message}`);
    }
  };

  const handleImportMetaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImportMessage('Importing meta backup...');
      const fullData = await importMetaBackupZip(file);
      onUpdateAppData(fullData);
      setImportMessage('Meta backup restored successfully');
    } catch (err: any) {
      setImportMessage(`Meta import error: ${err.message}`);
    }
  };

  // Calculate backup statistics & freshness
  const artistBackups = appData.backupLogs.filter((l) => l.type === 'artist');
  const metaBackups = appData.backupLogs.filter((l) => l.type === 'meta');

  return (
    <div className="w-full max-w-lg mx-auto p-3 text-xs space-y-4">
      {/* Top controls */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)]">
        <span className="font-semibold text-[var(--text)]">Export / import</span>
        <button
          type="button"
          onClick={onBack}
          className="text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer text-[11px]"
        >
          Back
        </button>
      </div>

      {exportNotice && (
        <div className="p-1.5 border border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text)] text-[11px]">
          {exportNotice}
        </div>
      )}

      {importMessage && (
        <div className="p-1.5 border border-[var(--border-light)] bg-[var(--bg-secondary)] text-[var(--text)] text-[11px]">
          {importMessage}
        </div>
      )}

      {/* 1. AI & SHARING EXPORTS (TXT, CSV, MD) */}
      <section className="space-y-2 border-b border-[var(--border-light)] pb-4">
        <div className="font-semibold text-[var(--text)]">Export for sharing or ai (txt, csv, md)</div>
        <div className="text-[11px] text-[var(--text-muted)]">
          Exports releases, albums and artist summaries for ai models or document sharing.
        </div>

        {appData.artists.length > 1 && (
          <div className="w-48 pt-1">
            <CustomDropdown
              value={activeArtistId}
              options={appData.artists.map((a) => ({ value: a.id, label: a.name }))}
              onChange={(val) => setActiveArtistId(val)}
            />
          </div>
        )}

        {currentArtist && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => requestExport(exportTxt)}
              className="py-1 px-2.5 border border-[var(--border)] bg-[var(--bg)] rounded-[3px] hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              Export txt
            </button>
            <button
              type="button"
              onClick={() => requestExport(exportCsv)}
              className="py-1 px-2.5 border border-[var(--border)] bg-[var(--bg)] rounded-[3px] hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              Export csv
            </button>
            <button
              type="button"
              onClick={() => requestExport(exportMd)}
              className="py-1 px-2.5 border border-[var(--border)] bg-[var(--bg)] rounded-[3px] hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              Export markdown (md)
            </button>
          </div>
        )}
      </section>

      {/* 2. ISOLATED ARTIST BACKUP (ZIP) */}
      <section className="space-y-2 border-b border-[var(--border-light)] pb-4">
        <div className="font-semibold text-[var(--text)]">Isolated artist backup (.zip)</div>
        <div className="text-[11px] text-[var(--text-muted)]">
          Creates a standalone zip backup containing only this artist&apos;s profile, releases,
          notes, lyrics, artworks, and achievements.
        </div>

        {currentArtist && (
          <div>
            <button
              type="button"
              onClick={() => requestExport(exportArtistZip)}
              className="py-1.5 px-3 bg-[var(--accent)] text-[var(--accent-text)] rounded-[3px] hover:bg-[var(--accent-hover)] cursor-pointer"
            >
              Backup {currentArtist.name} (.zip)
            </button>
          </div>
        )}
      </section>

      {/* 3. META BACKUP (meta-backup.zip) & TRACKING UI */}
      <section className="space-y-2 border-b border-[var(--border-light)] pb-4">
        <div className="font-semibold text-[var(--text)]">Meta backup &amp; tracking (meta-backup.zip)</div>
        <div className="text-[11px] text-[var(--text-muted)]">
          Tracks logs, backup frequency, and backup status across all artists.
        </div>

        <div>
          <button
            type="button"
            onClick={() => requestExport(exportMetaZip)}
            className="py-1.5 px-3 bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] rounded-[3px] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            Generate meta-backup.zip
          </button>
        </div>

        {/* Tracking Logs & Status UI */}
        <div className="p-2 border border-[var(--border-light)] rounded-[3px] bg-[var(--bg-secondary)] space-y-2 mt-2">
          <div className="font-medium text-[var(--text)] text-[11px]">Backup tracking status</div>

          {/* Artist status table */}
          <div className="space-y-1 divide-y divide-[var(--border-light)]">
            {appData.artists.map((art) => {
              const lastLog = appData.backupLogs
                .filter((l) => l.artistId === art.id)
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

              const releasesCount = appData.releases.filter((r) => r.artistId === art.id).length;
              const notesCount = appData.notes.filter((n) => n.artistId === art.id).length;
              const lyricsCount = appData.lyrics.filter((l) => l.artistId === art.id).length;

              return (
                <div key={art.id} className="pt-1 flex items-center justify-between text-[11px]">
                  <div>
                    <span className="font-medium text-[var(--text)]">{art.name}</span>
                    <span className="text-[var(--text-muted)] ml-1">
                      ({releasesCount} rels, {notesCount} notes, {lyricsCount} lyrics)
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--text-faint)]">
                    {lastLog
                      ? `Backed up: ${new Date(lastLog.timestamp).toLocaleDateString()}`
                      : 'Not backed up'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Backup frequency info */}
          <div className="text-[10px] text-[var(--text-muted)] pt-1 border-t border-[var(--border-light)]">
            <span>Total backups performed: {appData.backupLogs.length}</span>
            <span className="ml-2">({artistBackups.length} artist, {metaBackups.length} meta)</span>
          </div>

          {/* Historical logs */}
          {appData.backupLogs.length > 0 && (
            <div className="pt-1">
              <div className="text-[10px] font-medium text-[var(--text)] mb-1">Recent backup history:</div>
              <div className="max-h-24 overflow-y-auto space-y-1 font-mono text-[9px] text-[var(--text-muted)]">
                {appData.backupLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="truncate">
                    [{new Date(log.timestamp).toLocaleString()}] {log.type}:{' '}
                    {log.artistName || 'All data'} ({log.notes})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. SEPARATE IMPORT BUTTONS */}
      <section className="space-y-3">
        <div className="font-semibold text-[var(--text)]">Import data</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Import Artist Backup */}
          <div className="p-2 border border-[var(--border-light)] rounded-[3px] space-y-1">
            <div className="font-medium text-[var(--text)] text-[11px]">Import artist backup</div>
            <div className="text-[10px] text-[var(--text-muted)]">
              Restores a single artist&apos;s backup file (.zip).
            </div>
            <label className="block mt-1">
              <span className="py-1 px-2 border border-[var(--border)] bg-[var(--bg)] rounded-[2px] text-[11px] cursor-pointer hover:bg-[var(--bg-hover)] inline-block">
                Choose artist zip
              </span>
              <input
                type="file"
                accept=".zip"
                onChange={handleImportArtistFile}
                className="hidden"
              />
            </label>
          </div>

          {/* Import Meta Backup */}
          <div className="p-2 border border-[var(--border-light)] rounded-[3px] space-y-1">
            <div className="font-medium text-[var(--text)] text-[11px]">Import meta backup</div>
            <div className="text-[10px] text-[var(--text-muted)]">
              Restores full database from meta-backup.zip.
            </div>
            <label className="block mt-1">
              <span className="py-1 px-2 border border-[var(--border)] bg-[var(--bg)] rounded-[2px] text-[11px] cursor-pointer hover:bg-[var(--bg-hover)] inline-block">
                Choose meta-backup zip
              </span>
              <input
                type="file"
                accept=".zip"
                onChange={handleImportMetaFile}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </section>

      {/* Typed Confirmation Modal for Export: Type "I want to export" */}
      <TypedConfirmModal
        isOpen={showExportModal}
        title="Confirm export"
        expectedText="I want to export"
        onConfirm={handleConfirmExport}
        onCancel={() => {
          setShowExportModal(false);
          setPendingExportAction(null);
        }}
      />
    </div>
  );
}
