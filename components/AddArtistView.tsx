'use client';

import React, { useState, useEffect } from 'react';
import { Artist, SocialLink, InspirationItem, SocialPlatform } from '../lib/types';
import { MAJOR_GENRES, getSubGenresForGenre } from '../lib/genres';
import { CustomDropdown } from './CustomDropdown';
import { Image as ImageIcon } from 'lucide-react';
import { saveFileToDb } from '../lib/db';
import { ImageCropModal } from './ImageCropModal';

interface AddArtistViewProps {
  onSave: (artist: Artist) => void;
  onCancel: () => void;
  existingLabels: string[];
  customGenres: { [genre: string]: string[] };
  onAddCustomGenre: (genre: string, subGenre?: string) => void;
}

export function extractUsername(url: string, platform: string): string {
  if (!url) return '';
  try {
    const cleaned = url.trim().replace(/\/+$/, '');
    const urlObj = new URL(cleaned.startsWith('http') ? cleaned : `https://${cleaned}`);
    const pathname = urlObj.pathname;
    const parts = pathname.split('/').filter(Boolean);

    if (platform === 'instagram' || platform === 'x' || platform === 'facebook') {
      return parts[0]?.replace(/^@/, '') || '';
    }
    if (platform === 'bluesky') {
      // bsky.app/profile/username.bsky.social
      const profIdx = parts.indexOf('profile');
      if (profIdx !== -1 && parts[profIdx + 1]) return parts[profIdx + 1];
      return parts[parts.length - 1] || '';
    }
    if (platform === 'mastodon') {
      // instance.social/@username
      const last = parts[parts.length - 1];
      return last?.replace(/^@/, '') || '';
    }
    return parts[parts.length - 1] || '';
  } catch {
    // regex fallback
    const match = url.match(/(?:@|(?:\/))([a-zA-Z0-9_\-\.]+)\/?$/);
    return match ? match[1] : '';
  }
}

