import { test, expect, openProfile } from './profile-fixtures.mjs';
import sharp from 'sharp';
import AxeBuilder from '@axe-core/playwright';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

for (const width of [320, 768, 1024, 1440]) {
  test(`seletor por lápis: foco, vidro e fechamento em ${width}px`, async ({ page, app }) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({width,height:960});
    await page.emulateMedia({ reducedMotion: width === 320 ? 'reduce' : 'no-preference' });
    await openProfile(page, app, `picker-${width}`);
    const pencil = page.getByRole('button',{name:'Editar foto do perfil',exact:true});
    await expect(page.locator('.profile-details')).toHaveCSS('opacity','1');
    await pencil.click();
    const edit = page.getByRole('button',{name:'Editar imagem',exact:true});
    await expect(edit).toBeVisible();
    await expect(page.locator('#avatar-edit-menu')).toHaveCSS('opacity','1');
    await page.screenshot({path:join(tmpdir(),`sete-passos-avatar-menu-${width}.png`)});
    await edit.click();
    const dialog = page.getByRole('dialog',{name:'Selecione uma imagem'});
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Enviar imagem',{exact:true})).toBeVisible();
    await expect(dialog.getByText(/GIF/)).toHaveCount(0);
    expect(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    const audit = await new AxeBuilder({page}).include('#avatar-dialog').withTags(['wcag2a','wcag2aa']).analyze();
    expect(audit.violations).toEqual([]);
    await page.screenshot({path:join(tmpdir(),`sete-passos-avatar-picker-${width}.png`)});
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(pencil).toBeFocused();
    await page.screenshot({path:join(tmpdir(),`sete-passos-profile-depth-${width}.png`)});
    expect(errors).toEqual([]);
  });
}


test('avatares recentes só incluem uploads salvos e podem ser escolhidos novamente', async ({ page, app }) => {
  await openProfile(page, app, 'recentes');
  await page.locator('#avatar-pencil').click(); await page.locator('#avatar-edit').click();
  await expect(page.locator('#avatar-file')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#avatar-dialog-close')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.querySelector('#avatar-dialog').contains(document.activeElement))).toBe(true);
  const photo = {name:'teste.png',mimeType:'image/png',buffer:await sharp({create:{width:96,height:96,channels:3,background:'#5c7592'}}).png().toBuffer()};
  await page.locator('#avatar-file').setInputFiles(photo);
  await expect(page.locator('#avatar-preview')).toBeVisible();
  await expect(page.locator('#avatar-recents button')).toHaveCount(0);
  await page.locator('#avatar-save').click();
  await expect(page.locator('#avatar-dialog-status')).toHaveText('Foto atualizada.');
  await expect(page.locator('#avatar-recents button')).toHaveCount(1);
  await page.locator('#avatar-dialog-close').click();
  await expect(page.locator('#avatar-pencil')).toBeFocused();
  await page.locator('#avatar-pencil').click(); await page.locator('#avatar-edit').click();
  await page.getByRole('button',{name:'Selecionar imagem recente 1'}).click();
  await expect(page.locator('#avatar-preview')).toBeVisible();
  await page.locator('#avatar-save').click();
  await expect(page.locator('#avatar-dialog-status')).toHaveText('Foto atualizada.');
  await expect(page.locator('#avatar-recents button')).toHaveCount(1);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  await page.locator('#avatar-dialog-close').click();
  await expect(page.locator('body')).not.toHaveClass(/dialog-open/);
});
