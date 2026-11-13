import { test, expect } from './profile-fixtures.mjs';
import { randomBytes } from 'node:crypto';

const servers = [process.env.AUTH_UI_URL || 'http://127.0.0.1:5177'];
if (process.env.GO_LIVE_URL) servers.push(process.env.GO_LIVE_URL);
for (const baseURL of servers) {
  test(`cadastro → login → reload → retorno → sair com SQLite real em ${baseURL}`, async ({ page, app }) => {
    const password = randomBytes(18).toString('base64url');
    const cpf = '529.982.247-25';
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${baseURL}/login.html`);
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await page.locator('#register-name').fill('Conta de teste');
    await page.locator('#register-cpf').fill(cpf);
    await page.locator('#register-password').fill(password);
    await page.locator('#register-confirm').fill(password);
    await page.getByRole('button', { name: 'Criar minha conta' }).click();
    await expect(page.locator('#auth-status')).toContainText('Solicitação processada');
    expect(app.db.prepare('SELECT count(*) AS n FROM user').get().n).toBe(1);
    const stored = app.db.prepare('SELECT password FROM account').get().password;
    expect(typeof stored === 'string' && stored !== password && stored.length > 64).toBe(true);
    await expect(page.locator('#account-panel')).toBeHidden();
    await page.locator('#login-password').fill(password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.locator('#profile-name')).toHaveText('Conta de teste');
    await expect(page).toHaveURL(/perfil\.html$/);
    const cookie = (await page.context().cookies()).find(c => c.name === 'sete-passos.session_token');
    expect(Boolean(cookie?.httpOnly && cookie.sameSite === 'Lax')).toBe(true);
    expect(await page.evaluate(() => document.cookie.includes('session_token'))).toBe(false);
    expect(await page.evaluate(() => Object.keys(localStorage).length)).toBe(0);
    await page.reload();
    await expect(page.locator('#profile-cpf')).toHaveText('529.982.247-25');
    await expect(page.locator('[data-admin-link]')).toBeHidden();
    expect(await page.evaluate(async () => (await fetch('/api/admin/access', { credentials: 'include' })).status)).toBe(403);
    await expect(page.locator('#profile-cpf')).toHaveText('529.982.247-25');
    await page.getByRole('button', { name: 'Sair da conta' }).click();
    await expect(page.locator('#login-form')).toBeVisible();
    await expect(page.locator('#profile-email')).toHaveCount(0);
    expect(app.db.prepare('SELECT count(*) AS n FROM session').get().n).toBe(0);
    const revoked = await fetch(`${app.url}/api/me`, { headers: { Cookie: `${cookie.name}=${cookie.value}` } });
    expect(revoked.status).toBe(401);
    await page.reload();
    await expect(page.locator('#login-form')).toBeVisible();
    await expect(page.locator('#account-panel')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test(`login por e-mail existente e cadastro por e-mail protegido em ${baseURL}`, async ({ page, app }) => {
    const password = randomBytes(18).toString('base64url');
    const existingEmail = { name: 'Conta fictícia', email: 'duplicada@example.test', password };
    await app.auth.api.signUpEmail({ body: existingEmail });
    await page.goto(`${baseURL}/login.html`);
    await page.locator('#login-cpf').fill('duplicada@example.test');
    await page.locator('#login-password').fill('SenhaIncorreta123!');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.locator('#auth-error')).toHaveText('Não foi possível entrar. Confira o CPF ou e-mail e a senha.');
    await expect(page.locator('#account-panel')).toBeHidden();
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await page.locator('#register-name').fill('Outra conta fictícia');
    await page.locator('#register-cpf').fill('DUPLICADA@example.test');
    await page.locator('#register-password').fill(password);
    await page.locator('#register-confirm').fill(password);
    await page.getByRole('button', { name: 'Criar minha conta' }).click();
    await expect(page.locator('#auth-error')).toContainText('exigem confirmação da caixa postal');
    expect(app.db.prepare('SELECT count(*) AS n FROM user').get().n).toBe(1);
    await expect(page.locator('#account-panel')).toBeHidden();
  });
}
