import { betterAuth } from 'better-auth';
import { PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { isValidCPF, normalizeCPF } from '../src/cpf.js';
import { parseLoginIdentifier } from '../src/login-identifier.js';

const ORIGIN = 'https://sete-passos.pages.dev';
const SCHEMA = 'sete_passos_auth';
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};
const BODY_LIMIT = 16 * 1024;
const PROFILE_CAPABILITIES = Object.freeze({ cpfChange: true, emailChange: false, passwordReset: false });

function json(status, value, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { ...JSON_HEADERS, ...headers } });
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

async function findUserByCPF(pool, cpf) {
  return (await pool.query(`SELECT email FROM ${SCHEMA}."user" WHERE cpf = $1 LIMIT 1`, [cpf])).rows[0] || null;
}

async function readUserCPF(pool, id) {
  return (await pool.query(`SELECT cpf FROM ${SCHEMA}."user" WHERE id = $1 LIMIT 1`, [id])).rows[0]?.cpf || null;
}

function failure(status, code) {
  return Object.assign(new Error(code), { status, code });
}

function safeHealthDiagnostic(error) {
  return String(error?.message || '')
    .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/giu, '[redacted PostgreSQL URL]')
    .replace(/\b(password|secret|token)=\S+/giu, '$1=[redacted]')
    .slice(0, 240);
}

