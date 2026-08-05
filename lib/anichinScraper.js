// Alternate donghua source, wrapping the "iFilm" JSON API
// (vps-donghuawatch.vercel.app) instead of scraping HTML directly. The
// original author hadn't been able to confirm the exact response field
// names either (no sandbox internet access when they wrote it), so this
// ports their own defensive "try several likely field names" approach
// rather than assuming one fixed shape.
const axios = require('axios');

const API_BASE = 'https://vps-donghuawatch.vercel.app';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://ifilm.web.id/',
    'Origin': 'https://ifilm.web.id'
  }
});

async function apiGet(path) {
  const res = await client.get(path);
  if (res.data?.success === false) throw new Error(res.data?.error || `Gagal fetch ${path}`);
  return res.data;
}

// ---------- defensive field helpers (ported from js/common.js) ----------

function pick(obj, keys, fallback = null) {
  if (!obj) return fallback;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return fallback;
}

function unwrapData(json) {
  let d = json.data !== undefined ? json.data : json;
  if (d && d.data !== undefined && typeof d.data === 'object' && !Array.isArray(d.data)) d = d.data;
  return d;
}

function extractList(json) {
  if (!json) return [];
  let d = json.data !== undefined ? json.data : json;
  for (let i = 0; i < 5; i++) {
    if (Array.isArray(d)) return d;
    if (d && typeof d === 'object') {
      const candidates = ['data', 'results', 'list', 'items', 'animeList', 'donghuaList', 'anime', 'donghua'];
      let found = false;
      for (const key of candidates) {
        if (Array.isArray(d[key])) { d = d[key]; found = true; break; }
      }
      if (found) continue;
      const arrProp = Object.values(d).find((v) => Array.isArray(v));
      if (arrProp) { d = arrProp; continue; }
    }
    break;
  }
  return Array.isArray(d) ? d : [];
}

function rawSlugFrom(item) {
  const raw = pick(item, ['slug', 'href', 'link', 'url', 'id']);
  if (!raw) return null;
  const parts = String(raw).split('/').filter(Boolean);
  return parts[parts.length - 1];
}

// For series-level items (home/completed/schedule/search listings, and the
// "back to series" reference inside an episode's own detail response).
// Anichin's ongoing/schedule listings link to the latest EPISODE, not the
// series itself — e.g. "one-slash-to-the-heavens-episode-03-subtitle-indonesia".
// The series detail route needs the series slug, so strip that suffix off.
function getSeriesSlugFrom(item) {
  const last = rawSlugFrom(item);
  if (!last) return null;
  return last.replace(/-episode-\d+(-subtitle-indonesia)?\/?$/i, '');
}

// For individual episode entries inside a series' episode list — these must
// KEEP their full slug (including "-episode-N-...") since that's what
// distinguishes one episode from another when routing to /watch-ac/[slug].
function getEpisodeSlugFrom(item) {
  return rawSlugFrom(item);
}

// Normalizes a raw list item into the same shape used across the app
// (matches what normalizeDonghua()/AnimeCard already expect).
function mapListItem(item) {
  const slug = getSeriesSlugFrom(item);
  if (!slug) return null;
  return {
    title: pick(item, ['title', 'judul', 'name'], 'Tanpa Judul'),
    url: `https://placeholder.invalid/${slug}`, // slug is what matters for routing; see anichin routes
    slug,
    image: pick(item, ['poster', 'thumbnail', 'thumb', 'image', 'img', 'cover', 'gambar']),
    episode: pick(item, ['episode', 'ep', 'current_episode', 'latestEpisode', 'episode_number']),
    status: pick(item, ['status', 'type_status'], 'Ongoing'),
    genres: (() => {
      const g = pick(item, ['category', 'type', 'genre', 'genres'], []);
      if (Array.isArray(g)) return g.map((x) => (typeof x === 'object' ? pick(x, ['name'], '') : x)).filter(Boolean);
      return g ? [g] : [];
    })(),
    rating: pick(item, ['rating', 'score'])
  };
}

class AnichinScraper {
  constructor() {
    this.base = API_BASE;
  }

  async home(page = 1) {
    const json = await apiGet(`/api/ongoing/${page}`);
    const items = extractList(json).map(mapListItem).filter(Boolean);
    return { items };
  }

  async completed(page = 1) {
    const json = await apiGet(`/api/completed/${page}`);
    const items = extractList(json).map(mapListItem).filter(Boolean);
    return { items };
  }

