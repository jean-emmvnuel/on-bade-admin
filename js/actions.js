// Actions d'administration partagées entre les écrans (menus, confirmations, motifs).
import * as S from './store.js';
import { $, confirmAction, esc, menu, modal, closeModal, toast, icon, userCell } from './ui.js';
import { stickerHtml } from './stickers.js';

const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

export function sanctionDialog(userId) {
  const u = S.user(userId);
  return new Promise((resolve) => {
    const box = modal({
      title: `Sanctionner @${u.pseudo}`,
      html: `<div class="levels">${[1, 2, 3].map((l) => `<label class="level"><input type="radio" name="lvl" value="${l}" ${l === 1 ? 'checked' : ''}/><span><b>Niveau ${l} · ${S.SANCTIONS[l]}</b><small>${['Le bading est supprimé et la personne est prévenue.', 'Le compte ne peut plus publier ni commenter pendant 7 jours.', 'Le compte est fermé définitivement.'][l - 1]}</small></span></label>`).join('')}</div>
        <p class="muted small">Historique : ${u.sanctions.length ? u.sanctions.map((s) => `${S.SANCTIONS[s.level]} (${S.timeAgo(s.at)})`).join(' · ') : 'aucune sanction'}</p>
        <div class="field"><label for="sr">Motif communiqué à la personne</label><textarea id="sr" rows="3" maxlength="300" placeholder="Ex. moquerie sur l'ethnie, contraire à la charte"></textarea></div>
        <div class="modal-actions"><button class="btn btn-ghost" data-cancel>Annuler</button><button class="btn btn-danger" data-ok disabled>Appliquer la sanction</button></div>`,
    });
    const ta = $('#sr', box), ok = $('[data-ok]', box);
    ta.oninput = () => (ok.disabled = ta.value.trim().length < 3);
    $('[data-cancel]', box).onclick = () => { closeModal(); resolve(null); };
    ok.onclick = () => {
      const level = +box.querySelector('input[name=lvl]:checked').value;
      S.sanction(userId, level, ta.value.trim());
      closeModal(); toast(`${S.SANCTIONS[level]} appliqué à @${u.pseudo}`); resolve(level);
    };
  });
}

export async function revealDialog(b) {
  const reason = await confirmAction({
    title: 'Révéler l’auteur anonyme',
    text: 'L’anonymat est une promesse faite aux Badeurs. Ne le lève qu’en cas d’abus grave (menace, harcèlement, réquisition judiciaire). Ton nom et le motif sont inscrits au journal d’audit.',
    confirm: 'Révéler l’auteur', danger: true, reason: true, reasonLabel: 'Motif de la levée d’anonymat',
    presets: ['Menaces envers une personne', 'Harcèlement répété', 'Réquisition judiciaire'],
  });
  if (!reason) return null;
  const u = S.revealAuthor(b.id, reason);
  modal({ title: 'Auteur du bading anonyme', html: `<div class="reveal">${userCell(u, esc(u.email))}<a class="btn btn-secondary btn-sm" href="#/users/${u.id}">Ouvrir le profil</a></div><p class="muted small">Consultation journalisée le ${S.fmtDate(Date.now())}.</p>` });
  return u;
}

export async function badingMenu(anchor, b) {
  const items = [
    { k: 'open', icon: 'eye', label: 'Voir le détail' },
    b.status === 'visible' && { k: 'hide', icon: 'eyeOff', label: 'Masquer' },
    b.status !== 'visible' && { k: 'restore', icon: 'restore', label: 'Rétablir' },
    b.anonymous && { k: 'reveal', icon: 'key', label: 'Révéler l’auteur' },
    { k: 'author', icon: 'user', label: b.anonymous ? 'Sanctionner l’auteur (anonyme)' : 'Voir l’auteur' },
    '-',
    b.status !== 'deleted' && { k: 'delete', icon: 'trash', label: 'Supprimer', danger: true },
  ];
  const k = await menu(anchor, items);
  await badingAction(k, b);
}

