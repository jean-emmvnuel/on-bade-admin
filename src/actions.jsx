// Actions d'administration partagées entre les écrans (menus, confirmations, motifs).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as S from './lib/store.js';
import { go } from './lib/nav.js';
import { toast } from './lib/toast.js';
import { confirmAction, dialog, menu, openModal } from './components/overlays.jsx';
import { Icon, Sticker, UserCell } from './components/ui.jsx';

// ─── Sanctions ─────────────────────────────────────────────
const LEVEL_HELP = ['Le bading est supprimé et la personne est prévenue.', 'Le compte ne peut plus publier ni commenter pendant 7 jours.', 'Le compte est fermé définitivement.'];

function SanctionForm({ user: u, done }) {
  const levels = S.can('warning') ? [1, 2, 3] : [2, 3];
  const [level, setLevel] = useState(levels[0]);
  const [reason, setReason] = useState('');
  const apply = () => {
    S.sanction(u.id, level, reason.trim());
    toast(`${S.SANCTIONS[level]} appliqué à @${u.pseudo}`);
    done(level);
  };
  return (
    <>
      <div className="levels">
        {levels.map((l) => (
          <label className="level" key={l}>
            <input type="radio" name="lvl" value={l} checked={level === l} onChange={() => setLevel(l)} />
            <span><b>Niveau {l} · {S.SANCTIONS[l]}</b><small>{LEVEL_HELP[l - 1]}</small></span>
          </label>
        ))}
      </div>
      {S.can('warning') ? null : <p className="muted small">Le compte est bloqué : il ne peut plus se connecter et ses contenus disparaissent du fil.</p>}
      <p className="muted small">Historique : {u.sanctions.length ? u.sanctions.map((s) => `${S.SANCTIONS[s.level]} (${S.timeAgo(s.at)})`).join(' · ') : 'aucune sanction'}</p>
      <div className="field">
        <label htmlFor="sr">Motif communiqué à la personne</label>
        <textarea id="sr" rows={3} maxLength={300} placeholder="Ex. moquerie sur l'ethnie, contraire à la charte" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" data-cancel onClick={() => done(null)}>Annuler</button>
        <button className="btn btn-danger" data-ok disabled={reason.trim().length < 3} onClick={apply}>Appliquer la sanction</button>
      </div>
    </>
  );
}

/** Sanctionne un compte. Résout le niveau appliqué, ou null. */
export function sanctionDialog(userId) {
  const u = S.user(userId);
  return dialog({ title: `Sanctionner @${u.pseudo}`, render: (done) => <SanctionForm user={u} done={done} /> });
}

// ─── Coffre d'anonymat ─────────────────────────────────────
export async function revealDialog(b) {
  const reason = await confirmAction({
    title: 'Révéler l’auteur anonyme',
    text: 'L’anonymat est une promesse faite aux Badeurs. Ne le lève qu’en cas d’abus grave (menace, harcèlement, réquisition judiciaire). Ton nom et le motif sont inscrits au journal d’audit.',
    confirm: 'Révéler l’auteur', danger: true, reason: true, reasonLabel: 'Motif de la levée d’anonymat',
    presets: ['Menaces envers une personne', 'Harcèlement répété', 'Réquisition judiciaire'],
  });
  if (!reason) return null;
  const u = await S.revealAuthor(b.id, reason);
  if (!u) return null;
  const at = S.fmtDate(Date.now());
  openModal({
    title: 'Auteur du bading anonyme',
    render: () => (
      <>
        <div className="reveal"><UserCell user={u} sub={u?.email} />{u ? <Link className="btn btn-secondary btn-sm" to={`/users/${u.id}`}>Ouvrir le profil</Link> : null}</div>
        <p className="muted small">Consultation journalisée le {at}.</p>
      </>
    ),
  });
  return u;
}