export function AddArtistView({
  onSave,
  onCancel,
  existingLabels,
  customGenres,
  onAddCustomGenre,
}: AddArtistViewProps) {
  const [name, setName] = useState('');
  const [actualName, setActualName] = useState('');
  const [biography, setBiography] = useState('');
  const [socialDob, setSocialDob] = useState('');
  const [label, setLabel] = useState('');
  const [genre, setGenre] = useState('');
  const [subGenre, setSubGenre] = useState('');
  const [style, setStyle] = useState('');
  const [averageBpm, setAverageBpm] = useState<number | string>('');
  const [category, setCategory] = useState<'independent' | 'dependent'>('independent');
  const [distributor, setDistributor] = useState('');

  // Socials
  const [socials, setSocials] = useState<SocialLink[]>([]);
  // Inspirations
  const [inspirations, setInspirations] = useState<InspirationItem[]>([]);

  // Profile image + banner state (URL or local file)
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null);

  // Crop modal state — when a raw File is picked, we open the crop modal
  // with the chosen target aspect ratio before accepting it.
  const [cropTarget, setCropTarget] = useState<null | { file: File; aspect: number; title: string }>(null);

  // Live preview URLs for newly picked local files
  const [profilePreviewUrl, setProfilePreviewUrl] = useState<string | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!profileImageFile) return;
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

  const displayProfileSrc = profileImageUrl || profilePreviewUrl || null;
  const displayBannerSrc = bannerImageUrl || bannerPreviewUrl || null;

  // Genre options
  const builtInGenreList = MAJOR_GENRES.map((g) => g.genre);
  const customGenreList = Object.keys(customGenres);
  const allGenres = Array.from(new Set([...builtInGenreList, ...customGenreList]));
  const availableSubGenres = genre ? getSubGenresForGenre(genre, customGenres) : [];

  const handleAddSocial = () => {
    const newSocial: SocialLink = {
      id: 'soc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      platform: 'instagram',
      url: '',
      username: '',
      bioUsed: '',
      postCount: '',
      otherMediaCount: '',
      notes: '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let profileImageFileId: string | undefined;
    if (profileImageFile) {
      profileImageFileId = 'prof_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      await saveFileToDb(profileImageFileId, profileImageFile, profileImageFile.name);
    }

    let bannerImageFileId: string | undefined;
    if (bannerImageFile) {
      bannerImageFileId = 'ban_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      await saveFileToDb(bannerImageFileId, bannerImageFile, bannerImageFile.name);
    }

    const newArtist: Artist = {
      id: 'art_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: name.trim(),
      actualName: actualName.trim(),
      biography: biography.trim(),
      socialDob: socialDob.trim(),
      socials,
      label: label.trim(),
      genre: genre.trim(),
      subGenre: subGenre.trim(),
      style: style.trim(),
      averageBpm: averageBpm || '',
      inspirations,
      category,
      distributor: distributor.trim(),
      profileImageUrl: profileImageUrl.trim() || undefined,
      profileImageFileId,
      bannerImageUrl: bannerImageUrl.trim() || undefined,
      bannerImageFileId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(newArtist);
  };

  return (
    <div className="w-full max-w-lg mx-auto p-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)] mb-3">
        <span className="font-semibold text-[var(--text)]">Add artist</span>
        <button
          type="button"
          onClick={onCancel}
          className="text-[var(--text-muted)] hover:text-[var(--text)] underline cursor-pointer"
        >
          Back
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Banner + Profile picture uploader */}
        <div className="space-y-2 border border-[var(--border-light)] rounded-[3px] p-2 bg-[var(--bg-secondary)]">
          <div>
            <label className="block text-[11px] text-[var(--text-muted)] mb-1">Banner (wide image)</label>
            <div className="w-full aspect-[16/5] sm:aspect-[16/4] md:aspect-[3/1] bg-[var(--bg)] border border-[var(--border-light)] overflow-hidden flex items-center justify-center rounded-[3px]">
              {displayBannerSrc ? (
                <img src={displayBannerSrc} alt="banner preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-[10px] text-[var(--text-faint)] flex flex-col items-center gap-1">
                  <ImageIcon className="w-5 h-5" />
                  <span>banner preview</span>
                </div>
              )}
            </div>
            <input
              type="url"
              placeholder="Cdn banner url"
              value={bannerImageUrl}
              onChange={(e) => setBannerImageUrl(e.target.value)}
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

          <div className="pt-1 border-t border-[var(--border-light)]">
            <label className="block text-[11px] text-[var(--text-muted)] mb-1">Profile picture (square)</label>
            <div className="flex items-center gap-2">
              <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-full bg-[var(--bg)] border border-[var(--border-light)] overflow-hidden flex items-center justify-center">
                {displayProfileSrc ? (
                  <img src={displayProfileSrc} alt="profile preview" className="w-full h-full object-cover" />
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
                  onChange={(e) => setProfileImageUrl(e.target.value)}
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

        {/* 1. Artist name */}
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

        {/* 4. Actual name */}
        <div>
          <label className="block text-[11px] text-[var(--text-muted)] mb-0.5">Actual name</label>
          <input
            type="text"
            value={actualName}
            onChange={(e) => setActualName(e.target.value)}
            className="w-full border border-[var(--border-light)] p-1.5 bg-[var(--bg)] text-[var(--text)] rounded-[2px]"
          />
        </div>

        {/* 2. Biography */}
        <div>
          <label className="block text-[11px] text-[var(--text-muted)] mb-0.5">Biography</label>
          <textarea
            rows={3}
            value={biography}
            onChange={(e) => setBiography(e.target.value)}
            className="w-full border border-[var(--border-light)] p-1.5 bg-[var(--bg)] text-[var(--text)] rounded-[2px]"
          />
        </div>

        {/* 3. Social DOB */}
        <div>
          <label className="block text-[11px] text-[var(--text-muted)] mb-0.5">Social dob (date of birth used on social platforms)</label>
          <input
            type="date"
            value={socialDob}
            onChange={(e) => setSocialDob(e.target.value)}
            className="w-full border border-[var(--border-light)] p-1 bg-[var(--bg)] text-[var(--text)] rounded-[2px]"
          />
        </div>

        {/* 6. Label */}
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

        {/* 7. Genre, Subgenre, Style, Average BPM */}
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

        {/* 9. Category: Independent / Dependent */}
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

        {/* 10. Distributor */}
        <div>
          <label className="block text-[11px] text-[var(--text-muted)] mb-0.5">Distributor</label>
          <input
            type="text"
            value={distributor}
            onChange={(e) => setDistributor(e.target.value)}
            className="w-full border border-[var(--border-light)] p-1.5 bg-[var(--bg)] text-[var(--text)] rounded-[2px]"
          />
        </div>

        {/* 5. Socials */}
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
              <div key={s.id} className="p-2 border border-[var(--border-light)] rounded-[3px] space-y-1.5 bg-[var(--bg-secondary)]">
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
                  <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Other media counts / notes</label>
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

        {/* 8. Inspiration / styled from */}
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
                <label className="block text-[10px] text-[var(--text-muted)]">Spotify, apple music or song link</label>
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

        {/* Proceed button */}
        <div className="pt-3">
          <button
            type="submit"
            className="w-full py-2 bg-[var(--accent)] text-[var(--accent-text)] border border-[var(--border)] rounded-[3px] text-xs hover:bg-[var(--accent-hover)] cursor-pointer"
          >
            Proceed
          </button>
        </div>
      </form>
      <ImageCropModal
        isOpen={!!cropTarget}
        file={cropTarget?.file || null}
        aspectRatio={cropTarget?.aspect || 1}
        title={cropTarget?.title || 'crop image'}
        onConfirm={(croppedFile) => {
          if (!cropTarget) return;
          if (cropTarget.aspect === 1) {
            setProfileImageFile(croppedFile);
          } else if (cropTarget.aspect === 3) {
            setBannerImageFile(croppedFile);
          }
          setCropTarget(null);
        }}
        onCancel={() => setCropTarget(null)}
      />
    </div>
  );
}
