import axios from 'axios';

export const dynamic = 'force-dynamic';

// Locked to OK.ru's video CDN only — this exists purely so requests to the
// signed okcdn.ru URLs come from OUR server's IP (the one the signature was
// issued for), not the visitor's browser. Anichin-specific, not a general
// proxy — keep the allowlist narrow.
function isAllowedCdnHost(hostname) {
  return hostname === 'okcdn.ru' || hostname.endsWith('.okcdn.ru');
}

const UA = 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url');

  if (!target) {
    return Response.json({ error: 'Parameter url wajib diisi' }, { status: 400 });
  }
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return Response.json({ error: 'URL tidak valid' }, { status: 400 });
  }
  if (!isAllowedCdnHost(parsed.hostname)) {
    return Response.json({ error: 'Host tidak diizinkan untuk diproxy' }, { status: 403 });
  }

  const range = request.headers.get('range');

  try {
    const upstream = await axios.get(target, {
      headers: {
        'User-Agent': UA,
        Referer: 'https://anichin.cafe/',
        ...(range ? { Range: range } : {})
      },
      responseType: 'stream',
      validateStatus: () => true,
      timeout: 20000
    });

    if (upstream.status >= 400) {
      return Response.json({ error: `Upstream balikin status ${upstream.status}` }, { status: 502 });
    }

    const headers = new Headers();
    for (const h of ['content-length', 'content-range', 'accept-ranges']) {
      if (upstream.headers[h]) headers.set(h, upstream.headers[h]);
    }
    if (!headers.has('accept-ranges')) headers.set('accept-ranges', 'bytes');
    // Force video/mp4 regardless of whatever upstream sends — these
    // okcdn.ru links are confirmed mp4, but upstream's own content-type
    // header (e.g. a generic octet-stream) makes the HTML5 <video> element
    // reject it as unsupported even though the bytes are fine. A full-page
    // browser navigation to the same URL plays it fine because Chrome
    // sniffs the actual bytes there instead of trusting the header —
    // <video> doesn't do that sniffing, so we set it explicitly.
    headers.set('content-type', 'video/mp4');
    headers.set('cache-control', 'no-store');

    // upstream.data is a Node Readable stream (axios responseType: 'stream')
    // — Web Response needs a Web ReadableStream, so wrap it.
    const webStream = new ReadableStream({
      start(controller) {
        upstream.data.on('data', (chunk) => controller.enqueue(chunk));
        upstream.data.on('end', () => controller.close());
        upstream.data.on('error', (err) => controller.error(err));
      },
      cancel() {
        upstream.data.destroy();
      }
    });

    return new Response(webStream, { status: upstream.status, headers });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }
}
