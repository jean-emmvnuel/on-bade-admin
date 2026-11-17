// Alertes de l'équipe (cloche du back-office) : nouvel inscrit, signalement, demande de badge, panne du serveur…
// - La liste est relue toutes les 30 s (et au retour sur l'onglet).
// - Notification du navigateur pour chaque nouvelle alerte tant que le back-office est ouvert (même en arrière-plan).
// - Push (public/admin-sw.js) : les alertes arrivent même back-office fermé, si le membre l'a activé sur cet appareil.
//   Quand le push est actif ici, c'est lui qui affiche les notifications (pas de doublon).
// - Les pannes partent aussi par e-mail à toute l'équipe (côté serveur).
import * as api from './api.js';
import { BACKEND } from './api.js';
import { go } from './nav.js';

const POLL_MS = 30_000;
const PUSH_KEY = 'onbade-admin-push';
const SW_URL = './admin-sw.js';

const store = (fn) => { try { return fn(localStorage); } catch { return null; } };

let state = { alerts: [], unread: 0, seenAt: null, loaded: false, error: null };
const listeners = new Set();
export const getAlertsState = () => state;
export function subscribeAlerts(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn(state)); };

// ─── Démo (sans serveur) ──────────────────────────────────
const MIN = 60_000;
function demoAlerts() {
  const now = Date.now();
  return [
    { id: 'd1', kind: 'signup', severity: 'info', title: 'Nouvel inscrit', body: '@KoffiLeVrai vient de créer son compte.', url: '/users', createdAt: now - 3 * MIN },
    { id: 'd2', kind: 'server', severity: 'critical', title: 'Erreurs sur le serveur', body: '6 erreurs serveur (5xx) en 5 minutes sur 412 requêtes. Dernière : POST /api/register/code — délai dépassé.', url: '/server', createdAt: now - 18 * MIN },
    { id: 'd3', kind: 'report', severity: 'info', title: 'Bading signalé', body: 'Motif : Harcèlement', url: '/reports', createdAt: now - 45 * MIN },
    { id: 'd4', kind: 'autohide', severity: 'warning', title: 'Bading masqué automatiquement', body: '5 signalements : le bading est masqué en attendant une décision de l’équipe.', url: '/badings', createdAt: now - 2 * 60 * MIN },
    { id: 'd5', kind: 'badge', severity: 'info', title: 'Demande de badge vérifié', body: '@AwaLaGo225 demande le badge vérifié.', url: '/badges', createdAt: now - 5 * 60 * MIN },
  ];
}

// ─── Lecture ──────────────────────────────────────────────
let known = null; // ids déjà vus dans cette session (pas de notification au premier chargement)

export async function refreshAlerts() {
  try {
    const r = BACKEND ? await api.getAlerts(50) : { alerts: state.loaded ? state.alerts : demoAlerts(), unread: state.loaded ? state.unread : 2, seenAt: state.seenAt };
    const fresh = known ? r.alerts.filter((a) => !known.has(a.id)) : [];
    known = new Set(r.alerts.map((a) => a.id));
    set({ alerts: r.alerts, unread: r.unread, seenAt: r.seenAt ?? null, loaded: true, error: null });
    if (fresh.length) notifyBrowser(fresh);
  } catch (error) {
    set({ error, loaded: true });
  }
}

/** Tout est lu : la pastille disparaît (les alertes restent dans la liste). */
export async function markAlertsRead() {
  set({ unread: 0, seenAt: Date.now() });
  if (BACKEND) await api.markAlertsRead().catch(() => {});
}

let timer = null;
const onVisible = () => { if (!document.hidden) refreshAlerts(); };
const onWorkerMessage = (e) => {
  if (e.data?.type === 'alert') refreshAlerts();
  if (e.data?.type === 'navigate' && e.data.path) go(e.data.path);
};

