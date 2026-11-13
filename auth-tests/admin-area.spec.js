import { test, expect, origin, syntheticAccount, syntheticAdminAccount, signIn } from './profile-fixtures.mjs';

test('somente a conta allowlisted vê Administração e carrega Fichas dentro da área', async ({ page, app }) => {
  await page.goto(`${origin}/`);
  const adminLink = page.locator('[data-admin-link]');
  await expect(adminLink).toBeHidden();

  const account = await syntheticAdminAccount(app);
  await signIn(page, account);
  await expect(adminLink).toBeVisible();
  await adminLink.click();
  await expect(page).toHaveURL(/admin\.html$/);
  await expect(page.getByRole('heading', { name: /Conta administrativa/ })).toBeVisible();
  const person = await syntheticAccount(app, 'ficha');
  await page.getByRole('link', { name: 'Pessoas e acessos', exact: true }).click();
  const profile = page.locator('.admin-user-card').filter({ hasText: person.email });
  await expect(profile).toBeVisible();
  await expect(profile).toContainText('Nenhuma ficha individual cadastrada.');
  await profile.getByText('Adicionar ficha a este perfil').click();
  await profile.getByLabel('Título').fill('Avaliação inicial');
  await profile.getByLabel('Conteúdo da ficha').fill('Registro sintético para validar o vínculo ao perfil.');
  await profile.getByRole('button', { name: 'Salvar ficha' }).click();
  await expect(profile).toContainText('Avaliação inicial');
  await expect(profile).toContainText('Registro sintético para validar o vínculo ao perfil.');
  await expect(page.getByRole('link', { name: 'Fichas', exact: true })).toBeVisible();
  await expect(page.locator('.record-card')).toHaveCount(0);
  await page.getByRole('link', { name: 'Fichas', exact: true }).click();
  await expect(page.locator('.record-card')).toHaveCount(1);
  await expect(page.getByText('Modelo de teste')).toBeVisible();
  const card = page.locator('.record-card');
  await card.locator('summary').click();
  await expect(card.locator('iframe')).toBeVisible();
  await expect(card.frameLocator('iframe').locator('main')).toContainText('Prévia protegida de teste');
});
