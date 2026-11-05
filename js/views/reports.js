import * as S from '../store.js';
import { $, confirmAction, enter, esc, icon, pageHead, pill, statusPill, toast, userCell } from '../ui.js';
import { badingAction, commentAction, sanctionDialog, targetPreview } from '../actions.js';

/** File des signalements : regroupés par contenu signalé, du plus signalé au moins signalé. */
export function reportsView(root, { query, go }) {
  const tab = query.tab || 'open';
  const st = S.get();
  const list = st.reports.filter((r) => (tab === 'all' ? true : tab === 'open' ? r.status === 'open' : r.status !== 'open'));
  const groups = Object.values(list.reduce((acc, r) => { const k = `${r.targetType}:${r.targetId}`; (acc[k] ||= { type: r.targetType, id: r.targetId, reports: [] }).reports.push(r); return acc; }, {}))
    .sort((a, b) => b.reports.length - a.reports.length || Math.max(...b.reports.map((r) => r.createdAt)) - Math.max(...a.reports.map((r) => r.createdAt)));

  const authorOf = (g) => (g.type === 'bading' ? S.bading(g.id)?.authorId : g.type === 'comment' ? S.comment(g.id)?.authorId : g.id);
  const contentStatus = (g) => (g.type === 'bading' ? S.bading(g.id)?.status : g.type === 'comment' ? S.comment(g.id)?.status : S.user(g.id)?.status);

  root.innerHTML = `
    ${pageHead('Signalements', `Masquage automatique dès ${st.rules.autoHideThreshold} signalements sur un même contenu. Chaque décision est journalisée.`)}
    <div class="tabs" role="tablist" data-enter>
      ${[['open', 'À traiter', S.openReports().length], ['done', 'Traités'], ['all', 'Tous']].map(([k, l, n]) => `<a role="tab" href="#/reports?tab=${k}" aria-selected="${tab === k}">${l}${n ? ` <b class="count">${n}</b>` : ''}</a>`).join('')}
    </div>
    ${groups.length ? groups.map((g) => {
      const open = g.reports.filter((r) => r.status === 'open');
      const author = S.user(authorOf(g));
      return `<article class="card report" data-enter data-key="${g.type}:${g.id}">
        <header class="report-head">
          <span class="report-count ${g.reports.length >= st.rules.autoHideThreshold ? 'hot' : ''}">${icon('flag')} ${g.reports.length}</span>
          <span>${{ bading: 'Bading', comment: 'Commentaire', user: 'Compte' }[g.type]} ${contentStatus(g) ? statusPill(contentStatus(g)) : ''}</span>
          <span class="spacer"></span>
          ${author && g.type !== 'user' ? `<span class="muted small">Auteur : <a href="#/users/${author.id}">@${esc(author.pseudo)}</a>${S.bading(g.id)?.anonymous ? ' (anonyme, visible admin)' : ''} · ${author.sanctions.length} sanction(s)</span>` : ''}
        </header>
        ${targetPreview(g.type, g.id)}
        <ul class="report-list">${g.reports.map((r) => `<li>${userCell(S.user(r.reporterId), S.timeAgo(r.createdAt))}<span>${pill(S.REASONS[r.reason] ?? r.reason, 'warn')}${r.details ? ` <span class="muted">« ${esc(r.details)} »</span>` : ''}</span>${r.status !== 'open' ? `<span class="decision">${statusPill(r.status)} ${esc(r.decision ?? '')}</span>` : ''}</li>`).join('')}</ul>
        ${open.length ? `<footer class="report-actions">
          <button class="btn btn-ghost btn-sm" data-act="dismiss">${icon('check')} Classer sans suite</button>
          ${g.type === 'bading' ? (contentStatus(g) === 'hidden' ? `<button class="btn btn-secondary btn-sm" data-act="keep">${icon('eyeOff')} Garder masqué</button>` : `<button class="btn btn-secondary btn-sm" data-act="hide">${icon('eyeOff')} Masquer</button>`) : ''}
          ${g.type !== 'user' && contentStatus(g) !== 'deleted' ? `<button class="btn btn-secondary btn-sm" data-act="delete">${icon('trash')} Supprimer le contenu</button>` : ''}
          <button class="btn btn-danger btn-sm" data-act="sanction">${icon('ban')} Sanctionner ${g.type === 'user' ? 'le compte' : 'l’auteur'}</button>
        </footer>` : ''}
      </article>`;
    }).join('') : `<div class="empty card" data-enter>${icon('circleCheck')}<h2>${tab === 'open' ? 'Rien à traiter 🎉' : 'Aucun signalement ici'}</h2><p class="muted">${tab === 'open' ? 'La communauté rigole tranquille.' : ''}</p></div>`}`;
  enter(root);

  root.querySelectorAll('.report').forEach((card) => {
    const [type, id] = card.dataset.key.split(':');
    const ids = st.reports.filter((r) => r.targetType === type && r.targetId === id && r.status === 'open').map((r) => r.id);
    card.querySelectorAll('[data-act]').forEach((btn) => (btn.onclick = async () => {
      const act = btn.dataset.act;
      if (act === 'dismiss') {
        const why = await confirmAction({ title: 'Classer sans suite', text: 'Le contenu reste en ligne. Les personnes qui ont signalé sont prévenues que le contenu respecte la charte.', confirm: 'Classer', reason: true, reasonLabel: 'Décision', presets: ['Humour sans cible, conforme à la charte', 'Signalement abusif', 'Doublon'] });
        if (!why) return;
        if (type === 'bading' && S.bading(id)?.status === 'hidden') S.setBadingStatus(id, 'visible', 'Rétabli après examen');
        S.resolveReports(ids, 'dismissed', why); toast('Signalement classé'); return go(`/reports?tab=${tab}`);
      }
      if (act === 'sanction') {
        const uid = type === 'user' ? id : type === 'bading' ? S.bading(id).authorId : S.comment(id).authorId;
        const lvl = await sanctionDialog(uid);
        if (lvl) { S.resolveReports(ids, 'actioned', `Auteur sanctionné : ${S.SANCTIONS[lvl]}`); if (lvl >= 1 && type === 'bading') S.setBadingStatus(id, 'deleted', 'Supprimé avec la sanction'); if (type === 'comment') S.setCommentStatus(id, 'deleted', 'Supprimé avec la sanction'); }
        return go(`/reports?tab=${tab}`);
      }
      if (act === 'keep') {
        const why = await confirmAction({ title: 'Garder ce bading masqué', text: 'Il reste invisible dans l’app et peut être rétabli plus tard depuis Badings.', confirm: 'Confirmer', reason: true, reasonLabel: 'Décision', presets: ['Contraire à la charte', 'Personne réelle exposée'] });
        if (!why) return;
        S.setBadingStatus(id, 'hidden', why); S.resolveReports(ids, 'actioned', `Masquage confirmé : ${why}`); toast('Masquage confirmé'); return go(`/reports?tab=${tab}`);
      }
      const done = type === 'bading' ? await badingAction(act, S.bading(id)) : await commentAction('delete', S.comment(id));
      if (done) { S.resolveReports(ids, 'actioned', act === 'hide' ? 'Contenu masqué' : 'Contenu supprimé'); go(`/reports?tab=${tab}`); }
    }));
  });
}