async function readJson(request, maxBytes = BODY_LIMIT) {
  if (!/^application\/json(?:\s*;|$)/iu.test(request.headers.get('content-type') || '')) throw failure(415, 'JSON_REQUIRED');
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw failure(413, 'BODY_TOO_LARGE');
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw failure(413, 'BODY_TOO_LARGE');
  let value;
  try { value = JSON.parse(new TextDecoder().decode(bytes) || '{}'); } catch { throw failure(400, 'INVALID_JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw failure(400, 'INVALID_JSON');
  return value;
}

function sameOrigin(request) {
  return request.headers.get('origin') === ORIGIN && request.headers.get('sec-fetch-site') !== 'cross-site';
}

function makeRuntime(env) {
  if (!env.HYPERDRIVE?.connectionString || !env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    throw failure(503, 'BACKEND_NOT_CONFIGURED');
  }
  if (!env.SETEPASSOS_STORAGE) throw failure(503, 'STORAGE_UNAVAILABLE');
  const pool = new Pool({
    connectionString: env.HYPERDRIVE.connectionString,
    // Keep a single client for this request. Hyperdrive reuses origin connections
    // globally, while reusing a frozen Worker-side socket can cause read timeouts.
    max: 1,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 1_000,
    query_timeout: 15_000,
    application_name: 'sete-passos-cloudflare',
  });
  pool.on('error', error => console.error('Cloudflare database pool error', error?.code || error?.name || 'Error'));
  const db = { dialect: new PostgresDialect({ pool }), type: 'postgres', schemaName: SCHEMA, transaction: true };
  const auth = betterAuth({
    appName: 'Sete Passos — Físio e Estética Avançada',
    baseURL: ORIGIN,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    database: db,
    trustedOrigins: [ORIGIN],
    emailAndPassword: {
      enabled: true,
      disableSignUp: false,
      autoSignIn: false,
      requireEmailVerification: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    // GIS sends a signed ID token directly; verification uses Google's JWKS
    // and the public Client ID. The client secret is only needed for OAuth
    // authorization-code redirects, which this login does not use.
    ...(env.GOOGLE_CLIENT_ID ? {
      account: { accountLinking: { trustedProviders: ['google'], requireLocalEmailVerified: true } },
      socialProviders: {
        google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET || '', requireEmailVerification: true },
      },
    } : {}),
    user: { additionalFields: { cpf: { type: 'string', required: false, unique: true, input: true, returned: false } } },
    session: { expiresIn: 60 * 60 * 24, updateAge: 60 * 60, cookieCache: { enabled: false } },
    advanced: {
      cookiePrefix: 'sete-passos',
      useSecureCookies: true,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      disableCSRFCheck: false,
      disableOriginCheck: false,
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      customStorage: createPostgresRateLimitStorage(pool),
      window: 60,
      max: 120,
      customRules: { '/sign-in/email': { window: 60, max: 10 }, '/sign-up/email': { window: 60, max: 10 } },
    },
    logger: { disabled: true },
    telemetry: { enabled: false },
  });
  return { pool, auth, storage: env.SETEPASSOS_STORAGE, adminEmail: (env.SETE_PASSOS_ADMIN_EMAIL || '').trim().toLowerCase() };
}

async function getRuntime(env) {
  return makeRuntime(env);
}

async function getSession(auth, request) {
  return auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
}

function privateImageReference(value) {
  return typeof value === 'string' && /^\/api\/profile\/avatar\?v=[a-f0-9-]{36}$/u.test(value) ? value : null;
}

function avatarKey(userId, reference) {
  const version = privateImageReference(reference)?.split('v=')[1];
  if (!version) return null;
  const userHash = createHash('sha256').update(userId).digest('hex');
  return `avatars/${userHash}/${version}`;
}

function imageFailure(status, code) { return failure(status, code); }
const imageDimensionsValid = (width, height) => Number.isInteger(width) && Number.isInteger(height)
  && width > 0 && height > 0 && width <= 8192 && height <= 8192 && width * height <= 16_000_000;

// Keep profile images private and remove common location/camera metadata before
// storing them. SVG and animated image formats are intentionally not accepted.
function sanitizeImage(bytes, mime, filename) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 16) throw imageFailure(400, 'INVALID_IMAGE');
  const ext = filename.toLowerCase().split('.').pop();
  if (bytes.length > 5 * 1024 * 1024) throw imageFailure(413, 'IMAGE_TOO_LARGE');
  const chunks = [];
  let width = 0, height = 0, normalizedMime = mime;
  if (mime === 'image/png' && ext === 'png' && bytes.subarray(0, 8).every((v, i) => v === [137,80,78,71,13,10,26,10][i])) {
    normalizedMime = 'image/png';
    chunks.push(bytes.subarray(0, 8));
    let offset = 8, sawHeader = false, sawEnd = false;
    while (offset + 12 <= bytes.length) {
      const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
      const end = offset + 12 + length;
      if (end > bytes.length) throw imageFailure(400, 'INVALID_IMAGE');
      const kind = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8));
      if (!sawHeader) {
        if (kind !== 'IHDR' || length !== 13) throw imageFailure(400, 'INVALID_IMAGE');
        const dims = new DataView(bytes.buffer, bytes.byteOffset + offset + 8, 8);
        width = dims.getUint32(0); height = dims.getUint32(4); sawHeader = true;
      }
      if (!['eXIf', 'tEXt', 'iTXt', 'zTXt'].includes(kind)) chunks.push(bytes.subarray(offset, end));
      offset = end;
      if (kind === 'IEND') { sawEnd = true; break; }
    }
    if (!sawHeader || !sawEnd) throw imageFailure(400, 'INVALID_IMAGE');
  } else if (mime === 'image/jpeg' && ['jpg', 'jpeg'].includes(ext) && bytes[0] === 0xff && bytes[1] === 0xd8) {
    normalizedMime = 'image/jpeg';
    chunks.push(bytes.subarray(0, 2));
    let offset = 2, foundFrame = false, foundScan = false;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) throw imageFailure(400, 'INVALID_IMAGE');
      let markerOffset = offset;
      while (bytes[markerOffset] === 0xff) markerOffset++;
      const marker = bytes[markerOffset++];
      if (marker === 0xd9) { chunks.push(bytes.subarray(offset, markerOffset)); offset = markerOffset; break; }
      if ([0xd8, 0x01].includes(marker) || (marker >= 0xd0 && marker <= 0xd7)) {
        chunks.push(bytes.subarray(offset, markerOffset)); offset = markerOffset; continue;
      }
      if (markerOffset + 2 > bytes.length) throw imageFailure(400, 'INVALID_IMAGE');
      const length = (bytes[markerOffset] << 8) | bytes[markerOffset + 1];
      const end = markerOffset + length;
      if (length < 2 || end > bytes.length) throw imageFailure(400, 'INVALID_IMAGE');
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        if (length < 7) throw imageFailure(400, 'INVALID_IMAGE');
        height = (bytes[markerOffset + 3] << 8) | bytes[markerOffset + 4];
        width = (bytes[markerOffset + 5] << 8) | bytes[markerOffset + 6]; foundFrame = true;
      }
      // APP1 (Exif/XMP), APP13 (IPTC), and COM may carry personal metadata.
      if (marker !== 0xe1 && marker !== 0xed && marker !== 0xfe) chunks.push(bytes.subarray(offset, end));
      offset = end;
      if (marker === 0xda) { chunks.push(bytes.subarray(offset)); foundScan = true; break; }
    }
    if (!foundFrame || !foundScan) throw imageFailure(400, 'INVALID_IMAGE');
  } else if (mime === 'image/webp' && ext === 'webp'
    && new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF'
    && new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP') {
    normalizedMime = 'image/webp';
    const declared = new DataView(bytes.buffer, bytes.byteOffset + 4, 4).getUint32(0, true) + 8;
    if (declared > bytes.length || declared < 20) throw imageFailure(400, 'INVALID_IMAGE');
    const kept = [];
    let offset = 12, animated = false;
    while (offset + 8 <= declared) {
      const kind = new TextDecoder().decode(bytes.subarray(offset, offset + 4));
      const length = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true);
      const end = offset + 8 + length + (length & 1);
      if (end > declared) throw imageFailure(400, 'INVALID_IMAGE');
      const data = bytes.subarray(offset + 8, offset + 8 + length);
      if (kind === 'VP8X' && length >= 10) {
        animated = Boolean(data[0] & 0x02);
        width = 1 + data[4] + (data[5] << 8) + (data[6] << 16);
        height = 1 + data[7] + (data[8] << 8) + (data[9] << 16);
      } else if (kind === 'VP8 ' && length >= 10 && data[3] === 0x9d && data[4] === 0x01 && data[5] === 0x2a) {
        width = (data[6] | (data[7] << 8)) & 0x3fff;
        height = (data[8] | (data[9] << 8)) & 0x3fff;
      } else if (kind === 'VP8L' && length >= 5 && data[0] === 0x2f) {
        width = 1 + data[1] + ((data[2] & 0x3f) << 8);
        height = 1 + (data[2] >> 6) + (data[3] << 2) + ((data[4] & 0x0f) << 10);
        animated = Boolean(data[4] & 0x20);
      }
      if (kind !== 'EXIF' && kind !== 'XMP ' && kind !== 'ANIM' && kind !== 'ANMF') kept.push(bytes.subarray(offset, end));
      offset = end;
    }
    if (animated || !width || !height || !kept.some(chunk => ['VP8 ', 'VP8L', 'VP8X'].includes(new TextDecoder().decode(chunk.subarray(0, 4))))) throw imageFailure(400, 'INVALID_IMAGE');
    const payloadLength = kept.reduce((sum, chunk) => sum + chunk.length, 0);
    const output = new Uint8Array(12 + payloadLength);
    output.set(bytes.subarray(0, 12));
    let cursor = 12;
    for (const chunk of kept) { output.set(chunk, cursor); cursor += chunk.length; }
    new DataView(output.buffer).setUint32(4, output.length - 8, true);
    chunks.length = 0; chunks.push(output);
  } else {
    throw imageFailure(400, 'INVALID_IMAGE');
  }
  if (!imageDimensionsValid(width, height)) throw imageFailure(400, 'IMAGE_DIMENSIONS');
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const clean = new Uint8Array(size);
  let cursor = 0;
  for (const chunk of chunks) { clean.set(chunk, cursor); cursor += chunk.length; }
  return { bytes: clean, mime: normalizedMime };
}

