import { becomeModerator, confirm, expect, store, test } from './fixtures.js';

test.describe('Utilisateurs', () => {
  test('rechercher puis ouvrir une fiche', async ({ admin: page }) => {
    await page.goto('/#/users');
    await page.locator('input[data-q]').fill('koffi');
    await expect(page).toHaveURL(/q=koffi/);
    await page.locator('tbody tr').first().click();
    await expect(page).toHaveURL(/#\/users\/u\d+/);
  });

  test('suspendre un compte 7 jours puis lever la sanction', async ({ admin: page }) => {
    const id = await store(page, (S) => S.users().find((u) => u.role === 'user' && u.status === 'active').id);
    await page.goto(`/#/users/${id}`);
    await page.getByRole('button', { name: /Sanctionner/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[value="2"]').check();
    await dialog.locator('#sr').fill('Harcèlement en commentaires');
    await dialog.locator('[data-ok]').click();
    await expect.poll(() => store(page, (S, i) => S.user(i).status, id)).toBe('suspended');
    await page.getByRole('button', { name: /Lever la sanction/ }).click();
    if (await page.getByRole('dialog').isVisible()) await confirm(page);
    await expect.poll(() => store(page, (S, i) => S.user(i).status, id)).toBe('active');
  });
});

test.describe('Badge vérifié', () => {
  test('accepter une demande vérifie le compte', async ({ admin: page }) => {
    const g = await store(page, (S) => S.pendingBadges().find((x) => !S.user(x.userId).verified));
    await page.goto('/#/badges');
    await page.locator(`.badge-req[data-id="${g.id}"]`).getByRole('button', { name: /Accepter/ }).click();
    await confirm(page);
    await expect.poll(() => store(page, (S, u) => S.user(u).verified, g.userId)).toBe(true);
  });

  test('attribuer le badge à un Badeur éligible qui n’a rien demandé', async ({ admin: page }) => {
    await page.goto('/#/badges?tab=eligible');
    const card = page.locator('.badge-req[data-uid]').first();
    const uid = await card.getAttribute('data-uid');
    await card.getByRole('button', { name: /Attribuer le badge/ }).click();
    await confirm(page);
    await expect.poll(() => store(page, (S, u) => S.user(u).verified, uid)).toBe(true);
    await expect(page.locator(`.badge-req[data-uid="${uid}"]`)).toHaveCount(0);
  });

  test('un modérateur voit les demandes mais ne peut rien valider', async ({ admin: page }) => {
    await becomeModerator(page);
    await page.goto('/#/badges'); await page.reload();
    await expect(page.locator('[data-me]')).toContainText('Modérateur');
    await expect(page.getByText(/Lecture seule/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Accepter|Refuser|Attribuer/ })).toHaveCount(0);
    const id = await store(page, (S) => S.users().find((u) => u.role === 'user').id);
    await page.goto(`/#/users/${id}`);
    await expect(page.getByRole('button', { name: /Attribuer le badge|Retirer le badge/ })).toHaveCount(0);
  });
});
