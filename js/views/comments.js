import * as S from '../store.js';
import { $, enter, esc, icon, menu, pageHead, statusPill, table, userCell } from '../ui.js';
import { commentAction } from '../actions.js';
import { stickerHtml } from '../stickers.js';

export function commentsView(root, { query, go }) {
  const f = { q: query.q || '', status: query.status || 'all' };
  const set = (p) => go(`/comments?${new URLSearchParams({ ...f, ...p })}`);
  const list = S.get().comments
    .filter((c) => (f.status === 'all' || (f.status === 'sticker' ? !!c.sticker : c.status === f.status)) && (!f.q || c.text.toLowerCase().includes(f.q.toLowerCase()) || S.user(c.authorId)?.pseudo.toLowerCase().includes(f.q.toLowerCase())))
    .sort((a, b) => S.reportsOn('comment', b.id).length - S.reportsOn('comment', a.id).length || b.createdAt - a.createdAt)
    .slice(0, 60);

  root.innerHTML = `
    ${pageHead('Commentaires', 'Les commentaires signalés apparaissent en premier.')}
    <div class="toolbar card" data-enter>
      <div class="search-inline">${icon('search')}<input data-q type="search" placeholder="Texte ou pseudo…" value="${esc(f.q)}"/></div>
      <select data-f="status" aria-label="Statut">${[['all', 'Tous'], ['visible', 'Visibles'], ['sticker', 'Stickers'], ['deleted', 'Supprimés']].map(([v, l]) => `<option value="${v}" ${f.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <div data-enter>${table(['Commentaire', 'Auteur', 'Sur le bading', 'Signal.', 'Statut', 'Date', ''], list.map((c) => {
      const rep = S.reportsOn('comment', c.id).length, b = S.bading(c.badingId);
      return `<tr data-id="${c.id}"><td class="text-cell">${c.sticker ? `<span class="c-stk small">${stickerHtml(c.sticker, 64)}</span>` : `<span class="clamp">${esc(c.text)}</span>`}</td><td>${userCell(S.user(c.authorId))}</td>
        <td class="text-cell"><a class="clamp muted" href="#/badings/${c.badingId}">${b?.text ? `${esc(b.text.slice(0, 60))}…` : '📷 Bading en image'}</a></td>
        <td class="num">${rep ? `<span class="flag-n">${icon('flag')} ${rep}</span>` : '—'}</td><td>${statusPill(c.status)}</td><td class="nowrap">${S.timeAgo(c.createdAt)}</td>
        <td><button class="icon-btn" data-menu aria-label="Actions">${icon('ellipsis')}</button></td></tr>`;
    }), 'Aucun commentaire.')}</div>`;
  enter(root);
  let t; $('[data-q]', root).oninput = (e) => { clearTimeout(t); t = setTimeout(() => set({ q: e.target.value }), 350); };
  $('[data-f]', root).onchange = (e) => set({ status: e.target.value });
  root.querySelectorAll('[data-menu]').forEach((btn) => (btn.onclick = async () => {
    const c = S.comment(btn.closest('tr').dataset.id);
    const k = await menu(btn, [{ k: 'author', icon: 'user', label: 'Voir l’auteur' }, { k: 'sanction', icon: 'ban', label: 'Sanctionner l’auteur' }, '-', c.status === 'deleted' ? { k: 'restore', icon: 'restore', label: 'Rétablir' } : { k: 'delete', icon: 'trash', label: 'Supprimer', danger: true }]);
    if (k) commentAction(k, c);
  }));
  if (f.q) { const i = $('[data-q]', root); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
