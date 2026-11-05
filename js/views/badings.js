import * as S from '../store.js';
import { $, enter, esc, icon, pageHead, statusPill, table, userCell, avatar } from '../ui.js';
import { badingAction, badingMenu, commentAction, revealDialog } from '../actions.js';

const PAGE = 15;

export function badingsView(root, { query, go }) {
  const f = { q: query.q || '', status: query.status || 'all', kind: query.kind || 'all', sort: query.sort || 'recent', page: +(query.page || 1) };
  const set = (patch) => go(`/badings?${new URLSearchParams({ ...f, page: 1, ...patch })}`);
  const st = S.get();
  let list = st.badings.filter((b) =>
    (f.status === 'all' || b.status === f.status) &&
    (f.kind === 'all' || (f.kind === 'anon' ? b.anonymous : f.kind === 'reported' ? b.reportsCount > 0 || S.reportsOn('bading', b.id).length : !b.anonymous)) &&
    (!f.q || b.text.toLowerCase().includes(f.q.toLowerCase()) || b.id === f.q || S.user(b.authorId)?.pseudo.toLowerCase().includes(f.q.toLowerCase())));
  list.sort(f.sort === 'likes' ? (a, b) => b.likes - a.likes : f.sort === 'reports' ? (a, b) => S.reportsOn('bading', b.id).length - S.reportsOn('bading', a.id).length : (a, b) => b.createdAt - a.createdAt);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const rows = list.slice((f.page - 1) * PAGE, f.page * PAGE);
  const counts = { all: st.badings.length, visible: 0, hidden: 0, deleted: 0 };
  st.badings.forEach((b) => (counts[b.status] += 1));

  root.innerHTML = `
    ${pageHead('Badings', `${counts.visible} en ligne · ${counts.hidden} masqués · ${counts.deleted} supprimés`)}
    <div class="toolbar card" data-enter>
      <div class="search-inline">${icon('search')}<input data-q type="search" placeholder="Texte, pseudo ou identifiant…" value="${esc(f.q)}"/></div>
      <select data-f="status" aria-label="Statut">${[['all', 'Tous les statuts'], ['visible', 'Visibles'], ['hidden', 'Masqués'], ['deleted', 'Supprimés']].map(([v, l]) => `<option value="${v}" ${f.status === v ? 'selected' : ''}>${l} (${counts[v]})</option>`).join('')}</select>
      <select data-f="kind" aria-label="Type">${[['all', 'Signés et anonymes'], ['signed', 'Signés'], ['anon', 'Anonymes'], ['reported', 'Signalés']].map(([v, l]) => `<option value="${v}" ${f.kind === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select data-f="sort" aria-label="Tri">${[['recent', 'Plus récents'], ['likes', 'Plus de rires'], ['reports', 'Plus signalés']].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <div data-enter>${table(['Bading', 'Auteur', 'Réactions', 'Signal.', 'Statut', 'Publié', ''], rows.map((b) => {
      const u = S.user(b.authorId), rep = S.reportsOn('bading', b.id).length;
      return `<tr data-id="${b.id}" class="clickable">
        <td class="text-cell"><span class="clamp">${esc(b.text)}</span></td>
        <td>${b.anonymous ? `<span class="who">${avatar(null, 32)}<span><b>Anonyme</b><small>${icon('lock')} coffre</small></span></span>` : userCell(u)}</td>
        <td class="num">😂 ${S.compact(b.likes)}<small>${b.rebades} rebades · ${b.shares} partages</small></td>
        <td class="num">${rep ? `<span class="flag-n">${icon('flag')} ${rep}</span>` : '—'}</td>
        <td>${statusPill(b.status)}</td>
        <td class="nowrap">${S.timeAgo(b.createdAt)}</td>
        <td><button class="icon-btn" data-menu aria-label="Actions">${icon('ellipsis')}</button></td></tr>`;
    }), 'Aucun bading ne correspond.')}</div>
    ${pages > 1 ? `<nav class="pager" data-enter><button class="btn btn-ghost btn-sm" data-page="${f.page - 1}" ${f.page <= 1 ? 'disabled' : ''}>Précédent</button><span>Page ${f.page} sur ${pages} · ${list.length} badings</span><button class="btn btn-ghost btn-sm" data-page="${f.page + 1}" ${f.page >= pages ? 'disabled' : ''}>Suivant</button></nav>` : ''}`;
  enter(root);

  let t; $('[data-q]', root).oninput = (e) => { clearTimeout(t); t = setTimeout(() => set({ q: e.target.value }), 350); };
  root.querySelectorAll('[data-f]').forEach((s) => (s.onchange = () => set({ [s.dataset.f]: s.value })));
  root.querySelectorAll('[data-page]').forEach((b) => (b.onclick = () => go(`/badings?${new URLSearchParams({ ...f, page: b.dataset.page })}`)));
  root.querySelectorAll('tr[data-id]').forEach((tr) => (tr.onclick = (e) => {
    const b = S.bading(tr.dataset.id);
    if (e.target.closest('[data-menu]')) return badingMenu(e.target.closest('[data-menu]'), b);
    go(`/badings/${b.id}`);
  }));
  if (f.q) { const i = $('[data-q]', root); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}

export function badingDetailView(root, { params, go }) {
  const b = S.bading(params.id);
  if (!b) { root.innerHTML = `${pageHead('Bading introuvable')}<a class="btn btn-secondary" href="#/badings">Retour aux badings</a>`; return; }
  const u = S.user(b.authorId);
  const reports = S.reportsOn('bading', b.id);
  const comments = S.commentsOf(b.id).sort((a, c) => c.createdAt - a.createdAt);
  const history = S.get().audit.filter((l) => l.target === b.id);

  root.innerHTML = `
    <a class="back" href="#/badings">${icon('arrowLeft')} Badings</a>
    ${pageHead(`Bading ${b.id}`, `Publié le ${S.fmtDate(b.createdAt)}`, `${statusPill(b.status)}
      ${b.status === 'visible' ? `<button class="btn btn-secondary btn-sm" data-a="hide">${icon('eyeOff')} Masquer</button>` : `<button class="btn btn-secondary btn-sm" data-a="restore">${icon('restore')} Rétablir</button>`}
      ${b.anonymous ? `<button class="btn btn-secondary btn-sm" data-a="reveal">${icon('key')} Révéler l’auteur</button>` : ''}
      ${b.status !== 'deleted' ? `<button class="btn btn-danger btn-sm" data-a="delete">${icon('trash')} Supprimer</button>` : ''}`)}
    <div class="grid-detail">
      <div>
        <article class="card bading-card" data-enter>
          <div class="who-row">${b.anonymous ? `${avatar(null, 44)}<div><b>Badeur anonyme</b><small>${icon('lock')} Auteur protégé par le coffre d’anonymat</small></div>` : `${avatar(u, 44)}<div><b><a href="#/users/${u.id}">@${esc(u.pseudo)}</a></b><small>${esc(u.email)}</small></div>`}</div>
          <p class="story">${esc(b.text)}</p>
          ${b.hiddenReason ? `<p class="alert warn">${icon('eyeOff')} ${esc(b.hiddenReason)}</p>` : ''}
          <div class="stats-row"><span><b>${S.fmt(b.likes)}</b> rires</span><span><b>${b.rebades}</b> rebades</span><span><b>${b.shares}</b> partages</span><span><b>${comments.length}</b> commentaires</span></div>
        </article>
        <section class="card" data-enter><div class="card-head"><h2>Commentaires (${comments.length})</h2></div>
          ${comments.length ? `<ul class="comment-list">${comments.map((c) => `<li class="${c.status === 'deleted' ? 'is-deleted' : ''}">${avatar(S.user(c.authorId), 32)}<div><b><a href="#/users/${c.authorId}">@${esc(S.user(c.authorId)?.pseudo)}</a></b> <small>${S.timeAgo(c.createdAt)} · 😂 ${c.likes}</small>${c.status === 'deleted' ? ' ' + statusPill('deleted') : ''}<p>${esc(c.text)}</p></div>
            <button class="btn btn-ghost btn-sm" data-c="${c.id}" data-k="${c.status === 'deleted' ? 'restore' : 'delete'}">${c.status === 'deleted' ? 'Rétablir' : 'Supprimer'}</button></li>`).join('')}</ul>` : '<p class="muted">Aucun commentaire.</p>'}
        </section>
      </div>
      <aside>
        <section class="card" data-enter><div class="card-head"><h2>Signalements (${reports.length})</h2>${reports.some((r) => r.status === 'open') ? '<a class="link" href="#/reports">Traiter</a>' : ''}</div>
          ${reports.length ? `<ul class="mini-list">${reports.map((r) => `<li>${statusPill(r.status)} <b>${S.REASONS[r.reason]}</b><small>par @${esc(S.user(r.reporterId)?.pseudo)} · ${S.timeAgo(r.createdAt)}</small>${r.details ? `<p>« ${esc(r.details)} »</p>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Aucun signalement.</p>'}
        </section>
        <section class="card" data-enter><div class="card-head"><h2>Historique de modération</h2></div>
          ${history.length ? `<ul class="mini-list">${history.map((l) => `<li><b>${esc(l.detail)}</b><small>@${esc(S.user(l.actor)?.pseudo)} · ${S.fmtDate(l.at)}</small></li>`).join('')}</ul>` : '<p class="muted">Aucune action pour l’instant.</p>'}
        </section>
      </aside>
    </div>`;
  enter(root);
  root.querySelectorAll('[data-a]').forEach((btn) => (btn.onclick = async () => (btn.dataset.a === 'reveal' ? revealDialog(b) : badingAction(btn.dataset.a, b))));
  root.querySelectorAll('[data-c]').forEach((btn) => (btn.onclick = () => commentAction(btn.dataset.k, S.comment(btn.dataset.c))));
}
