'use client';

/**
 * Tiny localStorage-backed preference helper for view modes.
 * Used by ReleasesView, ArtworksView, and HomeView (artist list/grid)
 * so the user's chosen view mode persists across page navigations and
 * page reloads.
 *
 * All keys are namespaced under `pseudonymous.viewpref.*` to avoid
 * collisions with the app's data store (which lives under a different
 * storage key managed by lib/db.ts).
 */

const PREFIX = 'pseudonymous.viewpref.';

export function loadViewPref(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(PREFIX + key);
    return v || fallback;
  } catch {
    return fallback;
  }
}

export function saveViewPref(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // ignore quota / privacy errors
  }
}