async function consumeRateLimit(pool, namespace, key, max, windowSeconds) {
  const now = Date.now();
  const hashedKey = createHash('sha256').update(key).digest('hex');
  const result = await pool.query(
    `INSERT INTO ${SCHEMA}."rateLimit" (id, key, count, "lastRequest") VALUES ($1, $2, 1, $3)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN ${SCHEMA}."rateLimit"."lastRequest" < $3 - ($4 * 1000) THEN 1 ELSE ${SCHEMA}."rateLimit".count + 1 END,
       "lastRequest" = CASE WHEN ${SCHEMA}."rateLimit"."lastRequest" < $3 - ($4 * 1000) THEN $3 ELSE ${SCHEMA}."rateLimit"."lastRequest" END
     RETURNING count, "lastRequest"`,
    [randomUUID(), `${namespace}:${hashedKey}`, now, windowSeconds],
  );
  const row = result.rows[0];
  if (row.count <= max) return 0;
  return Math.max(1, Math.ceil((Number(row.lastRequest) + windowSeconds * 1000 - now) / 1000));
}

export function createPostgresRateLimitStorage(pool) {
  return {
    async consume(key, rule) {
      const retryAfter = await consumeRateLimit(pool, 'better-auth', key, rule.max, rule.window);
      return { allowed: retryAfter === 0, retryAfter: retryAfter || null };
    },
  };
}