// ─── Badings ───────────────────────────────────────────────
export async function badingMenu(anchor, b) {
  const k = await menu(anchor, [
    { k: 'open', icon: 'eye', label: 'Voir le détail' },
    S.can('hide') && b.status === 'visible' && { k: 'hide', icon: 'eyeOff', label: 'Masquer' },
    S.can('hide') && b.status !== 'visible' && { k: 'restore', icon: 'restore', label: 'Rétablir' },
    S.can('reveal') && b.anonymous && { k: 'reveal', icon: 'key', label: 'Révéler l’auteur' },
    S.can('pin') && b.status === 'visible' && (b.pinned ? { k: 'unpin', icon: 'x', label: 'Retirer l’épinglage' } : { k: 'pin', icon: 'trendingUp', label: 'Épingler en tête du fil' }),
    b.authorId && { k: 'author', icon: 'user', label: b.anonymous ? 'Sanctionner l’auteur (anonyme)' : 'Voir l’auteur' },
    '-',
    b.status !== 'deleted' && { k: 'delete', icon: 'trash', label: 'Supprimer', danger: true },
  ]);
  await badingAction(k, b);
}

/** Exécute une action sur un bading. Résout true si elle a été appliquée. */
export async function badingAction(k, b) {
  if (!k) return false;
  if (k === 'open') { go(`/badings/${b.id}`); return false; }
  if (k === 'author') { if (b.anonymous) await sanctionDialog(b.authorId); else go(`/users/${b.authorId}`); return false; }
  if (k === 'reveal') return !!(await revealDialog(b));
  if (k === 'restore') { S.setBadingStatus(b.id, 'visible'); toast('Bading rétabli'); return true; }
  if (k === 'pin') return pinDialog(b);
  if (k === 'unpin') { S.unpinBading(b.id); toast('Épinglage retiré'); return true; }
  const hide = k === 'hide';
  const reason = await confirmAction({
    title: hide ? 'Masquer ce bading' : 'Supprimer ce bading',
    text: hide ? 'Le bading n’est plus visible dans l’app, mais reste en base et peut être rétabli.' : 'Le bading disparaît pour tout le monde. Les rebades afficheront « Ce bading n’est plus disponible ».',
    confirm: hide ? 'Masquer' : 'Supprimer', danger: !hide, reason: true,
    presets: ['Contraire à la charte', 'Personne réelle exposée', 'Spam / arnaque', 'Haine ou discrimination'],
  });
  if (!reason) return false;
  S.setBadingStatus(b.id, hide ? 'hidden' : 'deleted', reason);
  toast(hide ? 'Bading masqué' : 'Bading supprimé');
  return true;
}

// ─── Épinglage (« bading du jour ») ─────────────────────────
const PIN_DURATIONS = [['24', '24 heures'], ['72', '3 jours'], ['168', '7 jours'], ['', 'Jusqu’au retrait']];

