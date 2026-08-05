'use client';

import { useEffect } from 'react';
import { pushHistory } from '../lib/store';

export default function HistoryRecorder({ item }) {
  useEffect(() => {
    if (item?.url) pushHistory(item);
  }, [item?.url]);

  return null;
}