async function rateLimit(pool, key, max, windowSeconds) {
  return consumeRateLimit(pool, 'api', key, max, windowSeconds);
}

async function adminAuthorized(runtimeState, request) {
  const session = await getSession(runtimeState.auth, request);
  if (!session) return { response: json(401, { code: 'UNAUTHORIZED' }) };
  const email = session.user.email.trim().toLowerCase();
  if (!runtimeState.adminEmail || email !== runtimeState.adminEmail) return { response: json(403, { code: 'FORBIDDEN' }) };
  return { session };
}

function parseFichaContent(value) {
  const data = typeof value === 'string' ? JSON.parse(value) : value;
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.text !== 'string') return { text: '', answers: {} };
  return { text: data.text, answers: data.answers && typeof data.answers === 'object' && !Array.isArray(data.answers) ? data.answers : {} };
}

async function listUsers(pool) {
  const users = (await pool.query(`SELECT id, name, cpf, "createdAt" FROM ${SCHEMA}."user" ORDER BY "createdAt" DESC`)).rows;
  const sessions = (await pool.query(`SELECT "userId", "expiresAt" FROM ${SCHEMA}.session WHERE "expiresAt" > now()`)).rows;
  const fichas = (await pool.query(`SELECT id, "userId", title, type, content, "createdAt" FROM ${SCHEMA}.clinical_ficha ORDER BY "createdAt" DESC`)).rows;
  const active = new Map();
  for (const session of sessions) active.set(session.userId, (active.get(session.userId) || 0) + 1);
  const byUser = new Map();
  for (const ficha of fichas) {
    const entries = byUser.get(ficha.userId) || [];
    const content = parseFichaContent(ficha.content);
    entries.push({ title: ficha.title, type: ficha.type, content: content.text, answers: content.answers, createdAt: ficha.createdAt });
    byUser.set(ficha.userId, entries);
  }
  return { fichasStorageAvailable: true, users: users.map(user => ({
    id: user.id, name: user.name, cpf: user.cpf, createdAt: user.createdAt,
    activeSessions: active.get(user.id) || 0, fichas: byUser.get(user.id) || [],
  })) };
}

async function createFicha(pool, payload, createdBy) {
  const userId = typeof payload.userId === 'string' ? payload.userId.trim() : '';
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const type = payload.type;
  const content = typeof payload.content === 'string' ? payload.content.trim() : '';
  const fields = payload.fields === undefined ? {} : payload.fields;
  if (!userId || userId.length > 128) throw failure(400, 'INVALID_USER');
  if (!title || title.length > 160) throw failure(400, 'INVALID_TITLE');
  if (!['avaliacao-fisioterapeutica', 'proposta-tratamento', 'outro'].includes(type)) throw failure(400, 'INVALID_FICHA_TYPE');
  if (!fields || typeof fields !== 'object' || Array.isArray(fields) || Object.keys(fields).length > 100) throw failure(400, 'INVALID_FICHA_FIELDS');
  for (const [key, answer] of Object.entries(fields)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/u.test(key)) throw failure(400, 'INVALID_FICHA_FIELDS');
    if (typeof answer === 'string' ? answer.length > 4000 : Array.isArray(answer) ? answer.length > 40 || answer.some(item => typeof item !== 'string' || item.length > 160) : true) throw failure(400, 'INVALID_FICHA_FIELDS');
  }
  if ((!content && Object.keys(fields).length === 0) || content.length > 12_000 || JSON.stringify(fields).length > 48 * 1024) throw failure(400, 'INVALID_CONTENT');
  const user = (await pool.query(`SELECT id FROM ${SCHEMA}."user" WHERE id = $1 LIMIT 1`, [userId])).rows[0];
  if (!user) return null;
  const id = randomUUID();
  const storageType = type === 'proposta-tratamento' ? 'outro' : type;
  const answers = type === 'proposta-tratamento' ? { ...fields, _formType: type } : fields;
  const serialized = JSON.stringify({ text: content || title, answers });
  const result = await pool.query(
    `INSERT INTO ${SCHEMA}.clinical_ficha (id, "userId", "createdBy", title, type, content) VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING title, type, content, "createdAt"`,
    [id, user.id, createdBy, title, storageType, serialized],
  );
  const record = result.rows[0];
  const parsed = parseFichaContent(record.content);
  return { title: record.title, type, content: parsed.text, createdAt: record.createdAt };
}

