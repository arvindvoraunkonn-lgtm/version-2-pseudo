import {
  Artist,
  Release,
  Achievement,
  ArtworkEntry,
  LyricsDocument,
  NoteDocument,
  FeaturePerson,
  TypeBeatSample,
  ArtworkIdea,
  MusicVideoIdea,
  CustomMiscEntry,
  MoodboardFolder,
  MoodboardItem,
  BackupLog,
  JasmineFolder,
  JasmineEntry,
  DaisyEntry,
} from './types';

const DB_NAME = 'artist_document_db';
const DB_VERSION = 1;

interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  createdAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available in SSR'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store', { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

export async function saveFileToDb(id: string, file: File | Blob, name: string): Promise<string> {
  const db = await getDb();
  const record: StoredFile = {
    id,
    name,
    type: file.type,
    size: file.size,
    blob: file,
    createdAt: new Date().toISOString(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    const req = store.put(record);
    req.onsuccess = () => resolve(id);
    req.onerror = () => reject(req.error);
  });
}

export async function getFileFromDb(id: string): Promise<StoredFile | null> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const store = tx.objectStore('files');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteFileFromDb(id: string): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      const store = tx.objectStore('files');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}

// App data storage
export interface AppDataStore {
  artists: Artist[];
  releases: Release[];
  achievements: Achievement[];
  artworks: ArtworkEntry[];
  lyrics: LyricsDocument[];
  notes: NoteDocument[];
  features: FeaturePerson[];
  typeBeats: TypeBeatSample[];
  artworkIdeas: ArtworkIdea[];
  videoIdeas: MusicVideoIdea[];
  miscCustom: CustomMiscEntry[];
  moodboardFolders: MoodboardFolder[];
  moodboardItems: MoodboardItem[];
  backupLogs: BackupLog[];
  customGenres: { [genre: string]: string[] };
  // JASmine — saved lyrics search results from lrclib.net
  jasmineFolders: JasmineFolder[];
  jasmineEntries: JasmineEntry[];
  // DAISY — saved song-title generations + optional lyrics/artwork
  daisyEntries: DaisyEntry[];
}

const STORAGE_KEY = 'artist_document_data_v1';

export async function saveAppData(data: AppDataStore): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    // 1. Save metadata to localStorage for synchronous instant availability
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('localStorage full or unavailable, relying on IndexedDB', e);
  }

  try {
    // 2. Also persist in IndexedDB for resilience and unlimited data
    const db = await getDb();
    const tx = db.transaction('store', 'readwrite');
    const store = tx.objectStore('store');
    store.put({ key: 'app_data', data, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.warn('error saving app data to indexedDB', e);
  }
}

export async function loadAppData(): Promise<AppDataStore | null> {
  if (typeof window === 'undefined') return null;

  // Try IndexedDB first for latest full payload
  try {
    const db = await getDb();
    const result = await new Promise<{ key: string; data: AppDataStore } | undefined>((resolve, reject) => {
      const tx = db.transaction('store', 'readonly');
      const store = tx.objectStore('store');
      const req = store.get('app_data');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (result && result.data) {
      return result.data;
    }
  } catch (e) {
    console.warn('error loading from indexedDB, trying localStorage', e);
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('error loading from localStorage', e);
  }

  return null;
}

// Memory blob URL cache to prevent memory leaks and provide instant playback
const blobUrlCache = new Map<string, string>();

export async function getBlobUrlForFileId(fileId: string): Promise<string | null> {
  if (blobUrlCache.has(fileId)) {
    return blobUrlCache.get(fileId)!;
  }
  const file = await getFileFromDb(fileId);
  if (!file || !file.blob) return null;
  const url = URL.createObjectURL(file.blob);
  blobUrlCache.set(fileId, url);
  return url;
}
