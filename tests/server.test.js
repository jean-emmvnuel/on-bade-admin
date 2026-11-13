// Branchement sur l'API d'administration : conversion des réponses du serveur vers la forme des écrans.
import { describe, expect, it } from 'vitest';
import { buildDaily, fromAction, fromAdminBading, fromAdminComment, fromAdminSticker, fromAdminUser, fromBading, fromDataRequest, fromReport, fromVerification, permissionOf, roleOf, sanctionFromWarning } from '../src/lib/server.js';

const D = 86_400_000;

describe('Réponses de /api/admin → back-office', () => {
  it('rôle tiré de la permission, et l’inverse', () => {
    expect([roleOf(undefined), roleOf('READ'), roleOf('READWRITE'), roleOf('ALL')]).toEqual(['user', 'moderator', 'moderator', 'admin']);
    expect([permissionOf('admin'), permissionOf('moderator'), permissionOf('user')]).toEqual(['ALL', 'READWRITE', null]);
  });

  it('utilisateur bloqué avec une fin = suspendu, sans fin = banni', () => {
    const base = { id: 'u1', username: 'zero', email: 'z@x.ci', verified: false, createdAt: 5, points: 12, admin: null, counts: { posts: 3, comments: 1, reports: 0 } };
    expect(fromAdminUser({ ...base, block: null })).toMatchObject({ pseudo: 'zero', status: 'active', role: 'user', points: 12, joinedAt: 5, sanctions: [] });
    expect(fromAdminUser({ ...base, block: { reason: 'Spam', createdAt: 9, expiresAt: 99, adminId: 'a1' } })).toMatchObject({ status: 'suspended', suspendedUntil: 99, sanctions: [{ level: 2, reason: 'Spam' }] });
    expect(fromAdminUser({ ...base, block: { reason: 'Arnaque', createdAt: 9, expiresAt: undefined, adminId: 'a1' } })).toMatchObject({ status: 'banned', sanctions: [{ level: 3 }] });
    expect(fromAdminUser({ ...base, admin: { id: 'a1', permission: 'ALL' } })).toMatchObject({ role: 'admin', adminId: 'a1', permission: 'ALL' });
  });

  it('bading du fil : image { src, ratio } → { src, width, height }', () => {
    expect(fromBading({ id: 'b1', authorId: null, anonymous: true, text: '', image: { src: 'https://x/i', ratio: 0.8 }, createdAt: 1, likes: 4 }))
      .toMatchObject({ id: 'b1', anonymous: true, image: { src: 'https://x/i', width: 800, height: 1000 }, likes: 4, status: 'visible' });
  });

  it('signalement : cible, statut et auteur', () => {
    expect(fromReport({ id: 'r1', reason: 'Haine', status: 'open', createdAt: 2, reporter: { id: 'u2' }, bading: { id: 'b1' }, comment: null }))
      .toMatchObject({ targetType: 'bading', targetId: 'b1', reporterId: 'u2', status: 'open' });
    expect(fromReport({ id: 'r2', reason: 'Spam', status: 'resolved', createdAt: 2, reporter: { id: 'u2' }, bading: null, comment: { id: 'c1' } }))
      .toMatchObject({ targetType: 'comment', targetId: 'c1', status: 'actioned' });
  });

  it('demande de badge', () => {
    expect(fromVerification({ id: 'v1', user: { id: 'u1' }, links: ['tiktok.com/@z'], hasDocument: true, status: 'pending', createdAt: 3 }))
      .toMatchObject({ userId: 'u1', hasDocument: true, status: 'pending', links: ['tiktok.com/@z'] });
  });

  it('courbes des 30 jours : badings, rires et inscriptions par jour', () => {
    const now = new Date().setHours(12, 0, 0, 0); // midi : les deux badings tombent le même jour
    const days = buildDaily([{ createdAt: now, likes: 5 }, { createdAt: now - 1000, likes: 2 }, { createdAt: now - 40 * D, likes: 9 }], [{ joinedAt: now }], now);
    expect(days).toHaveLength(30);
    expect(days.at(-1)).toMatchObject({ badings: 2, laughs: 7, signups: 1 });
    expect(days.reduce((n, d) => n + d.badings, 0)).toBe(2); // le bading de 40 jours n'entre pas
  });
});

describe('Routes de modération /api/admin → back-office', () => {
  it('fromAdminBading : statut, motif de masquage, épinglage, signalements en attente', () => {
    const b = fromAdminBading({ id: 'p1', text: 'Salut', anonymous: true, authorId: null, createdAt: 5, likes: 3, comments: 2, openReports: 4, status: 'hidden', hidden: { reason: 'Spam', auto: true }, pinned: { at: 1, until: null, label: 'Bading du jour' } });
    expect(b).toMatchObject({ id: 'p1', authorId: null, status: 'hidden', hiddenReason: 'Spam', autoHidden: true, reportsCount: 4, commentCount: 2, pinned: { label: 'Bading du jour' } });
  });
  it('fromAdminComment : un commentaire masqué s’affiche « supprimé »', () => {
    expect(fromAdminComment({ id: 'c1', badingId: 'p1', author: { id: 'u1' }, text: 'x', status: 'hidden', hidden: { reason: 'Insulte' } })).toMatchObject({ authorId: 'u1', status: 'deleted', hiddenReason: 'Insulte' });
    expect(fromAdminComment({ id: 'c2', badingId: 'p1', authorId: 'u2', text: 'y', status: 'visible' }).status).toBe('visible');
  });
  it('fromAction : acteur = utilisateur, « system » pour une action automatique', () => {
    expect(fromAction({ id: 'a1', createdAt: 9, actor: { id: 'u1', username: 'x' }, action: 'bading.hide', targetId: 'p1', detail: 'Masqué' })).toEqual({ id: 'a1', at: 9, actor: 'u1', action: 'bading.hide', target: 'p1', targetType: null, detail: 'Masqué' });
    expect(fromAction({ id: 'a2', createdAt: 9, actor: null, action: 'bading.autohide', targetId: 'p1' }).actor).toBe('system');
  });
  it('fromDataRequest et sanctionFromWarning', () => {
    expect(fromDataRequest({ userId: 'u1', reason: 'Bye', requestedAt: 7 })).toEqual({ id: 'del-u1', userId: 'u1', type: 'deletion', reason: 'Bye', createdAt: 7, status: 'pending' });
    expect(sanctionFromWarning({ reason: 'Attention', createdAt: 3, adminId: 'ad1' })).toEqual({ level: 1, reason: 'Attention', at: 3, by: 'ad1' });
  });
  it('fromAdminSticker : retiré, utilisations et enregistrements', () => {
    expect(fromAdminSticker({ id: 's1', ownerId: 'u1', src: '/s.png', createdAt: 1, status: 'removed', uses: 5, saves: 2, removed: { reason: 'Choquant' } })).toMatchObject({ status: 'removed', uses: 5, saves: 2, removedReason: 'Choquant' });
  });
});
