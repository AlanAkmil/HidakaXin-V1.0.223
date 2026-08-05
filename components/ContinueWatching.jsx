'use client';

import { useEffect, useState } from 'react';
import { getHistory } from '../lib/store';
import AnimeRow from './AnimeRow';
import SectionHeader from './SectionHeader';

export default function ContinueWatching() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    setItems(getHistory());
    function onStorage() {
      setItems(getHistory());
    }
    window.addEventListener('hidakaxin:storage', onStorage);
    return () => window.removeEventListener('hidakaxin:storage', onStorage);
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="mb-8">
      <SectionHeader title="Lanjut Nonton" href="/riwayat" />
      <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-1">
        {items.slice(0, 10).map((item, i) => (
          <AnimeRow key={item.url + i} item={item} watchMode />
        ))}
      </div>
    </section>
  );
}
