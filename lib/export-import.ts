import JSZip from 'jszip';
import {
  Artist,
  Release,
  Achievement,
  ArtworkEntry,
  LyricsDocument,
  NoteDocument,
  FeaturePerson,
  BackupLog,
  MetaBackupData,
} from './types';
import { AppDataStore, getFileFromDb, saveFileToDb } from './db';

// Sanitize filename
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-z0-9_\-\.]/gi, '_').toLowerCase();
}

// 1. Text, CSV, Markdown Exports for Sharing / AI
export function generateArtistTxt(artist: Artist, releases: Release[]): string {
  let out = `ARTIST SUMMARY\n`;
  out += `==============\n`;
  out += `artist name: ${artist.name}\n`;
  out += `actual name: ${artist.actualName || '-'}\n`;
  out += `category: ${artist.category}\n`;
  out += `label: ${artist.label || '-'}\n`;
  out += `genre: ${artist.genre}${artist.subGenre ? ` / ${artist.subGenre}` : ''}\n`;
  out += `style: ${artist.style || '-'}\n`;
  out += `average bpm: ${artist.averageBpm || '-'}\n`;
  out += `distributor: ${artist.distributor || '-'}\n`;
  out += `social dob: ${artist.socialDob || '-'}\n\n`;

  if (artist.biography) {
    out += `biography:\n${artist.biography}\n\n`;
  }

  if (artist.socials && artist.socials.length > 0) {
    out += `socials:\n`;
    for (const s of artist.socials) {
      out += `- ${s.platform}: ${s.url} (user: ${s.username || '-'})\n`;
    }
    out += `\n`;
  }

  if (artist.inspirations && artist.inspirations.length > 0) {
    out += `inspirations:\n`;
    for (const insp of artist.inspirations) {
      out += `- ${insp.artistName}: ${insp.url}\n`;
    }
    out += `\n`;
  }

  out += `RELEASES & ALBUMS\n`;
  out += `=================\n`;
  for (const r of releases) {
    out += `[${r.isReleased ? 'released' : 'unreleased'}] ${r.title} (${r.type})\n`;
    if (r.year || r.releaseDate) out += `  date: ${r.year || r.releaseDate}\n`;
    out += `  genre: ${r.genre}${r.subGenre ? ` / ${r.subGenre}` : ''}\n`;
    if (r.tracks && r.tracks.length > 0) {
      out += `  tracks (${r.tracks.length}):\n`;
      for (const t of r.tracks) {
        out += `    ${t.trackNumber}. ${t.title}${t.duration ? ` [${t.duration}]` : ''}\n`;
      }
    }
    if (r.credits && r.credits.length > 0) {
      out += `  credits: ${r.credits.map((c) => `${c.role}: ${c.name}`).join(', ')}\n`;
    }
    out += `\n`;
  }
  return out;
}

export function generateArtistCsv(artist: Artist, releases: Release[]): string {
  const rows: string[][] = [
    ['type', 'title', 'status', 'year_date', 'genre', 'subgenre', 'track_count', 'credits'],
  ];

  for (const r of releases) {
    const creditsStr = (r.credits || []).map((c) => `${c.role}: ${c.name}`).join('; ');
    rows.push([
      `"${r.type.replace(/"/g, '""')}"`,
      `"${r.title.replace(/"/g, '""')}"`,
      r.isReleased ? 'released' : 'unreleased',
      `"${(r.year || r.releaseDate || '').replace(/"/g, '""')}"`,
      `"${r.genre.replace(/"/g, '""')}"`,
      `"${(r.subGenre || '').replace(/"/g, '""')}"`,
      String(r.tracks?.length || (r.type === 'single' ? 1 : 0)),
      `"${creditsStr.replace(/"/g, '""')}"`,
    ]);
  }

  return rows.map((r) => r.join(',')).join('\n');
}