/** Exécute une action sur un bading. Résout true si elle a été appliquée. */
export async function badingAction(k, b) {
  if (!k) return false;
  if (k === 'open') { location.hash = `#/badings/${b.id}`; return false; }
  if (k === 'author') { if (b.anonymous) await sanctionDialog(b.authorId); else location.hash = `#/users/${b.authorId}`; refresh(); return false; }
  if (k === 'reveal') { return !!(await revealDialog(b)); }
  if (k === 'restore') { S.setBadingStatus(b.id, 'visible'); toast('Bading rétabli'); refresh(); return true; }
  const reason = await confirmAction({
    title: k === 'hide' ? 'Masquer ce bading' : 'Supprimer ce bading',
    text: k === 'hide' ? 'Le bading n’est plus visible dans l’app, mais reste en base et peut être rétabli.' : 'Le bading disparaît pour tout le monde. Les rebades afficheront « Ce bading n’est plus disponible ».',
    confirm: k === 'hide' ? 'Masquer' : 'Supprimer', danger: k === 'delete', reason: true,
    presets: ['Contraire à la charte', 'Personne réelle exposée', 'Spam / arnaque', 'Haine ou discrimination'],
  });
  if (!reason) return false;
  S.setBadingStatus(b.id, k === 'hide' ? 'hidden' : 'deleted', reason);
  toast(k === 'hide' ? 'Bading masqué' : 'Bading supprimé');
  refresh();
  return true;
}

export async function commentAction(k, c) {
  if (k === 'restore') { S.setCommentStatus(c.id, 'visible'); toast('Commentaire rétabli'); refresh(); return true; }
  if (k === 'author') { location.hash = `#/users/${c.authorId}`; return; }
  if (k === 'sanction') { await sanctionDialog(c.authorId); return refresh(); }
  if (k === 'delete') {
    const reason = await confirmAction({ title: 'Supprimer ce commentaire', text: `« ${esc(c.text)} »`, confirm: 'Supprimer', danger: true, reason: true, presets: ['Harcèlement', 'Insulte', 'Spam'] });
    if (!reason) return false;
    S.setCommentStatus(c.id, 'deleted', reason); toast('Commentaire supprimé'); refresh();
    return true;
  }
  return false;
}

export async function userMenu(anchor, u) {
  const isMe = u.id === S.me().id;
  const items = [
    { k: 'open', icon: 'user', label: 'Voir le profil' },
    !isMe && u.status === 'active' && { k: 'sanction', icon: 'ban', label: 'Sanctionner' },
    !isMe && (u.status === 'suspended' || u.status === 'banned') && { k: 'lift', icon: 'restore', label: 'Lever la sanction' },
    ...(S.canManageBadges() ? [{ k: 'badge', icon: 'badgeCheck', label: u.verified ? 'Retirer le badge' : 'Attribuer le badge' }] : []),
    !isMe && { k: 'role', icon: 'shield', label: 'Changer le rôle' },
    { k: 'pseudo', icon: 'userPen', label: 'Modifier le pseudo' },
    { k: 'reset', icon: 'key', label: 'Envoyer un lien de mot de passe' },
    '-',
    !isMe && u.status !== 'deleted' && { k: 'delete', icon: 'trash', label: 'Supprimer le compte', danger: true },
  ];
  await userAction(await menu(anchor, items), u);
}

