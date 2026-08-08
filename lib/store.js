'use client';

/**
 * Storage abstraction layer.
 *
 * When the person is logged in (Supabase Auth — Google OAuth via
 * AuthPanel.jsx), favorites and reading/watch history are stored in
 * Supabase tables keyed by user_id, so they sync across every device
 * signed into the same account. When logged out, everything falls back to
 * localStorage exactly like before, so the app still works with zero login.
 *
 * IMPORTANT for callers: every function here returns a Promise now (even
 * the ones that used to be plain sync reads), because a signed-in read has
 * to await a Supabase query. Fire-and-forget calls (pushHistory,
 * pushNovelHistory, pushKomikHistory from a recorder's useEffect) don't
 * need to change at the call site. Anything that reads the return value
 * (getHistory, getFavorites, isFavorite, toggleFavorite, etc.) needs an
 * `await` — see ContinueWatching.jsx / FavoriteButton.jsx for the pattern.
 *
 * Run supabase-schema.sql once in the Supabase SQL editor before this will
 * do anything for logged-in users — it creates the favorites/history/
 * novel_history/komik_history tables with row-level security so each
 * account only ever sees its own rows.
 */

import { supabase } from './supabaseClient';

const KEYS = {
  favorites: 'hidakaxin:favorites',
  history: 'hidakaxin:history',
  chat: 'hidakaxin:chat',
  profile: 'hidakaxin:profile',
  novelHistory: 'hidakaxin:novel:history',
  komikHistory: 'hidakaxin:komik:history',
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
    notify(key);
  } catch {
    // storage full or unavailable — fail silently, app still usable
  }
}

function notify(key) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('hidakaxin:storage', { detail: { key } }));
  } catch {
    // ignore
  }
}

async function getUserId() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

// ---------- Favorites ----------

export async function getFavorites() {
  const uid = await getUserId();
  if (!uid) return read(KEYS.favorites, []);
  const { data, error } = await supabase
    .from('favorites')
    .select('item')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });
  if (error) return read(KEYS.favorites, []);
  return (data || []).map((row) => row.item);
}

export async function isFavorite(url) {
  const favs = await getFavorites();
  return favs.some((f) => f.url === url);
}

export async function toggleFavorite(item) {
  const uid = await getUserId();
  if (!uid) {
    const current = read(KEYS.favorites, []);
    const exists = current.some((f) => f.url === item.url);
    const next = exists ? current.filter((f) => f.url !== item.url) : [{ ...item, savedAt: Date.now() }, ...current];
    write(KEYS.favorites, next);
    return !exists;
  }

  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', uid)
    .eq('url', item.url)
    .maybeSingle();

  if (existing) {
    await supabase.from('favorites').delete().eq('id', existing.id);
    notify(KEYS.favorites);
    return false;
  }
  await supabase.from('favorites').insert({ user_id: uid, url: item.url, item: { ...item, savedAt: Date.now() } });
  notify(KEYS.favorites);
  return true;
}

// ---------- Watch history (anime/donghua) ----------

export async function getHistory() {
  const uid = await getUserId();
  if (!uid) return read(KEYS.history, []);
  const { data, error } = await supabase
    .from('history')
    .select('item')
    .eq('user_id', uid)
    .order('watched_at', { ascending: false })
    .limit(40);
  if (error) return read(KEYS.history, []);
  return (data || []).map((row) => row.item);
}

export async function pushHistory(item) {
  const uid = await getUserId();
  const enriched = { ...item, watchedAt: Date.now() };
  if (!uid) {
    const current = read(KEYS.history, []).filter((h) => h.url !== item.url);
    const next = [enriched, ...current].slice(0, 40);
    write(KEYS.history, next);
    return;
  }
  await supabase
    .from('history')
    .upsert({ user_id: uid, url: item.url, item: enriched, watched_at: new Date().toISOString() }, { onConflict: 'user_id,url' });
  notify(KEYS.history);
}

export async function clearHistory() {
  const uid = await getUserId();
  if (!uid) {
    write(KEYS.history, []);
    return;
  }
  await supabase.from('history').delete().eq('user_id', uid);
  notify(KEYS.history);
}

// ---------- Novel reading history ----------
// Kept in its own table/key instead of reusing history above, because
// AnimeCard's routing logic (isAnichin/isSanka/else) doesn't know about a
// 'novel' source and would build a broken link for these entries if they
// were mixed into the generic history list.

export async function getNovelHistory() {
  const uid = await getUserId();
  if (!uid) return read(KEYS.novelHistory, []);
  const { data, error } = await supabase
    .from('novel_history')
    .select('item')
    .eq('user_id', uid)
    .order('read_at', { ascending: false })
    .limit(40);
  if (error) return read(KEYS.novelHistory, []);
  return (data || []).map((row) => row.item);
}

