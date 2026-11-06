import { ADMIN, expect, login, test } from './fixtures.js';

test.describe('Connexion', () => {
  test('refuse un mauvais mot de passe sans ouvrir le back-office', async ({ page }) => {
    await login(page, { password: 'mauvais' });
    await expect(page.locator('[data-err]')).toBeVisible();
    await expect(page).toHaveURL(/#\/login/);
  });

  test('sans session, toute page renvoie vers la connexion', async ({ page }) => {
    await page.goto('/#/users');
    await expect(page).toHaveURL(/#\/login/);
  });

  test('l’administrateur se connecte, voit le tableau de bord, puis se déconnecte', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Tableau de bord|Bonjour/);
    await page.locator('[data-me]').click();
    await page.getByRole('menuitem', { name: 'Se déconnecter' }).or(page.getByText('Se déconnecter')).first().click();
    await expect(page).toHaveURL(/#\/login/);
    await page.goto('/#/');
    await expect(page).toHaveURL(/#\/login/);
  });

  test('la session survit à un rechargement', async ({ page }) => {
    await login(page, ADMIN);
    await expect(page.locator('[data-me]')).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-me]')).toBeVisible();
  });
});
