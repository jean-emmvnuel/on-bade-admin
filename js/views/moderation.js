import * as S from '../store.js';
import { $, confirmAction, enter, esc, icon, pageHead, toast } from '../ui.js';

const FIELDS = [
  ['Publication', [['minLength', 'Longueur minimale d’un bading', 'caractères'], ['maxLength', 'Longueur maximale d’un bading', 'caractères'], ['dailyLimit', 'Badings par jour et par compte', 'badings'], ['maxMentions', 'Mentions maximum par bading', 'mentions'], ['opinionMax', 'Longueur d’un avis de rebade', 'caractères'], ['commentMax', 'Longueur d’un commentaire', 'caractères']]],
  ['Modération', [['autoHideThreshold', 'Masquage automatique après', 'signalements']]],
  ['Badge vérifié', [['badgeMinAgeDays', 'Ancienneté minimale du compte', 'jours'], ['badgeMinBadings', 'Badings publiés minimum', 'badings'], ['badgeRetryDays', 'Délai avant nouvelle demande', 'jours']]],
  ['Données personnelles', [['deletionDays', 'Délai de traitement des demandes', 'jours']]],
];

export function moderationView(root, { go }) {
  const st = S.get();
  root.innerHTML = `
    ${pageHead('Mots interdits & règles', 'Le filtre bloque un bading avant sa publication. Les règles s’appliquent à l’app et au site.')}
    <div class="grid-2">
      <section class="card" data-enter>
        <div class="card-head"><h2>Mots interdits (${st.bannedWords.length})</h2></div>
        <form class="add-word" data-add><input data-word placeholder="Ajouter un mot ou une expression" maxlength="40" aria-label="Mot interdit"/><button class="btn btn-primary btn-sm">${icon('plus')} Ajouter</button></form>
        <ul class="words">${st.bannedWords.map((w) => `<li><span>${esc(w)}</span><button class="icon-btn" data-rm="${esc(w)}" aria-label="Retirer ${esc(w)}">${icon('x')}</button></li>`).join('')}</ul>
        <div class="tester"><label for="test">Tester un texte</label><textarea id="test" rows="2" placeholder="Colle un bading pour voir s’il passerait…"></textarea><p data-res class="small muted">—</p></div>
      </section>
      <form class="card" data-rules data-enter>
        <div class="card-head"><h2>Règles de la plateforme</h2></div>
        ${FIELDS.map(([g, fs]) => `<fieldset><legend>${g}</legend>${fs.map(([k, l, unit]) => `<label class="rule"><span>${l}</span><span class="num-input"><input type="number" min="1" max="100000" name="${k}" value="${st.rules[k]}"/><small>${unit}</small></span></label>`).join('')}</fieldset>`).join('')}
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-reset>Annuler</button><button class="btn btn-primary" data-save>Enregistrer les règles</button></div>
      </form>
    </div>`;
  enter(root);

  $('[data-add]', root).onsubmit = (e) => { e.preventDefault(); const w = $('[data-word]', root).value; if (S.addBannedWord(w)) { toast('Mot ajouté'); go('/moderation'); } else toast('Déjà dans la liste ou vide'); };
  root.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = async () => { if (await confirmAction({ title: 'Retirer ce mot', text: `« ${esc(b.dataset.rm)} » ne sera plus bloqué.`, confirm: 'Retirer', danger: true })) { S.removeBannedWord(b.dataset.rm); go('/moderation'); } }));
  $('#test', root).oninput = (e) => {
    const t = e.target.value.toLowerCase(), hit = st.bannedWords.filter((w) => t.includes(w)), res = $('[data-res]', root);
    res.className = `small ${!t ? 'muted' : hit.length ? 'error' : 'ok-text'}`;
    res.textContent = !t ? '—' : hit.length ? `Bloqué : contient ${hit.map((w) => `« ${w} »`).join(', ')}` : t.trim().length < st.rules.minLength ? `Trop court (min. ${st.rules.minLength} caractères)` : 'Passerait le filtre ✓';
  };
  $('[data-reset]', root).onclick = () => go('/moderation');
  $('[data-rules]', root).onsubmit = async (e) => {
    e.preventDefault();
    const next = Object.fromEntries([...new FormData(e.target)].map(([k, v]) => [k, Math.max(1, Math.round(+v))]));
    if (next.minLength >= next.maxLength) return toast('La longueur minimale doit être inférieure à la maximale', 'bad');
    if (!(await confirmAction({ title: 'Appliquer les nouvelles règles', text: 'Elles s’appliquent tout de suite à tous les utilisateurs.', confirm: 'Appliquer' }))) return;
    const n = S.setRules(next);
    toast(n ? `${n} règle(s) modifiée(s)` : 'Aucun changement'); go('/moderation');
  };
}
