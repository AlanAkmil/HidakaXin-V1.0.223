import Link from 'next/link';
import HistoryRecorder from '../../../../../components/HistoryRecorder';

// Webtoons.com loads its actual comic panel images via client-side
// JavaScript after the page loads — a server-side fetch (like everything
// else in this app) only ever sees transparent placeholders in the raw
// HTML, never the real panel image URLs. That's a platform limitation, not
// something fixable with better selectors, so this reader honestly sends
// people to read the chapter on webtoons.com itself instead of pretending
// to show it in-app.

export default function WebtoonReaderPage({ params }) {
  const url = decodeURIComponent(params.slug);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <HistoryRecorder item={{ url, title: 'Webtoons episode', source: 'webtoons' }} />

      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-50">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ff5a36" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 3h7v7M21 3l-9 9M5 5h6M5 5v14h14v-6" />
        </svg>
      </div>
      <p className="font-display text-lg font-extrabold text-ink">Baca di Webtoons.com</p>
      <p className="mt-2 text-sm text-ink-soft">
        Webtoons.com muat gambar chapter-nya lewat JavaScript, jadi nggak bisa ditampilin langsung di sini. Ketuk
        tombol di bawah buat baca chapter ini di situs resminya.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white"
      >
        Buka Chapter →
      </a>
      <Link href="/komik" className="mt-4 text-sm font-semibold text-ink-faint hover:text-accent">
        ← Kembali ke Komik
      </Link>
    </div>
  );
}
