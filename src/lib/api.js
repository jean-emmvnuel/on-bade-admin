// Client HTTP de l'API On Bade (routes /api/admin/* du backend onbad-backend).
//
// Mode :
// - en ligne (back-office publié) : l'API de production ;
// - sur localhost : la démo locale (données simulées, utilisée par les tests) — le backend n'accepte
//   de toute façon pas les requêtes venant de localhost (CORS) ;
// - `?demo=1` ou `?demo=0` dans l'adresse force un mode et le garde pour ce navigateur.

const MODE_KEY = 'onbade-admin-mode';
const TOKEN_KEY = 'onbade-admin-token';
const TIMEOUT_MS = 20_000;

function storage(fn) { try { return fn(localStorage); } catch { return null; } }

const forced = new URLSearchParams(location.search).get('demo');
if (forced === '1' || forced === '0') storage((s) => s.setItem(MODE_KEY, forced === '1' ? 'demo' : 'api'));
const saved = storage((s) => s.getItem(MODE_KEY));
const local = ['localhost', '127.0.0.1', ''].includes(location.hostname);

/** true : le back-office lit et modifie les vraies données. false : démo locale. */
export const BACKEND = saved ? saved === 'api' : !local;
export const API_URL = String(globalThis.ONBADE_API_URL || 'https://backend-onbade.oriverse-it.tech/api').replace(/\/$/, '');

// ─── Jeton ────────────────────────────────────────────────
export const getToken = () => storage((s) => s.getItem(TOKEN_KEY));
export const setToken = (t) => storage((s) => (t ? s.setItem(TOKEN_KEY, t) : s.removeItem(TOKEN_KEY)));

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

// ─── Erreurs ──────────────────────────────────────────────
export class ApiError extends Error {
  constructor(status, code, message = '') { super(message || code); this.name = 'ApiError'; this.status = status; this.code = code; }
}

/** Message lisible d'une erreur de l'API. */
export function errorMessage(e, fallback = 'Une erreur est survenue, réessaie.') {
  if (!(e instanceof ApiError)) return fallback;
  if (e.code === 'network') return 'Impossible de joindre le serveur. Vérifie ta connexion.';
  if (e.code === 'timeout') return 'Le serveur met trop de temps à répondre.';
  if (e.status === 403) return e.message && e.message !== e.code ? e.message : 'Permission insuffisante pour cette action.';
  if (e.message && e.message !== e.code && !e.message.startsWith('http_')) return e.message;
  return fallback;
}

// ─── Requête ──────────────────────────────────────────────
const SESSION_LOST = new Set(['unauthorized', 'invalid_token', 'session_expired', 'mfa_required']);
async function readJson(res) { const t = await res.text(); if (!t) return {}; try { return JSON.parse(t); } catch { return { message: t }; } }
const unwrap = (b) => (b && typeof b === 'object' && typeof b.success === 'boolean' && 'data' in b ? b.data ?? {} : b);

