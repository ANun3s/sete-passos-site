// Shared transport only. A browser flag is never a source of authentication.
export const DEFAULT_AVATAR = '/assets/avatar-default.svg';
export const ACCOUNT_EVENT = 'sete-passos:account-changed';

export function safeReturnTo(value) {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || /[\\\s\u0000-\u001f]/u.test(value)) return '/perfil.html';
  try {
    const url = new URL(value, 'https://local.invalid');
    if (url.origin !== 'https://local.invalid' || !['/perfil.html', '/admin.html', '/index.html'].includes(url.pathname)) return '/perfil.html';
    // No nested redirects, auth endpoints, or arbitrary query parameters.
    return `${url.pathname}${url.hash}`;
  } catch { return '/perfil.html'; }
}

export function apiURL(path) {
  const live = ['localhost', '127.0.0.1'].includes(location.hostname) && ['5500', '5501'].includes(location.port);
  return `${live ? `http://${location.hostname}:3007` : ''}${path}`;
}

export function avatarSource(value) {
  return typeof value === 'string' && /^\/api\/profile\/avatar(?:\?v=[a-zA-Z0-9_-]{1,160})?$/u.test(value) ? value : DEFAULT_AVATAR;
}

export function setAvatar(image, value) {
  const safe = avatarSource(value);
  if (safe !== DEFAULT_AVATAR) image.crossOrigin = 'use-credentials';
  else image.removeAttribute('crossorigin');
  image.onerror = () => { image.onerror = null; image.removeAttribute('crossorigin'); image.src = DEFAULT_AVATAR; };
  image.src = safe === DEFAULT_AVATAR ? safe : apiURL(safe);
}

function invalidResponse() {
  const error = new Error('Resposta incompleta do servidor.');
  error.code = 'INVALID_RESPONSE'; error.status = 502;
  return error;
}
function validIdentity(user, withID = false) {
  return user && typeof user === 'object' && !Array.isArray(user)
    && typeof user.name === 'string' && Boolean(user.name.trim())
    && (!withID || (typeof user.id === 'string' && Boolean(user.id)));
}
export function validateProfile(result) {
  const security = result?.security, capabilities = result?.capabilities;
  const image = result?.user?.image;
  if (!validIdentity(result?.user) || !(result.user.cpf === null || (typeof result.user.cpf === 'string' && /^\d{11}$/u.test(result.user.cpf)))
    || !(image === null || avatarSource(image) !== DEFAULT_AVATAR)
    || typeof security?.hasPassword !== 'boolean'
    || !Number.isSafeInteger(security.minPasswordLength) || security.minPasswordLength < 1
    || !Number.isSafeInteger(security.maxPasswordLength) || security.maxPasswordLength < security.minPasswordLength || security.maxPasswordLength > 10000
    || typeof capabilities?.cpfChange !== 'boolean' || typeof capabilities?.emailChange !== 'boolean' || typeof capabilities?.passwordReset !== 'boolean'
    || !Array.isArray(result.fichas)) throw invalidResponse();
  return result;
}

export async function request(path, { method = 'GET', body, signal } = {}) {
  const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
  const timeout = AbortSignal.timeout(20000);
  const response = await fetch(apiURL(path), {
    method, credentials: 'include', cache: 'no-store', redirect: 'error',
    headers: body && !multipart ? { 'Content-Type': 'application/json' } : {},
    body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  let data;
  try { data = await response.json(); } catch { if (response.ok) throw invalidResponse(); }
  if (!response.ok) {
    const error = new Error('A operação não pôde ser confirmada.');
    error.code = data?.code; error.status = response.status;
    throw error;
  }
  if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:;|$)/iu.test(response.headers.get('content-type') || '')) throw invalidResponse();
  if ((data === null || typeof data !== 'object' || Array.isArray(data)) && !(path === '/api/auth/get-session' && data === null)) throw invalidResponse();
  if (method === 'POST' && path.startsWith('/api/profile/') && data?.ok !== true) throw invalidResponse();
  return data;
}

export async function session(signal) {
  try {
    const current = await request('/api/auth/get-session', { signal });
    if (current === null) return null;
    if (!validIdentity(current?.user, true) || !current.session || current.session.userId !== current.user.id
      || !Number.isFinite(Date.parse(current.session.expiresAt))) throw invalidResponse();
    const account = await request('/api/me', { signal });
    if (!validIdentity(account?.user, true) || account.user.id !== current.user.id) throw invalidResponse();
    return account;
  }
  catch (error) { if (error.status === 401) return null; throw error; }
}

export async function adminAccess(signal) {
  return request('/api/admin/access', { signal });
}

export function notifyAccountChanged(kind = 'updated') {
  window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT, { detail: { kind } }));
  // Only an invalidation message travels between tabs. No user or secret data.
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('sete-passos-account');
    channel.postMessage({ kind }); channel.close();
  }
}

export function loginDestination() {
  return `/login.html?returnTo=${encodeURIComponent('/perfil.html')}`;
}

export function operationMessage(error) {
  const messages = {
    INVALID_NAME: 'Confira o nome: use de 1 a 100 caracteres, sem caracteres de controle.',
    INVALID_CURRENT_PASSWORD: 'A senha atual não está correta. Tente novamente.',
    INVALID_PASSWORD: 'A senha atual não está correta. Tente novamente.',
    PASSWORD_MISMATCH: 'A confirmação precisa ser igual à nova senha.',
    PASSWORD_TOO_SHORT: 'A nova senha precisa ter pelo menos 12 caracteres.',
    PASSWORD_TOO_LONG: 'A nova senha pode ter no máximo 128 caracteres.',
    IMAGE_TOO_LARGE: 'Escolha uma imagem de até 5 MB.',
    INVALID_IMAGE: 'Use um arquivo JPEG, PNG ou WebP válido. SVG e outros formatos não são aceitos.',
    IMAGE_DIMENSIONS: 'A imagem é grande demais em dimensões. Escolha uma versão menor.',
    EMAIL_UNAVAILABLE: 'O envio de e-mails ainda não está configurado. Nenhum e-mail foi enviado.',
    USER_ALREADY_EXISTS: 'Não foi possível usar esse e-mail. Confira o endereço ou recupere o acesso.',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Não foi possível usar esse e-mail. Confira o endereço ou recupere o acesso.',
    EMAIL_ALREADY_EXISTS: 'Não foi possível usar esse e-mail. Confira o endereço ou recupere o acesso.',
    INVALID_EMAIL: 'Digite um endereço de e-mail válido.',
    INVALID_TOKEN: 'Este link é inválido ou expirou. Solicite um novo link de recuperação.',
    TOKEN_EXPIRED: 'Este link expirou. Solicite um novo link de recuperação.',
    RATE_LIMITED: 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.',
  };
  return messages[error.code] || (error.status === 429 ? messages.RATE_LIMITED : 'Não foi possível confirmar a operação com o servidor. Seus dados preenchidos foram preservados; tente novamente.');
}
