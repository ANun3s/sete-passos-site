const CLOUDFLARE_ORIGIN = 'https://sete-passos.pages.dev';
const MAX_BODY_BYTES = 4_500_000;

export const config = { api: { bodyParser: false } };

function publicOrigin(req) {
  const protocol = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!['http', 'https'].includes(protocol) || !host || /[\s/\\]/u.test(host)) return null;
  return `${protocol}://${host}`;
}

async function readRequestBody(req) {
  const declaredSize = Number(req.headers['content-length']);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) return null;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const origin = publicOrigin(req);
  const browserOrigin = req.headers.origin;
  const method = req.method || 'GET';
  if (!origin || (browserOrigin && browserOrigin !== origin)
      || !['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'].includes(method)) {
    res.status(403).json({ code: 'ORIGIN_NOT_ALLOWED' });
    return;
  }
  if (method !== 'GET' && method !== 'HEAD' && !browserOrigin) {
    res.status(403).json({ code: 'ORIGIN_NOT_ALLOWED' });
    return;
  }

  let body;
  if (!['GET', 'HEAD'].includes(method)) {
    body = await readRequestBody(req);
    if (body === null) {
      res.status(413).json({ code: 'BODY_TOO_LARGE' });
      return;
    }
  }

  try {
    const target = new URL(req.url || '/api', CLOUDFLARE_ORIGIN);
    if (!target.pathname.startsWith('/api/')) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value === undefined || ['host', 'connection', 'content-length', 'transfer-encoding', 'accept-encoding', 'origin', 'x-forwarded-host', 'x-forwarded-proto'].includes(name.toLowerCase())
          || name.toLowerCase().startsWith('x-vercel-')) continue;
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
    headers.set('origin', CLOUDFLARE_ORIGIN);
    const upstream = await fetch(target, {
      method,
      headers,
      ...(body?.length ? { body, duplex: 'half' } : {}),
      redirect: 'manual',
      signal: AbortSignal.timeout(25_000),
    });

    res.statusCode = upstream.status;
    upstream.headers.forEach((value, name) => {
      if (['set-cookie', 'connection', 'content-length', 'transfer-encoding', 'content-encoding'].includes(name.toLowerCase())) return;
      if (name.toLowerCase() === 'location') {
        value = value.replaceAll(CLOUDFLARE_ORIGIN, origin);
      }
      res.setHeader(name, value);
    });
    const cookies = upstream.headers.getSetCookie?.() || [];
    if (cookies.length) res.setHeader('Set-Cookie', cookies);
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Length', String(responseBody.length));
    res.end(responseBody);
  } catch {
    res.status(502).json({ code: 'API_UNAVAILABLE' });
  }
}
