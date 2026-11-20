// Données de la plateforme + actions d'administration.
// Avec l'API (BACKEND, voir api.js) : les données viennent de /api/admin/* (server.js) et chaque action
// est envoyée au serveur ; en cas de refus, un toast l'explique et les données sont rechargées.
// En démo (localhost, tests) : tout est simulé dans le navigateur et inscrit au journal d'audit local.
import * as api from './api.js';
import { BACKEND, errorMessage } from './api.js';
import * as server from './server.js';
import { toast } from './toast.js';
import { emptyState, seed } from './demoData.js';

export { BACKEND };

const MIN = 60_000, H = 60 * MIN, D = 24 * H;
const KEY = 'jebade-admin-v1';

// Démo : admin@jebade.app / JeBade2026!  (hash SHA-256 salé ; en prod, l'API vérifie un hash argon2)
const ADMIN_HASH = '6230cc7849e264edd951bb046f65d35970d1d7d940951937b0912a8fa8fa406d';

export const ROLES = { user: 'Utilisateur', moderator: 'Modérateur', admin: 'Administrateur' };
export const REASONS = { haine: 'Haine / discrimination', harcelement: 'Harcèlement', choquant: 'Contenu choquant', spam: 'Spam / arnaque', usurpation: 'Usurpation', vraie_personne: 'Personne réelle exposée', autre: 'Autre' };
export const SANCTIONS = { 1: 'Avertissement', 2: 'Suspension 7 jours', 3: 'Bannissement définitif' };

// ─── État ──────────────────────────────────────────────────
const SESSION_KEY = 'onbade-admin-session';
let state;
if (BACKEND) {
  // Seule la session est gardée dans le navigateur ; les données sont relues sur le serveur.
  let session = null;
  try { session = api.getToken() ? JSON.parse(localStorage.getItem(SESSION_KEY)) : null; } catch {}
  state = emptyState(session);
} else {
  try { state = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { state = seed(); }
  // Nouvelle version des données (images et stickers) : on régénère la démo en gardant la session.
  if (state.v !== 2) { const session = state.session ?? null; state = seed(); state.session = session; }
  // Nouvelles règles du badge (actif + 1 000 rires) sans perdre les données en place.
  // Collections de stickers : la limite passe de 50 à 1 000.
  if (state.rules.myStickersMax === 50) state.rules.myStickersMax = 1000;
  if (!('badgeMinLaughs' in state.rules)) { state.rules.badgeActiveDays = 30; state.rules.badgeMinLaughs = 1000; delete state.rules.badgeMinAgeDays; delete state.rules.badgeMinBadings; }
}

const listeners = new Set();
let saveTimer, version = 0;
/** Numéro de version de l'état : change à chaque modification (React s'y abonne via useSyncExternalStore). */
export const getVersion = () => version;
function commit() {
  version += 1;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      if (BACKEND) localStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
      else localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, 120);
  listeners.forEach((fn) => fn(state));
}

/**
 * Fonctions disponibles. Avec l'API, seules celles que le serveur sait faire sont proposées
 * (les autres écrans et boutons sont masqués).
 */
const SERVER_FEATURES = new Set(['reports', 'badings', 'users', 'badges', 'data', 'settings', 'block', 'verify', 'role', 'passwordReset', 'deleteContent',
  'comments', 'stickers', 'moderation', 'announcements', 'audit', 'warning', 'hide', 'reveal', 'pseudo', 'deleteUser', 'restoreComment', 'dataProcess',
  'pin', 'message', 'export', 'security', 'backlog', 'server', 'leaderboard']);
/** Fonctions réservées aux administrateurs « tous les droits » (permission ALL) côté serveur. */
const ALL_ONLY = new Set(['reveal', 'deleteUser', 'dataProcess', 'export', 'server']);
export const can = (feature) => !BACKEND || (SERVER_FEATURES.has(feature) && (!ALL_ONLY.has(feature) || me()?.permission === 'ALL'));

