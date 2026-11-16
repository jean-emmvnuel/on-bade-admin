// Backlog du projet (src/views/Backlog.jsx) : ordre des cartes et filtres.
import { describe, expect, it } from 'vitest';
import { matches, sortCards } from '../src/views/Backlog.jsx';

const c = (o) => ({ title: 'Carte', area: 'Produit', parts: [], status: 'todo', priority: null, position: 0, ...o });

describe('Backlog', () => {
  it('À faire : priorité haute d’abord, puis position', () => {
    const list = [c({ title: 'B', priority: 'basse' }), c({ title: 'H2', priority: 'haute', position: 2 }), c({ title: 'H1', priority: 'haute', position: 1 }), c({ title: 'Sans' })];
    expect(sortCards(list, 'todo').map((x) => x.title)).toEqual(['H1', 'H2', 'B', 'Sans']);
  });

  it('Fait : du plus récent au plus ancien', () => {
    const list = [c({ title: 'Vieux', doneAt: '2026-10-01' }), c({ title: 'Récent', doneAt: '2026-11-14' }), c({ title: 'Sans date' })];
    expect(sortCards(list, 'done').map((x) => x.title)).toEqual(['Récent', 'Vieux', 'Sans date']);
  });

  it('filtres : texte, domaine, partie du projet, priorité', () => {
    const card = c({ title: 'Captcha', detail: 'Turnstile', area: 'Sécurité', parts: ['site', 'backend'], priority: 'haute' });
    expect(matches(card, { q: 'turnstile' })).toBe(true);
    expect(matches(card, { area: 'Sécurité', part: 'backend', prio: 'haute' })).toBe(true);
    expect(matches(card, { part: 'serveur' })).toBe(false);
    expect(matches(card, { prio: 'basse' })).toBe(false);
  });
});
