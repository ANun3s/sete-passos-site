import { openSupabaseRuntime } from './supabase-runtime.mjs';
import { createServer } from 'node:http';
import { fromNodeHeaders } from 'better-auth/node';
import { createAuth, FRONTEND_ORIGINS } from './auth.mjs';
import { openDatabase } from './database.mjs';
import { migrateDatabase } from './migrations.mjs';
import { assertLocalMode, assertOutsideWebroot, DEFAULT_DATA_DIRECTORY } from './config.mjs';
import { join } from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { parseLoginIdentifier } from '../src/login-identifier.js';
import { readFile } from 'node:fs/promises';
import { lstat } from 'node:fs/promises';
import { createAvatarStore, privateImageReference } from './avatar.mjs';
import { authHeaders, readJsonBody, AUTH_METHODS, EMAIL_PATHS } from './http.mjs';
import { PROFILE_METHODS, PROFILE_CAPABILITIES, handleProfile } from './profile.mjs';
import { createProfileRateLimiter } from './profile-rate-limit.mjs';
import { createAdminFicha, listAdminUsers } from './admin-data.mjs';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function findUserByCPF({ db, pool, cpf }) {
  if (pool) return (await pool.query('SELECT email FROM sete_passos_auth."user" WHERE cpf = $1 LIMIT 1', [cpf])).rows[0] || null;
  return db.prepare('SELECT email FROM "user" WHERE cpf = ? LIMIT 1').get(cpf) || null;
}

async function readUserCPF({ db, pool, id }) {
  if (pool) return (await pool.query('SELECT cpf FROM sete_passos_auth."user" WHERE id = $1 LIMIT 1', [id])).rows[0]?.cpf || null;
  return db.prepare('SELECT cpf FROM "user" WHERE id = ? LIMIT 1').get(id)?.cpf || null;
}

function hideInternalIdentifiers(value) {
  if (Array.isArray(value)) return value.map(hideInternalIdentifiers);
  if (!value || typeof value !== 'object') return value;
  const result = { ...value };
  if (result.user && typeof result.user === 'object') {
    result.user = { ...result.user };
    delete result.user.email;
    delete result.user.cpf;
  }
  return Object.fromEntries(Object.entries(result).map(([key, item]) => [key, hideInternalIdentifiers(item)]));
}