// ─── Chargement depuis l'API ──────────────────────────────
let loading = null;
export const isLoaded = () => !BACKEND || state.loaded;
/** Charge les données du serveur (une seule fois, sauf `force`). */
export function ensureLoaded(force = false) {
  if (!BACKEND) return Promise.resolve();
  if (!loading || force) {
    loading = server.loadAll().then((data) => { Object.assign(state, data); commit(); }).catch((e) => { loading = null; throw e; });
  }
  return loading;
}
/**
 * Envoie une action au serveur (`call` n'est appelé qu'avec l'API). L'écran a déjà été mis à jour : en cas de refus, on prévient
 * et on recharge les vraies données.
 */
function remote(call) {
  if (!BACKEND) return Promise.resolve(true);
  return Promise.resolve().then(call).then(() => { refreshAudit(); return true; }, (e) => {
    toast(errorMessage(e, 'L’action n’a pas pu être enregistrée.'), 'bad');
    ensureLoaded(true).catch(() => {});
    return false;
  });
}
/** Relit le journal d'audit du serveur (après chaque action réussie : c'est lui qui l'écrit). */
let auditTimer;
export function refreshAudit() {
  if (!BACKEND) return;
  clearTimeout(auditTimer);
  auditTimer = setTimeout(() => { server.loadAudit().then((audit) => { state.audit = audit; commit(); }).catch(() => {}); }, 300);
}
const loadedDetails = new Set();
/** Commentaires d'un bading (chargés à la première ouverture de son détail). */
export async function loadBadingDetail(id) {
  if (!BACKEND || loadedDetails.has(`b:${id}`)) return false;
  loadedDetails.add(`b:${id}`);
  const { bading: b, comments, users: people } = await server.loadBading(id);
  people.forEach((u) => { if (!state.users[u.id]) state.users[u.id] = u; });
  const known = bading(id);
  if (known) Object.assign(known, { ...b, rebades: known.rebades, authorId: known.authorId ?? b.authorId });
  else state.badings.push(b);
  state.comments = state.comments.filter((c) => c.badingId !== id).concat(comments);
  commit();
  return true;
}
/** Fiche complète d'un utilisateur (historique des blocages). */
export async function loadUserDetail(id) {
  if (!BACKEND || loadedDetails.has(`u:${id}`)) return false;
  loadedDetails.add(`u:${id}`);
  state.users[id] = { ...state.users[id], ...(await server.loadUser(id)) };
  commit();
  return true;
}
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const get = () => state;
export function resetDemo() { const s = state.session; state = seed(); state.session = s; loadedDetails.clear(); log('platform.reset', null, 'Données de démo réinitialisées'); }

function log(action, target, detail) {
  // Avec l'API, c'est le serveur qui tient le journal (relu par refreshAudit après chaque action).
  if (BACKEND) { commit(); return; }
  state.audit.unshift({ id: `l${Date.now()}${Math.random().toString(36).slice(2, 5)}`, at: Date.now(), actor: state.session?.userId ?? 'system', action, target, detail });
  commit();
}

// ─── Lecture ───────────────────────────────────────────────
/** Auteur d'une action : un utilisateur, ou un administrateur (identifiant de la table des admins côté serveur). */
export const actor = (id) => state.users[id] ?? state.users[state.admins?.find((a) => a.id === id)?.user?.id];
export const me = () => (state.session ? state.users[state.session.userId] ?? state.session.user ?? null : null);
export const user = (id) => state.users[id];
export const bading = (id) => state.badings.find((b) => b.id === id);
export const comment = (id) => state.comments.find((c) => c.id === id);
export const users = () => Object.values(state.users);
export const openReports = () => state.reports.filter((r) => r.status === 'open');
export const pendingBadges = () => state.badgeRequests.filter((g) => g.status === 'pending');
export const pendingData = () => state.dataRequests.filter((d) => d.status === 'pending');
export const commentsOf = (badingId) => state.comments.filter((c) => c.badingId === badingId);
export const badingsOf = (userId) => state.badings.filter((b) => b.authorId === userId);
export const reportsOn = (type, id) => state.reports.filter((r) => r.targetType === type && r.targetId === id);
export const customSticker = (id) => state.customStickers?.[id];
export const stickerUses = (id) => state.customStickers?.[id]?.uses ?? state.comments.filter((c) => c.sticker === id && c.status !== 'deleted').length;
export function targetLabel(type, id) {
  if (type === 'bading') return `Bading ${id}`;
  if (type === 'comment') return `Commentaire ${id}`;
  if (type === 'sticker') return `Sticker ${state.customStickers?.[id]?.label ?? id}`;
  if (type === 'user') return `@${state.users[id]?.pseudo ?? id}`;
  return id ?? '';
}

