import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as S from '../src/lib/store.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sticker } from '../src/components/ui.jsx';

const stickerHtml = (id) => renderToStaticMarkup(createElement(Sticker, { id }));

const D = 86_400_000;
const as = (userId) => { S.get().session = { userId, at: Date.now() }; };
const moderator = () => S.users().find((u) => u.role === 'moderator');
const lastLog = () => S.get().audit[0];

beforeEach(() => { S.resetDemo(); as('admin'); });

describe('Connexion au back-office', () => {
  it('refuse un mauvais mot de passe ou un e-mail inconnu', async () => {
    S.get().session = null;
    expect(await S.logIn('admin@jebade.app', 'mauvais')).toBe(false);
    expect(await S.logIn('personne@jebade.app', 'JeBade2026!')).toBe(false);
    expect(S.me()).toBeNull();
  });
  it('connecte l’administrateur (e-mail insensible à la casse) et l’inscrit au journal', async () => {
    S.get().session = null;
    expect(await S.logIn('  Admin@JeBade.app ', 'JeBade2026!')).toBe(true);
    expect(S.me().role).toBe('admin');
    expect(lastLog()).toMatchObject({ action: 'auth.login', actor: 'admin' });
  });
  it('la déconnexion vide la session', () => { S.logOut(); expect(S.me()).toBeNull(); });
});

describe('Badge vérifié : seul l’administrateur décide', () => {
  it('canManageBadges : oui pour l’admin, non pour un modérateur', () => {
    expect(S.canManageBadges()).toBe(true);
    as(moderator().id); expect(S.canManageBadges()).toBe(false);
  });
  it('un modérateur ne peut ni attribuer, ni retirer, ni valider', () => {
    const u = S.users().find((x) => x.role === 'user' && !x.verified), g = S.pendingBadges()[0];
    as(moderator().id);
    expect(S.setVerified(u.id, true)).toBe(false);
    expect(S.decideBadge(g.id, true)).toBe(false);
    expect(u.verified).toBe(false);
    expect(S.pendingBadges().some((x) => x.id === g.id)).toBe(true);
  });
  it('l’admin attribue un badge directement : la demande en attente est close', () => {
    const g = S.pendingBadges()[0];
    S.setVerified(g.userId, true);
    expect(S.user(g.userId).verified).toBe(true);
    expect(S.get().badgeRequests.find((x) => x.id === g.id).status).toBe('accepted');
    expect(lastLog()).toMatchObject({ action: 'badge.grant', target: g.userId });
  });
  it('accepter une demande vérifie le compte et supprime la pièce d’identité', () => {
    const g = S.pendingBadges()[0];
    S.decideBadge(g.id, true);
    expect(S.user(g.userId).verified).toBe(true);
    expect(S.get().badgeRequests.find((x) => x.id === g.id).document).toMatch(/supprimé après traitement/);
  });
  it('refuser une demande garde le motif communiqué', () => {
    const g = S.pendingBadges().find((x) => !S.user(x.userId).verified);
    S.decideBadge(g.id, false, 'Il faut au moins 1 000 rires reçus');
    expect(S.get().badgeRequests.find((x) => x.id === g.id)).toMatchObject({ status: 'refused', reason: 'Il faut au moins 1 000 rires reçus' });
    expect(S.user(g.userId).verified).toBe(false);
  });
});

