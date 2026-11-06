import * as S from '../store.js';
import { $, avatar, enter, esc, icon, pageHead, pill, statusPill, table, userCell, verified } from '../ui.js';
import { badingMenu, userAction, userMenu } from '../actions.js';

const D = 86_400_000, PAGE = 15;

export function usersView(root, { query, go }) {
  const f = { q: query.q || '', status: query.status || 'all', role: query.role || 'all', sort: query.sort || 'recent', page: +(query.page || 1) };
  const set = (p) => go(`/users?${new URLSearchParams({ ...f, page: 1, ...p })}`);
  const all = S.users();
  const posts = (u) => S.badingsOf(u.id).filter((b) => b.status !== 'deleted').length;
  let list = all.filter((u) =>
    (f.status === 'all' || (f.status === 'verified' ? u.verified : u.status === f.status)) &&
    (f.role === 'all' || u.role === f.role) &&
    (!f.q || u.pseudo.toLowerCase().includes(f.q.toLowerCase()) || u.email.includes(f.q.toLowerCase())));
  list.sort(f.sort === 'active' ? (a, b) => b.lastActiveAt - a.lastActiveAt : f.sort === 'posts' ? (a, b) => posts(b) - posts(a) : f.sort === 'sanctions' ? (a, b) => b.sanctions.length - a.sanctions.length : (a, b) => b.joinedAt - a.joinedAt);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const n = (fn) => all.filter(fn).length;

  root.innerHTML = `
    ${pageHead('Utilisateurs', `${all.length} comptes · ${n((u) => u.status === 'suspended')} suspendus · ${n((u) => u.status === 'banned')} bannis · ${n((u) => u.role !== 'user')} dans l’équipe`)}
    <div class="toolbar card" data-enter>
      <div class="search-inline">${icon('search')}<input data-q type="search" placeholder="Pseudo ou e-mail…" value="${esc(f.q)}"/></div>
      <select data-f="status" aria-label="Statut">${[['all', 'Tous les statuts'], ['active', 'Actifs'], ['suspended', 'Suspendus'], ['banned', 'Bannis'], ['deleted', 'Supprimés'], ['verified', 'Vérifiés']].map(([v, l]) => `<option value="${v}" ${f.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select data-f="role" aria-label="Rôle"><option value="all">Tous les rôles</option>${Object.entries(S.ROLES).map(([v, l]) => `<option value="${v}" ${f.role === v ? 'selected' : ''}>${l}s</option>`).join('')}</select>
      <select data-f="sort" aria-label="Tri">${[['recent', 'Inscription récente'], ['active', 'Dernière activité'], ['posts', 'Plus de badings'], ['sanctions', 'Plus de sanctions']].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <div data-enter>${table(['Utilisateur', 'Rôle', 'Badings', 'Sanctions', 'Statut', 'Inscrit', 'Actif', ''], list.slice((f.page - 1) * PAGE, f.page * PAGE).map((u) => `
      <tr data-id="${u.id}" class="clickable"><td>${userCell(u, esc(u.email))}</td><td>${u.role === 'user' ? '<span class="muted">Utilisateur</span>' : pill(S.ROLES[u.role], u.role === 'admin' ? 'brand' : 'info')}</td>
      <td class="num">${posts(u)}</td><td class="num">${u.sanctions.length || '—'}</td><td>${statusPill(u.status)}</td>
      <td class="nowrap">${new Date(u.joinedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</td><td class="nowrap">${S.timeAgo(u.lastActiveAt)}</td>
      <td><button class="icon-btn" data-menu aria-label="Actions">${icon('ellipsis')}</button></td></tr>`), 'Aucun compte ne correspond.')}</div>
    ${pages > 1 ? `<nav class="pager" data-enter><button class="btn btn-ghost btn-sm" data-page="${f.page - 1}" ${f.page <= 1 ? 'disabled' : ''}>Précédent</button><span>Page ${f.page} sur ${pages} · ${list.length} comptes</span><button class="btn btn-ghost btn-sm" data-page="${f.page + 1}" ${f.page >= pages ? 'disabled' : ''}>Suivant</button></nav>` : ''}`;
  enter(root);
  let t; $('[data-q]', root).oninput = (e) => { clearTimeout(t); t = setTimeout(() => set({ q: e.target.value }), 350); };
  root.querySelectorAll('[data-f]').forEach((s) => (s.onchange = () => set({ [s.dataset.f]: s.value })));
  root.querySelectorAll('[data-page]').forEach((b) => (b.onclick = () => go(`/users?${new URLSearchParams({ ...f, page: b.dataset.page })}`)));
  root.querySelectorAll('tr[data-id]').forEach((tr) => (tr.onclick = (e) => {
    const u = S.user(tr.dataset.id);
    if (e.target.closest('[data-menu]')) return userMenu(e.target.closest('[data-menu]'), u);
    go(`/users/${u.id}`);
  }));
  if (f.q) { const i = $('[data-q]', root); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}

export function userDetailView(root, { params }) {
  const u = S.user(params.id);
  if (!u) { root.innerHTML = `${pageHead('Compte introuvable')}<a class="btn btn-secondary" href="#/users">Retour</a>`; return; }
  const isMe = u.id === S.me().id;
  const badings = S.badingsOf(u.id).sort((a, b) => b.createdAt - a.createdAt);
  const laughs = badings.reduce((n, b) => n + b.likes, 0);
  const reportsAgainst = S.get().reports.filter((r) => (r.targetType === 'user' && r.targetId === u.id) || (r.targetType === 'bading' && S.bading(r.targetId)?.authorId === u.id) || (r.targetType === 'comment' && S.comment(r.targetId)?.authorId === u.id));
  const log = S.get().audit.filter((l) => l.target === u.id || l.actor === u.id).slice(0, 12);
  const badge = S.get().badgeRequests.filter((g) => g.userId === u.id);

  root.innerHTML = `
    <a class="back" href="#/users">${icon('arrowLeft')} Utilisateurs</a>
    <section class="card profile-head" data-enter>
      ${avatar(u, 72)}
      <div class="profile-id"><h1>@${esc(u.pseudo)} ${u.verified ? verified() : ''}</h1>
        <p class="muted">${esc(u.email)} · inscrit le ${new Date(u.joinedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} · actif ${S.timeAgo(u.lastActiveAt)}</p>
        <p>${statusPill(u.status)} ${pill(S.ROLES[u.role], u.role === 'admin' ? 'brand' : u.role === 'moderator' ? 'info' : 'neutral')}${u.suspendedUntil ? ` <span class="muted small">jusqu’au ${S.fmtDate(u.suspendedUntil)}</span>` : ''}${isMe ? ' <span class="muted small">(c’est toi)</span>' : ''}</p></div>
      <div class="profile-actions">
        ${!isMe && u.status === 'active' ? `<button class="btn btn-danger btn-sm" data-k="sanction">${icon('ban')} Sanctionner</button>` : ''}
        ${!isMe && ['suspended', 'banned'].includes(u.status) ? `<button class="btn btn-secondary btn-sm" data-k="lift">${icon('restore')} Lever la sanction</button>` : ''}
        ${S.canManageBadges() ? `<button class="btn btn-secondary btn-sm" data-k="badge">${icon('badgeCheck')} ${u.verified ? 'Retirer le badge' : 'Attribuer le badge'}</button>` : ''}
        ${!isMe ? `<button class="btn btn-secondary btn-sm" data-k="role">${icon('shield')} Rôle</button>` : ''}
        <button class="btn btn-secondary btn-sm" data-k="pseudo">${icon('userPen')} Pseudo</button>
        <button class="btn btn-secondary btn-sm" data-k="reset">${icon('key')} Mot de passe</button>
        ${!isMe && u.status !== 'deleted' ? `<button class="btn btn-ghost btn-sm danger-text" data-k="delete">${icon('trash')} Supprimer</button>` : ''}
      </div>
    </section>
    <section class="kpis small" data-enter>
      <div class="kpi card"><span class="kpi-top">${icon('quote')}<span>Badings</span></span><b>${badings.length}</b><span class="kpi-sub">dont ${badings.filter((b) => b.anonymous).length} anonymes</span></div>
      <div class="kpi card"><span class="kpi-top">${icon('laugh')}<span>Rires reçus</span></span><b>${S.fmt(laughs)}</b></div>
      <div class="kpi card"><span class="kpi-top">${icon('flag')}<span>Signalements reçus</span></span><b>${reportsAgainst.length}</b></div>
      <div class="kpi card"><span class="kpi-top">${icon('ban')}<span>Sanctions</span></span><b>${u.sanctions.length}</b></div>
    </section>
    <div class="grid-detail">
      <section class="card" data-enter><div class="card-head"><h2>Badings (${badings.length})</h2><span class="muted small">${icon('lock')} les anonymes ne sont visibles qu’ici</span></div>
        ${badings.length ? table(['Bading', 'Réactions', 'Statut', ''], badings.slice(0, 20).map((b) => `<tr data-b="${b.id}" class="clickable"><td class="text-cell"><span class="clamp">${b.anonymous ? `<span class="pill neutral">Anonyme</span> ` : ''}${esc(b.text)}</span></td><td class="num">😂 ${S.compact(b.likes)}</td><td>${statusPill(b.status)}</td><td><button class="icon-btn" data-menu aria-label="Actions">${icon('ellipsis')}</button></td></tr>`)) : '<p class="muted">Aucun bading.</p>'}
      </section>
      <aside>
        <section class="card" data-enter><div class="card-head"><h2>Sanctions</h2></div>
          ${u.sanctions.length ? `<ul class="mini-list">${[...u.sanctions].reverse().map((s) => `<li>${pill(`Niveau ${s.level}`, s.level === 3 ? 'bad' : 'warn')} <b>${S.SANCTIONS[s.level]}</b><small>${esc(s.reason)} · par @${esc(S.user(s.by)?.pseudo)} · ${S.timeAgo(s.at)}</small></li>`).join('')}</ul>` : '<p class="muted">Aucune sanction.</p>'}
        </section>
        ${badge.length ? `<section class="card" data-enter><div class="card-head"><h2>Demandes de badge</h2></div><ul class="mini-list">${badge.map((g) => `<li>${statusPill(g.status)} <small>${S.timeAgo(g.createdAt)}${g.reason ? ' · ' + esc(g.reason) : ''}</small></li>`).join('')}</ul></section>` : ''}
        <section class="card" data-enter><div class="card-head"><h2>Activité liée</h2><a class="link" href="#/audit?target=${u.id}">Tout voir</a></div>
          ${log.length ? `<ul class="mini-list">${log.map((l) => `<li><b>${esc(l.detail)}</b><small>@${esc(S.user(l.actor)?.pseudo)} · ${S.fmtDate(l.at)}</small></li>`).join('')}</ul>` : '<p class="muted">Rien pour l’instant.</p>'}
        </section>
      </aside>
    </div>`;
  enter(root);
  root.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => userAction(b.dataset.k, u)));
  root.querySelectorAll('tr[data-b]').forEach((tr) => (tr.onclick = (e) => {
    const b = S.bading(tr.dataset.b);
    if (e.target.closest('[data-menu]')) return badingMenu(e.target.closest('[data-menu]'), b);
    location.hash = `#/badings/${b.id}`;
  }));
}