// ─── Connexion admin ───────────────────────────────────────
async function sha(s) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join(''); }
/** Connexion. Renvoie true, false (identifiants faux) ou 'forbidden' (compte sans accès au back-office). */
export async function logIn(email, password) {
  const e = email.trim().toLowerCase();
  if (BACKEND) {
    let res;
    try {
      res = await api.login(e, password);
    } catch (err) {
      if ([400, 401, 404].includes(err.status) && err.code !== 'account_blocked') return false;
      throw err;
    }
    api.setToken(res.token);
    pendingLogin = { user: res.user, email: e };
    // Double authentification activée : le code est demandé avant tout accès (Login → verifyMfa).
    if (res.mfaRequired) return 'mfa';
    return finishLogin();
  }
  const u = Object.values(state.users).find((x) => x.email === e && (x.role === 'admin' || x.role === 'moderator'));
  if (!u || u.id !== 'admin' || (await sha(`jebade-admin:${e}:${password}`)) !== ADMIN_HASH) return false;
  state.session = { userId: u.id, at: Date.now() };
  log('auth.login', u.id, 'Connexion au back-office');
  return true;
}
// ─── Double authentification ───────────────────────────────
let pendingLogin = null;
/** Vérifie que le compte connecté fait partie de l'équipe et ouvre la session. */
async function finishLogin() {
  const { user: account, email } = pendingLogin ?? {};
  if (!account) return false;
  let admin = null;
  try {
    const { admins = [] } = await api.getAdmins();
    admin = admins.find((a) => a.user?.id === account.id);
  } catch (err) {
    // L'équipe impose la double authentification et ce compte ne l'a pas encore configurée.
    if (err.code === 'mfa_setup_required') return 'mfa-setup';
    if (err.status !== 403) { api.setToken(null); throw err; }
  }
  if (!admin) { api.logout().catch(() => {}); api.setToken(null); pendingLogin = null; return 'forbidden'; }
  const user = { ...server.fromBriefUser(account), email: account.email ?? email, role: server.roleOf(admin.permission), adminId: admin.id, permission: admin.permission };
  state = emptyState({ userId: user.id, at: Date.now(), user });
  loading = null; loadedDetails.clear(); pendingLogin = null;
  commit();
  return true;
}
/** Étape 2 de la connexion : code à 6 chiffres. Renvoie le même résultat que logIn, ou 'bad-code'. */
export async function verifyMfa(code) {
  try {
    const { token } = await api.mfaVerify(code.trim());
    api.setToken(token);
  } catch (err) {
    if (err.code === 'invalid_code') return 'bad-code';
    throw err;
  }
  return finishLogin();
}
/** Configuration de la double authentification (premier passage, ou depuis Paramètres). */
export const startMfaSetup = () => api.mfaSetup();
export async function enableMfa(code, { duringLogin = false } = {}) {
  try {
    const { token } = await api.mfaEnable(code.trim());
    api.setToken(token);
  } catch (err) {
    if (err.code === 'invalid_code') return 'bad-code';
    throw err;
  }
  refreshAudit();
  return duringLogin ? finishLogin() : true;
}
export async function disableMfa(code) {
  try { await api.mfaDisable(code.trim()); } catch (err) { if (err.code === 'invalid_code') return 'bad-code'; throw err; }
  refreshAudit();
  return true;
}
export const mfaStatus = () => api.getMfa();
export const loginHistory = (query) => api.getLogins(query);
export function resetMemberMfa(adminId) {
  const a = state.admins.find((x) => x.id === adminId); if (a) a.mfaEnabled = false;
  commit();
  return remote(() => api.resetAdminMfa(adminId));
}