/** Démarre le suivi (une fois connecté). Renvoie la fonction d'arrêt. */
export function startAlerts() {
  stopAlerts();
  known = null;
  refreshAlerts();
  timer = setInterval(() => { if (!document.hidden) refreshAlerts(); }, POLL_MS);
  document.addEventListener('visibilitychange', onVisible);
  navigator.serviceWorker?.addEventListener('message', onWorkerMessage);
  return stopAlerts;
}
export function stopAlerts() {
  clearInterval(timer);
  timer = null;
  document.removeEventListener('visibilitychange', onVisible);
  navigator.serviceWorker?.removeEventListener('message', onWorkerMessage);
}

// ─── Notifications du navigateur (back-office ouvert) ─────
export const browserNotifSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const browserPermission = () => (browserNotifSupported() ? Notification.permission : 'unsupported');
export async function enableBrowserNotifs() {
  if (!browserNotifSupported()) return 'unsupported';
  return Notification.requestPermission();
}

const ICON = 'assets/icon-192.png';
const prefix = (a) => (a.severity === 'critical' ? '🚨 ' : a.severity === 'warning' ? '⚠️ ' : '');

function notifyBrowser(list) {
  if (browserPermission() !== 'granted' || pushOnThisDevice()) return;
  const show = (title, body, tag, path) => {
    try {
      const n = new Notification(title, { body, tag, icon: ICON });
      n.onclick = () => { window.focus(); if (path) go(path); n.close(); };
    } catch { /* navigateur qui n'accepte les notifications que via un service worker (Android) */ }
  };
  if (list.length > 3) show(`${list.length} nouvelles alertes`, list.slice(0, 3).map((a) => a.title).join(' · '), 'alerts', '/');
  else list.forEach((a) => show(`${prefix(a)}${a.title}`, a.body, a.id, a.url));
}

// ─── Push (même back-office fermé) ────────────────────────
export const pushSupported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && browserNotifSupported();
export const pushOnThisDevice = () => !!store((s) => s.getItem(PUSH_KEY));

function keyBytes(base64url) {
  const b64 = `${base64url}${'='.repeat((4 - (base64url.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Active le push sur cet appareil. Renvoie 'on', 'denied', 'unsupported' ou 'no_key' (serveur sans clés VAPID). */
export async function enablePush() {
  if (!pushSupported()) return 'unsupported';
  if (!BACKEND) { store((s) => s.setItem(PUSH_KEY, 'demo')); return 'on'; }
  if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  const { publicKey } = await api.getPushKey();
  if (!publicKey) return 'no_key';
  const reg = await navigator.serviceWorker.register(SW_URL);
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  const { endpoint, keys } = sub.toJSON();
  await api.saveAdminPush({ endpoint, keys });
  store((s) => s.setItem(PUSH_KEY, endpoint));
  return 'on';
}

/** Coupe le push sur cet appareil. */
export async function disablePush() {
  const endpoint = store((s) => s.getItem(PUSH_KEY));
  store((s) => s.removeItem(PUSH_KEY));
  if (!BACKEND || !pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  const url = sub?.endpoint ?? endpoint;
  if (url) await api.deleteAdminPush(url).catch(() => {});
  await sub?.unsubscribe().catch(() => {});
}

/** Déconnexion : cet appareil ne doit plus recevoir les alertes de l'équipe. */
export function forgetPushOnLogout() {
  stopAlerts();
  set({ alerts: [], unread: 0, seenAt: null, loaded: false, error: null });
  // La requête part tout de suite, avant que la déconnexion n'efface le jeton.
  const endpoint = store((s) => s.getItem(PUSH_KEY));
  store((s) => s.removeItem(PUSH_KEY));
  if (BACKEND && endpoint && api.getToken()) api.deleteAdminPush(endpoint).catch(() => {});
  if (pushSupported()) navigator.serviceWorker.getRegistration(SW_URL).then((r) => r?.pushManager.getSubscription()).then((sub) => sub?.unsubscribe()).catch(() => {});
}
