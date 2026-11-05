import * as S from '../store.js';
import { confirmAction, enter, esc, icon, pageHead, pill, statusPill, toast, userCell } from '../ui.js';

const D = 86_400_000;

export function badgesView(root, { query, go }) {
  const tab = query.tab || 'pending';
  const st = S.get(), R = st.rules;
  const list = st.badgeRequests.filter((g) => (tab === 'pending' ? g.status === 'pending' : g.status !== 'pending')).sort((a, b) => b.createdAt - a.createdAt);

  const checks = (u) => {
    const age = Math.floor((Date.now() - u.joinedAt) / D), posts = S.badingsOf(u.id).filter((b) => b.status !== 'deleted' && !b.anonymous).length;
    return [
      [age >= R.badgeMinAgeDays, `Compte de ${age} jours (min. ${R.badgeMinAgeDays})`],
      [posts >= R.badgeMinBadings, `${posts} badings signés (min. ${R.badgeMinBadings})`],
      [!u.sanctions.length, u.sanctions.length ? `${u.sanctions.length} sanction(s) au dossier` : 'Aucun avertissement'],
    ];
  };

  root.innerHTML = `
    ${pageHead('Badges vérifiés', `Réponse sous 7 jours. Les pièces d’identité sont supprimées dès la décision.`)}
    <div class="tabs" role="tablist" data-enter>${[['pending', 'En attente', S.pendingBadges().length], ['done', 'Traitées']].map(([k, l, n]) => `<a role="tab" href="#/badges?tab=${k}" aria-selected="${tab === k}">${l}${n ? ` <b class="count">${n}</b>` : ''}</a>`).join('')}</div>
    ${list.length ? `<div class="cards">${list.map((g) => {
      const u = S.user(g.userId), late = g.status === 'pending' && Date.now() - g.createdAt > 7 * D;
      return `<article class="card badge-req" data-enter data-id="${g.id}">
        <header>${userCell(u, `demande ${S.timeAgo(g.createdAt)}`)}${statusPill(g.status)}${late ? pill('Délai de 7 j dépassé', 'bad') : ''}</header>
        ${g.status === 'pending' ? `<ul class="checks">${checks(u).map(([ok, t]) => `<li class="${ok ? 'ok' : 'ko'}">${icon(ok ? 'circleCheck' : 'circleX')} ${t}</li>`).join('')}</ul>` : ''}
        <p class="muted small">${icon('idCard')} ${esc(g.document)}</p>
        ${g.links.length ? `<ul class="links">${g.links.map((l) => `<li>${icon('link')} <a href="${esc(l)}" target="_blank" rel="noopener noreferrer">${esc(l.replace(/^https?:\/\//, ''))}</a></li>`).join('')}</ul>` : '<p class="muted small">Aucun lien fourni.</p>'}
        ${g.status === 'pending' ? `<footer><button class="btn btn-ghost btn-sm" data-k="refuse">Refuser</button><button class="btn btn-primary btn-sm" data-k="accept">${icon('badgeCheck')} Accepter</button></footer>` : `<p class="small">${g.status === 'refused' ? `Motif : ${esc(g.reason ?? '')}` : 'Badge attribué'} · ${g.decidedAt ? S.timeAgo(g.decidedAt) : ''}</p>`}
      </article>`;
    }).join('')}</div>` : `<div class="empty card" data-enter>${icon('badgeCheck')}<h2>Aucune demande ${tab === 'pending' ? 'en attente' : 'traitée'}</h2></div>`}`;
  enter(root);

  root.querySelectorAll('.badge-req [data-k]').forEach((b) => (b.onclick = async () => {
    const g = st.badgeRequests.find((x) => x.id === b.closest('[data-id]').dataset.id), u = S.user(g.userId);
    if (b.dataset.k === 'accept') {
      if (!(await confirmAction({ title: `Vérifier @${u.pseudo}`, text: 'Le badge apparaît sur son profil et ses badings signés. La pièce fournie est supprimée.', confirm: 'Accepter la demande' }))) return;
      S.decideBadge(g.id, true); toast(`@${u.pseudo} est vérifié ✓`);
    } else {
      const why = await confirmAction({ title: 'Refuser la demande', text: `@${esc(u.pseudo)} pourra refaire une demande dans ${R.badgeRetryDays} jours.`, confirm: 'Refuser', danger: true, reason: true, reasonLabel: 'Motif communiqué', presets: [`Il faut au moins ${R.badgeMinBadings} badings publiés`, 'Pièce illisible ou non conforme', 'Identité non vérifiable', 'Notoriété insuffisante'] });
      if (!why) return;
      S.decideBadge(g.id, false, why); toast('Demande refusée');
    }
    go(`/badges?tab=${tab}`);
  }));
}