async function profileRoute(state, request, url) {
  const method = request.method;
  if (!['GET', 'POST'].includes(method)) return json(405, { code: 'METHOD_NOT_ALLOWED' });
  if (method === 'POST' && !sameOrigin(request)) return json(403, { code: 'ORIGIN_NOT_ALLOWED' });
  const session = await getSession(state.auth, request);
  if (!session) return json(401, { code: 'UNAUTHORIZED' });
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (method === 'POST') {
    const retry = await rateLimit(state.pool, `${url.pathname}:ip:${ip}`, url.pathname.endsWith('/password') ? 5 : 30, 60);
    if (retry) return json(429, { code: 'RATE_LIMITED' }, { 'retry-after': String(retry), 'x-retry-after': String(retry) });
    const userRetry = await rateLimit(state.pool, `${url.pathname}:user:${session.user.id}`, url.pathname.endsWith('/password') ? 5 : 30, 60);
    if (userRetry) return json(429, { code: 'RATE_LIMITED' }, { 'retry-after': String(userRetry) });
  }
  if (url.pathname === '/api/profile' && method === 'GET') {
    const { name } = session.user;
    const cpf = await readUserCPF(state.pool, session.user.id);
    const context = await state.auth.$context;
    const credential = await context.internalAdapter.findCredentialAccount(session.user.id);
    return json(200, {
      user: { name, cpf, image: privateImageReference(session.user.image) },
      security: { hasPassword: Boolean(credential?.password), minPasswordLength: 12, maxPasswordLength: 128 },
      capabilities: PROFILE_CAPABILITIES, fichas: [],
    });
  }
  if (url.pathname === '/api/profile/cpf' && method === 'POST') {
    if (await readUserCPF(state.pool, session.user.id)) return json(409, { code: 'CPF_ALREADY_SET' });
    const value = await readJson(request);
    const cpf = normalizeCPF(value.cpf);
    if (!isValidCPF(cpf)) return json(400, { code: 'INVALID_CPF' });
    try {
      return finishMutation(await state.auth.api.updateUser({ headers: request.headers, body: { cpf }, asResponse: true }));
    } catch (error) {
      if (error?.code === '23505') return json(409, { code: 'CPF_UNAVAILABLE' });
      throw error;
    }
  }
  if (url.pathname === '/api/profile/avatar' || url.pathname === '/api/profile/avatar/remove') {
    const oldKey = avatarKey(session.user.id, session.user.image);
    if (method === 'GET') {
      if (!oldKey) return json(404, { code: 'NOT_FOUND' });
      const { value, metadata } = await state.storage.getWithMetadata(oldKey, 'arrayBuffer');
      if (!value) return json(404, { code: 'NOT_FOUND' });
      return new Response(value, { headers: { ...JSON_HEADERS, 'content-type': metadata?.contentType || 'application/octet-stream', 'cross-origin-resource-policy': 'same-origin', 'content-security-policy': "default-src 'none'; sandbox" } });
    }
    let image;
    if (url.pathname.endsWith('/remove')) {
      await readJson(request);
    } else {
      const declared = Number(request.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > 5 * 1024 * 1024 + 64 * 1024) throw failure(413, 'IMAGE_TOO_LARGE');
      let form;
      try { form = await request.formData(); } catch { throw failure(400, 'INVALID_IMAGE'); }
      const photos = form.getAll('photo');
      if (photos.length !== 1 || !(photos[0] instanceof File) || !photos[0].size || [...form.values()].filter(value => value instanceof File).length !== 1) throw failure(400, 'INVALID_IMAGE');
      image = sanitizeImage(new Uint8Array(await photos[0].arrayBuffer()), photos[0].type, photos[0].name);
    }
    const reference = image ? `/api/profile/avatar?v=${randomUUID()}` : null;
    const newKey = image ? avatarKey(session.user.id, reference) : null;
    if (image) await state.storage.put(newKey, image.bytes, { metadata: { contentType: image.mime } });
    const response = await state.auth.api.updateUser({ headers: request.headers, body: { image: reference }, asResponse: true });
    if (!response.ok && newKey) await state.storage.delete(newKey);
    if (response.ok && oldKey && oldKey !== newKey) await state.storage.delete(oldKey);
    return new Response(response.ok ? JSON.stringify({ ok: true }) : JSON.stringify({ code: 'PROFILE_UPDATE_FAILED' }), { status: response.ok ? 200 : response.status, headers: { ...JSON_HEADERS, ...(response.headers.get('set-cookie') ? { 'set-cookie': response.headers.get('set-cookie') } : {}) } });
  }
  if (url.pathname === '/api/profile/email') { await readJson(request); return json(501, { code: 'EMAIL_UNAVAILABLE' }); }
  if (url.pathname === '/api/profile/name') {
    const { name } = await readJson(request);
    if (typeof name !== 'string' || /[\u0000-\u001f\u007f]/u.test(name)) throw failure(400, 'INVALID_NAME');
    const normalized = name.normalize('NFC').trim().replace(/\s+/gu, ' ');
    if (!normalized || [...normalized].length > 100) throw failure(400, 'INVALID_NAME');
    return finishMutation(await state.auth.api.updateUser({ headers: request.headers, body: { name: normalized }, asResponse: true }));
  }
  if (url.pathname === '/api/profile/password') {
    const { currentPassword, newPassword, confirmPassword } = await readJson(request);
    if (typeof newPassword !== 'string' || newPassword !== confirmPassword) throw failure(400, 'PASSWORD_MISMATCH');
    if (newPassword.length < 12) throw failure(400, 'PASSWORD_TOO_SHORT');
    if (newPassword.length > 128) throw failure(400, 'PASSWORD_TOO_LONG');
    if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 128) throw failure(400, 'INVALID_CURRENT_PASSWORD');
    return finishMutation(await state.auth.api.changePassword({ headers: request.headers, body: { currentPassword, newPassword, revokeOtherSessions: true }, asResponse: true }));
  }
  return json(404, { code: 'NOT_FOUND' });
}

