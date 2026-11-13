import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createLocalServer } from './app.mjs';
import { formatCPF, formatCPFInput, isValidCPF, normalizeCPF } from '../src/cpf.js';
import { looksLikeEmailIdentifier, parseLoginIdentifier } from '../src/login-identifier.js';

const origin = 'http://127.0.0.1:5177';

test('validador de CPF normaliza, formata e rejeita dígitos verificadores inválidos', () => {
  assert.equal(normalizeCPF('529.982.247-25'), '52998224725');
  assert.equal(formatCPF('52998224725'), '529.982.247-25');
  assert.equal(isValidCPF('529.982.247-25'), true);
  assert.equal(isValidCPF('111.111.111-11'), false);
  assert.equal(isValidCPF('529.982.247-24'), false);
  assert.equal(isValidCPF('123'), false);
  assert.equal(parseLoginIdentifier('529.982.247-25').type, 'cpf');
  assert.deepEqual(parseLoginIdentifier('  Pessoa@GMAIL.com '), { type: 'email', value: 'pessoa@gmail.com' });
  assert.equal(parseLoginIdentifier('111.111.111-11').type, 'invalid-cpf');
  assert.equal(parseLoginIdentifier('pessoa@').type, 'invalid-email');
  assert.equal(parseLoginIdentifier('abc529.982.247-25xyz').type, 'invalid-cpf');
  assert.equal(parseLoginIdentifier('529-982-247-25').type, 'invalid-cpf');
  assert.equal(looksLikeEmailIdentifier('pessoa'), true);
  assert.equal(looksLikeEmailIdentifier('1234@gmail.com'), true);
  assert.equal(looksLikeEmailIdentifier('1.234', '@'), true);
});

test('a formatação automática mantém o cursor no fim do CPF digitado', () => {
  const input = { value: '', setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; } };
  for (const digit of '52998224725') {
    input.value += digit;
    formatCPFInput(input);
    assert.equal(input.selectionStart, input.value.length);
    assert.equal(input.selectionEnd, input.value.length);
  }
  assert.equal(input.value, '529.982.247-25');
});

test('email começa a ser reconhecido antes do @ e não passa pelo formatador de CPF', () => {
  for (const value of ['g', 'gmail', 'usuario@gmail.com']) assert.equal(looksLikeEmailIdentifier(value), true);
  assert.equal(looksLikeEmailIdentifier('52998224725'), false);
});

test('cadastro e entrada aceitam CPF ou e-mail, permitem a mesma senha em contas diferentes e ocultam o e-mail interno', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'sete-cpf-'));
  const app = await createLocalServer({ databasePath: join(directory, 'auth.sqlite'), secret: randomBytes(48).toString('base64url'), port: 0, mode: 'test' });
  await app.start();
  t.after(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });

  const credentials = { name: 'Pessoa de teste', cpf: '529.982.247-25', password: randomBytes(24).toString('base64url') };
  const post = (path, body, headers = {}) => fetch(`${app.url}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(body) });
  const invalid = await post('/api/auth/sign-up/email', { ...credentials, cpf: '111.111.111-11' });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, 'INVALID_CPF');

  const created = await post('/api/auth/sign-up/email', credentials);
  assert.equal(created.status, 200);
  const secondAccount = await post('/api/auth/sign-up/email', { ...credentials, name: 'Outra pessoa', cpf: '111.444.777-35' });
  assert.equal(secondAccount.status, 200);
  const bothIdentifiers = await post('/api/auth/sign-up/email', { name: 'Conta ambígua', identifier: 'pessoa@gmail.com', cpf: '111.444.777-35', password: credentials.password });
  assert.equal(bothIdentifiers.status, 400);
  assert.equal((await bothIdentifiers.json()).code, 'INVALID_IDENTIFIER');
  const login = await post('/api/auth/sign-in/email', { cpf: '52998224725', password: credentials.password });
  assert.equal(login.status, 200);
  const loginBody = await login.json();
  assert.equal(Object.hasOwn(loginBody, 'user') && Object.hasOwn(loginBody.user, 'email'), false);
  const cookies = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');

  const me = await fetch(`${app.url}/api/me`, { headers: { Cookie: cookies } });
  assert.equal(me.status, 200);
  const profile = await me.json();
  assert.equal(profile.user.cpf, '52998224725');
  assert.equal(Object.hasOwn(profile.user, 'email'), false);

  const emailSignup = await post('/api/auth/sign-up/email', { name: 'Pessoa Gmail', identifier: '  Pessoa.Teste@GMAIL.com ', password: credentials.password });
  assert.equal(emailSignup.status, 200);
  const emailLogin = await post('/api/auth/sign-in/email', { identifier: 'pessoa.teste@gmail.com', password: credentials.password });
  assert.equal(emailLogin.status, 200);
  const emailCookies = emailLogin.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const emailProfile = await fetch(`${app.url}/api/me`, { headers: { Cookie: emailCookies } });
  assert.equal(emailProfile.status, 200);
  assert.equal((await emailProfile.json()).user.cpf, null);
  const emailAsCpf = await post('/api/auth/sign-in/email', { identifier: '93541134780', password: credentials.password });
  assert.equal(emailAsCpf.status, 401);
  const linkedCpf = await fetch(`${app.url}/api/profile/cpf`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: emailCookies }, body: JSON.stringify({ cpf: '93541134780' }) });
  assert.equal(linkedCpf.status, 200);
  const linkedEmailProfile = await fetch(`${app.url}/api/me`, { headers: { Cookie: emailCookies } });
  assert.equal((await linkedEmailProfile.json()).user.cpf, '93541134780');
  const linkedCpfLogin = await post('/api/auth/sign-in/email', { identifier: '935.411.347-80', password: credentials.password });
  assert.equal(linkedCpfLogin.status, 200);
});
