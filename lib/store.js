'use client';

/**
 * Storage abstraction layer.
 *
 * Right now everything is persisted to the browser's localStorage so the
 * app works with zero backend setup. When you're ready to wire up Supabase
 * or Firebase (needed to make Chat actually public across devices/users),
 * you only need to reimplement the functions in this file — every page
 * calls these functions instead of touching localStorage directly.
 *
 * Suggested next step for Chat specifically:
 *  - Supabase: create a `messages` table + use `supabase.channel()` realtime
 *  - Firebase: use a Firestore collection + `onSnapshot()` listener
 */

const KEYS = {
  favorites: 'hidakaxin:favorites',
  history: 'hidakaxin:history',
  chat: 'hidakaxin:chat',
  profile: 'hidakaxin:profile',
  novelHistory: 'hidakaxin:novel:history',
  theme: 'hidakaxin:theme'
};

function read(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('hidakaxin:storage', { detail: { key } }));
  } catch {
    // storage full or unavailable — fail silently, app still usable
  }
}

// ---------- Favorites ----------

export function getFavorites() {
  return read(KEYS.favorites, []);
}

export function isFavorite(url) {
  return getFavorites().some((f) => f.url === url);
}

export function toggleFavorite(item) {
  const current = getFavorites();
  const exists = current.some((f) => f.url === item.url);
  const next = exists ? current.filter((f) => f.url !== item.url) : [{ ...item, savedAt: Date.now() }, ...current];
  write(KEYS.favorites, next);
  return !exists;
}

// ---------- Watch history ----------

export function getHistory() {
  return read(KEYS.history, []);
}

export function pushHistory(item) {
  const current = getHistory().filter((h) => h.url !== item.url);
  const next = [{ ...item, watchedAt: Date.now() }, ...current].slice(0, 40);
  write(KEYS.history, next);
}

export function clearHistory() {
  write(KEYS.history, []);
}

// ---------- Novel reading history ----------
// Kept in its own key instead of reusing getHistory()/pushHistory() above,
// because AnimeCard's routing logic (isAnichin/isSanka/else) doesn't know
// about a 'novel' source and would build a broken /anime or /watch link for
// these entries if they were mixed into the generic history list.

export function getNovelHistory() {
  return read(KEYS.novelHistory, []);
}

export function pushNovelHistory(item) {
  const current = getNovelHistory().filter((h) => h.chapterUrl !== item.chapterUrl);
  const next = [{ ...item, readAt: Date.now() }, ...current].slice(0, 40);
  write(KEYS.novelHistory, next);
}

export function clearNovelHistory() {
  write(KEYS.novelHistory, []);
}

// ---------- App theme (light / dark) ----------
// Applied to <html> via ThemeSync + the no-flash script in app/layout.js,
// so this affects the whole app.

export function getTheme() {
  return read(KEYS.theme, 'light');
}

export function setTheme(theme) {
  write(KEYS.theme, theme === 'dark' ? 'dark' : 'light');
}

// ---------- Public chat (local-only placeholder) ----------

export function getChatMessages() {
  return read(KEYS.chat, []);
}

export function sendChatMessage({ author, text }) {
  const current = getChatMessages();
  const message = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    author: author || 'Anonim',
    text,
    createdAt: Date.now()
  };
  const next = [...current, message].slice(-200);
  write(KEYS.chat, next);
  return message;
}

// ---------- Local profile (display name only, no auth) ----------

export function getProfile() {
  return read(KEYS.profile, { name: 'Penonton', joined: Date.now() });
}

export function setProfileName(name) {
  const current = getProfile();
  const next = { ...current, name };
  write(KEYS.profile, next);
  return next;
}

export const STORAGE_KEYS = KEYS;