function PinForm({ done }) {
  const [label, setLabel] = useState('Bading du jour');
  const [hours, setHours] = useState('24');
  return (
    <>
      <div className="field">
        <label htmlFor="pl">Étiquette affichée dans l’app (facultative)</label>
        <input id="pl" maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="pd">Durée</label>
        <select id="pd" value={hours} onChange={(e) => setHours(e.target.value)}>{PIN_DURATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>
      <p className="muted small">Les 3 derniers badings épinglés s’affichent en tête du fil, avant les plus récents.</p>
      <div className="modal-actions">
        <button className="btn btn-ghost" data-cancel onClick={() => done(null)}>Annuler</button>
        <button className="btn btn-primary" data-ok onClick={() => done({ label: label.trim(), until: hours ? Date.now() + Number(hours) * 3_600_000 : undefined })}>Épingler</button>
      </div>
    </>
  );
}

async function pinDialog(b) {
  const opts = await dialog({ title: 'Épingler ce bading', render: (done) => <PinForm done={done} /> });
  if (!opts) return false;
  S.pinBading(b.id, opts);
  toast('Bading épinglé en tête du fil 📌');
  return true;
}

// ─── Commentaires ──────────────────────────────────────────
export async function commentAction(k, c) {
  if (k === 'restore') { S.setCommentStatus(c.id, 'visible'); toast('Commentaire rétabli'); return true; }
  if (k === 'author') { go(`/users/${c.authorId}`); return false; }
  if (k === 'sanction') { await sanctionDialog(c.authorId); return false; }
  if (k === 'delete') {
    const reason = await confirmAction({ title: 'Supprimer ce commentaire', text: `« ${c.text} »`, confirm: 'Supprimer', danger: true, reason: true, presets: ['Harcèlement', 'Insulte', 'Spam'] });
    if (!reason) return false;
    S.setCommentStatus(c.id, 'deleted', reason); toast('Commentaire supprimé');
    return true;
  }
  return false;
}

// ─── Utilisateurs ──────────────────────────────────────────
export async function userMenu(anchor, u) {
  const isMe = u.id === S.me().id;
  const k = await menu(anchor, [
    { k: 'open', icon: 'user', label: 'Voir le profil' },
    !isMe && u.status === 'active' && { k: 'sanction', icon: 'ban', label: 'Sanctionner' },
    !isMe && (u.status === 'suspended' || u.status === 'banned') && { k: 'lift', icon: 'restore', label: 'Lever la sanction' },
    S.canManageBadges() && { k: 'badge', icon: 'badgeCheck', label: u.verified ? 'Retirer le badge' : 'Attribuer le badge' },
    !isMe && { k: 'role', icon: 'shield', label: 'Changer le rôle' },
    S.can('pseudo') && { k: 'pseudo', icon: 'userPen', label: 'Modifier le pseudo' },
    S.can('message') && !isMe && { k: 'message', icon: 'megaphone', label: 'Envoyer un message' },
    { k: 'reset', icon: 'key', label: S.BACKEND ? 'Créer un lien de mot de passe' : 'Envoyer un lien de mot de passe' },
    S.can('export') && { k: 'export', icon: 'download', label: 'Télécharger ses données' },
    '-',
    S.can('deleteUser') && !isMe && u.status !== 'deleted' && { k: 'delete', icon: 'trash', label: 'Supprimer le compte', danger: true },
  ]);
  await userAction(k, u);
}

const ROLE_HELP = {
  user: 'Utilise l’app, aucun accès au back-office.',
  moderator: 'Traite les signalements, masque les contenus, sanctionne (niveaux 1 et 2).',
  admin: 'Tous les accès : utilisateurs, coffre d’anonymat, règles, équipe, paramètres.',
};

function RoleForm({ user: u, done }) {
  const [role, setRole] = useState(u.role);
  return (
    <>
      <div className="levels">
        {Object.entries(S.ROLES).map(([r, l]) => (
          <label className="level" key={r}>
            <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
            <span><b>{l}</b><small>{ROLE_HELP[r]}</small></span>
          </label>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" data-cancel onClick={() => done(null)}>Annuler</button>
        <button className="btn btn-primary" data-ok onClick={() => done(role)}>Enregistrer</button>
      </div>
    </>
  );
}

function PseudoForm({ user: u, done }) {
  const [pseudo, setPseudo] = useState(u.pseudo);
  const [error, setError] = useState('');
  const save = () => {
    const p = pseudo.trim();
    if (!/^[A-Za-z0-9_.]{3,20}$/.test(p)) return setError('Entre 3 et 20 caractères : lettres, chiffres, _ ou .');
    if (S.users().some((x) => x.id !== u.id && x.pseudo.toLowerCase() === p.toLowerCase())) return setError('Ce pseudo est déjà pris.');
    return done(p);
  };
  return (
    <>
      <div className="field">
        <label htmlFor="np">Nouveau pseudo</label>
        <div className="input-prefix"><span>@</span><input id="np" value={pseudo} maxLength={20} onChange={(e) => { setPseudo(e.target.value); setError(''); }} onKeyDown={(e) => e.key === 'Enter' && save()} /></div>
        <small className={error ? 'error' : 'hint'}>{error || '3 à 20 caractères : lettres, chiffres, _ ou . — le badge vérifié sera retiré.'}</small>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" data-cancel onClick={() => done(null)}>Annuler</button>
        <button className="btn btn-primary" data-ok onClick={save}>Enregistrer</button>
      </div>
    </>
  );
}

function MessageForm({ user: u, done }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  return (
    <>
      <div className="field"><label htmlFor="mt">Titre (facultatif)</label><input id="mt" maxLength={80} placeholder="Message de l’équipe On Bade" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="field">
        <label htmlFor="mx">Message</label>
        <textarea id="mx" rows={4} maxLength={1000} placeholder={`Bonjour @${u.pseudo}, …`} value={text} onChange={(e) => setText(e.target.value)} />
        <small className="hint">{text.length} / 1 000 · reçu comme notification dans l’app, inscrit au journal d’audit</small>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" data-cancel onClick={() => done(null)}>Annuler</button>
        <button className="btn btn-primary" data-ok disabled={!text.trim()} onClick={() => done({ title: title.trim(), text: text.trim() })}>Envoyer</button>
      </div>
    </>
  );
}

function ResetLink({ link }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(link.url).then(() => setCopied(true), () => {});
  return (
    <>
      <p className="muted">Aucun e-mail n’est envoyé pour l’instant : transmets ce lien à la personne par un canal sûr. Il est valable jusqu’au {S.fmtDate(link.expiresAt)} et ne sert qu’une fois.</p>
      <div className="row-input"><input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} aria-label="Lien de réinitialisation" /><button className="btn btn-secondary btn-sm" onClick={copy}>{copied ? 'Copié ✓' : 'Copier'}</button></div>
    </>
  );
}

function download(name, data) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function userAction(k, u) {
  if (!k) return;
  if (k === 'open') { go(`/users/${u.id}`); return; }
  if (k === 'sanction') { await sanctionDialog(u.id); return; }
  if (k === 'lift') {
    if (await confirmAction({ title: `Réactiver @${u.pseudo}`, text: 'Le compte pourra de nouveau publier et commenter.', confirm: 'Lever la sanction' })) { S.liftSanction(u.id); toast('Compte réactivé'); }
    return;
  }
  if (k === 'badge') {
    if (!S.canManageBadges()) { toast('Réservé à l’administrateur'); return; }
    const el = S.badgeEligibility(u.id), R = S.get().rules;
    const info = u.verified
      ? `Pour @${u.pseudo}. Le badge disparaît de son profil et de ses badings signés.`
      : `Pour @${u.pseudo} : ${el.active ? 'actif' : 'pas actif'} (${el.lastDays === null ? 'aucun bading signé' : `dernier bading signé il y a ${el.lastDays} j`}), ${S.compact(el.laughs)} rires reçus sur ${S.compact(R.badgeMinLaughs)} demandés.${el.eligible ? '' : ' Les conditions ne sont pas remplies : en tant qu’administrateur, tu peux quand même l’attribuer.'}`;
    const wasVerified = u.verified;
    if (await confirmAction({ title: wasVerified ? 'Retirer le badge vérifié' : 'Attribuer le badge vérifié', text: info, confirm: wasVerified ? 'Retirer' : 'Attribuer le badge', danger: wasVerified })) {
      S.setVerified(u.id, !wasVerified); toast(wasVerified ? 'Badge retiré' : 'Badge attribué');
    }
    return;
  }
  if (k === 'reset') {
    if (S.BACKEND) {
      if (!(await confirmAction({ title: 'Réinitialiser le mot de passe', text: <>Un lien valable 1 heure sera créé pour <b>@{u.pseudo}</b>. Tu devras le lui transmettre.</>, confirm: 'Créer le lien' }))) return;
      const link = await S.sendPasswordReset(u.id);
      if (link) openModal({ title: `Lien pour @${u.pseudo}`, render: () => <ResetLink link={link} /> });
      return;
    }
    if (await confirmAction({ title: 'Réinitialiser le mot de passe', text: <>Un lien valable 1 heure sera envoyé à <b>{u.email}</b>. Les sessions ouvertes seront fermées.</>, confirm: 'Envoyer le lien' })) { S.sendPasswordReset(u.id); toast('Lien envoyé'); }
    return;
  }
  if (k === 'message') {
    const m = await dialog({ title: `Message à @${u.pseudo}`, render: (done) => <MessageForm user={u} done={done} /> });
    if (m) { S.messageUser(u.id, m.title, m.text); toast('Message envoyé'); }
    return;
  }
  if (k === 'export') {
    if (!(await confirmAction({ title: `Données de @${u.pseudo}`, text: 'Une copie complète (profil, badings, rires, favoris, commentaires) est téléchargée en JSON. La consultation est inscrite au journal d’audit.', confirm: 'Télécharger' }))) return;
    const data = await S.exportUserData(u.id);
    if (data) { download(`onbade-donnees-${u.pseudo}-${new Date().toISOString().slice(0, 10)}.json`, data); toast('Copie téléchargée'); }
    return;
  }
  if (k === 'role') {
    const r = await dialog({ title: `Rôle de @${u.pseudo}`, render: (done) => <RoleForm user={u} done={done} /> });
    if (r && r !== u.role) { S.setRole(u.id, r); toast(`@${u.pseudo} est maintenant ${S.ROLES[r].toLowerCase()}`); }
    return;
  }
  if (k === 'pseudo') {
    const p = await dialog({ title: 'Modifier le pseudo', render: (done) => <PseudoForm user={u} done={done} /> });
    if (p && p !== u.pseudo) { S.setPseudo(u.id, p); toast('Pseudo modifié'); }
    return;
  }
  if (k === 'delete') {
    const reason = await confirmAction({ title: `Supprimer le compte @${u.pseudo}`, text: 'Le compte, ses badings et ses commentaires sont supprimés. Cette action est définitive.', confirm: 'Supprimer définitivement', danger: true, reason: true, presets: ['Demande de l’utilisateur', 'Compte frauduleux', 'Bannissement'] });
    if (!reason) return;
    S.deleteUser(u.id, reason); toast('Compte supprimé');
  }
}

// ─── Aperçu du contenu signalé ─────────────────────────────
export function TargetPreview({ type, id }) {
  if (type === 'bading') {
    const b = S.bading(id);
    if (!b) return <em>Bading introuvable</em>;
    return (
      <Link className="preview" to={`/badings/${b.id}`}>
        <small><Icon name="quote" /> Bading {b.id} · {b.anonymous ? 'Badeur anonyme' : `@${S.user(b.authorId)?.pseudo}`} · {S.timeAgo(b.createdAt)}</small>
        {b.text ? <span>{b.text}</span> : null}
        {b.image ? <img className="preview-img" src={b.image.src} alt="Image du bading" /> : null}
      </Link>
    );
  }
  if (type === 'comment') {
    const c = S.comment(id);
    if (!c) return <em>Commentaire introuvable</em>;
    return (
      <Link className="preview" to={`/badings/${c.badingId}`}>
        <small><Icon name="message" /> Commentaire de @{S.user(c.authorId)?.pseudo} · {S.timeAgo(c.createdAt)}</small>
        {c.sticker ? <Sticker id={c.sticker} size={90} /> : <span>{c.text}</span>}
      </Link>
    );
  }
  if (type === 'sticker') {
    const x = S.customSticker(id);
    if (!x) return <em>Sticker introuvable</em>;
    return (
      <Link className="preview" to="/stickers">
        <small><Icon name="sticker" /> Sticker personnel « {x.label ?? id} » · créé par @{S.user(x.ownerId)?.pseudo} · utilisé {S.stickerUses(id)} fois</small>
        <Sticker id={id} size={110} />
      </Link>
    );
  }
  const u = S.user(id);
  return u ? <Link className="preview" to={`/users/${u.id}`}><UserCell user={u} sub={u.email} /></Link> : <em>Compte introuvable</em>;
}
