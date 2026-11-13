import { test, expect } from '@playwright/test';

test('o cursor permanece no fim enquanto o CPF é formatado no login e cadastro', async ({ page }) => {
  await page.goto('/login.html');

  for (const [view, selector] of [['login', '#login-cpf'], ['register', '#register-cpf']]) {
    if (view === 'register') await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    const input = page.locator(selector);
    await input.click();
    for (const digit of '52998224725') {
      await input.press(digit);
      const state = await input.evaluate(element => ({ value: element.value, start: element.selectionStart, end: element.selectionEnd }));
      expect(state.start, `cursor start after ${digit}`).toBe(state.value.length);
      expect(state.end, `cursor end after ${digit}`).toBe(state.value.length);
    }
    await expect(input).toHaveValue('529.982.247-25');
  }
});

test('a caixa única de login preserva e-mails enquanto são digitados', async ({ page }) => {
  await page.goto('/login.html');
  const input = page.locator('#login-cpf');
  await input.fill('gmail');
  await expect(input).toHaveValue('gmail');
  await input.fill('pessoa.teste@gmail.com');
  await expect(input).toHaveValue('pessoa.teste@gmail.com');
  await expect(page.locator('label[for="login-cpf"]')).toHaveText('CPF ou e-mail (Gmail)');
});

test('e-mail com usuário numérico não é transformado em máscara de CPF', async ({ page }) => {
  await page.goto('/login.html');
  const input = page.locator('#login-cpf');
  await input.click();
  for (const character of '1234@gmail.com') await input.press(character);
  await expect(input).toHaveValue('1234@gmail.com');
});
