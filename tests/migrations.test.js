import { beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'jebade-admin-v1';
const load = async () => { vi.resetModules(); return import('../js/store.js'); };
beforeEach(() => localStorage.clear());

describe('Données gardées dans le navigateur', () => {
  it('anciennes règles du badge (ancienneté + 10 badings) → nouvelles (actif + 1 000 rires), sans perdre la session', async () => {
    let S = await load();
    const old = JSON.parse(JSON.stringify(S.get()));
    old.session = { userId: 'admin', at: 1 };
    old.rules = { ...old.rules, badgeMinAgeDays: 30, badgeMinBadings: 10 };
    delete old.rules.badgeActiveDays; delete old.rules.badgeMinLaughs;
    localStorage.setItem(KEY, JSON.stringify(old));
    S = await load();
    expect(S.get().rules).toMatchObject({ badgeActiveDays: 30, badgeMinLaughs: 1000 });
    expect(S.get().rules.badgeMinAgeDays).toBeUndefined();
    expect(S.me()?.id).toBe('admin');
  });
  it('la session survit à un rechargement', async () => {
    let S = await load();
    S.get().session = { userId: 'admin', at: 1 }; S.setPlatform('maintenance', true);
    await new Promise((r) => setTimeout(r, 200));
    S = await load();
    expect(S.me()?.id).toBe('admin');
    expect(S.get().platform.maintenance).toBe(true);
  });
});