export function logOut() {
  if (BACKEND) {
    if (api.getToken()) api.logout().catch(() => {});
    api.setToken(null);
    state = emptyState(); loading = null; loadedDetails.clear();
    commit();
    return;
  }
  log('auth.logout', state.session?.userId, 'Déconnexion'); state.session = null; commit();
}
// Session expirée ou révoquée côté serveur : retour à la connexion.
api.setUnauthorizedHandler(() => { state = emptyState(); loading = null; loadedDetails.clear(); commit(); location.hash = '#/login'; });

// ─── Signalements ──────────────────────────────────────────
export function resolveReports(reportIds, status, decision) {
  state.reports.forEach((r) => { if (reportIds.includes(r.id)) Object.assign(r, { status, decision, resolvedBy: state.session.userId, resolvedAt: Date.now() }); });
  log('report.resolve', reportIds.join(', '), `${status === 'dismissed' ? 'Classé sans suite' : 'Traité'} : ${decision}`);
  return remote(() => Promise.all(reportIds.map((id) => api.setReportStatus(id, status === 'dismissed' ? 'dismissed' : 'resolved'))));
}

// ─── Badings ───────────────────────────────────────────────
export function setBadingStatus(id, status, reason = '') {
  const b = bading(id); if (!b) return;
  b.status = status; b.hiddenReason = status === 'hidden' ? reason : undefined; b.moderatedAt = Date.now();
  log(`bading.${status === 'visible' ? 'restore' : status === 'hidden' ? 'hide' : 'delete'}`, id, reason || (status === 'visible' ? 'Rétabli' : ''));
  if (!BACKEND) return;
  // Masquer ou supprimer clôt aussi, côté serveur, les signalements en attente sur ce bading.
  if (status !== 'visible') {
    state.reports.forEach((r) => { if (r.targetType === 'bading' && r.targetId === id && r.status === 'open') Object.assign(r, { status: 'actioned', resolvedAt: Date.now() }); });
    b.reportsCount = 0;
  }
  return remote(() => (status === 'deleted' ? api.deleteBading(id, reason) : api.setBadingStatus(id, status, reason)));
}
/** Épingle un bading en tête du fil (« bading du jour »). `until` : fin en ms, sinon jusqu'au retrait. */
export function pinBading(id, { until, label } = {}) {
  const b = bading(id); if (!b) return;
  b.pinned = { at: Date.now(), until: until ?? null, label: label || null };
  log('bading.pin', id, `Épinglé${label ? ` (« ${label} »)` : ''}`);
  return remote(() => api.pinBading(id, { until, label }));
}
export function unpinBading(id) {
  const b = bading(id); if (!b) return;
  b.pinned = null;
  log('bading.unpin', id, 'Épinglage retiré');
  return remote(() => api.unpinBading(id));
}
/** Coffre d'anonymat : révèle l'auteur d'un bading anonyme. Motif obligatoire, toujours journalisé. */
export function revealAuthor(id, reason) {
  const b = bading(id); if (!b) return null;
  if (BACKEND) {
    // Le serveur vérifie les droits (ALL), journalise et renvoie l'auteur.
    return api.revealAuthor(id, reason).then(({ user: who }) => {
      if (!state.users[who.id]) state.users[who.id] = server.fromBriefUser(who);
      b.authorId = who.id;
      refreshAudit(); commit();
      return state.users[who.id];
    }, (e) => { toast(errorMessage(e, 'Révélation impossible.'), 'bad'); return null; });
  }
  log('vault.reveal', id, `Auteur révélé (@${state.users[b.authorId]?.pseudo}) — motif : ${reason}`);
  return state.users[b.authorId];
}

// ─── Commentaires ──────────────────────────────────────────
export function setCommentStatus(id, status, reason = '') {
  const c = comment(id); if (!c) return;
  c.status = status;
  log(status === 'deleted' ? 'comment.delete' : 'comment.restore', id, reason);
  // Serveur : « supprimer » masque le commentaire (réversible), « rétablir » le rend visible.
  if (BACKEND) return remote(() => api.setCommentStatus(id, status === 'deleted' ? 'hidden' : 'visible', reason || undefined));
}

