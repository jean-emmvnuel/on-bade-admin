import * as S from '../store.js';
import { confirmAction, enter, esc, icon, pageHead, pill, statusPill, table, toast, userCell } from '../ui.js';

const D = 86_400_000;

/** Droits des utilisateurs (loi ivoirienne n° 2013-450) : suppression du compte et copie des données. */
export function dataView(root, { go }) {
  const st = S.get(), limit = st.rules.deletionDays;
  const list = [...st.dataRequests].sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1) || a.createdAt - b.createdAt);
  root.innerHTML = `
    ${pageHead('Données personnelles', `Demandes de suppression et de copie des données. Délai légal : ${limit} jours.`)}
    <div data-enter>${table(['Utilisateur', 'Demande', 'Reçue', 'Échéance', 'Statut', ''], list.map((d) => {
      const due = d.createdAt + limit * D, left = Math.ceil((due - Date.now()) / D);
      return `<tr data-id="${d.id}"><td>${userCell(S.user(d.userId), esc(S.user(d.userId)?.email ?? ''))}</td>
        <td>${d.type === 'deletion' ? `${icon('trash')} Suppression du compte` : `${icon('download')} Copie des données`}${d.reason ? `<small class="muted block">« ${esc(d.reason)} »</small>` : ''}</td>
        <td class="nowrap">${S.timeAgo(d.createdAt)}</td>
        <td class="nowrap">${d.status === 'pending' ? (left < 0 ? pill(`En retard de ${-left} j`, 'bad') : pill(`${left} j restants`, left <= 5 ? 'warn' : 'neutral')) : '—'}</td>
        <td>${statusPill(d.status)}</td>
        <td class="nowrap">${d.status === 'pending' ? `<button class="btn btn-ghost btn-sm" data-k="cancel">Annuler</button><button class="btn ${d.type === 'deletion' ? 'btn-danger' : 'btn-primary'} btn-sm" data-k="process">${d.type === 'deletion' ? 'Supprimer le compte' : 'Envoyer la copie'}</button>` : ''}</td></tr>`;
    }), 'Aucune demande.')}</div>
    <p class="muted small" data-enter>${icon('lock')} Une copie est envoyée par lien sécurisé à l’adresse e-mail du compte. Une suppression efface le compte, ses badings et ses commentaires ; seuls les journaux légaux sont conservés.</p>`;
  enter(root);
  root.querySelectorAll('[data-k]').forEach((b) => (b.onclick = async () => {
    const d = st.dataRequests.find((x) => x.id === b.closest('tr').dataset.id), u = S.user(d.userId);
    if (b.dataset.k === 'process') {
      if (!(await confirmAction({ title: d.type === 'deletion' ? `Supprimer le compte @${u.pseudo}` : `Envoyer les données de @${u.pseudo}`, text: d.type === 'deletion' ? 'Le compte, ses badings et ses commentaires sont effacés. Action définitive.' : `Un lien sécurisé valable 7 jours sera envoyé à <b>${esc(u.email)}</b>.`, confirm: d.type === 'deletion' ? 'Supprimer définitivement' : 'Envoyer', danger: d.type === 'deletion' }))) return;
      S.processDataRequest(d.id); toast(d.type === 'deletion' ? 'Compte supprimé' : 'Copie envoyée');
    } else {
      const why = await confirmAction({ title: 'Annuler la demande', confirm: 'Annuler la demande', reason: true, presets: ['Annulée par l’utilisateur', 'Identité non confirmée'] });
      if (!why) return;
      S.rejectDataRequest(d.id, why); toast('Demande annulée');
    }
    go('/data');
  }));
}
