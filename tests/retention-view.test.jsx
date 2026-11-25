// Page Rétention (src/views/Retention.jsx) avec l'API simulée.
import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../src/lib/api.js', async (orig) => ({
  ...(await orig()),
  BACKEND: true,
  getRetention: async () => ({
    summary: { users: 200, activeToday: 12, active7: 40, active30: 80, postedPct: 35, pushPct: 22 },
    cohorts: [{ week: '2026-11-16', size: 30, d1: 45, d7: null, d30: null, never: 20 }, { week: '2026-10-12', size: 20, d1: 30, d7: 15, d30: 4, never: 40 }],
    daily: [{ day: '2026-11-24', active: 10 }, { day: '2026-11-25', active: 12 }],
    depth: [{ bucket: '0', users: 50 }, { bucket: '1', users: 60 }, { bucket: '2-3', users: 40 }],
    firstBading: [{ reaction: false, authors: 10, backPct: 10 }, { reaction: true, authors: 30, backPct: 50 }],
    nudges: [{ kind: 'streak', sent30: 120, measured: 100, backPct: 62 }, { kind: 'inactive_mail', sent30: 0, measured: 0, backPct: null }],
  }),
}));
vi.mock('../src/lib/store.js', async (orig) => ({ ...(await orig()), BACKEND: true }));
const { default: Retention } = await import('../src/views/Retention.jsx');

describe('Rétention (back-office)', () => {
  it('chiffres clés, cohortes (— si pas encore mesurable), relances et premier bading', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    await act(async () => { createRoot(el).render(<MemoryRouter><Retention /></MemoryRouter>); });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(el.querySelector('[data-kpi=today]').textContent).toBe('12');
    expect(el.textContent).toMatch(/fidélité 50 %/);
    expect(el.querySelector('[data-cohort="2026-11-16"]').textContent).toMatch(/30.*45 %.*—.*—.*20 %/);
    expect(el.querySelector('[data-cohort="2026-10-12"] .rt-bad')).not.toBeNull(); // J30 à 4 %
    expect(el.querySelector('[data-nudge=streak]').textContent).toMatch(/Rappel de série.*120.*62 % \(100\)/);
    expect(el.querySelector('[data-nudge=inactive_mail]').textContent).toMatch(/—$/);
    expect(el.textContent).toMatch(/Avec réaction.*30.*50 %.*Sans réaction/);
  });
});
