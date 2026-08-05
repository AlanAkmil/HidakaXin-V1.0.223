const BASE_URL = 'https://api.jikan.moe/v4';

// Jikan's public rate limit is ~3 req/sec / 60 req/min — cap ourselves
// comfortably under that, same pattern used for sankaScraper.
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_LIMIT = 40;
const WINDOW_MS = 60 * 1000;
const requestTimestamps = [];

async function waitForSlot() {
  while (true) {
    const now = Date.now();
    while (requestTimestamps.length && now - requestTimestamps[0] > WINDOW_MS) {
      requestTimestamps.shift();
    }
    if (requestTimestamps.length < REQUEST_LIMIT) {
      requestTimestamps.push(now);
      return;
    }
    await new Promise((r) => setTimeout(r, WINDOW_MS - (now - requestTimestamps[0]) + 50));
  }
}

async function fetchJikan(endpoint) {
  const cached = cache.get(endpoint);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) return cached.data;

  await waitForSlot();
  try {
    const res = await fetch(BASE_URL + endpoint);
    if (!res.ok) throw new Error(`Jikan ${res.status} for ${endpoint}`);
    const data = await res.json();
    cache.set(endpoint, { data, time: Date.now() });
    return data;
  } catch (e) {
    console.error('Jikan fetch failed:', e.message);
    return { data: [], pagination: { has_next_page: false } };
  }
}

function mapAnime(item) {
  return {
    title: item.title,
    slug: String(item.mal_id),
    poster: item.images?.webp?.image_url || item.images?.jpg?.image_url || null,
    status: item.status || null,
    type: item.type || null,
    episode: item.episodes ? `${item.episodes} Eps` : null,
    rating: item.score || null,
    season: item.season ? `${item.season} ${item.year}` : null
  };
}

async function listFrom(endpoint, page) {
  const data = await fetchJikan(endpoint);
  return {
    items: (data.data || []).map(mapAnime),
    page,
    hasNext: data.pagination?.has_next_page || false
  };
}

const JIKAN_DAY_MAP = {
  minggu: 'sunday', senin: 'monday', selasa: 'tuesday', rabu: 'wednesday',
  kamis: 'thursday', jumat: 'friday', sabtu: 'saturday'
};

class JikanScraper {
  async home(page = 1) {
    return listFrom(`/seasons/now?page=${page}`, page);
  }

  async ongoing(page = 1) {
    return listFrom(`/anime?status=airing&order_by=start_date&sort=desc&page=${page}`, page);
  }

  async top(page = 1) {
    return listFrom(`/top/anime?page=${page}`, page);
  }

  async search(query, page = 1) {
    return listFrom(`/anime?q=${encodeURIComponent(query)}&page=${page}`, page);
  }

  async schedule(dayId) {
    const englishDay = JIKAN_DAY_MAP[dayId] || dayId;
    const data = await fetchJikan(`/schedules?filter=${englishDay}`);
    return (data.data || []).map(mapAnime);
  }

  async detail(malId) {
    const [full, eps] = await Promise.all([
      fetchJikan(`/anime/${malId}/full`),
      fetchJikan(`/anime/${malId}/episodes`)
    ]);
    const info = full.data || {};
    const episodes = (eps.data || []).map((ep) => ({
      number: String(ep.mal_id),
      title: ep.title || `Episode ${ep.mal_id}`,
      slug: `${malId}-${ep.mal_id}`,
      date: ep.aired ? new Date(ep.aired).toLocaleDateString('id-ID') : null
    }));

    return {
      slug: String(malId),
      title: info.title || 'Unknown',
      poster: info.images?.webp?.large_image_url || info.images?.jpg?.large_image_url || null,
      rating: info.score || null,
      status: info.status || null,
      studio: info.studios?.[0]?.name || null,
      released: info.aired?.string || null,
      duration: info.duration || null,
      type: info.type || null,
      totalEps: info.episodes ? String(info.episodes) : null,
      genres: (info.genres || []).map((g) => ({ name: g.name, slug: String(g.mal_id) })),
      synopsis: info.synopsis || null,
      episodes
    };
  }

  // compoundSlug format: "{malId}-{episodeMalId}"
  async episode(compoundSlug) {
    const [animeId, ...rest] = compoundSlug.split('-');
    const epId = rest.join('-');

    const [animeFull, epDetail, allEps] = await Promise.all([
      fetchJikan(`/anime/${animeId}`),
      fetchJikan(`/anime/${animeId}/episodes/${epId}`),
      fetchJikan(`/anime/${animeId}/episodes`)
    ]);

    const epData = epDetail.data || {};
    const allEpsData = allEps.data || [];
    const idx = allEpsData.findIndex((e) => String(e.mal_id) === epId);

    return {
      animeId,
      animeTitle: animeFull.data?.title || 'Anime',
      title: epData.title
        ? `${animeFull.data?.title || 'Anime'} — Episode ${epId}: ${epData.title}`
        : `${animeFull.data?.title || 'Anime'} — Episode ${epId}`,
      poster: animeFull.data?.images?.webp?.large_image_url || null,
      // animeplay.cfd embeds by MAL anime id + MAL episode id, sub track only
      // (no Indonesian sub exists for this source — English/original only).
      iframeUrl: `https://animeplay.cfd/stream/mal/${animeId}/${epId}/sub`,
      prevEpisode: idx > 0 ? `${animeId}-${allEpsData[idx - 1].mal_id}` : null,
      nextEpisode: idx >= 0 && idx < allEpsData.length - 1 ? `${animeId}-${allEpsData[idx + 1].mal_id}` : null,
      episodeList: allEpsData.map((e) => ({
        title: e.title || `Episode ${e.mal_id}`,
        slug: `${animeId}-${e.mal_id}`,
        date: e.aired ? new Date(e.aired).toLocaleDateString('id-ID') : null
      }))
    };
  }
}

module.exports = new JikanScraper();
module.exports.JikanScraper = JikanScraper;
