// Page Classement (src/views/Leaderboard.jsx) : onglets Flammes / BadeScore / Activité, avec l'API simulée.
import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

const user = (id) => ({ id, pseudo: `p_${id}`, photo: null, verified: false });
vi.mock('../src/lib/api.js', async (orig) => ({
  ...(await orig()),
  BACKEND: true,
  getFlames: async ({ season } = {}) => ({
    season: { number: Number(season || 2), startsOn: '2026-11-25', endsOn: '2026-12-24', day: 3, length: 30, closed: !!season, current: !season },
    seasons: [{ number: 2, startsOn: '2026-11-25', endsOn: '2026-12-24', closed: false, current: true, participants: 2 },
      { number: 1, startsOn: '2026-10-26', endsOn: '2026-11-24', closed: true, current: false, participants: 5 }],
    summary: { activeToday: 1, participants: 2, ranked: 2, topStreak: 3, bestRecord: { user: user('a'), record: 9 } },
    badeurs: [{ rank: 1, user: user('a'), streak: 3, seasonDays: 3, seasonBest: 3, record: 9, totalDays: 20, today: true },
      { rank: 2, user: user('b'), streak: 1, seasonDays: 2, seasonBest: 1, record: 1, totalDays: 2, today: false }],
    records: [{ user: user('a'), record: 9, totalDays: 20 }],
  }),
  getBadeScores: async ({ level } = {}) => ({
    total: 10,
    levels: ['Petit Badeur', 'Badeur du quartier', 'Badeur confirmé', 'Grand Badeur', 'Légende du Bade'].map((name, index) => ({ index, name, min: [0, 300, 2000, 8000, 25000][index], badeurs: index === 0 ? 9 : index === 1 ? 1 : 0 })),
    badeurs: (level === '1' ? [] : [{ rank: 1, user: user('c'), score: 120, level: 'Petit Badeur', levelIndex: 0, next: 300, nextLevel: 'Badeur du quartier' }]),
  }),
}));
vi.mock('../src/lib/store.js', async (orig) => ({ ...(await orig()), BACKEND: true }));
const { default: Leaderboard } = await import('../src/views/Leaderboard.jsx');

const mount = async (path) => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(async () => { createRoot(el).render(<MemoryRouter initialEntries={[path]}><Leaderboard /></MemoryRouter>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  return el;
};

describe('Classement du back-office', () => {
  it('par défaut : les flammes de la saison en cours, résumé, classement et records', async () => {
    const el = await mount('/leaderboard');
    expect(el.querySelector('[data-tab=flames]').getAttribute('aria-selected')).toBe('true');
    expect(el.querySelector('[data-kpi=today]').textContent).toBe('1');
    expect(el.querySelector('[data-flame-badeur=p_a]').textContent).toMatch(/3 🔥.*9.*20.*✓/);
    expect(el.querySelector('[data-flame-badeur=p_b]').textContent).toMatch(/à faire/);
    expect(el.textContent).toMatch(/Records de tous les temps/);
    expect(el.querySelector('[data-season]').options).toHaveLength(2);
  });

  it('saison close : résultats figés', async () => {
    const el = await mount('/leaderboard?tab=flames&season=1');
    expect(el.textContent).toMatch(/Saison close : résultats figés/);
  });

  it('onglet BadeScore : Badeurs par rang et classement', async () => {
    const el = await mount('/leaderboard?tab=badescore');
    expect(el.querySelector('[data-level="0"]').textContent).toMatch(/Petit Badeur.*9.*90 %/);
    expect(el.querySelector('[data-score-badeur=p_c]').textContent).toMatch(/120.*Petit Badeur.*Badeur du quartier dans 180 pts/);
  });
});