// ─── Stickers personnels ───────────────────────────────────
/** Retire un sticker partout : il s'affiche « Sticker retiré par la modération » dans les commentaires et quitte les collections. */
export function setStickerStatus(id, status, reason = '') {
  const st = state.customStickers?.[id]; if (!st) return;
  st.status = status;
  log(status === 'removed' ? 'sticker.remove' : 'sticker.restore', id, `${st.label ? `« ${st.label} »` : id} de @${state.users[st.ownerId]?.pseudo ?? '?'}${reason ? ` : ${reason}` : ''}`);
  if (BACKEND) return remote(() => api.setStickerStatus(id, status === 'removed' ? 'removed' : 'active', status === 'removed' ? reason : undefined));
}

// ─── Utilisateurs ──────────────────────────────────────────
export function sanction(userId, level, reason) {
  const u = user(userId); if (!u) return;
  u.sanctions.push({ level, reason, at: Date.now(), by: state.session.userId });
  if (level === 2) { u.status = 'suspended'; u.suspendedUntil = Date.now() + 7 * D; }
  if (level === 3) { u.status = 'banned'; u.suspendedUntil = undefined; }
  log('user.sanction', userId, `${SANCTIONS[level]} : ${reason}`);
  // Serveur : avertissement (niveau 1), blocage de 7 jours (niveau 2) ou sans fin (niveau 3).
  if (BACKEND && level === 1) return remote(() => api.warnUser(userId, reason));
  if (BACKEND) return remote(() => api.blockUser(userId, reason, level === 2 ? u.suspendedUntil : undefined));
}
export function liftSanction(userId) {
  const u = user(userId); if (!u) return;
  u.status = 'active'; u.suspendedUntil = undefined;
  log('user.unsanction', userId, 'Sanction levée, compte réactivé');
  return remote(() => api.unblockUser(userId));
}
/** Le badge vérifié ne s'attribue, ne se retire et ne se valide que par un administrateur (pas les modérateurs). */
export const canManageBadges = () => (BACKEND ? ['WRITE', 'READWRITE', 'ALL'].includes(me()?.permission) : me()?.role === 'admin');
/**
 * Conditions pour qu'un Badeur puisse demander le badge : actif (un bading signé ces N derniers jours)
 * et au moins 1 000 rires reçus sur ses badings signés. Les badings anonymes ne comptent jamais.
 */
export function badgeEligibility(userId) {
  const R = state.rules, signed = state.badings.filter((b) => b.authorId === userId && !b.anonymous && b.status !== 'deleted');
  const last = signed.reduce((m, b) => Math.max(m, b.createdAt), 0);
  const lastDays = last ? Math.floor((Date.now() - last) / 86_400_000) : null;
  const laughs = signed.reduce((n, b) => n + (b.likes || 0), 0);
  const active = lastDays !== null && lastDays <= R.badgeActiveDays, enoughLaughs = laughs >= R.badgeMinLaughs;
  return { active, lastDays, laughs, enoughLaughs, eligible: active && enoughLaughs };
}
export function setVerified(userId, v) { if (!canManageBadges()) return false; const u = user(userId); if (!u) return false; u.verified = v;
  // Attribuer directement clôt une éventuelle demande en attente.
  if (v) state.badgeRequests.filter((g) => g.userId === userId && g.status === 'pending').forEach((g) => Object.assign(g, { status: 'accepted', decidedAt: Date.now() })); log(v ? 'badge.grant' : 'badge.revoke', userId, v ? 'Badge vérifié attribué' : 'Badge vérifié retiré'); return remote(() => api.setVerified(userId, v)); }
