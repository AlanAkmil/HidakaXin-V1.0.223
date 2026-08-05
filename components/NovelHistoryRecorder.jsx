'use client';

import { useEffect } from 'react';
import { pushNovelHistory } from '../lib/store';

export default function NovelHistoryRecorder({ item }) {
  useEffect(() => {
    if (item?.chapterUrl) pushNovelHistory(item);
  }, [item?.chapterUrl]);

  return null;
}