  async schedule() {
    const json = await apiGet('/api/schedule');
    // Defensive: schedule shape is unconfirmed too — try common day-keyed
    // object shape first, else try an array with a `day`/`hari` field per item.
    const d = unwrapData(json);
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      const result = {};
      for (const [key, val] of Object.entries(d)) {
        if (Array.isArray(val)) result[key] = val.map(mapListItem).filter(Boolean);
      }
      if (Object.keys(result).length) return result;
    }
    const list = extractList(json);
    if (list.length) {
      const result = {};
      for (const item of list) {
        const day = pick(item, ['day', 'hari', 'weekday'], 'Lainnya');
        if (!result[day]) result[day] = [];
        const mapped = mapListItem(item);
        if (mapped) result[day].push(mapped);
      }
      return result;
    }
    return {};
  }

  async search(query, page = 1) {
    const json = await apiGet(`/api/search/${encodeURIComponent(query)}/${page}`);
    const items = extractList(json).map(mapListItem).filter(Boolean);
    return { items };
  }

  async detail(slug) {
    const json = await apiGet(`/api/detail/${encodeURIComponent(slug)}`);
    const d = unwrapData(json);
    const info = d.donghua_details || d;

    const genreRaw = pick(info, ['genre', 'genres', 'category'], []);
    const genres = Array.isArray(genreRaw)
      ? genreRaw.map((g) => (typeof g === 'object' ? pick(g, ['name'], '') : g)).filter(Boolean)
      : genreRaw ? [genreRaw] : [];

    const candidates = ['episodes_list', 'episode_list', 'episodeList', 'episodes', 'list_episode', 'listEpisode', 'daftar_episode'];
    let episodesRaw = [];
    for (const key of candidates) {
      if (Array.isArray(d[key])) { episodesRaw = d[key]; break; }
    }
    if (!episodesRaw.length) {
      for (const val of Object.values(d)) {
        if (Array.isArray(val) && val.length && typeof val[0] === 'object') { episodesRaw = val; break; }
      }
    }

    return {
      slug,
      title: pick(info, ['title', 'judul', 'name'], 'Tanpa Judul'),
      image: pick(info, ['poster', 'thumbnail', 'thumb', 'image', 'img', 'cover', 'gambar']),
      synopsis: pick(info, ['synopsis', 'sinopsis', 'description', 'desc']),
      status: pick(info, ['status', 'type_status'], 'Ongoing'),
      genres,
      episodesList: episodesRaw.map((ep) => ({
        title: pick(ep, ['title', 'episode', 'name'], 'Episode'),
        slug: getEpisodeSlugFrom(ep)
      })).filter((e) => e.slug)
    };
  }

  async episode(slug) {
    const json = await apiGet(`/api/episode/${encodeURIComponent(slug)}`);
    const d = unwrapData(json);

    let servers = [];
    if (d.streaming && Array.isArray(d.streaming.servers)) {
      servers = d.streaming.servers.map((s) => ({ label: pick(s, ['name'], 'Server'), url: pick(s, ['url']) }));
    } else {
      for (const key of ['servers', 'server_list', 'streaming_servers']) {
        if (Array.isArray(d[key])) {
          servers = d[key].map((s) => ({ label: pick(s, ['name', 'label'], 'Server'), url: pick(s, ['url', 'link']) }));
          break;
        }
      }
    }
    servers = servers.filter((s) => /^https?:\/\//i.test(s.url || ''));

    let defaultPlayer = null;
    if (d.streaming?.main_url?.url) defaultPlayer = d.streaming.main_url.url;
    else if (servers.length) defaultPlayer = servers[0].url;
    else defaultPlayer = pick(d, ['stream_url', 'streamUrl', 'embed', 'embed_url', 'player', 'video_url', 'videoUrl']);
    if (!/^https?:\/\//i.test(defaultPlayer || '')) defaultPlayer = servers[0]?.url || null;

    const downloads = [];
    const dl = d.download_url || d.download || d.downloads;
    if (dl && typeof dl === 'object' && !Array.isArray(dl)) {
      for (const [quality, providers] of Object.entries(dl)) {
        if (providers && typeof providers === 'object' && !Array.isArray(providers)) {
          const links = Object.entries(providers).map(([provider, url]) => ({ label: provider, url }));
          downloads.push({ subtitle: quality.replace(/^mp4_/i, '').toUpperCase(), links });
        }
      }
    }

    let seriesSlug = null;
    let seriesTitle = null;
    let seriesImage = null;
    if (d.donghua_details) {
      seriesTitle = pick(d.donghua_details, ['title'], null);
      seriesSlug = getSeriesSlugFrom(d.donghua_details);
      seriesImage = pick(d.donghua_details, ['poster', 'thumbnail', 'thumb', 'image', 'img', 'cover', 'gambar']);
    }

    return {
      title: pick(d, ['title', 'episode'], 'Episode'),
      defaultPlayer,
      servers,
      downloads,
      seriesTitle,
      seriesSlug,
      seriesImage
    };
  }
}

module.exports = new AnichinScraper();
module.exports.AnichinScraper = AnichinScraper;
