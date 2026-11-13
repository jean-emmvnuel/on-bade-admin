import { test as base, expect } from '@playwright/test';

export const ADMIN = { email: 'admin@jebade.app', password: 'JeBade2026!' };

/** Chaque test échoue si la page lève une erreur JavaScript. */
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await use(page);
    expect(errors, `Erreurs JavaScript : ${errors.join(' | ')}`).toEqual([]);
  },
  /** Page déjà connectée en tant qu'administrateur. */
  admin: async ({ page }, use) => {
    await login(page);
    await use(page);
  },
});
export { expect };

export async function login(page, { email = ADMIN.email, password = ADMIN.password } = {}) {
  await page.goto('/#/login');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.locator('#pw').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

/** Passe la session sur le modérateur de la démo (rôle sans droit sur les badges). */
export async function becomeModerator(page) {
  await page.evaluate(async () => {
    const S = await import('/src/lib/store.js');
    const m = S.users().find((u) => u.role === 'moderator');
    S.get().session = { userId: m.id, at: Date.now() };
    localStorage.setItem('jebade-admin-v1', JSON.stringify(S.get()));
  });
}

/** Lit l'état de la démo depuis le navigateur. */
export const store = (page, fn, arg) => page.evaluate(async ([src, a]) => { const S = await import('/src/lib/store.js'); return new Function('S', 'a', `return (${src})(S, a)`)(S, a); }, [fn.toString(), arg]);

/** Valide la fenêtre de confirmation ouverte (avec un motif si besoin). */
export async function confirm(page, reason) {
  const dialog = page.getByRole('dialog');
  if (reason) await dialog.locator('textarea').fill(reason);
  await dialog.locator('[data-ok]').click();
  await expect(dialog).toBeHidden();
}
