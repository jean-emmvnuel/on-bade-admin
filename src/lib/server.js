// Données réelles : charge l'API d'administration et la range dans la même forme que la démo,
// pour que les écrans du back-office restent inchangés. Les fonctions de conversion sont pures (testées).
import * as api from './api.js';

const D = 86_400_000;
const FEED_DAYS = 30;
const MAX_BADING_PAGES = 5; // 200 par page
const MAX_USER_PAGES = 10;

/** Couleur d'avatar stable tirée de l'identifiant. */
export function hueFrom(id = '') {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/** ALL = administrateur ; READ / WRITE / READWRITE = modérateur (droits plus fins côté serveur). */
export const roleOf = (permission) => (!permission ? 'user' : permission === 'ALL' ? 'admin' : 'moderator');
export const permissionOf = (role) => (role === 'admin' ? 'ALL' : role === 'moderator' ? 'READWRITE' : null);

/** Blocage du serveur → sanction affichée (bloqué avec fin = suspension, sans fin = bannissement). */
export const sanctionFromBlock = (b) => ({ level: b.expiresAt ? 2 : 3, reason: b.reason, at: b.createdAt, by: b.adminId, until: b.expiresAt, revokedAt: b.revokedAt });

/** Utilisateur de /admin/users → utilisateur du back-office. */
export function fromAdminUser(u) {
  const block = u.block;
  return {
    id: u.id,
    pseudo: u.username ?? u.pseudo ?? 'inconnu',
    email: u.email ?? '',
    firstName: u.firstName, lastName: u.lastName,
    photo: u.photo ?? undefined,
    role: roleOf(u.admin?.permission),
    adminId: u.admin?.id,
    permission: u.admin?.permission,
    verified: !!u.verified,
    hue: hueFrom(u.id),
    joinedAt: u.createdAt ?? u.joinedAt ?? Date.now(),
    lastActiveAt: u.lastActiveAt ?? null,
    status: block ? (block.expiresAt ? 'suspended' : 'banned') : 'active',
    suspendedUntil: block?.expiresAt,
    sanctions: block ? [sanctionFromBlock(block)] : [],
    points: u.points ?? 0,
    counts: u.counts,
    deletion: u.deletion,
  };
}

/** Utilisateur réduit (auteur d'un signalement, d'un contenu…) quand sa fiche n'est pas chargée. */
export const fromBriefUser = (u) => ({ id: u.id, pseudo: u.username ?? u.pseudo ?? 'inconnu', email: u.email ?? '', role: 'user', verified: !!u.verified, hue: hueFrom(u.id), joinedAt: u.joinedAt ?? null, lastActiveAt: null, status: 'active', sanctions: [], photo: u.photo ?? undefined });

/** Image du serveur { src, ratio } → { src, width, height }. */
export function fromImage(img) {
  if (!img?.src) return undefined;
  const ratio = Number(img.ratio) > 0 ? Number(img.ratio) : 1;
  return { src: img.src, width: Math.round(1000 * ratio), height: 1000 };
}

/** Bading du fil public → bading du back-office (l'auteur d'un anonyme reste inconnu ici). */
export const fromBading = (b) => ({
  id: b.id, authorId: b.authorId ?? null, anonymous: !!b.anonymous, text: b.text ?? '', image: fromImage(b.image), createdAt: b.createdAt,
  likes: b.likes ?? 0, rebades: b.rebades ?? 0, shares: b.shares ?? 0, views: b.views ?? 0, commentCount: b.commentCount ?? 0,
  reportsCount: 0, status: b.deleted ? 'deleted' : 'visible',
});

/** Bading de /admin/badings → bading du back-office (masqués et supprimés compris ; auteur anonyme inconnu). */
export const fromAdminBading = (b) => ({
  id: b.id, authorId: b.authorId ?? null, anonymous: !!b.anonymous, text: b.text ?? '', image: fromImage(b.image), createdAt: b.createdAt,
  likes: b.likes ?? 0, rebades: b.rebades ?? 0, shares: b.shares ?? 0, views: b.views ?? 0, commentCount: b.comments ?? 0,
  reportsCount: b.openReports ?? 0, status: b.status ?? 'visible',
  hiddenReason: b.hidden?.reason ?? undefined, autoHidden: !!b.hidden?.auto, pinned: b.pinned ?? null,
});

/** Commentaire de /admin/comments. Un commentaire masqué par l'équipe s'affiche « supprimé » (et peut être rétabli). */
export const fromAdminComment = (c) => ({
  id: c.id, badingId: c.badingId, authorId: c.authorId ?? c.author?.id, text: c.text ?? '', sticker: c.sticker ?? undefined,
  createdAt: c.createdAt, likes: c.likes ?? 0, status: c.status === 'hidden' ? 'deleted' : 'visible', hiddenReason: c.hidden?.reason ?? undefined,
});

/** Sticker personnel de /admin/stickers. */
export const fromAdminSticker = (x) => ({
  id: x.id, ownerId: x.ownerId, src: x.src, createdAt: x.createdAt, status: x.status === 'removed' ? 'removed' : 'visible',
  uses: x.uses ?? 0, saves: x.saves ?? 0, removedReason: x.removed?.reason ?? undefined,
});

/** Entrée du journal d'audit du serveur → entrée du back-office (acteur = identifiant de l'utilisateur, « system » si automatique). */
export const fromAction = (a) => ({ id: a.id, at: a.createdAt, actor: a.actor?.id ?? 'system', action: a.action, target: a.targetId ?? null, targetType: a.targetType ?? null, detail: a.detail ?? '' });

export const fromAnnouncement = (a) => ({ id: a.id, title: a.title, body: a.body, audience: a.audience, sentAt: a.sentAt, by: a.by?.id ?? null, reach: a.reach ?? 0 });

/** Demande de suppression de /admin/data-requests. */
export const fromDataRequest = (r) => ({ id: `del-${r.userId}`, userId: r.userId, type: 'deletion', reason: r.reason ?? undefined, createdAt: r.requestedAt, status: 'pending' });

/** Avertissement du serveur → sanction de niveau 1. */
export const sanctionFromWarning = (w) => ({ level: 1, reason: w.reason, at: w.createdAt, by: w.adminId });

export const fromComment = (c) => ({ id: c.id, badingId: c.badingId ?? c.postId, authorId: c.authorId ?? c.author?.id, text: c.text ?? c.content ?? '', sticker: c.sticker ?? undefined, createdAt: c.createdAt ?? Date.now(), likes: c.likes ?? 0, status: c.deleted ? 'deleted' : 'visible' });

const REPORT_STATUS = { open: 'open', resolved: 'actioned', dismissed: 'dismissed' };
/** Signalement du serveur → signalement du back-office (le contenu visé est renvoyé à part). */
export function fromReport(r) {
  return {
    id: r.id,
    targetType: r.comment ? 'comment' : 'bading',
    targetId: r.comment?.id ?? r.bading?.id,
    reporterId: r.reporter?.id,
    reason: r.reason,
    createdAt: r.createdAt,
    status: REPORT_STATUS[r.status] ?? r.status,
    resolvedAt: r.handledAt,
    resolvedBy: r.handledById,
  };
}

export function fromVerification(v) {
  return {
    id: v.id, userId: v.user?.id, links: v.links ?? [], hasDocument: !!v.hasDocument,
    document: v.hasDocument ? 'Pièce d’identité fournie' : v.status === 'pending' ? 'Aucune pièce' : 'Pièce supprimée après traitement',
    createdAt: v.createdAt, status: v.status, reason: v.reason ?? undefined, decidedAt: v.decidedAt,
  };
}

/** Courbes des 30 derniers jours, à partir des badings et des inscriptions chargés. */
export function buildDaily(badings, users, now = Date.now()) {
  const days = [];
  for (let i = FEED_DAYS - 1; i >= 0; i--) {
    const start = new Date(now - i * D); start.setHours(0, 0, 0, 0);
    days.push({ date: start.toISOString().slice(0, 10), start: start.getTime(), end: start.getTime() + D, signups: 0, badings: 0, laughs: 0 });
  }
  const at = (ts) => days.find((d) => ts >= d.start && ts < d.end);
  badings.forEach((b) => { const d = at(b.createdAt); if (d) { d.badings += 1; d.laughs += b.likes || 0; } });
  users.forEach((u) => { const d = at(u.joinedAt); if (d) d.signups += 1; });
  return days.map(({ start, end, ...d }) => d);
}

// ─── Chargement ───────────────────────────────────────────

async function allPages(fetchPage, max) {
  const out = [];
  for (let page = 1; page <= max; page++) {
    const { users, total } = await fetchPage(page);
    out.push(...users);
    if (!users.length || out.length >= total) break;
  }
  return out;
}

/** Tous les badings vus par l'équipe (au plus 1 000, les plus récents). */
async function adminBadings() {
  const out = [];
  for (let page = 1; page <= MAX_BADING_PAGES; page++) {
    const { badings = [], total = 0 } = await api.getAdminBadings({ page, limit: 200 });
    out.push(...badings);
    if (badings.length < 200 || out.length >= total) break;
  }
  return out;
}

/** Une liste facultative : si la route manque ou refuse (droits), l'écran reste vide au lieu de bloquer le chargement. */
const optional = (promise, fallback) => promise.catch(() => fallback);

/** Journal d'audit (500 dernières actions). */
export async function loadAudit() {
  const { actions = [] } = await api.getAudit({ limit: 500 });
  return actions.map(fromAction);
}

/**
 * Charge tout ce qu'affichent les écrans : chiffres clés, utilisateurs, signalements, demandes de badge,
 * équipe et badings récents. Renvoie un état partiel à fusionner dans le store.
 */
export async function loadAll() {
  const [stats, users, rawBadings, reportsOpen, reportsResolved, reportsDismissed, vPending, vAccepted, vRefused, admins,
    rawComments, rawStickers, settings, announcements, audit, dataRequests] = await Promise.all([
    api.getStats(),
    allPages((page) => api.getUsers({ page, limit: 100 }), MAX_USER_PAGES),
    adminBadings(),
    api.getReports('open'), api.getReports('resolved'), api.getReports('dismissed'),
    api.getVerifications('pending'), api.getVerifications('accepted'), api.getVerifications('refused'),
    api.getAdmins().catch(() => ({ admins: [] })),
    optional(api.getAdminComments({ limit: 200 }), { comments: [] }),
    optional(api.getStickers({ limit: 200 }), { stickers: [] }),
    optional(api.getSettings(), null),
    optional(api.getAnnouncements(), { announcements: [] }),
    optional(loadAudit(), []),
    optional(api.getDataRequests(), null),
  ]);

  const usersById = Object.fromEntries(users.map((u) => [u.id, fromAdminUser(u)]));
  const badings = new Map(rawBadings.map((b) => [b.id, fromAdminBading(b)]));
  const comments = new Map(rawComments.comments.map((c) => [c.id, fromAdminComment(c)]));
  const addBriefEarly = (u) => { if (u?.id && !usersById[u.id]) usersById[u.id] = fromBriefUser(u); };
  rawComments.comments.forEach((c) => addBriefEarly(c.author));
  rawStickers.stickers.forEach((x) => addBriefEarly(x.owner));
  const rawReports = [...reportsOpen.reports, ...reportsResolved.reports, ...reportsDismissed.reports];
  const addBrief = (u) => { if (u?.id && !usersById[u.id]) usersById[u.id] = fromBriefUser(u); };

  rawReports.forEach((r) => {
    addBrief(r.reporter);
    if (r.bading) {
      addBrief(r.bading.author);
      const known = badings.get(r.bading.id);
      // L'équipe voit le véritable auteur, même d'un bading anonyme.
      badings.set(r.bading.id, {
        ...(known ?? fromBading({ id: r.bading.id, text: r.bading.content, anonymous: r.bading.anonymous, createdAt: r.createdAt })),
        authorId: r.bading.author?.id ?? known?.authorId ?? null,
        status: r.bading.deletedAt ? 'deleted' : known?.status ?? 'visible',
      });
    }
    if (r.comment) {
      addBrief(r.comment.author);
      if (!comments.has(r.comment.id)) comments.set(r.comment.id, fromComment({ ...r.comment, badingId: r.comment.postId, authorId: r.comment.author?.id }));
    }
  });
  const reports = rawReports.map(fromReport);
  // reportsCount vient déjà du serveur (signalements en attente) pour les badings de /admin/badings.

  const verifications = [...vPending.requests, ...vAccepted.requests, ...vRefused.requests];
  verifications.forEach((v) => addBrief(v.user));

  const userList = Object.values(usersById);
  const badingList = [...badings.values()];
  return {
    loaded: true,
    stats,
    users: usersById,
    badings: badingList,
    comments: [...comments.values()],
    reports,
    badgeRequests: verifications.map(fromVerification),
    dataRequests: dataRequests
      ? dataRequests.requests.map(fromDataRequest)
      : userList.filter((u) => u.deletion).map((u) => ({ id: `del-${u.id}`, userId: u.id, type: 'deletion', reason: u.deletion.reason ?? undefined, createdAt: u.deletion.requestedAt, status: 'pending' })),
    admins: admins.admins ?? [],
    daily: stats.daily?.length ? stats.daily : buildDaily(badingList, userList),
    customStickers: Object.fromEntries(rawStickers.stickers.map((x) => [x.id, fromAdminSticker(x)])),
    ...(settings ? { rules: settings.rules, platform: settings.platform, bannedWords: settings.bannedWords } : {}),
    announcements: announcements.announcements.map(fromAnnouncement),
    audit,
  };
}

/** Détail d'un bading (vue de l'équipe) : tous ses commentaires, masqués compris, et leurs auteurs. */
export async function loadBading(id) {
  const { bading, comments = [] } = await api.getAdminBading(id);
  const authors = new Map();
  comments.forEach((c) => { if (c.author?.id) authors.set(c.author.id, fromBriefUser(c.author)); });
  if (bading.author?.id) authors.set(bading.author.id, fromBriefUser(bading.author));
  return { bading: fromAdminBading(bading), comments: comments.map(fromAdminComment), users: [...authors.values()] };
}

/** Fiche d'un utilisateur avec tout l'historique de ses blocages. */
export async function loadUser(id) {
  const { user, blocks = [], warnings = [] } = await api.getUser(id);
  const u = fromAdminUser(user);
  u.sanctions = [...blocks.map(sanctionFromBlock), ...warnings.map(sanctionFromWarning)].sort((a, b) => a.at - b.at);
  return u;
}
