import { test, expect, origin, openProfile, syntheticAccount, signIn, installProxy } from './profile-fixtures.mjs';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import AxeBuilder from '@axe-core/playwright';

async function avatar(color = '#3a697d') {
  return { name: 'foto-teste.png', mimeType: 'image/png', buffer: await sharp({ create: { width: 64, height: 80, channels: 3, background: color } }).png().toBuffer() };
}
async function openAvatarPicker(page) {
  await page.locator('#avatar-pencil').click();
  await page.locator('#avatar-edit').click();
  await expect(page.locator('#avatar-dialog')).toBeVisible();
}
async function editor(page, formID) {
  const details = page.locator(`#${formID}`).locator('..');
  if (await details.evaluate(element => element.tagName === 'DETAILS' && !element.open)) await details.locator('summary').click();
  else await page.locator(`#${formID}`).evaluate(form => { const d = form.closest('details'); if (d) d.open = true; });
}

test('login real abre perfil, dados verdadeiros, modelos vazios e logout revoga acesso', async ({ page, app }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const account = await openProfile(page, app);
  await expect(page).toHaveURL(/\/perfil\.html$/);
  await expect(page.locator('#profile-name')).toHaveText(account.name);
  await expect(page.locator('#profile-email')).toHaveText(account.email);
  await expect(page.locator('[data-profile-avatar]')).toHaveAttribute('src', '/assets/avatar-default.svg');
  await expect(page.locator('[data-account-avatar]')).toHaveAttribute('src', '/assets/avatar-default.svg');
  await expect(page.getByText('Você ainda não possui fichas vinculadas à sua conta', { exact: true })).toBeVisible();
  await expect(page.locator('#password-state')).toHaveText('Senha definida');
  await expect(page.locator('#email-availability')).toContainText('indisponível');
  await expect(page.locator('#email-fields input[name="newEmail"]')).toBeDisabled();
  const cookie = (await page.context().cookies()).find(cookie => cookie.name === 'sete-passos.session_token');
  expect(Boolean(cookie?.httpOnly && cookie.sameSite === 'Lax')).toBe(true);
  expect(await page.evaluate(() => document.cookie.includes('session_token'))).toBe(false);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  await page.reload(); await expect(page.locator('#profile-email')).toHaveText(account.email);
  await expect(page.locator('[data-admin-link]')).toBeHidden();
  await expect(page.getByRole('link', { name: /Modelos de fichas/ })).toHaveCount(0);
  const adminDenied = await page.evaluate(async () => (await fetch('/api/admin/access', { credentials: 'include' })).status);
  expect(adminDenied).toBe(403);
  await page.locator('#profile-logout').click();
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page).toHaveURL(/login\.html/);
  expect(app.db.prepare('SELECT count(*) AS n FROM session').get().n).toBe(0);
  expect((await fetch(`${app.url}/api/profile`, { headers: { Cookie: `${cookie.name}=${cookie.value}` } })).status).toBe(401);
  await page.goto(`${origin}/perfil.html`);
  await expect(page).toHaveURL(new RegExp(`${origin}/login\\.html`));
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('#profile-content')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('upload tem prévia cancelável, troca/remoção persistem e falha conserva foto', async ({ page, app }) => {
  const account = await openProfile(page, app);
  const original = await avatar();
  await openAvatarPicker(page);
  await page.locator('#avatar-file').setInputFiles(original);
  await expect(page.locator('#avatar-preview')).toBeVisible();
  await page.locator('#avatar-cancel').click();
  await expect(page.locator('#avatar-preview')).toBeHidden();
  await expect(page.locator('[data-profile-avatar]')).toHaveAttribute('src', '/assets/avatar-default.svg');
  await page.locator('#avatar-file').setInputFiles(original);
  await page.locator('#avatar-save').click();
  await expect(page.locator('#profile-status')).toHaveText('Foto atualizada.');
  const first = await page.locator('[data-profile-avatar]').getAttribute('src');
  expect(first).toContain('/api/profile/avatar?v=');
  await expect(page.locator('[data-account-avatar]')).toHaveAttribute('src', first);
  await expect(page.locator('#avatar-recents button')).toHaveCount(1);
  await page.reload(); await expect(page.locator('[data-profile-avatar]')).toHaveAttribute('src', first);
  await openAvatarPicker(page);
  await expect(page.locator('#avatar-recents button')).toHaveCount(0);
  await page.locator('#avatar-file').setInputFiles({ name: 'invalida.png', mimeType: 'image/png', buffer: Buffer.from('<html>não é imagem</html>') });
  await expect(page.locator('#profile-error')).toContainText('imagem');
  await expect(page.locator('[data-profile-avatar]')).toHaveAttribute('src', first);
  await page.locator('#avatar-file').setInputFiles(await avatar('#b07f62'));
  await page.locator('#avatar-save').click();
  await expect(page.locator('#profile-status')).toHaveText('Foto atualizada.');
  await expect(page.locator('[data-profile-avatar]')).not.toHaveAttribute('src', first);
  const second = await page.locator('[data-profile-avatar]').getAttribute('src');
  await page.locator('#avatar-dialog-close').click();
  await page.locator('#profile-logout').click();
  await expect(page.locator('#login-form')).toBeVisible();
  await signIn(page, account);
  await expect(page.locator('[data-profile-avatar]')).toHaveAttribute('src', second);
  await openAvatarPicker(page);
  await page.locator('#avatar-remove').click();
  await expect(page.locator('#profile-status')).toContainText('Foto removida');
  await page.reload(); await expect(page.locator('[data-profile-avatar]')).toHaveAttribute('src', '/assets/avatar-default.svg');
});

test('nome persiste no perfil e cabeçalho; erro mantém edição e cancelar restaura', async ({ page, app }) => {
  const account = await openProfile(page, app);
  await editor(page, 'profile-name-form');
  await page.locator('#profile-name-input').fill('  Ana D’Ávila — Teste  ');
  await page.locator('#profile-name-form button[type="submit"]').click();
  await expect(page.locator('#profile-status')).toHaveText('Nome atualizado.');
  await expect(page.locator('[data-account-name]')).toHaveText('Ana D’Ávila — Teste');
  await page.reload(); await expect(page.locator('#profile-name')).toHaveText('Ana D’Ávila — Teste');
  await editor(page, 'profile-name-form');
  await page.locator('#profile-name-input').fill('Nome ainda não salvo');
  await page.route('**/api/profile/name', route => route.abort('connectionrefused'));
  await page.locator('#profile-name-form button[type="submit"]').click();
  await expect(page.locator('#profile-error')).toContainText('servidor');
  await expect(page.locator('#profile-name-input')).toHaveValue('Nome ainda não salvo');
  await page.locator('[data-cancel-name]').click();
  await editor(page, 'profile-name-form');
  await expect(page.locator('#profile-name-input')).toHaveValue('Ana D’Ávila — Teste');
  await expect(page.locator('#profile-email')).toHaveText(account.email);
});

test('senha: divergência não envia, atual incorreta não desloga, nova substitui antiga', async ({ page, app }) => {
  const account = await openProfile(page, app);
  const next = randomBytes(24).toString('base64url');
  await editor(page, 'profile-password-form');
  const form = page.locator('#profile-password-form');
  await form.locator('[name="currentPassword"]').fill('IncorretaApenasTeste12');
  await form.locator('[name="newPassword"]').fill(next);
  await form.locator('[name="confirmPassword"]').fill('DiferenteApenasTeste12');
  let count = 0; page.on('request', request => { if (request.url().endsWith('/api/profile/password')) count++; });
  await form.locator('[type="submit"]').click();
  await expect(page.locator('#profile-error')).toContainText('confirmação'); expect(count).toBe(0);
  await form.locator('[name="confirmPassword"]').fill(next);
  await form.locator('[type="submit"]').click();
  await expect(page.locator('#profile-error')).toContainText('senha atual');
  await expect(form.locator('[name="currentPassword"]')).toBeFocused();
  await expect(page.locator('#profile-content')).toBeVisible();
  await form.locator('[name="currentPassword"]').fill(account.password);
  await form.locator('[type="submit"]').click();
  await expect(page.locator('#profile-status')).toContainText('Senha alterada');
  await page.locator('#profile-logout').click();
  await expect(page.locator('#login-form')).toBeVisible();
  await signIn(page, account);
  await expect(page.locator('#auth-error')).toContainText('Não foi possível entrar');
  await page.locator('#login-password').fill(next); await page.locator('#login-form [type="submit"]').click();
  await expect(page.locator('#profile-email')).toHaveText(account.email);
  const stored = app.db.prepare('SELECT password FROM account').get().password;
  expect(Boolean(stored && stored !== next && stored !== account.password)).toBe(true);
});

test('duas contas: perfil/foto próprios e nenhum acesso cruzado por ID ou versão', async ({ page, app, browser }) => {
  await openProfile(page, app, 'a');
  await openAvatarPicker(page);
  await page.locator('#avatar-file').setInputFiles(await avatar()); await page.locator('#avatar-save').click();
  await expect(page.locator('#profile-status')).toHaveText('Foto atualizada.');
  const privatePhoto = await page.locator('[data-profile-avatar]').getAttribute('src');
  const idA = app.db.prepare('SELECT id FROM user WHERE email = ?').get('pessoa-a@example.test').id;
  const accountB = await syntheticAccount(app, 'b');
  const other = await browser.newContext(); await installProxy(other, app);
  try {
    const b = await other.newPage(); await signIn(b, accountB);
    await expect(b.locator('#profile-email')).toHaveText(accountB.email);
    const codes = await b.evaluate(async ({ id, photo }) => {
      const endpoint = location.port === '5500' ? 'http://127.0.0.1:3007' : '';
      return Promise.all([`/api/users/${id}`, photo].map(async path => (await fetch(endpoint + path, { credentials: 'include' })).status));
    }, { id: idA, photo: new URL(privatePhoto, origin).pathname + new URL(privatePhoto, origin).search });
    expect(codes[0]).toBe(403); expect([403, 404]).toContain(codes[1]);
    await expect(b.locator('[data-profile-avatar]')).toHaveAttribute('src', '/assets/avatar-default.svg');
  } finally { await other.close(); }
});

test('sessão expirada durante edição bloqueia salvamento e limpa a página', async ({ page, app }) => {
  await openProfile(page, app);
  await editor(page, 'profile-name-form'); await page.locator('#profile-name-input').fill('Não deve salvar');
  app.db.prepare('UPDATE session SET expiresAt = 1').run();
  await page.locator('#profile-name-form button[type="submit"]').click();
  await expect(page).toHaveURL(/login\.html/);
  expect(app.db.prepare('SELECT name FROM user').get().name).toBe('Conta sintética a');
  await expect(page.locator('#profile-content')).toHaveCount(0);
});

test('recovery indisponível não envia nem promete entrega; returnTo externo é ignorado', async ({ page, app }) => {
  let sent = 0; page.on('request', request => { if (request.url().includes('request-password-reset')) sent++; });
  await page.goto(`${origin}/login.html?view=recover`);
  await expect(page.locator('#recover-form')).toBeVisible();
  await expect(page.locator('#auth-email-availability')).toContainText('indisponíveis');
  await expect(page.locator('#recover-form button[type="submit"]')).toBeDisabled(); expect(sent).toBe(0);
  const a = await syntheticAccount(app); await signIn(page, a, '?returnTo=https%3A%2F%2Fevil.example');
  await expect(page).toHaveURL(new RegExp(`${origin}/perfil\\.html$`));
});

test('falha ao carregar permite retry; erro da imagem volta ao bonequinho cinza', async ({ page, app }) => {
  const a = await syntheticAccount(app);
  await page.route('**/api/profile', route => route.abort('connectionrefused'));
  await signIn(page, a);
  await expect(page.locator('#profile-load-error')).toBeVisible();
  await expect(page.locator('#profile-content')).toBeHidden();
  await page.unroute('**/api/profile');
  await page.locator('[data-profile-retry]').click();
  await expect(page.locator('#profile-content')).toBeVisible();
  await page.locator('[data-profile-avatar]').evaluate(image => { image.src = '/imagem-inexistente-sintetica.png'; });
  await expect(page.locator('[data-profile-avatar]')).toHaveAttribute('src', '/assets/avatar-default.svg');
});

test('salvamento pendente bloqueia duplicações sem perder o nome digitado', async ({ page, app }) => {
  await openProfile(page, app);
  await editor(page, 'profile-name-form');
  await page.locator('#profile-name-input').fill('Nome confirmado uma vez');
  let calls = 0, release;
  const paused = new Promise(resolve => { release = resolve; });
  await page.route('**/api/profile/name', async route => { calls++; await paused; await route.fallback(); });
  await page.locator('#profile-name-form [type="submit"]').click();
  try {
    await expect(page.locator('#profile-name-form [type="submit"]')).toBeDisabled();
    await page.locator('#profile-name-form').dispatchEvent('submit');
    await expect.poll(() => calls).toBe(1);
  } finally { release(); }
  await expect(page.locator('#profile-status')).toHaveText('Nome atualizado.');
  expect(app.db.prepare('SELECT name FROM user').get().name).toBe('Nome confirmado uma vez');
});

test('logout em outra aba invalida o perfil e remove dados visíveis', async ({ page, app, context }) => {
  await openProfile(page, app);
  const second = await context.newPage();
  await second.goto(`${origin}/perfil.html`);
  await expect(second.locator('#profile-content')).toBeVisible();
  await page.locator('#profile-logout').click();
  await expect(second).toHaveURL(/login\.html/);
  await expect(second.locator('#profile-content')).toHaveCount(0);
  expect(app.db.prepare('SELECT count(*) AS n FROM session').get().n).toBe(0);
  await second.close();
});

for (const width of [320, 768, 1024, 1440]) {
  test(`perfil acessível e formulários sem cortes em ${width}px`, async ({ page, app }) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    await openProfile(page, app); await editor(page, 'profile-name-form'); await editor(page, 'profile-password-form');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const overflow = await page.locator('#profile-root input:not([type="file"]):visible').evaluateAll(inputs => inputs.some(input => { const r = input.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; }));
    expect(overflow).toBe(false);
    const scan = await new AxeBuilder({ page }).include('#principal').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(scan.violations).toEqual([]);
    await page.locator('#profile-name-input').focus(); await page.keyboard.press('Escape');
    await expect(page.locator('#profile-name-form')).toBeHidden();
    expect(await page.evaluate(() => document.activeElement.tagName)).toBe('SUMMARY');
    await page.locator('#principal h1').evaluate(heading => { heading.tabIndex = -1; heading.focus({ preventScroll: true }); });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: `${process.env.TMPDIR}/sete-passos-perfil-${process.env.PORTAL_BROWSER || 'chromium'}-${new URL(origin).port}-${width}.png`, fullPage: true });
  });
}