export async function request(path, { method = 'GET', body, query } = {}) {
  const url = new URL(`${API_URL}${path}`);
  Object.entries(query ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v); });
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl.signal });
  } catch (e) {
    throw new ApiError(0, e?.name === 'AbortError' ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
  const data = await readJson(res);
  if (!res.ok) {
    // Session perdue (absente, expirée, révoquée ou 2FA exigée) : retour à la connexion.
    // Un code 2FA incorrect (401 invalid_code) ne ferme pas la session.
    if (res.status === 401 && token && SESSION_LOST.has(data.code)) { setToken(null); onUnauthorized?.(); }
    throw new ApiError(res.status, data.code || `http_${res.status}`, data.message);
  }
  return unwrap(data);
}

const get = (p, query) => request(p, { query });
const post = (p, body) => request(p, { method: 'POST', body });
const patch = (p, body) => request(p, { method: 'PATCH', body });
const put = (p, body) => request(p, { method: 'PUT', body });
const del = (p, body) => request(p, { method: 'DELETE', body });
const id = encodeURIComponent;

// ─── Routes ───────────────────────────────────────────────
export const login = (email, password) => post('/login', { email, password });
export const logout = () => post('/logout');
export const requestPasswordReset = (email) => post('/password-reset', { email });

export const getStats = () => get('/admin/stats');
export const getUsers = (query) => get('/admin/users', query); // { q, filter, page, limit } → { users, total, page }
export const getUser = (userId) => get(`/admin/users/${id(userId)}`); // → { user, blocks }
export const blockUser = (userId, reason, expiresAt) => post(`/admin/users/${id(userId)}/block`, { reason, ...(expiresAt ? { expiresAt } : {}) });
export const unblockUser = (userId) => del(`/admin/users/${id(userId)}/block`);
export const setVerified = (userId, verified) => put(`/admin/users/${id(userId)}/verified`, { verified });

export const getReports = (status, page) => get('/admin/reports', { status, page }); // → { reports, total }
export const setReportStatus = (reportId, status) => patch(`/admin/reports/${id(reportId)}`, { status });
export const deleteBading = (badingId, reason) => del(`/admin/badings/${id(badingId)}`, reason ? { reason } : undefined);
export const deleteComment = (commentId, reason) => del(`/admin/comments/${id(commentId)}`, reason ? { reason } : undefined);

export const getVerifications = (status) => get('/admin/verifications', { status }); // → { requests }
export const decideVerification = (requestId, status, reason) => patch(`/admin/verifications/${id(requestId)}`, { status, ...(reason ? { reason } : {}) });
export const verificationDocumentUrl = (requestId) => `${API_URL}/admin/verifications/${id(requestId)}/document`;

export const getAdmins = () => get('/admin/admins'); // → { admins }
export const addAdmin = (userId, permission) => post('/admin/admins', { userId, permission });
export const setAdminPermission = (adminId, permission) => patch(`/admin/admins/${id(adminId)}`, { permission });
export const removeAdmin = (adminId) => del(`/admin/admins/${id(adminId)}`);

// Contenu public (le fil sert de liste des badings) et détail d'un bading avec ses commentaires.
export const getFeed = (before) => get('/feed', { before, limit: 100 });
export const getBading = (badingId) => get(`/badings/${id(badingId)}`);

// ─── Modération des contenus ──────────────────────────────
export const getAdminBadings = (query) => get('/admin/badings', query); // { q, status, type, authorId, sort, page, limit } → { badings, total, counts }
export const getAdminBading = (badingId) => get(`/admin/badings/${id(badingId)}`); // → { bading, comments, reports, history }
export const setBadingStatus = (badingId, status, reason) => patch(`/admin/badings/${id(badingId)}`, { status, ...(reason ? { reason } : {}) });
export const revealAuthor = (badingId, reason) => post(`/admin/badings/${id(badingId)}/reveal`, { reason }); // → { user }
export const pinBading = (badingId, { until, label } = {}) => put(`/admin/badings/${id(badingId)}/pin`, { ...(until ? { until } : {}), ...(label ? { label } : {}) });
export const unpinBading = (badingId) => del(`/admin/badings/${id(badingId)}/pin`);
export const getAdminComments = (query) => get('/admin/comments', query); // → { comments, total }
export const setCommentStatus = (commentId, status, reason) => patch(`/admin/comments/${id(commentId)}`, { status, ...(reason ? { reason } : {}) });
export const getStickers = (query) => get('/admin/stickers', query); // → { stickers, total }
export const setStickerStatus = (stickerId, status, reason) => patch(`/admin/stickers/${id(stickerId)}`, { status, ...(reason ? { reason } : {}) });

// ─── Comptes ──────────────────────────────────────────────
export const warnUser = (userId, reason) => post(`/admin/users/${id(userId)}/warnings`, { reason });
export const messageUser = (userId, title, text) => post(`/admin/users/${id(userId)}/message`, { ...(title ? { title } : {}), text });
export const renameUser = (userId, username) => patch(`/admin/users/${id(userId)}`, { username });
export const deleteUser = (userId, reason) => del(`/admin/users/${id(userId)}`, { reason });
export const createPasswordResetLink = (userId) => post(`/admin/users/${id(userId)}/password-reset`); // → { url, expiresAt }
export const exportUser = (userId) => get(`/admin/users/${id(userId)}/export`);
export const getDataRequests = () => get('/admin/data-requests'); // → { requests }
export const decideDataRequest = (userId, action, reason) => post(`/admin/data-requests/${id(userId)}`, { action, ...(reason ? { reason } : {}) });

// ─── Plateforme ───────────────────────────────────────────
export const getAnnouncements = () => get('/admin/announcements');
export const getAnnouncementReach = (audience) => get('/admin/announcements/reach', { audience }); // → { reach }
export const sendAnnouncement = (body) => post('/admin/announcements', body); // { title, body, audience } → { announcement }
export const getSettings = () => get('/admin/settings'); // → { rules, platform, bannedWords }
export const saveSettings = (patchBody) => patch('/admin/settings', patchBody);
export const getAudit = (query) => get('/admin/audit', query); // → { actions, total }

// ─── Sécurité de l'équipe (double authentification) ───────
export const getMfa = () => get('/admin/mfa'); // → { enabled, enabledAt, pending, required, verified }
export const mfaSetup = () => post('/admin/mfa/setup'); // → { secret, otpauthUrl }
export const mfaEnable = (code) => post('/admin/mfa/enable', { code }); // → { token }
export const mfaVerify = (code) => post('/admin/mfa/verify', { code }); // → { token }
export const mfaDisable = (code) => del('/admin/mfa', { code });
export const resetAdminMfa = (adminId) => del(`/admin/admins/${id(adminId)}/mfa`);
export const getLogins = (query) => get('/admin/logins', query); // → { logins, total }
