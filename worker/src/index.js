/*
 * Feedstorm's CORS-unlocking proxy, as a Cloudflare Worker.
 *
 * Replaces the Flask version that ran on a home Raspberry Pi behind
 * Tailscale Funnel. That worked for local testing but breaks for real
 * visitors: Tailscale Funnel hostnames resolve into a CGNAT/private address
 * range, and Chrome/Edge's Local Network Access policy (shipped Chrome 142)
 * blocks any public page from fetching a private-network address unless the
 * user approves a permission prompt - which a plain fetch() can never
 * trigger or wait for. A Worker gets an ordinary public IP, so that
 * restriction never applies.
 *
 * Scoped down the same way the Pi version was: GET only, http(s) schemes
 * only, a timeout, and a response-size cap.
 */
const MAX_BYTES = 5 * 1024 * 1024; // feeds are text; images load directly via <img>, not through this
const TIMEOUT_MS = 10000;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'GET') {
      return new Response('method not allowed', { status: 405, headers: corsHeaders() });
    }

    const reqUrl = new URL(request.url);
    const target = reqUrl.searchParams.get('url') || '';
    if (!/^https?:\/\//i.test(target)) {
      return new Response('invalid url', { status: 400, headers: corsHeaders() });
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let upstream;
    try {
      upstream = await fetch(target, {
        signal: ctrl.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Accept: '*/*',
        },
      });
    } catch (e) {
      return new Response(`upstream error: ${e.message}`, { status: 502, headers: corsHeaders() });
    } finally {
      clearTimeout(timer);
    }

    const lenHeader = upstream.headers.get('Content-Length');
    if (lenHeader && Number(lenHeader) > MAX_BYTES) {
      return new Response('upstream response too large', { status: 413, headers: corsHeaders() });
    }

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return new Response('upstream response too large', { status: 413, headers: corsHeaders() });
    }

    return new Response(buf, {
      status: upstream.status,
      headers: {
        ...corsHeaders(),
        'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
      },
    });
  },
};
