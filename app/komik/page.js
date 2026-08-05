import SearchBar from '../../components/SearchBar';
import MangaCard from '../../components/MangaCard';
import Pagination from '../../components/Pagination';
import manga from '../../lib/mangaScraper';
import webtoons from '../../lib/webtoonsScraper';
import { normalizeWestmanhwa, normalizeWebtoon, shuffleTogether } from '../../lib/normalize';

export const revalidate = 300;

async function getData(page) {
  const [westPayload, wtPayload] = await Promise.all([
    manga.home(page).catch(() => null),
    webtoons.trending('daily').catch(() => null)
  ]);
  return { west: westPayload, webtoon: wtPayload };
}

export default async function KomikPage({ searchParams }) {
  const page = parseInt(searchParams?.page || '1');
  const { west, webtoon } = await getData(page);

  const merged = shuffleTogether(
    (west?.items || []).map(normalizeWestmanhwa),
    (webtoon || []).map(normalizeWebtoon)
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <h1 className="mb-1 font-display text-2xl font-extrabold text-ink">Komik</h1>
      <p className="mb-4 text-sm text-ink-soft">Baca manga, manhwa, manhua, & Webtoons — dua sumber digabung.</p>

      <div className="mb-6">
        <SearchBar defaultValue="" action="/komik/cari" placeholder="Cari komik.." />
      </div>

      {!west && !webtoon && (
        <p className="rounded-xl border border-line bg-paper-card p-6 text-center text-ink-soft shadow-card">
          Gagal memuat daftar komik. Coba lagi sebentar.
        </p>
      )}

      {merged.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {merged.map((item, i) => (
              <MangaCard key={item.url + i} item={item} index={i} />
            ))}
          </div>
          <Pagination current={page} total={west?.next ? page + 1 : page} basePath="/komik" />
        </>
      )}
    </div>
  );
}
