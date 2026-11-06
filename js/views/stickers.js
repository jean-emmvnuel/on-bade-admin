import * as S from '../store.js';
import { confirmAction, enter, esc, icon, pageHead, pill, statusPill, toast, userCell } from '../ui.js';
import { STICKERS, stickerHtml } from '../stickers.js';
import { sanctionDialog } from '../actions.js';

/** Stickers (F8) : ceux créés par les Badeurs (modérables) et la bibliothèque On Bade. */
export function stickersView(root, { query, go }) {
  const tab = query.tab || 'custom';
  const st = S.get();
  const list = Object.values(st.customStickers || {})
    .map((x) => ({ ...x, reports: S.reportsOn('sticker', x.id), uses: S.stickerUses(x.id) }))
    .sort((a, b) => b.reports.filter((r) => r.status === 'open').length - a.reports.filter((r) => r.status === 'open').length || b.createdAt - a.createdAt);
  const openReports = list.reduce((n, x) => n + x.reports.filter((r) => r.status === 'open').length, 0);

  root.innerHTML = `
    ${pageHead('Stickers', `Comme sur TikTok, chaque Badeur crée ses stickers et enregistre ceux des autres (${st.rules.myStickersMax} max par collection). Un sticker retiré disparaît des collections et s’affiche « retiré » dans les commentaires.`)}
    <div class="tabs" role="tablist" data-enter>
      <a role="tab" href="#/stickers?tab=custom" aria-selected="${tab === 'custom'}">Créés par les Badeurs (${list.length})${openReports ? ` <b class="count">${openReports}</b>` : ''}</a>
      <a role="tab" href="#/stickers?tab=builtin" aria-selected="${tab === 'builtin'}">Bibliothèque On Bade (${STICKERS.length})</a>
    </div>
    ${tab === 'builtin' ? `<div class="sticker-grid builtin" data-enter>${STICKERS.map((x) => `<figure>${stickerHtml(x.id, 104)}<figcaption>${esc(x.label)}<small>${x.theme === 'nouchi' ? 'Nouchi' : 'Réaction'} · ${S.stickerUses(x.id)} utilisations</small></figcaption></figure>`).join('')}</div>`
    : `<div class="sticker-grid" data-enter>${list.map((x) => {
      const open = x.reports.filter((r) => r.status === 'open');
      return `<article class="card sticker-card ${open.length ? 'flagged' : ''}" data-id="${x.id}">
        <div class="sticker-prev">${stickerHtml(x.id, 120)}</div>
        <div class="sticker-meta"><b>${esc(x.label ?? 'Sans nom')}</b>${statusPill(x.status === 'removed' ? 'deleted' : 'visible')}${open.length ? pill(`${open.length} signalement${open.length > 1 ? 's' : ''}`, 'bad') : ''}</div>
        ${userCell(S.user(x.ownerId), `créé ${S.timeAgo(x.createdAt)}`)}
        <p class="small muted">${x.uses} utilisation${x.uses > 1 ? 's' : ''} en commentaire · ${x.saves ?? 0} enregistrement${(x.saves ?? 0) > 1 ? 's' : ''}</p>
        ${open.length ? `<ul class="mini-list">${open.map((r) => `<li>${pill(S.REASONS[r.reason], 'warn')}<small>par @${esc(S.user(r.reporterId)?.pseudo)} · ${S.timeAgo(r.createdAt)}${r.details ? ` · « ${esc(r.details)} »` : ''}</small></li>`).join('')}</ul>` : ''}
        <footer>
          ${x.status === 'removed' ? `<button class="btn btn-secondary btn-sm" data-k="restore">${icon('restore')} Rétablir</button>` : `<button class="btn btn-danger btn-sm" data-k="remove">${icon('trash')} Retirer partout</button>`}
          ${open.length ? `<button class="btn btn-ghost btn-sm" data-k="dismiss">Classer</button>` : ''}
          <button class="btn btn-ghost btn-sm" data-k="sanction">${icon('ban')} Sanctionner</button>
        </footer>
      </article>`;
    }).join('') || '<p class="muted">Aucun sticker personnel pour l’instant.</p>'}</div>`}`;
  enter(root);

  root.querySelectorAll('.sticker-card [data-k]').forEach((b) => (b.onclick = async () => {
    const id = b.closest('[data-id]').dataset.id, x = S.customSticker(id), k = b.dataset.k;
    const openIds = S.reportsOn('sticker', id).filter((r) => r.status === 'open').map((r) => r.id);
    if (k === 'remove') {
      const why = await confirmAction({ title: 'Retirer ce sticker partout', text: 'Il quitte toutes les collections et s’affiche « Sticker retiré par la modération » dans les commentaires.', confirm: 'Retirer', danger: true, reason: true, presets: ['Personne réelle exposée', 'Contenu choquant', 'Haine ou discrimination', 'Droits d’auteur'] });
      if (!why) return;
      S.setStickerStatus(id, 'removed', why); if (openIds.length) S.resolveReports(openIds, 'actioned', `Sticker retiré : ${why}`); toast('Sticker retiré');
    }
    if (k === 'restore') { S.setStickerStatus(id, 'visible', 'Rétabli'); toast('Sticker rétabli'); }
    if (k === 'dismiss') {
      const why = await confirmAction({ title: 'Classer sans suite', confirm: 'Classer', reason: true, reasonLabel: 'Décision', presets: ['Conforme à la charte', 'Signalement abusif'] });
      if (!why) return; S.resolveReports(openIds, 'dismissed', why); toast('Signalements classés');
    }
    if (k === 'sanction') { await sanctionDialog(x.ownerId); }
    go(`/stickers?tab=${tab}`);
  }));
}