export async function createLocalServer({ databasePath, secret, port = 3007, mode = 'development', supabase, adminEmail = '', adminContentPath, adminMockupsDirectory, avatarDirectory = databasePath ? `${databasePath}.avatars` : join(DEFAULT_DATA_DIRECTORY, 'avatars') } = {}) {
  assertLocalMode(mode);
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('A project-specific secret of at least 32 characters is required.');
  adminEmail = typeof adminEmail === 'string' ? adminEmail.trim().toLowerCase() : '';
  if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(adminEmail)) throw new Error('Invalid private admin account configuration.');
  if (adminContentPath) assertOutsideWebroot(adminContentPath);
  if (adminMockupsDirectory) assertOutsideWebroot(adminMockupsDirectory);
  const avatars = createAvatarStore(avatarDirectory);
  const remote = supabase ? await openSupabaseRuntime(supabase) : null;
  const db = remote ? remote.database : openDatabase(databasePath);
  if (!remote) {
    try { migrateDatabase(db); } catch (error) { db.close(); throw error; }
  }
  let closed = false;
  let auth;
  const profileRateLimit = createProfileRateLimiter();
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const actualPort = server.address().port;
      const allowedHosts = [`127.0.0.1:${actualPort}`, `localhost:${actualPort}`, '127.0.0.1:5177', 'localhost:5177'];
      if (!allowedHosts.includes(req.headers.host)) return json(res, 403, { code: 'HOST_NOT_ALLOWED' });
      const origin = req.headers.origin;
      const allowedOrigins = [...FRONTEND_ORIGINS, `http://127.0.0.1:${actualPort}`, `http://localhost:${actualPort}`];
      if (origin && !allowedOrigins.includes(origin)) return json(res, 403, { code: 'ORIGIN_NOT_ALLOWED' });
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Expose-Headers', 'X-Retry-After');
      }
      if (req.method === 'OPTIONS') {
        const method = req.headers['access-control-request-method'];
        const headers = String(req.headers['access-control-request-headers'] || '').toLowerCase().split(',').map((value) => value.trim()).filter(Boolean);
        if (!origin || !['GET', 'POST'].includes(method) || headers.some((header) => header !== 'content-type')) return json(res, 403, { code: 'PREFLIGHT_NOT_ALLOWED' });
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.statusCode = 204;
        return res.end();
      }
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname === '/admin.html') {
        if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return json(res, 405, { code: 'METHOD_NOT_ALLOWED' }); }
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers), query: { disableCookieCache: true } });
        if (!session) { res.statusCode = 303; res.setHeader('Location', '/login.html?returnTo=%2Fadmin.html'); return res.end(); }
        if (!adminEmail || session.user.email.trim().toLowerCase() !== adminEmail) { res.statusCode = 303; res.setHeader('Location', '/index.html'); return res.end(); }
        const shell = await readFile(new URL('../admin.html', import.meta.url));
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(shell);
      }
      if (url.pathname === '/perfil.html') {
        if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return json(res, 405, { code: 'METHOD_NOT_ALLOWED' }); }
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers), query: { disableCookieCache: true } });
        if (!session) {
          res.statusCode = 303;
          res.setHeader('Location', '/login.html?returnTo=%2Fperfil.html');
          return res.end();
        }
        // Exactly one known shell. Never resolve client paths into the filesystem
        // or embed personal values in HTML; profile data still requires the API.
        const shell = await readFile(new URL('../perfil.html', import.meta.url));
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.end(shell);
      }
      if (EMAIL_PATHS.has(url.pathname)) {
        const method = url.pathname === '/api/auth/verify-email' ? 'GET' : 'POST';
        if (req.method !== method) { res.setHeader('Allow', method); return json(res, 405, { code: 'METHOD_NOT_ALLOWED' }); }
        if (method === 'POST' && (!origin || req.headers['sec-fetch-site'] === 'cross-site')) return json(res, 403, { code: 'ORIGIN_NOT_ALLOWED' });
        const retry = profileRateLimit('email', `ip:${req.socket.remoteAddress}`, 5);
        if (retry) {
          res.setHeader('X-Retry-After', retry);
          res.setHeader('Retry-After', retry);
          return json(res, 429, { code: 'RATE_LIMITED' });
        }
        if (method === 'POST') await readJsonBody(req);
        return json(res, 501, { code: 'EMAIL_UNAVAILABLE' });
      }
      if (Object.hasOwn(PROFILE_METHODS, url.pathname)) {
        if (!PROFILE_METHODS[url.pathname].includes(req.method)) { res.setHeader('Allow', PROFILE_METHODS[url.pathname].join(', ')); return json(res, 405, { code: 'METHOD_NOT_ALLOWED' }); }
        return await handleProfile({ auth, req, url, res, avatars, rateLimit: profileRateLimit, getCPF: (id) => readUserCPF({ db, pool: remote?.pool, id }), json: (status, body) => json(res, status, body) });
      }
      const mockupMatch = url.pathname.match(/^\/api\/admin\/mockups\/([a-z0-9-]+\.(?:html|css|png))$/u);
      if (url.pathname === '/api/admin/access' || url.pathname === '/api/admin/users' || url.pathname === '/api/admin/fichas' || mockupMatch) {
        const method = url.pathname === '/api/admin/fichas' ? req.method : 'GET';
        const allowedMethods = url.pathname === '/api/admin/fichas' ? ['GET', 'POST'] : ['GET'];
        if (!allowedMethods.includes(req.method)) { res.setHeader('Allow', allowedMethods.join(', ')); return json(res, 405, { code: 'METHOD_NOT_ALLOWED' }); }
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers), query: { disableCookieCache: true } });
        if (!session) return json(res, 401, { code: 'UNAUTHORIZED' });
        if (!adminEmail || session.user.email.trim().toLowerCase() !== adminEmail) return json(res, 403, { code: 'FORBIDDEN' });
        if (method === 'POST') {
          if (!origin || req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { code: 'ORIGIN_NOT_ALLOWED' });
          const retry = profileRateLimit('admin-ficha', `user:${session.user.id}`, 12);
          if (retry) { res.setHeader('Retry-After', retry); return json(res, 429, { code: 'RATE_LIMITED' }); }
          const value = await readJsonBody(req, { maxBytes: 64 * 1024 });
          const userId = typeof value.userId === 'string' ? value.userId.trim() : '';
          const title = typeof value.title === 'string' ? value.title.trim() : '';
          const type = value.type;
          const content = typeof value.content === 'string' ? value.content.trim() : '';
          const hasFields = value.fields !== undefined;
          if (hasFields && (!value.fields || typeof value.fields !== 'object' || Array.isArray(value.fields))) return json(res, 400, { code: 'INVALID_FICHA_FIELDS' });
          const fields = hasFields ? value.fields : {};
          if (!userId || userId.length > 128) return json(res, 400, { code: 'INVALID_USER' });
          if (!title || title.length > 160) return json(res, 400, { code: 'INVALID_TITLE' });
          if (!['avaliacao-fisioterapeutica', 'proposta-tratamento', 'outro'].includes(type)) return json(res, 400, { code: 'INVALID_FICHA_TYPE' });
          if (fields && Object.keys(fields).length > 100) return json(res, 400, { code: 'INVALID_FICHA_FIELDS' });
          for (const [key, answer] of Object.entries(fields)) {
            if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/u.test(key)) return json(res, 400, { code: 'INVALID_FICHA_FIELDS' });
            if (typeof answer === 'string' ? answer.length > 4000 : Array.isArray(answer) ? answer.length > 40 || answer.some(item => typeof item !== 'string' || item.length > 160) : true) return json(res, 400, { code: 'INVALID_FICHA_FIELDS' });
          }
          if (!content && Object.keys(fields).length === 0 || content.length > 12_000 || JSON.stringify(fields).length > 48 * 1024) return json(res, 400, { code: 'INVALID_CONTENT' });
          try {
            const ficha = await createAdminFicha({ db, pool: remote?.pool, userId, title, type, content: content || title, fields, createdBy: session.user.id });
            if (!ficha) return json(res, 404, { code: 'USER_NOT_FOUND' });
            return json(res, 201, { ficha });
          } catch (error) {
            if (error?.code === '42P01' || (error?.code === 'SQLITE_ERROR' && /no such table: clinical_ficha/u.test(error.message || ''))) return json(res, 503, { code: 'ADMIN_FICHA_STORAGE_UNAVAILABLE' });
            throw error;
          }
        }
        if (url.pathname === '/api/admin/access') return json(res, 200, { authorized: true, user: { name: session.user.name } });
        if (url.pathname === '/api/admin/users') {
          try { return json(res, 200, await listAdminUsers({ db, pool: remote?.pool })); }
          catch (error) {
            if (error?.code === '42P01' || (error?.code === 'SQLITE_ERROR' && /no such table: clinical_ficha/u.test(error.message || ''))) return json(res, 503, { code: 'ADMIN_FICHA_STORAGE_UNAVAILABLE' });
            throw error;
          }
        }
        if (mockupMatch) {
          const allowed = new Set(['avaliacao-fisioterapeutica.html', 'avaliacao-fisioterapeutica.png', 'proposta-tratamento.html', 'proposta-tratamento.png', 'mockups.css', '127094ee3636.png', '120e21d34aa0.png', 'cfc28f55752f.png']);
          if (!allowed.has(mockupMatch[1]) || !adminMockupsDirectory) return json(res, 404, { code: 'NOT_FOUND' });
          const path = join(adminMockupsDirectory, mockupMatch[1]);
          const info = await lstat(path);
          if (!info.isFile() || info.isSymbolicLink()) return json(res, 404, { code: 'NOT_FOUND' });
          const bytes = await readFile(path);
          res.setHeader('Content-Type', mockupMatch[1].endsWith('.html') ? 'text/html; charset=utf-8' : mockupMatch[1].endsWith('.css') ? 'text/css; charset=utf-8' : 'image/png');
          return res.end(bytes);
        }
        if (!adminContentPath) return json(res, 503, { code: 'ADMIN_CONTENT_UNAVAILABLE' });
        const info = await lstat(adminContentPath);
        if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o777) !== 0o600) return json(res, 503, { code: 'ADMIN_CONTENT_UNAVAILABLE' });
        const html = await readFile(adminContentPath, 'utf8');
        return json(res, 200, { html });
      }
      const protectedRoute = url.pathname === '/api/me' || /^\/api\/users\/[^/]+$/.test(url.pathname);
      const expectedMethod = Object.hasOwn(AUTH_METHODS, url.pathname) ? AUTH_METHODS[url.pathname] : (protectedRoute || url.pathname === '/api/health' ? 'GET' : null);
      if (!expectedMethod) return json(res, 404, { code: 'NOT_FOUND' });
      if (req.method !== expectedMethod) { res.setHeader('Allow', expectedMethod); return json(res, 405, { code: 'METHOD_NOT_ALLOWED' }); }
      if (url.pathname === '/api/health') {
        try { await remote?.health(); } catch { return json(res, 503, { ok: false, code: 'DATABASE_UNAVAILABLE' }); }
        const { minPasswordLength, maxPasswordLength } = auth.options.emailAndPassword;
        const googleClientId = auth.options.socialProviders?.google?.clientId || null;
        return json(res, 200, { ok: true, signUpEnabled: true, capabilities: { ...PROFILE_CAPABILITIES, googleLogin: Boolean(googleClientId) }, googleClientId, passwordPolicy: { minPasswordLength, maxPasswordLength } });
      }
      if (url.pathname.startsWith('/api/auth/')) {
        const headers = authHeaders(req);
        let body;
        if (req.method === 'POST') {
          const value = await readJsonBody(req);
          // image is server-owned; public registration cannot seed a tracking
          // URL, forged private reference, or arbitrary filesystem locator.
          if (url.pathname === '/api/auth/sign-up/email') delete value.image;
          if (['/api/auth/sign-up/email', '/api/auth/sign-in/email'].includes(url.pathname)) {
            if (typeof value.name === 'string') value.name = value.name.trim();
            if (url.pathname === '/api/auth/sign-up/email') {
              const supplied = [value.identifier, value.cpf, value.email].filter(item => typeof item === 'string' && item.trim());
              if (supplied.length !== 1) return json(res, 400, { code: 'INVALID_IDENTIFIER' });
              const identity = parseLoginIdentifier(supplied[0]);
              if (identity.type === 'invalid-email') return json(res, 400, { code: 'INVALID_EMAIL' });
              if (identity.type === 'invalid-cpf') return json(res, 400, { code: 'INVALID_CPF' });
              if (typeof value.name !== 'string' || !value.name || value.name.length > 100) return json(res, 400, { code: 'INVALID_NAME' });
              if (identity.type === 'email' && adminEmail && identity.value === adminEmail) return json(res, 400, { code: 'EMAIL_SIGNUP_REQUIRES_VERIFICATION' });
              delete value.identifier; delete value.cpf; delete value.email;
              if (identity.type === 'cpf') {
                value.cpf = identity.value;
                value.email = `conta-${createHmac('sha256', secret).update(identity.value).digest('hex')}@login.sete-passos.invalid`;
              } else value.email = identity.value;
            } else {
              const identifier = value.identifier ?? value.cpf ?? value.email;
              const identity = parseLoginIdentifier(identifier);
              const byCPF = identity.type === 'cpf' ? await findUserByCPF({ db, pool: remote?.pool, cpf: identity.value }) : null;
              value.email = byCPF?.email || (identity.type === 'email' ? identity.value : `unknown-${randomUUID()}@login.sete-passos.invalid`);
              delete value.identifier; delete value.cpf;
            }
          }
          body = JSON.stringify(value);
          headers.delete('content-length');
          headers.delete('transfer-encoding');
        }
        const response = await auth.handler(new Request(url, { method: req.method, headers, body }));
        res.statusCode = response.status;
        for (const [key, value] of response.headers) if (key !== 'set-cookie') res.setHeader(key, value);
        const cookies = response.headers.getSetCookie();
        if (cookies.length) res.setHeader('Set-Cookie', cookies);
        res.setHeader('Cache-Control', 'no-store');
        if (url.pathname === '/api/auth/sign-up/email' && response.ok) return json(res, 200, { ok: true });
        if (response.headers.get('content-type')?.includes('application/json')) {
          const payload = await response.json();
          return json(res, response.status, hideInternalIdentifiers(payload));
        }
        return res.end(Buffer.from(await response.arrayBuffer()));
      }
      if (url.pathname === '/api/me' || /^\/api\/users\/[^/]+$/.test(url.pathname)) {
        const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers), query: { disableCookieCache: true } });
        if (!session) return json(res, 401, { code: 'UNAUTHORIZED' });
        const { id, name } = session.user;
        const cpf = await readUserCPF({ db, pool: remote?.pool, id });
        if (url.pathname.startsWith('/api/users/') && decodeURIComponent(url.pathname.slice('/api/users/'.length)) !== id) {
          return json(res, 403, { code: 'FORBIDDEN' });
        }
        return json(res, 200, { user: { id, name, cpf, image: privateImageReference(session.user.image) } });
      }
      return json(res, 404, { code: 'NOT_FOUND' });
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : (error instanceof URIError ? 400 : 500);
      return json(res, status, { code: status < 500 && error.code ? error.code : 'INTERNAL_ERROR' });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  return {
    db,
    get auth() { return auth; },
    get url() { return `http://127.0.0.1:${server.address().port}`; },
    async start() {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
      auth = createAuth({ db, secret, baseURL: `http://127.0.0.1:${server.address().port}`, mode });
      await auth.$context;
    },
    async close() {
      if (server.listening) await new Promise((resolve) => server.close(resolve));
      if (closed) return;
      closed = true;
      if (remote) await remote.close();
      else if (db.open) db.close();
    },
  };
}
