import { test, expect } from '@playwright/test';

test.use({ baseURL: process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177' });

test('login usa o botão oficial Google Identity Services e envia o ID token ao servidor', async ({ page }) => {
  let signedIn = false;
  let socialPayload;

  await page.route('**/api/health', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      capabilities: { googleLogin: true },
      googleClientId: 'setepassos-test.apps.googleusercontent.com',
      passwordPolicy: { minPasswordLength: 12, maxPasswordLength: 128 },
    }),
  }));
  await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: `window.google = { accounts: { id: {
      initialize: config => { window.__googleIdentityConfig = config; },
      renderButton: (parent, options) => {
        window.__googleIdentityButtonOptions = options;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Entrar com Google (botão GIS de teste)';
        parent.append(button);
      }
    } } };`,
  }));
  await page.route('**/api/auth/get-session', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(signedIn ? {
        user: { id: 'google-test-user', name: 'Conta Google de teste' },
        session: { userId: 'google-test-user', expiresAt: new Date(Date.now() + 60_000).toISOString() },
      } : null),
    }));
  await page.route('**/api/auth/sign-in/social', async route => {
    socialPayload = route.request().postDataJSON();
    signedIn = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/api/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ user: { id: 'google-test-user', name: 'Conta Google de teste', cpf: null, image: null } }),
  }));

  await page.goto('/login.html?returnTo=%2Findex.html');
  const googleButton = page.locator('#google-login-button button');
  await expect(googleButton).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__googleIdentityButtonOptions)).toMatchObject({
    type: 'standard',
    theme: 'outline',
    text: 'signin_with',
    shape: 'pill',
    locale: 'pt_BR',
  });
  expect(await page.evaluate(() => window.__googleIdentityButtonOptions.width)).toBeLessThanOrEqual(400);
  expect(await page.evaluate(() => window.__googleIdentityConfig.client_id)).toBe('setepassos-test.apps.googleusercontent.com');
  const expectedNonce = await page.evaluate(() => window.__googleIdentityConfig.nonce);
  expect(expectedNonce).toMatch(/^[a-f0-9]{64}$/u);

  await page.evaluate(async () => window.__googleIdentityConfig.callback({ credential: 'signed-google-id-token' }));

  expect(socialPayload).toMatchObject({
    provider: 'google',
    idToken: { token: 'signed-google-id-token' },
  });
  expect(socialPayload.idToken.nonce).toBe(expectedNonce);
  await expect(page).toHaveURL(/\/index\.html$/u);
});

test('login informa quando o Google ainda não tem Client ID e não mostra um botão inoperante', async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      capabilities: { googleLogin: false },
      googleClientId: null,
      passwordPolicy: { minPasswordLength: 12, maxPasswordLength: 128 },
    }),
  }));
  await page.goto('/login.html');
  await expect(page.locator('#google-login-button')).toBeHidden();
  await expect(page.locator('#google-login-status')).toHaveText('O acesso pelo Google ficará disponível após configurar o Client ID do Google no servidor.');
});

test('login informa quando não consegue verificar a configuração Google', async ({ page }) => {
  await page.route('**/api/health', route => route.abort());
  await page.goto('/login.html');
  await expect(page.locator('#google-login-button')).toBeHidden();
  await expect(page.locator('#google-login-status')).toHaveText('Não foi possível verificar a configuração do login Google. Tente novamente mais tarde.');
});
