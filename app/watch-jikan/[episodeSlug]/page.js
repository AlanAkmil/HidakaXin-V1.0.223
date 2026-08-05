import Link from 'next/link';
import jikan from '../../../lib/jikanScraper';
import HistoryRecorder from '../../../components/HistoryRecorder';

export const revalidate = 600;

async function getData(episodeSlug) {
  try {
    return await jikan.episode(episodeSlug);
  } catch {
    return null;
  }
}

export default async function WatchJikanPage({ params }) {
  const episodeSlug = params.episodeSlug;
  const ep = await getData(episodeSlug);

  if (!ep) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-ink-soft">Episode tidak ditemukan atau sumber sedang bermasalah.</p>
        <Link href="/" className="mt-4 inline-block font-semibold text-accent">← Kembali ke Beranda</Link>
      </div>
    );
  }

  const detailHref = `/anime-jikan/${ep.animeId}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <HistoryRecorder
        item={{
          url: `jikan:${episodeSlug}`,
          title: ep.title,
          image: ep.poster,
          source: 'jikan'
        }}
      />

      <Link href={detailHref} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-accent">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
        </svg>
        Kembali ke detail
      </Link>

      <h1 className="mb-2 font-display text-xl font-extrabold text-ink sm:text-2xl">{ep.title}</h1>
      <p className="mb-4 text-xs text-ink-faint">Sub Inggris / bahasa asli — nggak ada sub Indonesia di sumber ini.</p>

      <div className="aspect-video w-full overflow-hidden rounded-xl border border-line bg-black shadow-card">
        <iframe
          src={ep.iframeUrl}
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="no-referrer"
          className="h-full w-full"
        />
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        {ep.prevEpisode ? (
          <Link href={`/watch-jikan/${ep.prevEpisode}`} className="text-sm font-semibold text-ink-soft hover:text-accent">← Sebelumnya</Link>
        ) : <span />}
        <Link href={detailHref} className="text-sm font-bold text-accent">Semua Episode</Link>
        {ep.nextEpisode ? (
          <Link href={`/watch-jikan/${ep.nextEpisode}`} className="text-sm font-semibold text-ink-soft hover:text-accent">Selanjutnya →</Link>
        ) : <span />}
      </div>
    </div>
  );
}
