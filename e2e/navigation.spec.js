import { expect, test } from './fixtures.js';

const PAGES = [
  ['/', /Tableau de bord|Bonjour/], ['/reports', /Signalements/], ['/badings', /Badings/], ['/comments', /Commentaires/],
  ['/stickers', /Stickers/], ['/moderation', /Mots interdits|règles/i], ['/users', /Utilisateurs/], ['/badges', /Badges vérifiés/],
  ['/announcements', /Annonces/], ['/data', /Données personnelles/], ['/audit', /Journal/], ['/settings', /Paramètres/],
];

test.describe('Navigation', () => {
  for (const [path, title] of PAGES) {
    test(`la page ${path} s’ouvre sans erreur`, async ({ admin: page }) => {
      await page.goto(`/#${path}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    });
  }

  test('le menu latéral mène à chaque section et marque la page active', async ({ admin: page }) => {
    await page.getByRole('link', { name: /Utilisateurs/ }).first().click();
    await expect(page).toHaveURL(/#\/users/);
    await expect(page.getByRole('link', { name: /Utilisateurs/ }).first()).toHaveAttribute('aria-current', 'page');
  });

  test('la recherche globale trouve un utilisateur et ouvre sa fiche', async ({ admin: page }) => {
    await page.locator('[data-search]').fill('kof');
    await page.locator('[data-results] a').first().click();
    await expect(page).toHaveURL(/#\/users\/u\d+/);
  });

  test('@mobile le menu s’ouvre avec le bouton Menu sur téléphone', async ({ admin: page }) => {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('link', { name: /Signalements/ }).first().click();
    await expect(page).toHaveURL(/#\/reports/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Signalements/);
  });
});
