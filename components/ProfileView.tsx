'use client';

import React, { useState, useEffect } from 'react';
import { Artist, SocialLink, InspirationItem, SocialPlatform } from '../lib/types';
import { MAJOR_GENRES, getSubGenresForGenre } from '../lib/genres';
import { CustomDropdown } from './CustomDropdown';
import { TypedConfirmModal } from './ConfirmModal';
import { extractUsername } from './AddArtistView';
import { ExternalLink, Image as ImageIcon, X } from 'lucide-react';
import { saveFileToDb, getBlobUrlForFileId, deleteFileFromDb } from '../lib/db';
import { ImageCropModal } from './ImageCropModal';

interface ProfileViewProps {
  artist: Artist;
  onUpdate: (updated: Artist) => void;
  onDelete: (artistId: string) => void;
  existingLabels: string[];
  customGenres: { [genre: string]: string[] };
  onAddCustomGenre: (genre: string, subGenre?: string) => void;
}

export function ProfileView({
  artist,
  onUpdate,
  onDelete,
  existingLabels,
  customGenres,
  onAddCustomGenre,
}: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form states
  const [name, setName] = useState(artist.name);
  const [actualName, setActualName] = useState(artist.actualName || '');
  const [biography, setBiography] = useState(artist.biography || '');
  const [socialDob, setSocialDob] = useState(artist.socialDob || '');
  const [label, setLabel] = useState(artist.label || '');
  const [genre, setGenre] = useState(artist.genre || '');
  const [subGenre, setSubGenre] = useState(artist.subGenre || '');
  const [style, setStyle] = useState(artist.style || '');
  const [averageBpm, setAverageBpm] = useState<number | string>(artist.averageBpm || '');
  const [category, setCategory] = useState<'independent' | 'dependent'>(artist.category || 'independent');
  const [distributor, setDistributor] = useState(artist.distributor || '');
  const [wikipediaUrl, setWikipediaUrl] = useState(artist.wikipediaUrl || '');
  const [socials, setSocials] = useState<SocialLink[]>(artist.socials || []);
  const [inspirations, setInspirations] = useState<InspirationItem[]>(artist.inspirations || []);

  // Profile image + banner state (URL or local file)
  const [profileImageUrl, setProfileImageUrl] = useState(artist.profileImageUrl || '');
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImageRemoved, setProfileImageRemoved] = useState(false);
  const [bannerImageUrl, setBannerImageUrl] = useState(artist.bannerImageUrl || '');
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null);
  const [bannerImageRemoved, setBannerImageRemoved] = useState(false);

  // Crop modal state — when a raw File is picked, we open the crop modal
  // with the chosen target aspect ratio before accepting it.
  const [cropTarget, setCropTarget] = useState<null | { file: File; aspect: number; title: string }>(null);

  // Live blob URL previews when a local file is selected (works in both view & edit mode)
  const [profilePreviewUrl, setProfilePreviewUrl] = useState<string | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);

  // Resolve stored file blob URLs for the view mode
  useEffect(() => {
    let mounted = true;
    let profileObjectUrl: string | null = null;
    let bannerObjectUrl: string | null = null;
    async function resolve() {
      if (artist.profileImageFileId && !profileImageRemoved) {
        const url = await getBlobUrlForFileId(artist.profileImageFileId!);
        if (mounted && url) {
          profileObjectUrl = url;
          setProfilePreviewUrl(url);
        }
      }
      if (artist.bannerImageFileId && !bannerImageRemoved) {
        const url = await getBlobUrlForFileId(artist.bannerImageFileId!);
        if (mounted && url) {
          bannerObjectUrl = url;
          setBannerPreviewUrl(url);
        }
      }
    }
    resolve();
    return () => {
      mounted = false;
      // Don't revoke cached blob URLs from getBlobUrlForFileId — they're cached globally.
    };
  }, [artist.profileImageFileId, artist.bannerImageFileId, profileImageRemoved, bannerImageRemoved]);

  // Generate local object URLs when user picks a new file in edit mode
  useEffect(() => {
    if (!profileImageFile) {
      // keep existing resolved blob url if any
      return;
    }
    const url = URL.createObjectURL(profileImageFile);
    setProfilePreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setProfilePreviewUrl(null);
    };
  }, [profileImageFile]);

  useEffect(() => {
    if (!bannerImageFile) return;
    const url = URL.createObjectURL(bannerImageFile);
    setBannerPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setBannerPreviewUrl(null);
    };
  }, [bannerImageFile]);

  // The actual src to render for profile + banner (URL > file preview > none)
  const displayProfileSrc =
    profileImageRemoved ? null : (profileImageUrl || profilePreviewUrl || null);
  const displayBannerSrc =
    bannerImageRemoved ? null : (bannerImageUrl || bannerPreviewUrl || null);

  const builtInGenreList = MAJOR_GENRES.map((g) => g.genre);
  const customGenreList = Object.keys(customGenres);
  const allGenres = Array.from(new Set([...builtInGenreList, ...customGenreList]));
  const availableSubGenres = genre ? getSubGenresForGenre(genre, customGenres) : [];

  const handleStartEdit = () => {
    setShowEditConfirm(true);
  };

  const handleConfirmEdit = () => {
    setShowEditConfirm(false);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Persist any newly selected local files to IndexedDB
    let profileImageFileId: string | undefined = artist.profileImageFileId;
    if (profileImageFile) {
      profileImageFileId = 'prof_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      await saveFileToDb(profileImageFileId, profileImageFile, profileImageFile.name);
      // If replacing an older stored file, delete the old one to save space
      if (artist.profileImageFileId && artist.profileImageFileId !== profileImageFileId) {
        deleteFileFromDb(artist.profileImageFileId).catch(() => {});
      }
    } else if (profileImageRemoved) {
      if (artist.profileImageFileId) deleteFileFromDb(artist.profileImageFileId).catch(() => {});
      profileImageFileId = undefined;
    }

    let bannerImageFileId: string | undefined = artist.bannerImageFileId;
    if (bannerImageFile) {
      bannerImageFileId = 'ban_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      await saveFileToDb(bannerImageFileId, bannerImageFile, bannerImageFile.name);
      if (artist.bannerImageFileId && artist.bannerImageFileId !== bannerImageFileId) {
        deleteFileFromDb(artist.bannerImageFileId).catch(() => {});
      }
    } else if (bannerImageRemoved) {
      if (artist.bannerImageFileId) deleteFileFromDb(artist.bannerImageFileId).catch(() => {});
      bannerImageFileId = undefined;
    }

    const updated: Artist = {
      ...artist,
      name: name.trim(),
      actualName: actualName.trim(),
      biography: biography.trim(),
      socialDob: socialDob.trim(),
      label: label.trim(),
      genre: genre.trim(),
      subGenre: subGenre.trim(),
      style: style.trim(),
      averageBpm: averageBpm || '',
      category,
      distributor: distributor.trim(),
      wikipediaUrl: wikipediaUrl.trim(),
      socials,
      inspirations,
      profileImageUrl: profileImageUrl.trim() || undefined,
      profileImageFileId,
      bannerImageUrl: bannerImageUrl.trim() || undefined,
      bannerImageFileId,
      updatedAt: new Date().toISOString(),
    };
    onUpdate(updated);
    setIsEditing(false);
    setProfileImageFile(null);
    setBannerImageFile(null);
    setProfileImageRemoved(false);
    setBannerImageRemoved(false);
  };

  const handleAddSocial = () => {
    const newSocial: SocialLink = {
      id: 'soc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      platform: 'instagram',
      url: '',
      username: '',
      bioUsed: '',
      postCount: '',
      otherMediaCount: '',
    };
    setSocials([...socials, newSocial]);
  };

  const handleUpdateSocial = (id: string, updates: Partial<SocialLink>) => {
    setSocials(
      socials.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, ...updates };
        if (updates.url && !updates.username) {
          const auto = extractUsername(updates.url, updated.platform);
          if (auto) updated.username = auto;
        }
        return updated;
      })
    );
  };

  const handleRemoveSocial = (id: string) => {
    setSocials(socials.filter((s) => s.id !== id));
  };

  const handleAddInspiration = () => {
    setInspirations([
      ...inspirations,
      {
        id: 'insp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        artistName: '',
        url: '',
      },
    ]);
  };

  const handleUpdateInspiration = (id: string, updates: Partial<InspirationItem>) => {
    setInspirations(
      inspirations.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleRemoveInspiration = (id: string) => {
    setInspirations(inspirations.filter((item) => item.id !== id));
  };

  // Crop modal renderer — shared by both view and edit modes (since a crop
  // could be triggered from either). The crop modal sits at z-50 above
  // everything else, so it can be returned at the end of either JSX branch.
  const renderCropModal = () => (
    <ImageCropModal
      isOpen={!!cropTarget}
      file={cropTarget?.file || null}
      aspectRatio={cropTarget?.aspect || 1}
      title={cropTarget?.title || 'crop image'}
      onConfirm={(croppedFile) => {
        if (!cropTarget) return;
        if (cropTarget.aspect === 1) {
          setProfileImageFile(croppedFile);
          setProfileImageRemoved(false);
        } else if (cropTarget.aspect === 3) {
          setBannerImageFile(croppedFile);
          setBannerImageRemoved(false);
        }
        setCropTarget(null);
      }}
      onCancel={() => setCropTarget(null)}
    />
  );

  // VIEW MODE
  if (!isEditing) {
    return (
      <div className="w-full max-w-lg mx-auto p-3 text-xs leading-relaxed space-y-4">
        {/* Controls at the top */}
        <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)]">
          <span className="font-semibold text-[var(--text)]">Profile</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleStartEdit}
              className="px-2 py-0.5 border border-[var(--border)] bg-[var(--bg)] rounded-[3px] text-[11px] text-[var(--text)] hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              Edit profile
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-[11px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer"
            >
              Delete artist
            </button>
          </div>
        </div>

        {/* Banner (wide, responsive) with circular profile picture overlay */}
        {/* NOTE: outer section has NO overflow-hidden so the profile pic can hang
            below the banner without being clipped. The banner div clips its own image. */}
        <section className="relative w-full">
          {/* Responsive banner: short on phones, taller on wider screens. */}
          <div className="w-full aspect-[16/5] sm:aspect-[16/4] md:aspect-[3/1] bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-[4px] flex items-center justify-center overflow-hidden">
            {displayBannerSrc ? (
              <img
                src={displayBannerSrc}
                alt={`${artist.name} banner`}
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="w-8 h-8 text-[var(--text-faint)]" />
            )}
          </div>

          {/* Profile picture — circular, overlapping bottom-left of banner, responsive size */}
          <div className="absolute left-3 -bottom-6 sm:left-4 sm:-bottom-7">
            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-[var(--bg)] border-[3px] border-[var(--bg)] shadow-md overflow-hidden flex items-center justify-center ring-1 ring-[var(--border-light)]">
              {displayProfileSrc ? (
                <img
                  src={displayProfileSrc}
                  alt={`${artist.name} profile`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-base sm:text-lg md:text-xl font-bold text-[var(--text)] uppercase">
                  {(artist.name || '?').charAt(0)}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Document Layout - Minimal, continuous, no excessive boxes */}
        <section className="space-y-1 pt-7 sm:pt-8">
          <div className="text-base font-bold text-[var(--text)]">{artist.name}</div>
          {artist.actualName && (
            <div className="text-[11px] text-[var(--text-muted)]">Actual name: {artist.actualName}</div>
          )}
          <div className="text-[11px] text-[var(--text-muted)]">
            <span>{artist.category ? artist.category.charAt(0).toUpperCase() + artist.category.slice(1) : ''}</span>
            {artist.label && <span> · Label: {artist.label}</span>}
            {artist.distributor && <span> · Distributor: {artist.distributor}</span>}
          </div>
        </section>

        <section className="border-t border-[var(--border-light)] pt-2 space-y-1">
          <div className="text-[11px] text-[var(--text-muted)]">
            <span className="text-[var(--text)] font-medium">Genre: </span>
            {artist.genre || 'none'}
          </div>
          {artist.subGenre && (
            <div className="text-[11px] text-[var(--text-muted)]">
              <span className="text-[var(--text)] font-medium">Sub genre: </span>
              {artist.subGenre}
            </div>
          )}
          {artist.style && (
            <div className="text-[11px] text-[var(--text-muted)]">
              <span className="text-[var(--text)] font-medium">Style: </span>
              {artist.style}
            </div>
          )}
          {artist.averageBpm && (
            <div className="text-[11px] text-[var(--text-muted)]">
              <span className="text-[var(--text)] font-medium">Average bpm: </span>
              {artist.averageBpm}
            </div>
          )}
          {artist.socialDob && (
            <div className="text-[11px] text-[var(--text-muted)]">
              <span className="text-[var(--text)] font-medium">Social dob: </span>
              {artist.socialDob}
            </div>
          )}
        </section>

        {artist.biography && (
          <section className="border-t border-[var(--border-light)] pt-2">
            <div className="text-[11px] font-medium text-[var(--text)] mb-1">Biography</div>
            <div className="text-[12px] text-[var(--text)] whitespace-pre-wrap">{artist.biography}</div>
          </section>
        )}

        {artist.wikipediaUrl && (
          <section className="border-t border-[var(--border-light)] pt-2">
            <div className="text-[11px] font-medium text-[var(--text)] mb-1">Wikipedia</div>
            <a
              href={artist.wikipediaUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--text)] underline hover:text-[var(--text-muted)] inline-flex items-center gap-1"
            >
              <span>{artist.wikipediaUrl}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </section>
        )}

        {artist.socials && artist.socials.length > 0 && (
          <section className="border-t border-[var(--border-light)] pt-2 space-y-1.5">
            <div className="text-[11px] font-medium text-[var(--text)]">Socials</div>
            <div className="space-y-1">
              {artist.socials.map((s) => (
                <div key={s.id} className="text-[11px] text-[var(--text-muted)] flex items-start justify-between">
                  <div>
                    <span className="text-[var(--text)] font-medium">
                      {s.platform === 'custom' && s.customTitle ? s.customTitle : s.platform}:
                    </span>{' '}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-[var(--text)]"
                    >
                      {s.username || s.url}
                    </a>
                    {s.postCount && <span className="text-[var(--text-faint)] ml-1">[{s.postCount} posts]</span>}
                    {s.bioUsed && <div className="text-[var(--text-muted)] text-[10px] mt-0.5">{s.bioUsed}</div>}
                    {s.otherMediaCount && (
                      <div className="text-[var(--text-muted)] text-[10px]">{s.otherMediaCount}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {artist.inspirations && artist.inspirations.length > 0 && (
          <section className="border-t border-[var(--border-light)] pt-2 space-y-1.5">
            <div className="text-[11px] font-medium text-[var(--text)]">Inspiration / styled from</div>
            <div className="space-y-1">
              {artist.inspirations.map((insp) => (
                <div key={insp.id} className="text-[11px] text-[var(--text-muted)]">
                  <span className="font-medium text-[var(--text)]">{insp.artistName}</span>
                  {insp.url && (
                    <span className="ml-1">
                      (
                      <a
                        href={insp.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-[var(--text)]"
                      >
                        link
                      </a>
                      )
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Typed Confirmations */}
        <TypedConfirmModal
          isOpen={showEditConfirm}
          title="Edit artist profile"
          expectedText="I want to edit"
          onConfirm={handleConfirmEdit}
          onCancel={() => setShowEditConfirm(false)}
        />

        <TypedConfirmModal
          isOpen={showDeleteConfirm}
          title={`Delete artist ${artist.name}`}
          expectedText={`I want to delete ${artist.name}`}
          onConfirm={() => {
            setShowDeleteConfirm(false);
            onDelete(artist.id);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />

        {renderCropModal()}
      </div>
    );
  }

  // EDIT MODE
  return (
    <div className="w-full max-w-lg mx-auto p-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)] mb-3">
        <span className="font-semibold text-[var(--text)]">Edit profile</span>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        {/* Banner + Profile picture uploader */}
        <div className="space-y-2 border border-[var(--border-light)] rounded-[3px] p-2 bg-[var(--bg-secondary)]">
          {/* Banner upload */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] text-[var(--text-muted)]">Banner (wide image)</label>
              {(displayBannerSrc || bannerImageUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    setBannerImageFile(null);
                    setBannerImageUrl('');
                    setBannerImageRemoved(true);
                  }}
                  className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer inline-flex items-center gap-0.5"
                >
                  <X className="w-2.5 h-2.5" /> Remove banner
                </button>
              )}
            </div>
            <div className="w-full aspect-[16/5] sm:aspect-[16/4] md:aspect-[3/1] bg-[var(--bg)] border border-[var(--border-light)] overflow-hidden flex items-center justify-center rounded-[3px] relative">
              {displayBannerSrc ? (
                <img
                  src={displayBannerSrc}
                  alt="banner preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-[10px] text-[var(--text-faint)] flex flex-col items-center gap-1">
                  <ImageIcon className="w-5 h-5" />
                  <span>Banner preview</span>
                </div>
              )}
            </div>
            <input
              type="url"
              placeholder="Cdn banner url"
              value={bannerImageUrl}
              onChange={(e) => {
                setBannerImageUrl(e.target.value);
                setBannerImageRemoved(false);
              }}
              className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px] mt-1"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                if (f) {
                  setCropTarget({ file: f, aspect: 3, title: 'crop banner' });
                }
                e.target.value = '';
              }}
              className="text-[11px] text-[var(--text-muted)] mt-1"
            />
          </div>

          {/* Profile picture upload */}
          <div className="pt-1 border-t border-[var(--border-light)]">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] text-[var(--text-muted)]">Profile picture (square)</label>
              {(displayProfileSrc || profileImageUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    setProfileImageFile(null);
                    setProfileImageUrl('');
                    setProfileImageRemoved(true);
                  }}
                  className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] underline cursor-pointer inline-flex items-center gap-0.5"
                >
                  <X className="w-2.5 h-2.5" /> Remove profile
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-full bg-[var(--bg)] border border-[var(--border-light)] overflow-hidden flex items-center justify-center">
                {displayProfileSrc ? (
                  <img
                    src={displayProfileSrc}
                    alt="profile preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-base font-bold text-[var(--text)] uppercase">
                    {(name || '?').charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <input
                  type="url"
                  placeholder="Cdn profile image url"
                  value={profileImageUrl}
                  onChange={(e) => {
                    setProfileImageUrl(e.target.value);
                    setProfileImageRemoved(false);
                  }}
                  className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (f) {
                      setCropTarget({ file: f, aspect: 1, title: 'crop profile picture' });
                    }
                    e.target.value = '';
                  }}
                  className="text-[11px] text-[var(--text-muted)]"
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-[var(--text-muted)] mb-0.5">Artist name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-[var(--border-light)] p-1.5 bg-[var(--bg)] text-[var(--text)] rounded-[2px]"
          />
        </div>

        <div>
          <label className="block text-[11px] text-[var(--text-muted)] mb-0.5">Actual name</label>
          <input
            type="text"
            value={actualName}
            onChange={(e) => setActualName(e.target.value)}
            className="w-full border border-[var(--border-light)] p-1.5 bg-[var(--bg)] text-[var(--text)] rounded-[2px]"
          />
        </div>

        <div>
          <label className="block text-[11px] text-[var(--text-muted)] mb-0.5">Biography</label>
          <textarea
            rows={4}
            value={biography}
            onChange={(e) => setBiography(e.target.value)}
            className="w-full border border-[var(--border-light)] p-1.5 bg-[var(--bg)] text-[var(--text)] rounded-[2px]"
          />
        </div>

        <div>
          <label className="block text-[11px] text-[var(--text-muted)] mb-0.5">Wikipedia url</label>
          <input
            type="url"
            value={wikipediaUrl}
            onChange={(e) => setWikipediaUrl(e.target.value)}
            className="w-full border border-[var(--border-light)] p-1.5 bg-[var(--bg)] text-[var(--text)] rounded-[2px]"
          />
        </div>

        <div>
          <label className="block text-[11px] text-[var(--text-muted)] mb-0.5">Social dob</label>
          <input
            type="date"
            value={socialDob}
            onChange={(e) => setSocialDob(e.target.value)}
            className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] rounded-[2px]"
          />
        </div>

        <div>
          <label className="block text-[11px] text-[var(--text-muted)] mb-0.5">Label</label>
          <CustomDropdown
            value={label}
            options={existingLabels}
            onChange={(val) => setLabel(val)}
            allowCustom
            emptyLabel="Choose or add label"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] mb-0.5">Genre</label>
            <CustomDropdown
              value={genre}
              options={allGenres}
              onChange={(val) => {
                setGenre(val);
                setSubGenre('');
                if (!allGenres.includes(val)) {
                  onAddCustomGenre(val);
                }
              }}
              allowCustom
              emptyLabel="Select genre"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] mb-0.5">Sub genre</label>
            <CustomDropdown
              value={subGenre}
              options={availableSubGenres}
              onChange={(val) => {
                setSubGenre(val);
                if (genre && !availableSubGenres.includes(val)) {
                  onAddCustomGenre(genre, val);
                }
              }}
              allowCustom
              disabled={!genre}
              emptyLabel={genre ? 'Select sub genre' : 'Pick genre first'}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] mb-0.5">Style</label>
            <input
              type="text"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full border border-[var(--border-light)] p-1.5 bg-[var(--bg)] text-[var(--text)] rounded-[2px]"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] mb-0.5">Average bpm</label>
            <input
              type="number"
              value={averageBpm}
              onChange={(e) => setAverageBpm(e.target.value)}
              className="w-full border border-[var(--border-light)] p-1.5 bg-[var(--bg)] text-[var(--text)] rounded-[2px]"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-[var(--text-muted)] mb-0.5">Category</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCategory('independent')}
              className={`flex-1 py-1 px-2 border rounded-[3px] cursor-pointer ${
                category === 'independent'
                  ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]'
                  : 'bg-[var(--bg)] text-[var(--text)] border-[var(--border-light)]'
              }`}
            >
              Independent
            </button>
            <button
              type="button"
              onClick={() => setCategory('dependent')}
              className={`flex-1 py-1 px-2 border rounded-[3px] cursor-pointer ${
                category === 'dependent'
                  ? 'bg-[var(--accent)] text-[var(--accent-text)] border-[var(--border)]'
                  : 'bg-[var(--bg)] text-[var(--text)] border-[var(--border-light)]'
              }`}
            >
              Dependent
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-[var(--text-muted)] mb-0.5">Distributor</label>
          <input
            type="text"
            value={distributor}
            onChange={(e) => setDistributor(e.target.value)}
            className="w-full border border-[var(--border-light)] p-1.5 bg-[var(--bg)] text-[var(--text)] rounded-[2px]"
          />
        </div>

        {/* Socials Editor */}
        <div className="pt-2 border-t border-[var(--border-light)]">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-[var(--text)] text-[11px]">Socials</span>
            <button
              type="button"
              onClick={handleAddSocial}
              className="text-[11px] underline text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
            >
              + Add social
            </button>
          </div>

          <div className="space-y-2">
            {socials.map((s) => (
              <div key={s.id} className="p-2 border border-[var(--border-light)] rounded-[3px] space-y-1 bg-[var(--bg-secondary)]">
                <div className="flex items-center justify-between gap-1">
                  <div className="w-1/2">
                    <CustomDropdown
                      value={s.platform}
                      options={[
                        'instagram',
                        'x',
                        'facebook',
                        'spotify',
                        'apple music',
                        'mastodon',
                        'bluesky',
                        'youtube',
                        'tiktok',
                        'soundcloud',
                        'bandcamp',
                        'threads',
                        'custom',
                      ]}
                      onChange={(val) => handleUpdateSocial(s.id, { platform: val as SocialPlatform })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSocial(s.id)}
                    className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] cursor-pointer underline"
                  >
                    Remove
                  </button>
                </div>
                {s.platform === 'custom' && (
                  <div>
                    <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Custom title</label>
                    <input
                      type="text"
                      value={s.customTitle || ''}
                      onChange={(e) => handleUpdateSocial(s.id, { customTitle: e.target.value })}
                      className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Url</label>
                  <input
                    type="url"
                    value={s.url}
                    onChange={(e) => handleUpdateSocial(s.id, { url: e.target.value })}
                    className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Username</label>
                    <input
                      type="text"
                      value={s.username}
                      onChange={(e) => handleUpdateSocial(s.id, { username: e.target.value })}
                      className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Posts</label>
                    <input
                      type="text"
                      value={s.postCount || ''}
                      onChange={(e) => handleUpdateSocial(s.id, { postCount: e.target.value })}
                      className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Bio used there</label>
                  <input
                    type="text"
                    value={s.bioUsed || ''}
                    onChange={(e) => handleUpdateSocial(s.id, { bioUsed: e.target.value })}
                    className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Other media / notes</label>
                  <input
                    type="text"
                    value={s.otherMediaCount || ''}
                    onChange={(e) => handleUpdateSocial(s.id, { otherMediaCount: e.target.value })}
                    className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Inspirations */}
        <div className="pt-2 border-t border-[var(--border-light)]">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-[var(--text)] text-[11px]">Inspiration / styled from</span>
            <button
              type="button"
              onClick={handleAddInspiration}
              className="text-[11px] underline text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
            >
              + Add inspiration
            </button>
          </div>
          <div className="space-y-1.5">
            {inspirations.map((item) => (
              <div key={item.id} className="p-1.5 border border-[var(--border-light)] rounded-[3px] bg-[var(--bg-secondary)] space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[var(--text-muted)]">Artist</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveInspiration(item.id)}
                    className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] cursor-pointer underline"
                  >
                    Remove
                  </button>
                </div>
                <input
                  type="text"
                  value={item.artistName}
                  onChange={(e) => handleUpdateInspiration(item.id, { artistName: e.target.value })}
                  className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                />
                <label className="block text-[10px] text-[var(--text-muted)]">Song link</label>
                <input
                  type="url"
                  value={item.url}
                  onChange={(e) => handleUpdateInspiration(item.id, { url: e.target.value })}
                  className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] text-xs rounded-[2px]"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="flex-1 py-1.5 bg-[var(--accent)] text-[var(--accent-text)] border border-[var(--border)] rounded-[3px] text-xs hover:bg-[var(--accent-hover)] cursor-pointer"
          >
            Save changes
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="px-3 py-1.5 bg-[var(--bg)] text-[var(--text)] border border-[var(--border-light)] rounded-[3px] text-xs hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
      {renderCropModal()}
    </div>
  );
}
