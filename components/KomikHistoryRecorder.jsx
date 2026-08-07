'use client';

import { useEffect } from 'react';
import { pushKomikHistory } from '../lib/store';

export default function KomikHistoryRecorder({ item }) {
  useEffect(() => {
    if (item?.chapterUrl) pushKomikHistory(item);
  }, [item?.chapterUrl]);

  return null;
}