export function setRole(userId, role) {
  const u = user(userId); if (!u) return; const old = u.role; u.role = role; log('user.role', userId, `${ROLES[old]} → ${ROLES[role]}`);
  if (!BACKEND) return;
  // Serveur : administrateur = permission ALL, modérateur = READWRITE, utilisateur = retiré de l'équipe.
  const permission = server.permissionOf(role);
  const call = !permission ? api.removeAdmin(u.adminId)
    : u.adminId ? api.setAdminPermission(u.adminId, permission)
    : api.addAdmin(u.id, permission).then(({ admin }) => { u.adminId = admin?.id; });
  u.permission = permission ?? undefined;
  if (!permission) u.adminId = undefined;
  return remote(() => call);
}
export function setPseudo(userId, pseudo) {
  const u = user(userId); if (!u) return; const old = u.pseudo; u.pseudo = pseudo; u.verified = false; log('user.pseudo', userId, `@${old} → @${pseudo} (badge retiré)`);
  if (BACKEND) return remote(() => api.renameUser(userId, pseudo));
}
/**
 * Lien de réinitialisation du mot de passe. Avec l'API, il est créé par le serveur et renvoyé ici
 * (aucun e-mail n'est envoyé pour l'instant) : résout { url, expiresAt } ou null.
 */
export function sendPasswordReset(userId) {
  const u = user(userId); log('user.password_reset', userId, `Lien de réinitialisation envoyé à ${u?.email}`);
  if (!BACKEND) return Promise.resolve(null);
  return api.createPasswordResetLink(userId).then((link) => { refreshAudit(); return link; }, (e) => { toast(errorMessage(e, 'Lien impossible à créer.'), 'bad'); return null; });
}
/** Message direct de l'équipe : notification « message de l'équipe » dans l'app. */
export function messageUser(userId, title, text) {
  const u = user(userId); log('user.message', userId, `Message à @${u?.pseudo} : « ${title || 'Message de l’équipe On Bade'} »`);
  return remote(() => api.messageUser(userId, title, text));
}
/** Copie des données d'un compte (fichier JSON). Résout l'objet, ou null. */
export function exportUserData(userId) {
  if (!BACKEND) return Promise.resolve({ generatedAt: Date.now(), user: user(userId), badings: badingsOf(userId) });
  return api.exportUser(userId).then((data) => { refreshAudit(); return data; }, (e) => { toast(errorMessage(e, 'Copie impossible.'), 'bad'); return null; });
}
function markDeleted(userId) {
  const u = user(userId); if (!u) return null;
  u.status = 'deleted'; u.deletedAt = Date.now();
  state.badings.forEach((b) => { if (b.authorId === userId) b.status = 'deleted'; });
  state.comments.forEach((c) => { if (c.authorId === userId) c.status = 'deleted'; });
  return u;
}
export function deleteUser(userId, reason) {
  const u = markDeleted(userId); if (!u) return;
  log('user.delete', userId, `Compte @${u.pseudo} supprimé : ${reason}`);
  if (BACKEND) return remote(() => api.deleteUser(userId, reason));
}

// ─── Badges ────────────────────────────────────────────────
export function decideBadge(id, accepted, reason = '') {
  if (!canManageBadges()) return false;
  const g = state.badgeRequests.find((x) => x.id === id); if (!g) return false;
  Object.assign(g, { status: accepted ? 'accepted' : 'refused', reason: accepted ? undefined : reason, decidedAt: Date.now(), document: `${g.document} (supprimé après traitement)` });
  if (accepted && user(g.userId)) user(g.userId).verified = true;
  log('badge.decision', g.userId, accepted ? 'Demande acceptée' : `Demande refusée : ${reason}`);
  return remote(() => api.decideVerification(id, accepted ? 'accepted' : 'refused', accepted ? undefined : reason));
}

// ─── Données personnelles ──────────────────────────────────
export function processDataRequest(id) {
  const d = state.dataRequests.find((x) => x.id === id); if (!d) return;
  d.status = 'done'; d.doneAt = Date.now();
  if (BACKEND) { markDeleted(d.userId); commit(); return remote(() => api.decideDataRequest(d.userId, 'process')); }
  if (d.type === 'deletion') deleteUser(d.userId, 'Demande de suppression de l\'utilisateur');
  log('data.process', d.userId, d.type === 'deletion' ? 'Suppression du compte effectuée' : 'Copie des données envoyée par e-mail');
}
export function rejectDataRequest(id, reason) {
  const d = state.dataRequests.find((x) => x.id === id); if (!d) return;
  d.status = 'cancelled'; d.reason = reason;
  log('data.cancel', d.userId, `Demande annulée : ${reason}`);
  if (BACKEND) return remote(() => api.decideDataRequest(d.userId, 'reject', reason));
}

