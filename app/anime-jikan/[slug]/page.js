import Link from 'next/link';
import jikan from '../../../lib/jikanScraper';

export const revalidate = 600;

async function getData(malId) {
  try {
    return await jikan.detail(malId);
  } catch {
    return null;
  }
}

export default async function AnimeJikanDetailPage({ params }) {
  const malId = params.slug;
  const d = await getData(malId);

  if (!d) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-ink-soft">Anime tidak ditemukan atau sumber sedang bermasalah.</p>
        <Link href="/" className="mt-4 inline-block font-semibold text-accent">← Kembali ke Beranda</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
        <div className="overflow-hidden rounded-xl border border-line shadow-card">
          {d.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.poster} alt={d.title} className="w-full object-cover" />
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center bg-paper-soft text-ink-faint font-display text-4xl">?</div>
          )}
        </div>

        <div>
          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 text-[10px] font-bold uppercase text-accent">
            Anime · Jikan (MAL)
          </span>
          <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">{d.title}</h1>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {d.genres?.map((g) => (
              <span key={g.slug} className="rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent">{g.name}</span>
            ))}
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {d.status && <Info label="Status" value={d.status} />}
            {d.type && <Info label="Tipe" value={d.type} />}
            {d.released && <Info label="Rilis" value={d.released} />}
            {d.duration && <Info label="Durasi" value={d.duration} />}
            {d.studio && <Info label="Studio" value={d.studio} />}
            {d.rating && <Info label="Rating MAL" value={`★ ${d.rating}`} />}
            {d.totalEps && <Info label="Total Eps" value={d.totalEps} />}
          </dl>

          <div className="mt-3 rounded-lg border border-gold/40 bg-gold-soft px-3 py-2 text-xs text-ink">
            Sumber ini nggak ada subtitle Indonesia — cuma tersedia bahasa aslinya (Jepang) atau sub Inggris.
          </div>

          {d.synopsis && (
            <div className="mt-5">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-faint">Sinopsis</p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{d.synopsis}</p>
            </div>
          )}
        </div>
      </div>

      {d.episodes?.length > 0 && (
        <div className="mt-8">
          <p className="mb-3 font-display text-lg font-extrabold text-ink">Daftar Episode ({d.episodes.length})</p>
          <div className="max-h-[480px] space-y-1.5 overflow-y-auto pr-1">
            {d.episodes.map((ep) => (
              <Link
                key={ep.slug}
                href={`/watch-jikan/${ep.slug}`}
                className="flex items-center justify-between rounded-xl border border-line bg-paper-card px-4 py-2.5 text-sm shadow-card transition hover:border-accent"
              >
                <span className="font-semibold text-ink">{ep.title}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-faint">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="text-ink-soft">{value}</dd>
    </div>
  );
}