function finishMutation(response) {
  return response.then ? response.then(finishMutation) : new Response(response.ok ? JSON.stringify({ ok: true }) : JSON.stringify({ code: response.status === 401 ? 'INVALID_CURRENT_PASSWORD' : 'PROFILE_UPDATE_FAILED' }), {
    status: response.ok ? 200 : response.status,
    headers: { ...JSON_HEADERS, ...(response.headers.get('set-cookie') ? { 'set-cookie': response.headers.get('set-cookie') } : {}) },
  });
}

async function adminRoute(state, request, url) {
  const route = url.pathname;
  const mockup = route.match(/^\/api\/admin\/mockups\/([a-z0-9-]+\.(?:html|css|png))$/u);
  const isFichas = route === '/api/admin/fichas';
  if (request.method !== (isFichas ? request.method : 'GET') || (isFichas && !['GET', 'POST'].includes(request.method))) return json(405, { code: 'METHOD_NOT_ALLOWED' });
  const { session, response } = await adminAuthorized(state, request);
  if (response) return response;
  if (isFichas && request.method === 'GET') {
    const html = await state.storage.get('admin/admin-fichas.html');
    if (!html) return json(503, { code: 'ADMIN_CONTENT_UNAVAILABLE' });
    return json(200, { html });
  }
  if (isFichas && request.method === 'POST') {
    if (!sameOrigin(request)) return json(403, { code: 'ORIGIN_NOT_ALLOWED' });
    const retry = await rateLimit(state.pool, `admin-ficha:${session.user.id}`, 12, 60);
    if (retry) return json(429, { code: 'RATE_LIMITED' }, { 'retry-after': String(retry) });
    const payload = await readJson(request, 64 * 1024);
    const ficha = await createFicha(state.pool, payload, session.user.id);
    return ficha ? json(201, { ficha }) : json(404, { code: 'USER_NOT_FOUND' });
  }
  if (route === '/api/admin/access') return json(200, { authorized: true, user: { name: session.user.name } });
  if (route === '/api/admin/users') return json(200, await listUsers(state.pool));
  if (mockup) {
    const allowed = new Set(['avaliacao-fisioterapeutica.html', 'avaliacao-fisioterapeutica.png', 'proposta-tratamento.html', 'proposta-tratamento.png', 'mockups.css', '127094ee3636.png', '120e21d34aa0.png', 'cfc28f55752f.png']);
    if (!allowed.has(mockup[1])) return json(404, { code: 'NOT_FOUND' });
    const object = await state.storage.getWithMetadata(`admin/mockups/${mockup[1]}`, 'arrayBuffer');
    if (!object.value) return json(404, { code: 'NOT_FOUND' });
    const mime = mockup[1].endsWith('.html') ? 'text/html; charset=utf-8' : mockup[1].endsWith('.css') ? 'text/css; charset=utf-8' : 'image/png';
    return new Response(object.value, { headers: { ...JSON_HEADERS, 'content-type': mime, 'content-security-policy': "default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; sandbox", 'cross-origin-resource-policy': 'same-origin' } });
  }
  return json(404, { code: 'NOT_FOUND' });
}

