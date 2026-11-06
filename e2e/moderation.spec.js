import { confirm, expect, store, test } from './fixtures.js';

test.describe('Modération', () => {
  test('classer sans suite ferme tous les signalements du contenu et le retire de la file', async ({ admin: page }) => {
    await page.goto('/#/reports');
    const card = page.locator('article.report').first();
    const [type, id] = (await card.getAttribute('data-key')).split(':');
    const n = await store(page, (S, [t, i]) => S.openReports().filter((r) => r.targetType === t && r.targetId === i).length, [type, id]);
    const before = await store(page, (S) => S.openReports().length);
    await card.getByRole('button', { name: /Classer/ }).click();
    await confirm(page, 'Conforme à la charte');
    await expect.poll(() => store(page, (S) => S.openReports().length)).toBe(before - n);
    await expect(page.locator(`article.report[data-key="${type}:${id}"]`)).toHaveCount(0);
  });

  test('masquer un bading avec un motif puis le rétablir', async ({ admin: page }) => {
    const id = await store(page, (S) => S.get().badings.find((b) => b.status === 'visible').id);
    await page.goto(`/#/badings/${id}`);
    await page.getByRole('button', { name: /Masquer/ }).first().click();
    await confirm(page, 'Contraire à la charte');
    await expect.poll(() => store(page, (S, i) => S.bading(i).status, id)).toBe('hidden');
    await page.getByRole('button', { name: /Rétablir/ }).first().click();
    await expect.poll(() => store(page, (S, i) => S.bading(i).status, id)).toBe('visible');
  });

  test('filtrer les badings avec image', async ({ admin: page }) => {
    await page.goto('/#/badings');
    await page.locator('select[data-f="kind"]').selectOption('image');
    await expect(page).toHaveURL(/kind=image/);
    const n = await store(page, (S) => S.get().badings.filter((b) => b.image).length);
    await expect(page.locator('tbody tr')).toHaveCount(n);
  });

  test('retirer un sticker partout puis le rétablir', async ({ admin: page }) => {
    await page.goto('/#/stickers');
    const card = page.locator('.sticker-card[data-id="us4"]');
    await card.getByRole('button', { name: /Retirer partout/ }).click();
    await confirm(page, 'Personne réelle exposée');
    await expect.poll(() => store(page, (S) => S.customSticker('us4').status)).toBe('removed');
    await page.locator('.sticker-card[data-id="us4"]').getByRole('button', { name: /Rétablir/ }).click();
    await expect.poll(() => store(page, (S) => S.customSticker('us4').status)).toBe('visible');
  });

  test('ajouter un mot interdit', async ({ admin: page }) => {
    await page.goto('/#/moderation');
    await page.getByPlaceholder(/mot|expression/i).first().fill('Grand voleur');
    await page.getByRole('button', { name: /Ajouter/ }).first().click();
    await expect.poll(() => store(page, (S) => S.get().bannedWords)).toContain('grand voleur');
  });

  test('chaque action est inscrite au journal d’audit', async ({ admin: page }) => {
    await page.goto('/#/reports');
    await page.getByRole('button', { name: /Classer/ }).first().click();
    await confirm(page, 'Signalement abusif');
    await page.goto('/#/audit');
    await expect(page.getByText('Signalement abusif').first()).toBeVisible();
  });
});
