import { authHeaders, readJsonBody } from './http.mjs';
import { readAvatar, privateImageReference } from './avatar.mjs';
import { isValidCPF, normalizeCPF } from '../src/cpf.js';

export const PROFILE_METHODS = Object.freeze({
  '/api/profile': ['GET'], '/api/profile/name': ['POST'], '/api/profile/password': ['POST'],
  '/api/profile/avatar': ['GET', 'POST'],
  '/api/profile/avatar/remove': ['POST'],
  '/api/profile/cpf': ['POST'], '/api/profile/email': ['POST'],
});
export const PROFILE_CAPABILITIES = Object.freeze({ cpfChange: true, emailChange: false, passwordReset: false });

// Keep raw session tokens and internal identifiers out of custom mutation JSON.
export async function finishMutation(response, res, json) {
  const cookies = response.headers.getSetCookie();
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const code = error.code === 'INVALID_PASSWORD' ? 'INVALID_CURRENT_PASSWORD' : error.code;
    return json(response.status, { code: code || 'INTERNAL_ERROR' });
  }
  return json(200, { ok: true });
}

export async function handleProfile({ auth, req, res, url, avatars, rateLimit, getCPF = async () => null, json }) {
  if (req.method === 'POST' && (!req.headers.origin || req.headers['sec-fetch-site'] === 'cross-site')) return json(403, { code: 'ORIGIN_NOT_ALLOWED' });
  const avatarRoute = url.pathname === '/api/profile/avatar' || url.pathname === '/api/profile/avatar/remove';
  const scope = avatarRoute ? '/api/profile/avatar' : url.pathname;
  const max = avatarRoute ? 10 : url.pathname === '/api/profile/password' ? 5 : 30;
  const limited = (actor) => {
    const retry = rateLimit(scope, actor, max);
    if (!retry) return false;
    res.setHeader('X-Retry-After', retry);
    res.setHeader('Retry-After', retry);
    json(429, { code: 'RATE_LIMITED' });
    return true;
  };
  if (req.method === 'POST' && limited(`ip:${req.socket.remoteAddress}`)) return;
  const headers = authHeaders(req);
  const session = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
  if (!session) return json(401, { code: 'UNAUTHORIZED' });
  if (req.method === 'POST' && limited(`user:${session.user.id}`)) return;
  if (url.pathname === '/api/profile/email') {
    await readJsonBody(req);
    return json(501, { code: 'EMAIL_UNAVAILABLE' });
  }
  if (url.pathname === '/api/profile/cpf') {
    const current = await getCPF(session.user.id);
    if (current) return json(409, { code: 'CPF_ALREADY_SET' });
    const value = await readJsonBody(req);
    const cpf = normalizeCPF(value.cpf);
    if (!isValidCPF(cpf)) return json(400, { code: 'INVALID_CPF' });
    try {
      return finishMutation(await auth.api.updateUser({ headers, body: { cpf }, asResponse: true }), res, json);
    } catch (error) {
      if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE' || error?.code === '23505') return json(409, { code: 'CPF_UNAVAILABLE' });
      throw error;
    }
  }
  if (url.pathname === '/api/profile/avatar' || url.pathname === '/api/profile/avatar/remove') {
    if (req.method === 'GET') {
      const bytes = await avatars.read(session.user.id, session.user.image);
      if (!bytes) return json(404, { code: 'NOT_FOUND' });
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      return res.end(bytes);
    }
    const remove = url.pathname.endsWith('/remove');
    if (remove) await readJsonBody(req);
    const bytes = remove ? null : await readAvatar(req);
    return avatars.serialize(session.user.id, async () => {
      const fresh = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
      if (!fresh || fresh.user.id !== session.user.id) return json(401, { code: 'UNAUTHORIZED' });
      const reference = remove ? null : await avatars.write(fresh.user.id, bytes);
      let response;
      const discardUncommitted = async () => {
        if (!reference) return;
        // A network/response failure does not prove the DB rolled back. Only
        // remove a staged file after an authoritative read confirms it is not
        // current. If the outcome is unknown, retain it privately for recovery.
        try {
          const current = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
          if (current && current.user.id === fresh.user.id && current.user.image !== reference) await avatars.remove(fresh.user.id, reference);
        } catch { /* Unknown commit outcome: never delete a potentially live file. */ }
      };
      try {
        response = await auth.api.updateUser({ headers, body: { image: reference }, asResponse: true });
        if (!response.ok) await discardUncommitted();
      } catch (error) {
        await discardUncommitted();
        throw error;
      }
      // Commit first. A private orphan on cleanup failure is preferable to a
      // missing current photo or falsely reporting failure after persistence.
      if (response.ok) await avatars.remove(fresh.user.id, fresh.user.image).catch(() => {});
      return finishMutation(response, res, json);
    });
  }
  if (url.pathname === '/api/profile/name') {
    const { name } = await readJsonBody(req);
    if (typeof name !== 'string' || /[\u0000-\u001f\u007f]/u.test(name)) return json(400, { code: 'INVALID_NAME' });
    const normalized = name.normalize('NFC').trim().replace(/\s+/gu, ' ');
    if (!normalized || [...normalized].length > 100) return json(400, { code: 'INVALID_NAME' });
    return finishMutation(await auth.api.updateUser({ headers, body: { name: normalized }, asResponse: true }), res, json);
  }
  if (url.pathname === '/api/profile/password') {
    const { currentPassword, newPassword, confirmPassword } = await readJsonBody(req);
    if (typeof newPassword !== 'string' || newPassword !== confirmPassword) return json(400, { code: 'PASSWORD_MISMATCH' });
    const policy = auth.options.emailAndPassword;
    if (newPassword.length < policy.minPasswordLength) return json(400, { code: 'PASSWORD_TOO_SHORT' });
    if (newPassword.length > policy.maxPasswordLength) return json(400, { code: 'PASSWORD_TOO_LONG' });
    if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > policy.maxPasswordLength) return json(400, { code: 'INVALID_CURRENT_PASSWORD' });
    return finishMutation(await auth.api.changePassword({ headers, body: { currentPassword, newPassword, revokeOtherSessions: true }, asResponse: true }), res, json);
  }
  const { name } = session.user;
  const cpf = await getCPF(session.user.id);
  const context = await auth.$context;
  const credential = await context.internalAdapter.findCredentialAccount(session.user.id);
  return json(200, {
    user: { name, cpf, image: privateImageReference(session.user.image) },
    security: {
      hasPassword: Boolean(credential?.password),
      minPasswordLength: auth.options.emailAndPassword.minPasswordLength,
      maxPasswordLength: auth.options.emailAndPassword.maxPasswordLength,
    },
    capabilities: PROFILE_CAPABILITIES,
    // The existing fichas are public visual templates, not personal records.
    fichas: [],
  });
}
