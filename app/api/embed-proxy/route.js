import { NextResponse } from 'next/server';

// Whitelist domain yang boleh diproxy — jangan biarin route ini jadi
// open proxy buat sembarang URL (rawan disalahgunakan orang lain).
const ALLOWED_HOSTS = [
  'anichin.moe',
  'anichin.forum',
  'anichin.cc',
  'ok.ru',
  'rpmshare.com',
  'earnvids.com',
  'abysscdn.com',
  'streamhg.com',
  'dood.re', 'dood.wf', 'dood.pm', 'dood.li', 'dood.ws',
  'mixdrop.co', 'mixdrop.to',
  'streamtape.com'
  // tambahin host provider server lain di sini kalau ternyata ke-block juga
];

function isAllowedHost(hostname) {
  return ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith('.' + h));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url');

  if (!target) {
    return NextResponse.json({ error: 'Parameter url wajib diisi' }, { status: 400 });
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: 'URL tidak valid' }, { status: 400 });
  }

  if (!isAllowedHost(parsed.hostname)) {
    return NextResponse.json({ error: 'Host tidak diizinkan untuk diproxy' }, { status: 403 });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        'Referer': 'https://anichin.moe/',
        'Origin': 'https://anichin.moe',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'
      },
      redirect: 'follow'
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream balikin status ${upstream.status}` },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get('content-type') || 'text/html; charset=utf-8';
    let body = await upstream.text();

    // Kalau responsnya HTML, resource internal (script/css/img) yang pake path
    // relatif bakal salah resolve kalau di-serve dari domain kita sendiri.
    // Inject <base> biar semua path relatif tetep ngarah ke domain asli.
    if (contentType.includes('text/html')) {
      const baseTag = `<base href="${parsed.origin}${parsed.pathname.replace(/\/[^/]*$/, '/')}">`;
      if (/<head[^>]*>/i.test(body)) {
        body = body.replace(/<head[^>]*>/i, (m) => `${m}${baseTag}`);
      } else {
        body = baseTag + body;
      }
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // biar iframe dari domain kita boleh nampilin ini
        'X-Frame-Options': 'ALLOWALL',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    return NextResponse.json({ error: 'Gagal fetch embed', detail: e.message }, { status: 502 });
  }
}