describe('Badge vérifié : conditions pour demander', () => {
  const uid = 'u1';
  const setBadings = (list) => { S.get().badings = S.get().badings.filter((b) => b.authorId !== uid).concat(list.map((b, i) => ({ id: `t${i}`, authorId: uid, anonymous: false, status: 'visible', createdAt: Date.now(), likes: 0, ...b }))); };
  it('éligible : actif et au moins 1 000 rires sur les badings signés', () => {
    setBadings([{ likes: 600 }, { likes: 400, createdAt: Date.now() - 2 * D }]);
    expect(S.badgeEligibility(uid)).toMatchObject({ active: true, laughs: 1000, eligible: true });
  });
  it('les badings anonymes et supprimés ne comptent pas', () => {
    setBadings([{ likes: 900 }, { likes: 5000, anonymous: true }, { likes: 5000, status: 'deleted' }]);
    expect(S.badgeEligibility(uid)).toMatchObject({ laughs: 900, eligible: false });
  });
  it('pas actif si le dernier bading signé a plus de 30 jours', () => {
    setBadings([{ likes: 3000, createdAt: Date.now() - 31 * D }]);
    expect(S.badgeEligibility(uid)).toMatchObject({ active: false, eligible: false });
  });
  it('aucun bading : ni actif ni éligible', () => {
    setBadings([]);
    expect(S.badgeEligibility(uid)).toMatchObject({ active: false, lastDays: null, laughs: 0, eligible: false });
  });
  it('les seuils se règlent dans les règles', () => {
    setBadings([{ likes: 300 }]);
    expect(S.badgeEligibility(uid).eligible).toBe(false);
    expect(S.setRules({ badgeMinLaughs: 200 })).toBe(1);
    expect(S.badgeEligibility(uid).eligible).toBe(true);
  });
});

describe('Sanctions et comptes', () => {
  it('avertissement : le compte reste actif', () => {
    S.sanction('u1', 1, 'Spam'); expect(S.user('u1')).toMatchObject({ status: 'active' }); expect(S.user('u1').sanctions.at(-1)).toMatchObject({ level: 1, by: 'admin' });
  });
  it('suspension de 7 jours puis levée', () => {
    S.sanction('u2', 2, 'Harcèlement');
    expect(S.user('u2').status).toBe('suspended');
    expect(S.user('u2').suspendedUntil - Date.now()).toBeGreaterThan(6.9 * D);
    S.liftSanction('u2'); expect(S.user('u2')).toMatchObject({ status: 'active', suspendedUntil: undefined });
  });
  it('bannissement définitif', () => { S.sanction('u3', 3, 'Arnaques'); expect(S.user('u3').status).toBe('banned'); });
  it('changer le pseudo retire le badge', () => {
    S.user('u3').verified = true; S.setPseudo('u3', 'NouveauNom');
    expect(S.user('u3')).toMatchObject({ pseudo: 'NouveauNom', verified: false });
  });
  it('supprimer un compte supprime aussi ses badings et commentaires', () => {
    S.deleteUser('u1', 'Test');
    expect(S.user('u1').status).toBe('deleted');
    expect(S.badingsOf('u1').every((b) => b.status === 'deleted')).toBe(true);
    expect(S.get().comments.filter((c) => c.authorId === 'u1').every((c) => c.status === 'deleted')).toBe(true);
  });
  it('changer le rôle est journalisé', () => { S.setRole('u1', 'moderator'); expect(S.user('u1').role).toBe('moderator'); expect(lastLog().action).toBe('user.role'); });
});

describe('Modération des contenus', () => {
  it('masquer un bading garde le motif, le rétablir l’efface', () => {
    const b = S.get().badings[0];
    S.setBadingStatus(b.id, 'hidden', 'Signalements');
    expect(S.bading(b.id)).toMatchObject({ status: 'hidden', hiddenReason: 'Signalements' });
    S.setBadingStatus(b.id, 'visible'); expect(S.bading(b.id).hiddenReason).toBeUndefined();
  });
  it('révéler l’auteur d’un bading anonyme est toujours journalisé avec le motif', () => {
    const b = S.get().badings.find((x) => x.anonymous);
    const author = S.revealAuthor(b.id, 'Réquisition judiciaire');
    expect(author.id).toBe(b.authorId);
    expect(lastLog()).toMatchObject({ action: 'vault.reveal', target: b.id });
    expect(lastLog().detail).toContain('Réquisition judiciaire');
  });
  it('traiter des signalements les ferme avec la décision et le modérateur', () => {
    const ids = S.openReports().slice(0, 2).map((r) => r.id);
    S.resolveReports(ids, 'dismissed', 'Conforme à la charte');
    for (const id of ids) expect(S.get().reports.find((r) => r.id === id)).toMatchObject({ status: 'dismissed', decision: 'Conforme à la charte', resolvedBy: 'admin' });
  });
  it('supprimer puis rétablir un commentaire', () => {
    const c = S.get().comments[0];
    S.setCommentStatus(c.id, 'deleted', 'Insulte'); expect(S.comment(c.id).status).toBe('deleted');
    S.setCommentStatus(c.id, 'visible'); expect(S.comment(c.id).status).toBe('visible');
  });
  it('retirer un sticker partout : il s’affiche « retiré » dans les commentaires', () => {
    S.setStickerStatus('us4', 'removed', 'Personne réelle exposée');
    expect(S.customSticker('us4').status).toBe('removed');
    expect(stickerHtml('us4')).toContain('retiré');
    S.setStickerStatus('us4', 'visible'); expect(stickerHtml('us4')).not.toContain('retiré');
  });
  it('compte les utilisations d’un sticker (hors commentaires supprimés)', () => {
    const n = S.stickerUses('us4');
    const c = S.get().comments.find((x) => x.sticker === 'us4'); S.setCommentStatus(c.id, 'deleted');
    expect(S.stickerUses('us4')).toBe(n - 1);
  });
});