// ─── Annonces ──────────────────────────────────────────────
/** Nombre de personnes touchées par une annonce (aperçu avant envoi). */
export function announcementReach(audience) {
  if (BACKEND) return api.getAnnouncementReach(audience).then((r) => r.reach).catch(() => null);
  return Promise.resolve(audience === 'all' ? users().filter((u) => u.status === 'active').length : audience === 'verified' ? users().filter((u) => u.verified).length : users().filter((u) => Date.now() - u.lastActiveAt > 7 * D).length);
}
export function sendAnnouncement({ title, body, audience }) {
  if (BACKEND) {
    // Renvoie le nombre d'appareils qui reçoivent la notification push (null si le serveur ne le dit pas).
    return api.sendAnnouncement({ title, body, audience }).then(({ announcement: a, pushDevices }) => {
      state.announcements.unshift(server.fromAnnouncement({ ...a, by: { id: state.session.userId } }));
      refreshAudit(); commit();
      return { pushDevices: typeof pushDevices === 'number' ? pushDevices : null };
    }, (e) => { toast(errorMessage(e, 'Annonce non envoyée.'), 'bad'); return false; });
  }
  const reach = audience === 'all' ? users().filter((u) => u.status === 'active').length : audience === 'verified' ? users().filter((u) => u.verified).length : users().filter((u) => Date.now() - u.lastActiveAt > 7 * D).length;
  state.announcements.unshift({ id: `a${Date.now()}`, title, body, audience, sentAt: Date.now(), by: state.session.userId, reach });
  log('announcement.send', null, `« ${title} » → ${reach} personnes`);
}

// ─── Modération et règles ──────────────────────────────────
/** Réglages : envoyés au serveur (qui valide les bornes et journalise) ; en cas de refus, toast et rechargement. */
const saveSettings = (patch) => remote(() => api.saveSettings(patch));
export function addBannedWord(w) {
  const word = w.trim().toLowerCase(); if (!word || state.bannedWords.includes(word)) return false;
  state.bannedWords.push(word); log('words.add', null, `Mot interdit ajouté : « ${word} »`);
  if (BACKEND) saveSettings({ bannedWords: state.bannedWords });
  return true;
}
export function removeBannedWord(w) {
  state.bannedWords = state.bannedWords.filter((x) => x !== w); log('words.remove', null, `Mot interdit retiré : « ${w} »`);
  if (BACKEND) return saveSettings({ bannedWords: state.bannedWords });
}
export function setRules(next) {
  const changes = Object.entries(next).filter(([k, v]) => state.rules[k] !== v).map(([k, v]) => `${k} ${state.rules[k]} → ${v}`);
  if (!changes.length) return 0;
  state.rules = { ...state.rules, ...next };
  log('rules.update', null, changes.join(' · '));
  if (BACKEND) saveSettings({ rules: next });
  return changes.length;
}
export function setPlatform(key, value) {
  state.platform[key] = value;
  const labels = { signupsOpen: 'Inscriptions', anonymousEnabled: 'Publication anonyme', commentsEnabled: 'Commentaires', maintenance: 'Mode maintenance', adminMfaRequired: 'Double authentification obligatoire' };
  log('platform.update', null, typeof value === 'boolean' ? `${labels[key]} : ${value ? 'activé' : 'désactivé'}` : `${key} modifié`);
  if (BACKEND) return saveSettings({ platform: { [key]: value } });
}

// ─── Formats ───────────────────────────────────────────────
export function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.max(0, Date.now() - ts);
  if (s < MIN) return "à l'instant"; if (s < H) return `il y a ${Math.floor(s / MIN)} min`;
  if (s < D) return `il y a ${Math.floor(s / H)} h`; if (s < 30 * D) return `il y a ${Math.floor(s / D)} j`;
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
export const fmtDate = (ts) => new Date(ts).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const compact = (n) => (n < 1000 ? String(n) : n < 10_000 ? `${(n / 1000).toFixed(1).replace('.0', '').replace('.', ',')} k` : `${Math.round(n / 1000)} k`);
export const fmt = (n) => n.toLocaleString('fr-FR');