export function generateArtistMd(artist: Artist, releases: Release[]): string {
  let md = `# ${artist.name}\n\n`;
  md += `**actual name:** ${artist.actualName || '-'}\n`;
  md += `**category:** ${artist.category} | **label:** ${artist.label || '-'} | **distributor:** ${artist.distributor || '-'}\n`;
  md += `**genre:** ${artist.genre} ${artist.subGenre ? `(${artist.subGenre})` : ''} | **style:** ${artist.style || '-'} | **average bpm:** ${artist.averageBpm || '-'}\n\n`;

  if (artist.biography) {
    md += `## biography\n\n${artist.biography}\n\n`;
  }

  if (artist.socials && artist.socials.length > 0) {
    md += `## socials\n\n`;
    for (const s of artist.socials) {
      md += `- **${s.platform}:** [${s.username || s.url}](${s.url})\n`;
    }
    md += `\n`;
  }

  md += `## discography & releases\n\n`;
  for (const r of releases) {
    md += `### ${r.title} *(${r.type}, ${r.isReleased ? 'released' : 'unreleased'}${r.year ? `, ${r.year}` : ''})*\n\n`;
    md += `- **genre:** ${r.genre}${r.subGenre ? ` / ${r.subGenre}` : ''}\n`;
    if (r.tracks && r.tracks.length > 0) {
      md += `- **tracks:**\n`;
      for (const t of r.tracks) {
        md += `  ${t.trackNumber}. ${t.title}${t.duration ? ` (${t.duration})` : ''}\n`;
      }
    }
    if (r.credits && r.credits.length > 0) {
      md += `- **credits:**\n`;
      for (const c of r.credits) {
        md += `  - ${c.role}: ${c.name}${c.email ? ` <${c.email}>` : ''}\n`;
      }
    }
    md += `\n`;
  }

  return md;
}

// 2. Isolated Artist Backup ZIP
export async function createArtistBackupZip(
  artist: Artist,
  appData: AppDataStore
): Promise<{ blob: Blob; fileName: string; log: BackupLog }> {
  const zip = new JSZip();

  const artistReleases = appData.releases.filter((r) => r.artistId === artist.id);
  const artistAchievements = appData.achievements.filter((a) => a.artistId === artist.id);
  const artistLyrics = appData.lyrics.filter((l) => l.artistId === artist.id);
  const artistNotes = appData.notes.filter((n) => n.artistId === artist.id || !n.artistId);
  const artistArtworks = appData.artworks.filter((a) => a.artistId === artist.id);

  // Folder: /profile.json
  zip.file('artist-profile.json', JSON.stringify(artist, null, 2));

  // Folder: /profile-files/ (profile picture + banner image blobs if stored locally)
  if (artist.profileImageFileId) {
    const stored = await getFileFromDb(artist.profileImageFileId);
    if (stored && stored.blob) {
      zip.file(`profile-files/${artist.profileImageFileId}`, stored.blob);
    }
  }
  if (artist.bannerImageFileId) {
    const stored = await getFileFromDb(artist.bannerImageFileId);
    if (stored && stored.blob) {
      zip.file(`profile-files/${artist.bannerImageFileId}`, stored.blob);
    }
  }

  // Folder: /releases/
  const releasesFolder = zip.folder('releases');
  if (releasesFolder) {
    releasesFolder.file('releases.json', JSON.stringify(artistReleases, null, 2));
  }

  // Folder: /achievements/
  const achFolder = zip.folder('achievements');
  if (achFolder) {
    achFolder.file('achievements.json', JSON.stringify(artistAchievements, null, 2));
  }

  // Folder: /notes/ (saved as title{date}.md)
  const notesFolder = zip.folder('notes');
  if (notesFolder) {
    notesFolder.file('notes-manifest.json', JSON.stringify(artistNotes, null, 2));
    for (const note of artistNotes) {
      const safeTitle = sanitizeFileName(note.title || 'untitled');
      const safeDate = (note.date || 'nodate').replace(/[^a-z0-9]/gi, '-');
      const filename = `${safeTitle}{${safeDate}}.md`;
      notesFolder.file(filename, `# ${note.title}\n\ndate: ${note.date}\n\n${note.body}`);
    }
  }

  // Folder: /lyrics/
  const lyricsFolder = zip.folder('lyrics');
  if (lyricsFolder) {
    lyricsFolder.file('lyrics-manifest.json', JSON.stringify(artistLyrics, null, 2));
    for (const l of artistLyrics) {
      const safeName = sanitizeFileName(l.fileName || 'lyrics');
      lyricsFolder.file(`${safeName}.txt`, l.lyrics);
    }
  }

  // Folder: /artworks/
  const artworksFolder = zip.folder('artworks');
  if (artworksFolder) {
    artworksFolder.file('artworks-manifest.json', JSON.stringify(artistArtworks, null, 2));
    // Embed any local files if available
    for (const art of artistArtworks) {
      if (art.imageFileId) {
        const stored = await getFileFromDb(art.imageFileId);
        if (stored && stored.blob) {
          artworksFolder.file(`files/${art.imageFileId}`, stored.blob);
        }
      }
    }
  }

  // Summary AI export files inside backup
  zip.file('export_summary.txt', generateArtistTxt(artist, artistReleases));
  zip.file('export_summary.csv', generateArtistCsv(artist, artistReleases));
  zip.file('export_summary.md', generateArtistMd(artist, artistReleases));

  const blob = await zip.generateAsync({ type: 'blob' });
  const fileName = `${sanitizeFileName(artist.name)}-backup.zip`;

  const log: BackupLog = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    timestamp: new Date().toISOString(),
    type: 'artist',
    artistId: artist.id,
    artistName: artist.name,
    itemCounts: {
      releases: artistReleases.length,
      achievements: artistAchievements.length,
      lyrics: artistLyrics.length,
      notes: artistNotes.length,
      artworks: artistArtworks.length,
    },
    notes: `isolated backup for artist ${artist.name}`,
  };

  return { blob, fileName, log };
}

