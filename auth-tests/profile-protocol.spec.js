import { test, expect, openProfile, origin } from './profile-fixtures.mjs';

for (const bad of [
  { label: 'HTML', contentType: 'text/html', body: '<html>upstream indisponível</html>' },
  { label: 'JSON sem confirmação', contentType: 'application/json', body: '{"message":"ok"}' },
]) {
  test(`resposta 200 ${bad.label} não anuncia salvamento nem perde o rascunho`, async ({ page, app }) => {
    const account = await openProfile(page, app);
    await page.locator('#profile-name-details summary').click();
    await page.locator('#profile-name-input').fill('Rascunho não persistido');
    await page.route('**/api/profile/name', route => route.fulfill({ status: 200, contentType: bad.contentType, body: bad.body }));
    await page.locator('#profile-name-form [type="submit"]').click();
    await expect(page.locator('#profile-error')).toContainText('confirmar');
    await expect(page.locator('#profile-name-input')).toHaveValue('Rascunho não persistido');
    await expect(page.locator('#profile-name')).toHaveText(account.name);
    expect(app.db.prepare('SELECT name FROM user').get().name).toBe(account.name);
  });
}

test('objeto incompleto de perfil não afirma identidade nem estado da senha', async ({ page, app }) => {
  await openProfile(page, app);
  await page.route('**/api/profile', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: {}, capabilities: {}, security: { minPasswordLength: 12, maxPasswordLength: 128 } }) }));
  await page.reload();
  await expect(page.locator('#profile-load-error')).toBeVisible();
  await expect(page.locator('#profile-content')).toBeHidden();
  await expect(page.locator('#password-state')).toBeEmpty();
  await expect(page.locator('#profile-name')).toBeEmpty();
  await page.unroute('**/api/profile'); await page.locator('[data-profile-retry]').click();
  await expect(page.locator('#profile-content')).toBeVisible();
});

test('sessão incompleta não autentica nem redireciona o login', async ({ page }) => {
  await page.route('**/api/auth/get-session', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"user":{}}' }));
  await page.route('**/api/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"user":{}}' }));
  await page.goto(`${origin}/login.html`);
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('[data-account-name]')).toHaveCount(0);
  await expect(page).toHaveURL(/login\.html$/);
});