export async function pushNovelHistory(item) {
  const uid = await getUserId();
  const enriched = { ...item, readAt: Date.now() };
  if (!uid) {
    const current = read(KEYS.novelHistory, []).filter((h) => h.chapterUrl !== item.chapterUrl);
    const next = [enriched, ...current].slice(0, 40);
    write(KEYS.novelHistory, next);
    return;
  }
  await supabase
    .from('novel_history')
    .upsert(
      { user_id: uid, chapter_url: item.chapterUrl, item: enriched, read_at: new Date().toISOString() },
      { onConflict: 'user_id,chapter_url' }
    );
  notify(KEYS.novelHistory);
}

export async function clearNovelHistory() {
  const uid = await getUserId();
  if (!uid) {
    write(KEYS.novelHistory, []);
    return;
  }
  await supabase.from('novel_history').delete().eq('user_id', uid);
  notify(KEYS.novelHistory);
}

// ---------- Komik reading history (incl. Webtoons) ----------
// Same reasoning as novel history above.

export async function getKomikHistory() {
  const uid = await getUserId();
  if (!uid) return read(KEYS.komikHistory, []);
  const { data, error } = await supabase
    .from('komik_history')
    .select('item')
    .eq('user_id', uid)
    .order('read_at', { ascending: false })
    .limit(40);
  if (error) return read(KEYS.komikHistory, []);
  return (data || []).map((row) => row.item);
}

export async function pushKomikHistory(item) {
  const uid = await getUserId();
  const enriched = { ...item, readAt: Date.now() };
  if (!uid) {
    const current = read(KEYS.komikHistory, []).filter((h) => h.chapterUrl !== item.chapterUrl);
    const next = [enriched, ...current].slice(0, 40);
    write(KEYS.komikHistory, next);
    return;
  }
  await supabase
    .from('komik_history')
    .upsert(
      { user_id: uid, chapter_url: item.chapterUrl, item: enriched, read_at: new Date().toISOString() },
      { onConflict: 'user_id,chapter_url' }
    );
  notify(KEYS.komikHistory);
}

export async function clearKomikHistory() {
  const uid = await getUserId();
  if (!uid) {
    write(KEYS.komikHistory, []);
    return;
  }
  await supabase.from('komik_history').delete().eq('user_id', uid);
  notify(KEYS.komikHistory);
}

// ---------- One-time migration: local device data → Google account ----------
// Called from AuthSync.jsx right after a successful login. Pushes whatever
// was saved locally (favorites + all 3 history types) up to Supabase, then
// clears the local copies. Guarded by a flag so it only runs once per
// browser per account.

export async function migrateLocalDataToAccount() {
  const uid = await getUserId();
  if (!uid || typeof window === 'undefined') return;

  const flagKey = `hidakaxin:migrated:${uid}`;
  if (window.localStorage.getItem(flagKey)) return;

  try {
    const localFavs = read(KEYS.favorites, []);
    for (const item of localFavs) {
      await supabase.from('favorites').upsert({ user_id: uid, url: item.url, item }, { onConflict: 'user_id,url' });
    }

    const localHistory = read(KEYS.history, []);
    for (const item of localHistory) {
      await supabase.from('history').upsert(
        { user_id: uid, url: item.url, item, watched_at: new Date(item.watchedAt || Date.now()).toISOString() },
        { onConflict: 'user_id,url' }
      );
    }

    const localNovel = read(KEYS.novelHistory, []);
    for (const item of localNovel) {
      await supabase.from('novel_history').upsert(
        { user_id: uid, chapter_url: item.chapterUrl, item, read_at: new Date(item.readAt || Date.now()).toISOString() },
        { onConflict: 'user_id,chapter_url' }
      );
    }

    const localKomik = read(KEYS.komikHistory, []);
    for (const item of localKomik) {
      await supabase.from('komik_history').upsert(
        { user_id: uid, chapter_url: item.chapterUrl, item, read_at: new Date(item.readAt || Date.now()).toISOString() },
        { onConflict: 'user_id,chapter_url' }
      );
    }

    write(KEYS.favorites, []);
    write(KEYS.history, []);
    write(KEYS.novelHistory, []);
    write(KEYS.komikHistory, []);
    window.localStorage.setItem(flagKey, '1');
    notify(KEYS.favorites);
  } catch {
    // best-effort — if migration fails, local data just stays local and
    // nothing breaks; the person can keep using the app normally.
  }
}

// ---------- App theme (light / dark) ----------
// Stays device-local on purpose — no reason to sync dark mode across
// devices, and it needs to be readable before Supabase has even responded
// (see the no-flash script in app/layout.js).

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