// 3. Meta Backup ZIP (meta-backup.zip)
export async function createMetaBackupZip(
  appData: AppDataStore
): Promise<{ blob: Blob; fileName: string; log: BackupLog }> {
  const zip = new JSZip();

  const metaData: MetaBackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    logs: appData.backupLogs,
    artistSnapshots: appData.artists.map((art) => ({
      artistId: art.id,
      artistName: art.name,
      lastBackedUpAt:
        appData.backupLogs
          .filter((l) => l.artistId === art.id)
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.timestamp || 'never',
      releaseCount: appData.releases.filter((r) => r.artistId === art.id).length,
      achievementsCount: appData.achievements.filter((a) => a.artistId === art.id).length,
      lyricsCount: appData.lyrics.filter((l) => l.artistId === art.id).length,
      notesCount: appData.notes.filter((n) => n.artistId === art.id).length,
    })),
  };

  zip.file('meta-manifest.json', JSON.stringify(metaData, null, 2));
  zip.file('full-database.json', JSON.stringify(appData, null, 2));

  // Also include markdown summary of backup tracking for human reading
  let trackingMd = `# meta backup tracking report\n\n`;
  trackingMd += `exported at: ${metaData.exportedAt}\n`;
  trackingMd += `total artists: ${appData.artists.length}\n`;
  trackingMd += `total releases: ${appData.releases.length}\n`;
  trackingMd += `total achievements: ${appData.achievements.length}\n`;
  trackingMd += `total notes: ${appData.notes.length}\n`;
  trackingMd += `total lyrics: ${appData.lyrics.length}\n\n`;
  trackingMd += `## artist snapshots\n\n`;
  for (const snap of metaData.artistSnapshots) {
    trackingMd += `- **${snap.artistName}:** ${snap.releaseCount} releases, ${snap.notesCount} notes, ${snap.lyricsCount} lyrics. last backup: ${snap.lastBackedUpAt}\n`;
  }
  trackingMd += `\n## historical logs\n\n`;
  for (const l of appData.backupLogs) {
    trackingMd += `- [${l.timestamp}] ${l.type} backup ${l.artistName ? `(${l.artistName})` : ''} - ${l.notes || ''}\n`;
  }
  zip.file('tracking-report.md', trackingMd);

  const blob = await zip.generateAsync({ type: 'blob' });
  const fileName = 'meta-backup.zip';

  const log: BackupLog = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    timestamp: new Date().toISOString(),
    type: 'meta',
    itemCounts: {
      artists: appData.artists.length,
      releases: appData.releases.length,
      achievements: appData.achievements.length,
      lyrics: appData.lyrics.length,
      notes: appData.notes.length,
      features: appData.features.length,
      misc: appData.typeBeats.length + appData.moodboardItems.length,
    },
    notes: 'full meta backup generated',
  };

  return { blob, fileName, log };
}