describe('Règles, mots interdits, plateforme', () => {
  it('mots interdits : normalisés, sans doublon, retirables', () => {
    expect(S.addBannedWord('  GRAND Voleur ')).toBe(true);
    expect(S.get().bannedWords).toContain('grand voleur');
    expect(S.addBannedWord('grand voleur')).toBe(false);
    expect(S.addBannedWord('   ')).toBe(false);
    S.removeBannedWord('grand voleur'); expect(S.get().bannedWords).not.toContain('grand voleur');
  });
  it('setRules ne journalise que les vrais changements', () => {
    const n = S.get().audit.length;
    expect(S.setRules({ captionMax: S.get().rules.captionMax })).toBe(0);
    expect(S.get().audit.length).toBe(n);
    expect(S.setRules({ captionMax: 300, commentMax: 400 })).toBe(2);
    expect(lastLog().detail).toContain('captionMax 280 → 300');
  });
  it('mode maintenance', () => { S.setPlatform('maintenance', true); expect(S.get().platform.maintenance).toBe(true); expect(lastLog().detail).toContain('activé'); });
  it('une annonce aux comptes vérifiés touche exactement les comptes vérifiés', () => {
    S.sendAnnouncement({ title: 'Merci', body: 'Bravo', audience: 'verified' });
    expect(S.get().announcements[0].reach).toBe(S.users().filter((u) => u.verified).length);
  });
});

describe('Données personnelles', () => {
  it('traiter une demande de suppression supprime le compte', () => {
    const d = S.pendingData().find((x) => x.type === 'deletion');
    S.processDataRequest(d.id);
    expect(S.user(d.userId).status).toBe('deleted');
    expect(S.get().dataRequests.find((x) => x.id === d.id).status).toBe('done');
  });
  it('annuler une demande garde le motif', () => {
    const d = S.pendingData()[0];
    S.rejectDataRequest(d.id, 'Doublon');
    expect(S.get().dataRequests.find((x) => x.id === d.id)).toMatchObject({ status: 'cancelled', reason: 'Doublon' });
  });
});

describe('Journal d’audit', () => {
  it('chaque action est journalisée avec son auteur', () => {
    as(moderator().id);
    S.setCommentStatus(S.get().comments[1].id, 'deleted', 'x');
    expect(lastLog().actor).toBe(moderator().id);
  });
  it('deux actions dans la même milliseconde ont des identifiants différents', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    S.setPlatform('commentsEnabled', false); S.setPlatform('commentsEnabled', true);
    expect(S.get().audit[0].id).not.toBe(S.get().audit[1].id);
  });
});

describe('Formats', () => {
  it('compact et libellés', () => {
    expect(S.compact(950)).toBe('950'); expect(S.compact(3210)).toBe('3,2 k'); expect(S.compact(25_000)).toBe('25 k');
    expect(S.targetLabel('user', 'u1')).toBe(`@${S.user('u1').pseudo}`);
    expect(S.targetLabel('sticker', 'us4')).toContain(S.customSticker('us4').label);
  });
});
