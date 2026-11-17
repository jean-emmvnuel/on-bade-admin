// Page « Serveur » (src/views/Server.jsx) : alertes de santé, tri des routes, formats.
import { describe, expect, it } from 'vitest';
import { fmtMs, fmtUptime, health, sortRoutes } from '../src/views/Server.jsx';

const snap = (o = {}) => ({
  totals: { p95Ms: 120 },
  process: { lagP99Ms: 12, cpu: 5 },
  host: { totalMemMb: 8000, freeMemMb: 4000 },
  database: { ok: true, pingMs: 2 },
  timeline: { stepMinutes: 1, points: Array.from({ length: 60 }, () => ({ count: 100, errors: 0 })) },
  ...o,
});

describe('Page Serveur', () => {
  it('tout va bien : aucune alerte', () => {
    expect(health(snap())).toEqual([]);
  });

  it('base injoignable, beaucoup d’erreurs, réponses lentes, Node surchargé', () => {
    const points = Array.from({ length: 60 }, (_, i) => ({ count: 100, errors: i < 30 ? 5 : 0 }));
    const issues = health(snap({ database: { ok: false, message: 'refusée' }, timeline: { stepMinutes: 1, points }, totals: { p95Ms: 1500 }, process: { lagP99Ms: 250, cpu: 95 } }));
    expect(issues[0]).toMatchObject({ tone: 'bad', text: expect.stringContaining('Base de données injoignable') });
    expect(issues[1]).toMatchObject({ tone: 'bad', text: expect.stringContaining('150 erreurs serveur') });
    expect(issues.map((i) => i.text).join(' | ')).toMatch(/Réponses lentes.*surchargé.*CPU/);
  });

  it('une erreur isolée : simple avertissement', () => {
    const points = Array.from({ length: 60 }, (_, i) => ({ count: 100, errors: i === 10 ? 1 : 0 }));
    expect(health(snap({ timeline: { stepMinutes: 1, points } }))).toEqual([{ tone: 'warn', text: '1 erreur serveur sur la dernière heure' }]);
  });

  it('tri des routes : appels, lenteur, erreurs', () => {
    const routes = [
      { path: '/a', count: 10, p95Ms: 900, errors: 0, clientErrors: 0 },
      { path: '/b', count: 50, p95Ms: 20, errors: 0, clientErrors: 3 },
      { path: '/c', count: 5, p95Ms: 40, errors: 2, clientErrors: 0 },
    ];
    expect(sortRoutes(routes, 'count').map((r) => r.path)).toEqual(['/b', '/a', '/c']);
    expect(sortRoutes(routes, 'p95Ms').map((r) => r.path)).toEqual(['/a', '/c', '/b']);
    expect(sortRoutes(routes, 'errors').map((r) => r.path)).toEqual(['/c', '/b']);
  });

  it('formats', () => {
    expect(fmtMs(42.37)).toBe('42,4 ms');
    expect(fmtMs(1500)).toBe('1,5 s');
    expect(fmtUptime(3 * 86400 + 4 * 3600)).toBe('3 j 4 h');
    expect(fmtUptime(3700)).toBe('1 h 1 min');
  });
});
