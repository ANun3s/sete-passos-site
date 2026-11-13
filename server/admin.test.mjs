import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, chmod, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createLocalServer } from './app.mjs';

const origin = 'http://127.0.0.1:5177';
const cookieFrom = response => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');

async function signUp(app, person) {
  const response = await app.auth.api.signUpEmail({ body: person });
  assert.ok(response.user?.id);
}
async function signIn(app, person) {
  const response = await fetch(`${app.url}/api/auth/sign-in/email`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(person) });
  assert.equal(response.status, 200);
  return cookieFrom(response);
}

test('administração e fichas: acesso de servidor restrito a uma única conta', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'sete-admin-'));
  const mockupsDirectory = join(directory, 'mockups');
  await mkdir(mockupsDirectory, { mode: 0o700 });
  const mockupPath = join(mockupsDirectory, 'avaliacao-fisioterapeutica.html');
  await writeFile(mockupPath, '<main>Modelo administrativo</main>', { mode: 0o600 });
  await chmod(mockupPath, 0o600);
  const contentPath = join(directory, 'admin-fichas.html');
  await writeFile(contentPath, '<section class="records-library"><details class="record-card"></details></section>', { mode: 0o600 });
  await chmod(contentPath, 0o600);
  const app = await createLocalServer({
    databasePath: join(directory, 'auth.sqlite'), secret: randomBytes(48).toString('base64url'),
    port: 0, mode: 'test', adminEmail: 'admin@example.test', adminContentPath: contentPath, adminMockupsDirectory: mockupsDirectory,
  });
  await app.start();
  t.after(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });

  const reservedSignup = await fetch(`${app.url}/api/auth/sign-up/email`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ name: 'Tentativa de administrador', identifier: 'ADMIN@example.test', password: randomBytes(24).toString('base64url') }) });
  assert.equal(reservedSignup.status, 400);
  assert.equal((await reservedSignup.json()).code, 'EMAIL_SIGNUP_REQUIRES_VERIFICATION');

  const guest = await fetch(`${app.url}/api/admin/access`);
  assert.equal(guest.status, 401);
  const guestPage = await fetch(`${app.url}/admin.html`, { redirect: 'manual' });
  assert.equal(guestPage.status, 303);
  assert.equal(guestPage.headers.get('location'), '/login.html?returnTo=%2Fadmin.html');

  const admin = { name: 'Conta admin', email: 'admin@example.test', password: randomBytes(24).toString('base64url') };
  const seededAdmin = await app.auth.api.signUpEmail({ body: admin });
  assert.ok(seededAdmin.user?.id);
  const adminCookie = await signIn(app, admin);
  const access = await fetch(`${app.url}/api/admin/access`, { headers: { Cookie: adminCookie } });
  assert.equal(access.status, 200);
  assert.deepEqual(await access.json(), { authorized: true, user: { name: 'Conta admin' } });
  const adminPage = await fetch(`${app.url}/admin.html`, { headers: { Cookie: adminCookie } });
  assert.equal(adminPage.status, 200);
  assert.match(await adminPage.text(), /data-page="admin"/);
  const fichas = await fetch(`${app.url}/api/admin/fichas`, { headers: { Cookie: adminCookie } });
  assert.equal(fichas.status, 200);
  assert.match((await fichas.json()).html, /records-library/);
  const mockup = await fetch(`${app.url}/api/admin/mockups/avaliacao-fisioterapeutica.html`, { headers: { Cookie: adminCookie } });
  assert.equal(mockup.status, 200);
  assert.match(mockup.headers.get('content-type'), /text\/html/u);
  assert.match(await mockup.text(), /Modelo administrativo/u);

  const other = { name: 'Outra conta', email: 'other@example.test', password: randomBytes(24).toString('base64url') };
  await signUp(app, other);
  const otherCookie = await signIn(app, other);
  assert.equal((await fetch(`${app.url}/api/admin/access`, { headers: { Cookie: otherCookie } })).status, 403);
  assert.equal((await fetch(`${app.url}/api/admin/fichas`, { headers: { Cookie: otherCookie } })).status, 403);
  assert.equal((await fetch(`${app.url}/api/admin/mockups/avaliacao-fisioterapeutica.html`, { headers: { Cookie: otherCookie } })).status, 403);
  assert.equal((await fetch(`${app.url}/api/admin/users`, { headers: { Cookie: otherCookie } })).status, 403);
  assert.equal((await fetch(`${app.url}/api/admin/fichas`, { method: 'POST', headers: { Cookie: otherCookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: other.email, title: 'Restrita', type: 'avaliacao-fisioterapeutica', content: 'Não deve salvar.' }) })).status, 403);
  const otherPage = await fetch(`${app.url}/admin.html`, { headers: { Cookie: otherCookie }, redirect: 'manual' });
  assert.equal(otherPage.status, 303);
  assert.equal(otherPage.headers.get('location'), '/index.html');

  const otherUserId = app.db.prepare('SELECT id FROM user WHERE email = ?').get(other.email).id;
  const createFicha = await fetch(`${app.url}/api/admin/fichas`, { method: 'POST', headers: { Cookie: adminCookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: otherUserId, title: 'Avaliação inicial', type: 'avaliacao-fisioterapeutica', content: 'Resumo clínico de teste.' }) });
  assert.equal(createFicha.status, 201);
  const fichaResponse = await createFicha.json();
  assert.deepEqual(fichaResponse.ficha, { title: 'Avaliação inicial', type: 'avaliacao-fisioterapeutica', content: 'Resumo clínico de teste.', createdAt: fichaResponse.ficha.createdAt });
  assert.ok(Number.isFinite(Date.parse(fichaResponse.ficha.createdAt)));
  const usersResponse = await fetch(`${app.url}/api/admin/users`, { headers: { Cookie: adminCookie } });
  assert.equal(usersResponse.status, 200);
  const usersPayload = await usersResponse.json();
  assert.equal(usersPayload.fichasStorageAvailable, true);
  assert.equal(usersPayload.users.length, 2);
  const linkedUser = usersPayload.users.find(user => user.name === other.name);
  assert.equal(linkedUser.name, other.name);
  assert.equal(linkedUser.activeSessions, 1);
  assert.equal(linkedUser.fichas.length, 1);
  assert.equal(linkedUser.fichas[0].content, 'Resumo clínico de teste.');
  assert.equal(typeof linkedUser.id, 'string');
  assert.equal(Object.hasOwn(linkedUser, 'password'), false);
  assert.equal(Object.hasOwn(linkedUser.fichas[0], 'userId'), false);
  const invalidFicha = await fetch(`${app.url}/api/admin/fichas`, { method: 'POST', headers: { Cookie: adminCookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: otherUserId, title: ' ', type: 'outro', content: 'Conteúdo' }) });
  assert.equal(invalidFicha.status, 400);
  app.db.exec('DROP TABLE clinical_ficha');
  const withoutStorage = await fetch(`${app.url}/api/admin/users`, { headers: { Cookie: adminCookie } });
  assert.equal(withoutStorage.status, 200);
  assert.equal((await withoutStorage.json()).fichasStorageAvailable, false);
  const unavailable = await fetch(`${app.url}/api/admin/fichas`, { method: 'POST', headers: { Cookie: adminCookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: otherUserId, title: 'Ficha', type: 'outro', content: 'Conteúdo' }) });
  assert.equal(unavailable.status, 503);
});
