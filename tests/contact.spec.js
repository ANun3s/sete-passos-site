// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test('contato prepara e copia uma mensagem local sem simular agendamento', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const transmissions = [];
  page.on('request', request => { if (request.method() !== 'GET') transmissions.push(request.url()); });
  await page.goto('/');
  const trigger = page.locator('.hero [data-contact]');
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Nenhum dado é enviado');
  await dialog.getByLabel('Estética avançada', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Preparar mensagem' }).click();
  const message = dialog.getByLabel('Sua mensagem');
  await expect(message).toHaveValue(/estética avançada/);
  await dialog.getByRole('button', { name: 'Copiar mensagem' }).click();
  await expect(dialog.getByRole('status')).toContainText('Mensagem copiada');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await message.inputValue());
  expect(transmissions).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
