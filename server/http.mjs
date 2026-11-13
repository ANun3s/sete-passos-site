import { fromNodeHeaders } from 'better-auth/node';

const BODY_LIMIT = 16 * 1024;

export function authHeaders(req) {
  const headers = fromNodeHeaders(req.headers);
  for (const key of [...headers.keys()]) if (key.startsWith('x-forwarded-') || key === 'forwarded' || key === 'x-real-ip') headers.delete(key);
  headers.set('x-sete-passos-peer-ip', req.socket.remoteAddress);
  return headers;
}

function failure(status, code) { return Object.assign(new Error(code), { status, code }); }

export async function readJsonBody(req, { maxBytes = BODY_LIMIT } = {}) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw failure(415, 'JSON_REQUIRED');
  if (Number(req.headers['content-length']) > maxBytes) { req.resume(); throw failure(413, 'BODY_TOO_LARGE'); }
  const raw = await new Promise((resolve, reject) => {
    let length = 0;
    let settled = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (settled) return; // Drain without retaining excess bytes.
      length += chunk.length;
      if (length > maxBytes) { settled = true; chunks.length = 0; reject(failure(413, 'BODY_TOO_LARGE')); }
      else chunks.push(chunk);
    });
    req.on('end', () => { if (!settled) { settled = true; resolve(Buffer.concat(chunks).toString('utf8')); } });
    req.on('error', () => { if (!settled) { settled = true; reject(failure(400, 'INVALID_BODY')); } });
    req.on('aborted', () => { if (!settled) { settled = true; reject(failure(400, 'INVALID_BODY')); } });
  });
  let value;
  try { value = JSON.parse(raw || '{}'); } catch { throw failure(400, 'INVALID_JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw failure(400, 'INVALID_JSON');
  return value;
}

export const AUTH_METHODS = Object.freeze({
  '/api/auth/sign-up/email': 'POST',
  '/api/auth/sign-in/email': 'POST',
  '/api/auth/sign-in/social': 'POST',
  '/api/auth/callback/google': 'GET',
  '/api/auth/sign-out': 'POST',
  '/api/auth/get-session': 'GET',
  '/api/auth/ok': 'GET',
});

export const EMAIL_PATHS = new Set([
  '/api/auth/request-password-reset', '/api/auth/reset-password',
  '/api/auth/send-verification-email', '/api/auth/verify-email',
]);
