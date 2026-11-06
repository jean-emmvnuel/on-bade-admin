import * as S from '../store.js';
import { $, confirmAction, enter, esc, icon, logo, pageHead, toast, userCell } from '../ui.js';

const AUDIENCES = { all: 'Tous les utilisateurs actifs', verified: 'Comptes vérifiés', inactive: 'Inactifs depuis 7 jours' };

export function announcementsView(root, { go }) {
  const st = S.get();
  root.innerHTML = `
    ${pageHead('Annonces', 'Envoie une notification à toute la communauté ou à un groupe.')}
    <div class="grid-2">
      <form class="card" data-form data-enter>
        <div class="card-head"><h2>Nouvelle annonce</h2></div>
        <div class="field"><label for="t">Titre</label><input id="t" maxlength="60" placeholder="Ex. Le défi de la semaine est lancé 😂"/></div>
        <div class="field"><label for="b">Message</label><textarea id="b" rows="4" maxlength="180" placeholder="Raconte ta pire galère en gbaka…"></textarea><small class="hint"><span data-n>0</span> / 180</small></div>
        <div class="field"><label for="a">Destinataires</label><select id="a">${Object.entries(AUDIENCES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
        <div class="modal-actions"><button class="btn btn-primary" data-send disabled>${icon('megaphone')} Envoyer</button></div>
      </form>
      <div class="card" data-enter>
        <div class="card-head"><h2>Aperçu sur le téléphone</h2></div>
        <div class="phone-notif"><span class="app">${logo(20)} ON BADE · maintenant</span><b data-pt>Titre de l’annonce</b><p data-pb>Le message apparaît ici.</p></div>
      </div>
    </div>
    <section class="card" data-enter><div class="card-head"><h2>Envoyées</h2></div>
      <ul class="feed-list">${st.announcements.map((a) => `<li>${userCell(S.user(a.by), `${S.fmtDate(a.sentAt)} · ${AUDIENCES[a.audience]} · ${S.fmt(a.reach)} personnes`)}<p><b>${esc(a.title)}</b> — ${esc(a.body)}</p></li>`).join('')}</ul>
    </section>`;
  enter(root);
  const t = $('#t', root), b = $('#b', root), send = $('[data-send]', root);
  const sync = () => { $('[data-pt]', root).textContent = t.value || 'Titre de l’annonce'; $('[data-pb]', root).textContent = b.value || 'Le message apparaît ici.'; $('[data-n]', root).textContent = b.value.length; send.disabled = !(t.value.trim() && b.value.trim()); };
  t.oninput = sync; b.oninput = sync;
  $('[data-form]', root).onsubmit = async (e) => {
    e.preventDefault();
    const audience = $('#a', root).value;
    if (!(await confirmAction({ title: 'Envoyer l’annonce', text: `Notification envoyée à : <b>${AUDIENCES[audience]}</b>. Impossible de l’annuler une fois partie.`, confirm: 'Envoyer maintenant' }))) return;
    S.sendAnnouncement({ title: t.value.trim(), body: b.value.trim(), audience });
    toast('Annonce envoyée 📣'); go('/announcements');
  };
}