// 4. Import Handler for Artist Backup ZIP
export async function importArtistBackupZip(
  file: File
): Promise<{
  artist: Artist;
  releases: Release[];
  achievements: Achievement[];
  lyrics: LyricsDocument[];
  notes: NoteDocument[];
  artworks: ArtworkEntry[];
}> {
  const zip = await JSZip.loadAsync(file);

  // Artist profile
  const profileFile = zip.file('artist-profile.json');
  if (!profileFile) {
    throw new Error('invalid artist backup zip: missing artist-profile.json');
  }
  const artist: Artist = JSON.parse(await profileFile.async('string'));

  // Restore profile picture + banner image blobs (if present in the zip)
  const profileFiles = zip.file(/^profile-files\//);
  for (const f of profileFiles) {
    const fileId = f.name.replace(/^profile-files\//, '');
    if (!fileId) continue;
    try {
      const blob = await f.async('blob');
      await saveFileToDb(fileId, blob, fileId);
    } catch {
      // best-effort: skip files that fail to restore
    }
  }

  // Releases
  let releases: Release[] = [];
  const releasesFile = zip.file('releases/releases.json');
  if (releasesFile) {
    releases = JSON.parse(await releasesFile.async('string'));
  }

  // Achievements
  let achievements: Achievement[] = [];
  const achFile = zip.file('achievements/achievements.json');
  if (achFile) {
    achievements = JSON.parse(await achFile.async('string'));
  }

  // Lyrics
  let lyrics: LyricsDocument[] = [];
  const lyricsManifest = zip.file('lyrics/lyrics-manifest.json');
  if (lyricsManifest) {
    lyrics = JSON.parse(await lyricsManifest.async('string'));
  }

  // Notes
  let notes: NoteDocument[] = [];
  const notesManifest = zip.file('notes/notes-manifest.json');
  if (notesManifest) {
    notes = JSON.parse(await notesManifest.async('string'));
  }

  // Artworks
  let artworks: ArtworkEntry[] = [];
  const artManifest = zip.file('artworks/artworks-manifest.json');
  if (artManifest) {
    artworks = JSON.parse(await artManifest.async('string'));
  }

  return { artist, releases, achievements, lyrics, notes, artworks };
}

// 5. Import Handler for Meta Backup ZIP
export async function importMetaBackupZip(file: File): Promise<AppDataStore> {
  const zip = await JSZip.loadAsync(file);

  const fullDbFile = zip.file('full-database.json');
  if (fullDbFile) {
    const data: AppDataStore = JSON.parse(await fullDbFile.async('string'));
    return data;
  }

  const metaManifest = zip.file('meta-manifest.json');
  if (!metaManifest) {
    throw new Error('invalid meta backup zip: missing meta-manifest.json or full-database.json');
  }

  throw new Error('database structure missing in meta backup');
}

// Helper to trigger browser file download
export function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
