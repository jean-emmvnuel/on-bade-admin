import * as S from '../store.js';
import { $, confirmAction, enter, esc, icon, pageHead, pill, table, toast, userCell } from '../ui.js';
import { userMenu } from '../actions.js';

const SWITCHES = [
  ['signupsOpen', 'Inscriptions ouvertes', 'Les nouveaux comptes peuvent s’inscrire.'],
  ['anonymousEnabled', 'Publication anonyme', 'Le mode « Badeur anonyme » est disponible.'],
  ['commentsEnabled', 'Commentaires', 'Les commentaires et réponses sont ouverts.'],
  ['maintenance', 'Mode maintenance', 'L’app et le site affichent un message et sont fermés au public.'],
];

export function settingsView(root, { go }) {
  const st = S.get(), team = S.users().filter((u) => u.role !== 'user');
  root.innerHTML = `
    ${pageHead('Paramètres', 'Interrupteurs de la plateforme, équipe et sécurité.')}
    <section class="card" data-enter><div class="card-head"><h2>Plateforme</h2></div>
      <div class="switches">${SWITCHES.map(([k, l, d]) => `<div class="switch-row ${k === 'maintenance' ? 'danger-zone' : ''}"><span><b>${l}</b><small>${d}</small></span><button class="toggle" role="switch" aria-checked="${st.platform[k]}" data-sw="${k}" aria-label="${l}"><i></i></button></div>`).join('')}</div>
      <div class="field"><label for="mm">Message affiché pendant la maintenance</label><div class="row-input"><input id="mm" value="${esc(st.platform.maintenanceMessage)}" maxlength="120"/><button class="btn btn-secondary btn-sm" data-mm>Enregistrer</button></div></div>
    </section>
    <section class="card" data-enter><div class="card-head"><h2>Équipe (${team.length})</h2><a class="link" href="#/users">Ajouter depuis Utilisateurs</a></div>
      ${table(['Membre', 'Rôle', 'Dernière activité', ''], team.map((u) => `<tr data-id="${u.id}"><td>${userCell(u, esc(u.email))}</td><td>${pill(S.ROLES[u.role], u.role === 'admin' ? 'brand' : 'info')}</td><td>${S.timeAgo(u.lastActiveAt)}</td><td><button class="icon-btn" data-menu aria-label="Actions">${icon('ellipsis')}</button></td></tr>`))}
      <p class="muted small">Pour nommer un modérateur ou un administrateur : ouvre son profil dans Utilisateurs, puis « Rôle ».</p>
    </section>
    <section class="card" data-enter><div class="card-head"><h2>Droits par rôle</h2></div>
      ${table(['Action', 'Modérateur', 'Administrateur'], [
        ['Traiter les signalements, masquer et supprimer des contenus', true, true], ['Sanctions niveaux 1 et 2', true, true], ['Bannissement définitif', false, true],
        ['Révéler l’auteur d’un bading anonyme', false, true], ['Badges vérifiés', false, true], ['Modifier pseudo, rôle, mot de passe, supprimer un compte', false, true],
        ['Données personnelles', false, true], ['Annonces', false, true], ['Mots interdits, règles, paramètres', false, true], ['Journal d’audit', true, true],
      ].map(([a, m, ad]) => `<tr><td>${a}</td><td>${m ? icon('check', 'ok-text') : '—'}</td><td>${ad ? icon('check', 'ok-text') : '—'}</td></tr>`))}
    </section>
    <section class="card danger-card" data-enter><div class="card-head"><h2>Démo</h2></div>
      <p class="muted">Les données de ce back-office sont simulées dans le navigateur en attendant l’API (voir BACKEND.md). Tu peux tout remettre à zéro.</p>
      <button class="btn btn-secondary btn-sm" data-reset>${icon('restore')} Réinitialiser les données de démo</button>
    </section>`;
  enter(root);

  root.querySelectorAll('[data-sw]').forEach((b) => (b.onclick = async () => {
    const k = b.dataset.sw, v = b.getAttribute('aria-checked') !== 'true';
    if (k === 'maintenance' && v && !(await confirmAction({ title: 'Activer la maintenance', text: 'L’app et le site seront fermés au public jusqu’à ce que tu la désactives.', confirm: 'Activer', danger: true }))) return;
    S.setPlatform(k, v); b.setAttribute('aria-checked', String(v));
    toast(`${SWITCHES.find((s) => s[0] === k)[1]} : ${v ? 'activé' : 'désactivé'}`);
  }));
  $('[data-mm]', root).onclick = () => { S.get().platform.maintenanceMessage = $('#mm', root).value; S.setPlatform('maintenanceMessage', $('#mm', root).value); toast('Message enregistré'); };
  root.querySelectorAll('[data-menu]').forEach((b) => (b.onclick = () => userMenu(b, S.user(b.closest('tr').dataset.id))));
  $('[data-reset]', root).onclick = async () => { if (await confirmAction({ title: 'Réinitialiser la démo', text: 'Toutes les actions faites dans ce navigateur seront effacées.', confirm: 'Réinitialiser', danger: true })) { S.resetDemo(); toast('Démo réinitialisée'); go('/'); } };
}
