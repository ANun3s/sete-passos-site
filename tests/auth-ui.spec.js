// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';
import AxeBuilder from '@axe-core/playwright';

test.use({ baseURL: process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177' });

test('login permite editar credenciais e alternar para criar conta', async ({ page }) => {
  await page.goto('/login.html');
  await expect(page.locator('#login-cpf')).toBeEnabled();
  await expect(page.locator('#login-password')).toBeEnabled();
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page.locator('#register-form')).toBeVisible();
  await expect(page.locator('#register-name')).toBeFocused();
  await expect(page.locator('#login-form')).toBeHidden();
  await page.getByRole('button', { name: 'Já tenho uma conta' }).click();
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('#login-cpf')).toBeFocused();
});

test('mostrar senha alterna sem perder valor e voltar ao login limpa cadastro', async ({ page }) => {
  await page.goto('/login.html');
  await page.locator('#login-password').fill('exemplo-local-sem-conta');
  await page.getByRole('button', { name: 'Mostrar senha', exact: true }).click();
  await expect(page.locator('#login-password')).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ocultar senha', exact: true }).click();
  await expect(page.locator('#login-password')).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page.locator('#login-password')).toHaveValue('');
});

test('confirmação divergente não envia cadastro', async ({ page }) => {
  let submissions = 0;
  page.on('request', req => { if (req.url().includes('/sign-up/email')) submissions++; });
  await page.goto('/login.html');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.locator('#register-name').fill('Conta fictícia');
  await page.locator('#register-cpf').fill('529.982.247-25');
  await page.locator('#register-password').fill('ExemploLocal123!');
  await page.locator('#register-confirm').fill('OutroExemplo123!');
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page.locator('#auth-error')).toHaveText('As senhas precisam ser iguais.');
  await expect(page.locator('#register-confirm')).toBeFocused();
  expect(submissions).toBe(0);
});

test('envio pendente bloqueia duplicação e falha permite tentar novamente', async ({ page }) => {
  let attempts = 0;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/api/auth/sign-in/email', async route => { attempts++; await pending; await route.abort('connectionrefused'); });
  await page.goto('/login.html');
  await page.locator('#login-cpf').fill('ficticio@example.test');
  await page.locator('#login-password').fill('ExemploLocal123!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeDisabled();
  await page.locator('#login-form').dispatchEvent('submit');
  await expect.poll(() => attempts).toBe(1);
  release();
  await expect(page.locator('#auth-error')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
  await expect(page.locator('#login-password')).toHaveValue('');
});

for (const width of [320, 768, 1024, 1440]) {
  test(`criar conta acessível e sem overflow em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login.html');
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include('#principal').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  });
}

test('API indisponível nunca apresenta login fictício', async ({ page }) => {
  await page.route('**/api/**', route => route.abort('connectionrefused'));
  await page.goto('/login.html');
  await page.locator('#login-cpf').fill('teste@example.test');
  await page.locator('#login-password').fill('exemplo-local-sem-conta');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('#auth-error')).toContainText('servidor');
  await expect(page.locator('#account-panel')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
});
