import { confirm, expect, store, test } from './fixtures.js';

test.describe('Plateforme et conformité', () => {
  test('modifier une règle (rires pour le badge) et la retrouver après rechargement', async ({ admin: page }) => {
    await page.goto('/#/moderation');
    await page.locator('input[name="badgeMinLaughs"]').fill('1500');
    await page.getByRole('button', { name: 'Enregistrer les règles' }).click();
    if (await page.getByRole('dialog').isVisible()) await confirm(page);
    await expect.poll(() => store(page, (S) => S.get().rules.badgeMinLaughs)).toBe(1500);
    await page.waitForTimeout(300); await page.reload();
    await expect(page.locator('input[name="badgeMinLaughs"]')).toHaveValue('1500');
  });

  test('envoyer une annonce aux comptes vérifiés', async ({ admin: page }) => {
    await page.goto('/#/announcements');
    await page.locator('#t').fill('Bravo les Badeurs vérifiés');
    await page.locator('#b').fill('Merci de faire rire tout le pays chaque semaine.');
    await page.locator('#a').selectOption('verified');
    await page.locator('[data-send]').click();
    if (await page.getByRole('dialog').isVisible()) await confirm(page);
    await expect.poll(() => store(page, (S) => S.get().announcements[0]?.title)).toBe('Bravo les Badeurs vérifiés');
  });

  test('envoyer la copie des données d’une demande', async ({ admin: page }) => {
    await page.goto('/#/data');
    const row = page.locator('tr', { has: page.getByRole('button', { name: 'Envoyer la copie' }) }).first();
    await row.getByRole('button', { name: 'Envoyer la copie' }).click();
    if (await page.getByRole('dialog').isVisible()) await confirm(page);
    await expect.poll(() => store(page, (S) => S.get().dataRequests.filter((d) => d.type === 'export' && d.status === 'pending').length)).toBe(0);
  });

  test('mode maintenance : activer puis désactiver', async ({ admin: page }) => {
    await page.goto('/#/settings');
    const sw = page.locator('[data-sw="maintenance"]');
    await sw.click();
    if (await page.getByRole('dialog').isVisible()) await confirm(page);
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await sw.click();
    if (await page.getByRole('dialog').isVisible()) await confirm(page);
    await expect(page.locator('[data-sw="maintenance"]')).toHaveAttribute('aria-checked', 'false');
  });

  test('Échap ferme une fenêtre de confirmation sans rien faire', async ({ admin: page }) => {
    await page.goto('/#/reports');
    const before = await store(page, (S) => S.openReports().length);
    await page.getByRole('button', { name: /Classer/ }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(await store(page, (S) => S.openReports().length)).toBe(before);
  });
});

test.describe('Affichage sur téléphone', () => {
  for (const path of ['/', '/reports', '/badings', '/users', '/badges', '/stickers', '/moderation', '/audit']) {
    test(`@mobile ${path} ne déborde pas horizontalement`, async ({ admin: page }) => {
      await page.goto(`/#${path}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