export async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  if (url.origin !== ORIGIN) return json(403, { code: 'HOST_NOT_ALLOWED' });
  if (request.headers.get('origin') && request.headers.get('origin') !== ORIGIN) return json(403, { code: 'ORIGIN_NOT_ALLOWED' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'cache-control': 'no-store', 'allow': 'GET, POST, OPTIONS' } });
  if (request.method === 'POST' && (!request.headers.get('origin') || request.headers.get('sec-fetch-site') === 'cross-site')) return json(403, { code: 'ORIGIN_NOT_ALLOWED' });
  let state;
  try {
    state = await getRuntime(env);
    if (url.pathname === '/api/health') {
      if (request.method !== 'GET') return json(405, { code: 'METHOD_NOT_ALLOWED' });
      const role = (await state.pool.query('SELECT current_user AS name, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user')).rows[0];
      if (role?.name !== 'sete_passos_app' || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole) return json(503, { ok: false, code: 'DATABASE_ROLE_INVALID' });
      await state.pool.query('SELECT 1');
      const googleLogin = Boolean(env.GOOGLE_CLIENT_ID);
      return json(200, { ok: true, signUpEnabled: true, capabilities: { ...PROFILE_CAPABILITIES, googleLogin }, googleClientId: googleLogin ? env.GOOGLE_CLIENT_ID : null, passwordPolicy: { minPasswordLength: 12, maxPasswordLength: 128 } });
    }
    if (url.pathname === '/api/auth/ok') {
      if (request.method !== 'GET') return json(405, { code: 'METHOD_NOT_ALLOWED' });
      return json(200, { ok: true });
    }
    if (url.pathname.startsWith('/api/auth/')) {
      if (['/api/auth/request-password-reset', '/api/auth/reset-password', '/api/auth/send-verification-email', '/api/auth/verify-email'].includes(url.pathname)) return json(501, { code: 'EMAIL_UNAVAILABLE' });
      if (!['GET', 'POST'].includes(request.method)) return json(405, { code: 'METHOD_NOT_ALLOWED' });
      let forwarded = request;
      if (request.method === 'POST') {
        const payload = await readJson(request);
        if (url.pathname === '/api/auth/sign-up/email') delete payload.image;
        if (['/api/auth/sign-up/email', '/api/auth/sign-in/email'].includes(url.pathname)) {
          if (typeof payload.name === 'string') payload.name = payload.name.trim();
          if (url.pathname === '/api/auth/sign-up/email') {
            const supplied = [payload.identifier, payload.cpf, payload.email].filter(item => typeof item === 'string' && item.trim());
            if (supplied.length !== 1) return json(400, { code: 'INVALID_IDENTIFIER' });
            const identity = parseLoginIdentifier(supplied[0]);
            if (identity.type === 'invalid-email') return json(400, { code: 'INVALID_EMAIL' });
            if (identity.type === 'invalid-cpf') return json(400, { code: 'INVALID_CPF' });
            if (typeof payload.name !== 'string' || !payload.name || payload.name.length > 100) return json(400, { code: 'INVALID_NAME' });
            if (identity.type === 'email' && state.adminEmail && identity.value === state.adminEmail) return json(400, { code: 'EMAIL_SIGNUP_REQUIRES_VERIFICATION' });
            delete payload.identifier; delete payload.cpf; delete payload.email;
            if (identity.type === 'cpf') {
              payload.cpf = identity.value;
              payload.email = `conta-${createHmac('sha256', env.BETTER_AUTH_SECRET).update(identity.value).digest('hex')}@login.sete-passos.invalid`;
            } else payload.email = identity.value;
          } else {
            const identifier = payload.identifier ?? payload.cpf ?? payload.email;
            const identity = parseLoginIdentifier(identifier);
            const byCPF = identity.type === 'cpf' ? await findUserByCPF(state.pool, identity.value) : null;
            payload.email = byCPF?.email || (identity.type === 'email' ? identity.value : `unknown-${randomUUID()}@login.sete-passos.invalid`);
            delete payload.identifier; delete payload.cpf;
          }
        }
        const headers = new Headers(request.headers); headers.delete('content-length');
        forwarded = new Request(request.url, { method: 'POST', headers, body: JSON.stringify(payload) });
      }
      const response = await state.auth.handler(forwarded);
      if (url.pathname === '/api/auth/sign-up/email' && response.ok) {
        const headers = new Headers(response.headers); headers.set('content-type', JSON_HEADERS['content-type']); headers.set('cache-control', 'no-store');
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }
      if (response.headers.get('content-type')?.includes('application/json')) {
        const headers = new Headers(response.headers);
        headers.set('content-type', JSON_HEADERS['content-type']);
        headers.set('cache-control', 'no-store');
        const payload = await response.json();
        return new Response(JSON.stringify(hideInternalIdentifiers(payload)), { status: response.status, headers });
      }
      return response;
    }
    if (Object.hasOwn({ '/api/profile': 1, '/api/profile/cpf': 1, '/api/profile/name': 1, '/api/profile/password': 1, '/api/profile/avatar': 1, '/api/profile/avatar/remove': 1, '/api/profile/email': 1 }, url.pathname)) return await profileRoute(state, request, url);
    if (url.pathname === '/api/me' || /^\/api\/users\/[^/]+$/u.test(url.pathname)) {
      if (request.method !== 'GET') return json(405, { code: 'METHOD_NOT_ALLOWED' });
      const session = await getSession(state.auth, request);
      if (!session) return json(401, { code: 'UNAUTHORIZED' });
      if (url.pathname.startsWith('/api/users/') && decodeURIComponent(url.pathname.slice('/api/users/'.length)) !== session.user.id) return json(403, { code: 'FORBIDDEN' });
      const { id, name } = session.user;
      const cpf = await readUserCPF(state.pool, id);
      return json(200, { user: { id, name, cpf, image: privateImageReference(session.user.image) } });
    }
    if (['/api/admin/access', '/api/admin/users', '/api/admin/fichas'].includes(url.pathname) || url.pathname.startsWith('/api/admin/mockups/')) return await adminRoute(state, request, url);
    return json(404, { code: 'NOT_FOUND' });
  } catch (error) {
    console.error('Sete Passos API failure', url.pathname, error?.name || 'Error', error?.code || 'NO_CODE',
      url.pathname === '/api/health' ? safeHealthDiagnostic(error) : '');
    if (['53300', '57P03', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error?.code)) return json(503, { code: 'DATABASE_UNAVAILABLE' });
    if (error?.code === '42P01') return json(503, { code: 'ADMIN_FICHA_STORAGE_UNAVAILABLE' });
    const status = Number.isInteger(error?.status) ? error.status : 500;
    return json(status, { code: status === 500 ? 'INTERNAL_ERROR' : error.code || 'REQUEST_FAILED' });
  } finally {
    if (state?.pool) {
      try { await state.pool.end(); }
      catch (error) { console.error('Cloudflare database pool close failure', error?.code || error?.name || 'Error'); }
    }
  }
}
