'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AnimeCard from '../../components/AnimeCard';
import { getHistory, clearHistory } from '../../lib/store';

export default function RiwayatPage() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    setItems(getHistory());
    function onStorage() {
      setItems(getHistory());
    }
    window.addEventListener('hidakaxin:storage', onStorage);
    return () => window.removeEventListener('hidakaxin:storage', onStorage);
  }, []);

  function handleClear() {
    clearHistory();
    setItems([]);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Riwayat</h1>
          <p className="text-sm text-ink-soft">Episode yang baru kamu tonton.</p>
        </div>
        {items?.length > 0 && (
          <button onClick={handleClear} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-accent hover:text-accent">
            Hapus semua
          </button>
        )}
      </div>

      {items?.length === 0 && (
        <div className="rounded-xl border border-line bg-paper-card p-8 text-center shadow-card">
          <p className="text-sm text-ink-soft">Belum ada riwayat tontonan.</p>
          <Link href="/daftar" className="mt-3 inline-block text-sm font-semibold text-accent">Jelajahi koleksi →</Link>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item, i) => (
            <AnimeCard key={item.url + i} item={item} index={i} watchMode />
          ))}
        </div>
      )}
    </div>
  );
}
