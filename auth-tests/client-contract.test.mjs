import test from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnTo, avatarSource } from '../src/account-api.js';

test('destino de login aceita somente páginas internas conhecidas', () => {
  assert.equal(safeReturnTo('/perfil.html#seguranca'), '/perfil.html#seguranca');
  assert.equal(safeReturnTo('/admin.html?section=fichas'), '/admin.html');
  assert.equal(safeReturnTo('/fichas.html'), '/perfil.html');
  for (const input of [null, '', 'https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '/%2f%2fevil.test', '/api/auth/sign-out', '/login.html', '/perfil.html\n', 'perfil.html', '/perfil.html?returnTo=https://evil.test']) {
    assert.equal(safeReturnTo(input), '/perfil.html');
  }
});

test('avatar nunca carrega URLs externas ou conteúdo ativo do atributo de conta', () => {
  const fallback = '/assets/avatar-default.svg';
  for (const value of [null, '', 'https://evil.test/pixel', 'javascript:alert(1)', 'data:image/svg+xml,evil', '/api/profile/avatar?userId=someone']) {
    assert.equal(avatarSource(value), fallback);
  }
  assert.equal(avatarSource('/api/profile/avatar?v=abc-123'), '/api/profile/avatar?v=abc-123');
});