export async function userAction(k, u) {
  if (!k) return;
  if (k === 'open') { location.hash = `#/users/${u.id}`; return; }
  if (k === 'sanction') { await sanctionDialog(u.id); return refresh(); }
  if (k === 'lift') { if (await confirmAction({ title: `Réactiver @${u.pseudo}`, text: 'Le compte pourra de nouveau publier et commenter.', confirm: 'Lever la sanction' })) { S.liftSanction(u.id); toast('Compte réactivé'); refresh(); } return; }
  if (k === 'badge') {
    if (!S.canManageBadges()) { toast('Réservé à l’administrateur'); return; }
    const el = S.badgeEligibility(u.id), R = S.get().rules;
    const info = u.verified ? `Pour @${esc(u.pseudo)}. Le badge disparaît de son profil et de ses badings signés.`
      : `Pour @${esc(u.pseudo)} : ${el.active ? 'actif' : 'pas actif'} (${el.lastDays === null ? 'aucun bading signé' : `dernier bading signé il y a ${el.lastDays} j`}), ${S.compact(el.laughs)} rires reçus sur ${S.compact(R.badgeMinLaughs)} demandés.${el.eligible ? '' : ' Les conditions ne sont pas remplies : en tant qu’administrateur, tu peux quand même l’attribuer.'}`;
    if (await confirmAction({ title: u.verified ? 'Retirer le badge vérifié' : 'Attribuer le badge vérifié', text: info, confirm: u.verified ? 'Retirer' : 'Attribuer le badge', danger: u.verified })) { S.setVerified(u.id, !u.verified); toast(u.verified ? 'Badge attribué' : 'Badge retiré'); refresh(); }
    return;
  }
  if (k === 'reset') { if (await confirmAction({ title: 'Réinitialiser le mot de passe', text: `Un lien valable 1 heure sera envoyé à <b>${esc(u.email)}</b>. Les sessions ouvertes seront fermées.`, confirm: 'Envoyer le lien' })) { S.sendPasswordReset(u.id); toast('Lien envoyé'); refresh(); } return; }
  if (k === 'role') {
    const box = modal({ title: `Rôle de @${u.pseudo}`, html: `<div class="levels">${Object.entries(S.ROLES).map(([r, l]) => `<label class="level"><input type="radio" name="role" value="${r}" ${u.role === r ? 'checked' : ''}/><span><b>${l}</b><small>${{ user: 'Utilise l’app, aucun accès au back-office.', moderator: 'Traite les signalements, masque les contenus, sanctionne (niveaux 1 et 2).', admin: 'Tous les accès : utilisateurs, coffre d’anonymat, règles, équipe, paramètres.' }[r]}</small></span></label>`).join('')}</div>
      <div class="modal-actions"><button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Enregistrer</button></div>` });
    $('[data-ok]', box).onclick = () => { const r = box.querySelector('input[name=role]:checked').value; if (r !== u.role) { S.setRole(u.id, r); toast(`@${u.pseudo} est maintenant ${S.ROLES[r].toLowerCase()}`); } closeModal(); refresh(); };
    box.querySelector('[data-close]:not(.icon-btn)').onclick = () => closeModal();
    return;
  }
  if (k === 'pseudo') {
    const box = modal({ title: 'Modifier le pseudo', html: `<div class="field"><label for="np">Nouveau pseudo</label><div class="input-prefix"><span>@</span><input id="np" value="${esc(u.pseudo)}" maxlength="20"/></div><small class="hint" data-h>3 à 20 caractères : lettres, chiffres, _ ou . — le badge vérifié sera retiré.</small></div>
      <div class="modal-actions"><button class="btn btn-ghost" data-cancel>Annuler</button><button class="btn btn-primary" data-ok>Enregistrer</button></div>` });
    const inp = $('#np', box), h = $('[data-h]', box);
    $('[data-cancel]', box).onclick = () => closeModal();
    $('[data-ok]', box).onclick = () => {
      const p = inp.value.trim();
      if (!/^[A-Za-z0-9_.]{3,20}$/.test(p)) { h.className = 'error'; h.textContent = 'Entre 3 et 20 caractères : lettres, chiffres, _ ou .'; return; }
      if (S.users().some((x) => x.id !== u.id && x.pseudo.toLowerCase() === p.toLowerCase())) { h.className = 'error'; h.textContent = 'Ce pseudo est déjà pris.'; return; }
      if (p !== u.pseudo) { S.setPseudo(u.id, p); toast('Pseudo modifié'); }
      closeModal(); refresh();
    };
    return;
  }
  if (k === 'delete') {
    const reason = await confirmAction({ title: `Supprimer le compte @${u.pseudo}`, text: 'Le compte, ses badings et ses commentaires sont supprimés. Cette action est définitive.', confirm: 'Supprimer définitivement', danger: true, reason: true, presets: ['Demande de l’utilisateur', 'Compte frauduleux', 'Bannissement'] });
    if (!reason) return;
    S.deleteUser(u.id, reason); toast('Compte supprimé'); refresh();
  }
}

export const targetPreview = (type, id) => {
  if (type === 'bading') { const b = S.bading(id); return b ? `<a class="preview" href="#/badings/${b.id}"><small>${icon('quote')} Bading ${b.id} · ${b.anonymous ? 'Badeur anonyme' : '@' + esc(S.user(b.authorId)?.pseudo)} · ${S.timeAgo(b.createdAt)}</small>${b.text ? `<span>${esc(b.text)}</span>` : ''}${b.image ? `<img class="preview-img" src="${b.image.src}" alt="Image du bading"/>` : ''}</a>` : '<em>Bading introuvable</em>'; }
  if (type === 'comment') { const c = S.comment(id); return c ? `<a class="preview" href="#/badings/${c.badingId}"><small>${icon('message')} Commentaire de @${esc(S.user(c.authorId)?.pseudo)} · ${S.timeAgo(c.createdAt)}</small>${c.sticker ? stickerHtml(c.sticker, 90) : `<span>${esc(c.text)}</span>`}</a>` : '<em>Commentaire introuvable</em>'; }
  if (type === 'sticker') { const x = S.customSticker(id); return x ? `<a class="preview" href="#/stickers"><small>${icon('sticker')} Sticker personnel « ${esc(x.label ?? id)} » · créé par @${esc(S.user(x.ownerId)?.pseudo)} · utilisé ${S.stickerUses(id)} fois</small>${stickerHtml(id, 110)}</a>` : '<em>Sticker introuvable</em>'; }
  const u = S.user(id); return u ? `<a class="preview" href="#/users/${u.id}">${userCell(u, esc(u.email))}</a>` : '<em>Compte introuvable</em>';
};
