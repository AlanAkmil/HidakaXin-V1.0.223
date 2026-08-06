'use client';

import { useEffect, useMemo, useState } from 'react';

function isOkRu(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '') === 'ok.ru';
  } catch {
    return false;
  }
}

function toEmbeddable(url) {
  if (!url) return null;
  try {
    new URL(url); // just validating it's an absolute URL
    return `/api/embed-proxy?url=${encodeURIComponent(url)}`;
  } catch {
    return null;
  }
}

// Preferred default quality when OK.ru's extraction succeeds — "sd" is a
// reasonable middle ground for mobile data. Falls back to the middle of
// whatever list comes back if "sd" isn't present.
function pickDefaultQualityIndex(videos) {
  const idx = videos.findIndex((v) => v.quality === 'sd');
  return idx >= 0 ? idx : Math.floor(videos.length / 2);
}

export default function AnichinVideoPlayer({ defaultPlayer, servers = [] }) {
  const validServers = useMemo(() => servers.filter((s) => s?.url), [servers]);
  const [serverIndex, setServerIndex] = useState(0);
  const current = validServers[serverIndex] || (defaultPlayer ? { label: 'Default', url: defaultPlayer } : null);
  const currentIsOkRu = current && isOkRu(current.url);

  const [okruVideos, setOkruVideos] = useState(null);
  const [okruQualityIndex, setOkruQualityIndex] = useState(0);
  const [okruLoading, setOkruLoading] = useState(false);
  const [okruError, setOkruError] = useState(null);
  const [okruPlaybackError, setOkruPlaybackError] = useState(null);

  useEffect(() => {
    setOkruVideos(null);
    setOkruError(null);
    setOkruPlaybackError(null);
    setOkruQualityIndex(0);
    if (!current || !currentIsOkRu) return;

    let cancelled = false;
    setOkruLoading(true);
    fetch(`/api/okru-extract?url=${encodeURIComponent(current.url)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok && data.videos?.length) {
          setOkruVideos(data.videos);
          setOkruQualityIndex(pickDefaultQualityIndex(data.videos));
        } else {
          setOkruError(data.error || 'Gagal ambil link video dari OK.ru');
        }
      })
      .catch((e) => {
        if (!cancelled) setOkruError(e.message);
      })
      .finally(() => {
        if (!cancelled) setOkruLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.url, currentIsOkRu]);

  function nextServer() {
    if (validServers.length > 1) {
      setServerIndex((i) => (i + 1) % validServers.length);
    }
  }

  const iframeSrc = current && !currentIsOkRu ? toEmbeddable(current.url) : null;
  const activeOkruVideo = okruVideos?.[okruQualityIndex];

  // MediaError.code is a plain number (1-4) with no message of its own —
  // map it to something readable so a failure shows real info instead of
  // just a broken-image icon with no explanation.
  const MEDIA_ERROR_LABELS = {
    1: 'MEDIA_ERR_ABORTED — dibatalkan',
    2: 'MEDIA_ERR_NETWORK — gagal jaringan pas ambil video',
    3: 'MEDIA_ERR_DECODE — gagal decode/format rusak',
    4: 'MEDIA_ERR_SRC_NOT_SUPPORTED — src gak didukung / gagal dimuat'
  };

  function handleVideoError(e) {
    const err = e.currentTarget.error;
    setOkruPlaybackError(
      err ? `${MEDIA_ERROR_LABELS[err.code] || `Error code ${err.code}`}${err.message ? ` — ${err.message}` : ''}` : 'Gagal muat video (unknown error)'
    );
  }

  function selectOkruQuality(i) {
    setOkruPlaybackError(null);
    setOkruQualityIndex(i);
  }

  return (
    <div>
      {/* TEMP DEBUG — hapus abis ketauan akar masalahnya */}
      {current && (
        <p className="mb-2 break-all text-[10px] text-ink-faint">
          debug: label="{current.label}" isOkRu={String(currentIsOkRu)} url={current.url}
        </p>
      )}
      <div className="relative overflow-hidden rounded-xl border border-line bg-black shadow-card">
        <div className="aspect-video">
          {!current ? (
            <div className="flex h-full items-center justify-center text-white/50">Player tidak tersedia</div>
          ) : currentIsOkRu ? (
            okruLoading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-white/60">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-accent" />
                Ngambil link video dari OK.ru...
              </div>
            ) : activeOkruVideo ? (
              <>
                <video
                  key={activeOkruVideo.url}
                  src={`/api/okru-stream?url=${encodeURIComponent(activeOkruVideo.url)}`}
                  controls
                  autoPlay
                  muted
                  playsInline
                  onError={handleVideoError}
                  onCanPlay={() => setOkruPlaybackError(null)}
                  className="h-full w-full bg-black"
                />
                {okruPlaybackError && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/85 px-4 text-center">
                    <p className="text-sm font-semibold text-white">Video gagal dimuat</p>
                    <p className="max-w-xs break-words text-xs text-white/60">{okruPlaybackError}</p>
                    {validServers.length > 1 && (
                      <button
                        onClick={nextServer}
                        className="mt-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-accent hover:text-accent"
                      >
                        Coba server lain →
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                <p className="text-sm text-white/70">{okruError || 'Gagal muat video dari OK.ru'}</p>
                {validServers.length > 1 && (
                  <button
                    onClick={nextServer}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-accent hover:text-accent"
                  >
                    Coba server lain →
                  </button>
                )}
              </div>
            )
          ) : iframeSrc ? (
            <iframe
              src={iframeSrc}
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="no-referrer"
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-white/50">Player tidak tersedia</div>
          )}
        </div>
      </div>

      {currentIsOkRu && okruVideos && okruVideos.length > 1 && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-faint">Kualitas</p>
          <div className="flex flex-wrap gap-2">
            {okruVideos.map((v, i) => (
              <button
                key={v.quality || i}
                onClick={() => selectOkruQuality(i)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  i === okruQualityIndex ? 'border-accent bg-accent-50 text-accent' : 'border-line bg-paper-card text-ink-soft hover:border-accent hover:text-accent'
                }`}
              >
                {v.quality || `Kualitas ${i + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {validServers.length > 1 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-faint">
            Server ({serverIndex + 1}/{validServers.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {validServers.map((s, i) => (
              <button
                key={s.label + i}
                onClick={() => setServerIndex(i)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  i === serverIndex ? 'border-accent bg-accent-50 text-accent' : 'border-line bg-paper-card text-ink-soft hover:border-accent hover:text-accent'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
