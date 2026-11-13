import { isValidCPF, normalizeCPF } from './cpf.js';

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidLoginEmail(value) {
  const email = normalizeEmail(value);
  if (email.length > 254 || /\s/u.test(email)) return false;
  const [local, domain, ...extra] = email.split('@');
  if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..') || !domain || extra.length || !domain.includes('.')) return false;
  return domain.split('.').every(label => label.length > 0 && label.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label));
}

export function parseLoginIdentifier(value) {
  if (typeof value !== 'string') return { type: 'invalid-cpf', value: '' };
  const raw = value.trim();
  if (raw.includes('@')) return isValidLoginEmail(raw)
    ? { type: 'email', value: normalizeEmail(raw) }
    : { type: 'invalid-email', value: raw };
  // Accept only the two CPF forms shown to customers. normalizeCPF alone is
  // intentionally permissive for display/masking, so it must not turn text
  // such as "abc529.982.247-25xyz" into a valid login credential.
  if (!/^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/u.test(raw)) {
    return { type: 'invalid-cpf', value: normalizeCPF(raw) };
  }
  const cpf = normalizeCPF(raw);
  return isValidCPF(cpf) ? { type: 'cpf', value: cpf } : { type: 'invalid-cpf', value: cpf };
}

// The input formatter must notice punctuation typed into an email address
// before the user reaches @ (for example a numeric Gmail local part).
export function looksLikeEmailIdentifier(value, inserted = '') {
  return (typeof value === 'string' && /[a-z@]/iu.test(value))
    || (typeof inserted === 'string' && /[._+@a-z-]/iu.test(inserted));
}
