import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as S from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { useStore } from '../lib/useStore.js';
import { useEnter } from '../lib/motion.js';
import { confirmAction, menu } from '../components/overlays.jsx';
import { errorMessage } from '../lib/api.js';
import { go } from '../lib/nav.js';
import { Icon, PageHead, Pill, Table, UserCell } from '../components/ui.jsx';
import { userMenu } from '../actions.jsx';

const SWITCHES = [
  ['signupsOpen', 'Inscriptions ouvertes', 'Les nouveaux comptes peuvent s’inscrire.'],
  ['anonymousEnabled', 'Publication anonyme', 'Le mode « Badeur anonyme » est disponible.'],
  ['commentsEnabled', 'Commentaires', 'Les commentaires et réponses sont ouverts.'],
  ['maintenance', 'Mode maintenance', 'L’app et le site affichent un message et sont fermés au public.'],
];
const PERMISSIONS = { READ: 'Lecture seule', WRITE: 'Actions seules', READWRITE: 'Lecture et actions', ALL: 'Tous les droits (gère l’équipe)' };
const RIGHTS = [
  ['Traiter les signalements, masquer et supprimer des contenus', true, true], ['Sanctions niveaux 1 et 2', true, true], ['Bannissement définitif', false, true],
  ['Révéler l’auteur d’un bading anonyme', false, true], ['Badges vérifiés', false, true], ['Modifier pseudo, rôle, mot de passe, supprimer un compte', false, true],
  ['Données personnelles', false, true], ['Annonces', false, true], ['Mots interdits, règles, paramètres', false, true], ['Journal d’audit', true, true],
];

const RolePill = ({ role }) => <Pill tone={role === 'admin' ? 'brand' : 'info'}>{S.ROLES[role]}</Pill>;
const MenuButton = ({ user }) => <button className="icon-btn" data-menu aria-label="Actions" onClick={(e) => userMenu(e.currentTarget, user)}><Icon name="ellipsis" /></button>;

export default function Settings() {
  useStore();
  return S.BACKEND ? <ServerSettings /> : <DemoSettings />;
}

/** Avec l'API : interrupteurs de la plateforme, équipe et droits, double authentification et connexions de l'équipe. */
function ServerSettings() {
  const st = S.get();
  const ref = useEnter();
  const team = S.users().filter((u) => u.role !== 'user');
  const isAll = S.me()?.permission === 'ALL';
  const mfaOf = (u) => st.admins.find((a) => a.id === u.adminId)?.mfaEnabled;
  const memberMenu = async (e, u) => {
    const k = await menu(e.currentTarget, [
      { k: 'open', icon: 'user', label: 'Voir le profil' },
      { k: 'more', icon: 'ellipsis', label: 'Autres actions…' },
      isAll && mfaOf(u) && u.id !== S.me().id && { k: 'mfa', icon: 'key', label: 'Réinitialiser sa double authentification', danger: true },
    ]);
    if (k === 'open') go(`/users/${u.id}`);
    if (k === 'more') userMenu(e.currentTarget, u);
    if (k === 'mfa' && (await confirmAction({ title: `Double authentification de @${u.pseudo}`, text: 'Sa configuration est effacée (téléphone perdu, changement d’appareil). Il devra la refaire à sa prochaine connexion si elle est obligatoire.', confirm: 'Réinitialiser', danger: true }))) {
      S.resetMemberMfa(u.adminId); toast('Double authentification réinitialisée');
    }
  };
  return (
    <div className="view" ref={ref}>
      <PageHead title="Paramètres" sub="Interrupteurs de la plateforme, équipe et sécurité. Chaque changement est inscrit au journal d’audit." />
      <PlatformSwitches readOnly={!isAll} />
      <section className="card" data-enter>
        <div className="card-head"><h2>Équipe ({team.length})</h2><Link className="link" to="/users">Ajouter depuis Utilisateurs</Link></div>
        <Table head={['Membre', 'Rôle', 'Droits', '2FA', 'Dernière activité', '']}>
          {team.map((u) => (
            <tr key={u.id} data-id={u.id}>
              <td><UserCell user={u} sub={u.email} /></td><td><RolePill role={u.role} /></td><td>{PERMISSIONS[u.permission] ?? '—'}</td>
              <td>{mfaOf(u) ? <Pill tone="good">Activée</Pill> : <Pill tone="neutral">Non</Pill>}</td>
              <td className="nowrap">{S.timeAgo(u.lastActiveAt)}</td>
              <td><button className="icon-btn" data-menu aria-label="Actions" onClick={(e) => memberMenu(e, u)}><Icon name="ellipsis" /></button></td>
            </tr>
          ))}
        </Table>
        <p className="muted small">Pour nommer un modérateur ou un administrateur : ouvre son profil dans Utilisateurs, puis « Rôle ». Seul un administrateur (tous les droits) peut modifier l’équipe.</p>
      </section>
      <MySecurity />
      <LoginHistory isAll={isAll} />
      <section className="card" data-enter>
        <div className="card-head"><h2>Droits</h2></div>
        <Table head={['Rôle', 'Droits sur le serveur']}>
          {[['Administrateur', 'Tous les droits : lecture, actions, révélation de l’auteur anonyme, suppression de comptes, données personnelles, réglages et gestion de l’équipe'], ['Modérateur', 'Lecture et actions (signalements, masquage, sanctions, badges, annonces), sans réglages ni gestion de l’équipe']]
            .map(([r, d]) => <tr key={r}><td><b>{r}</b></td><td>{d}</td></tr>)}
        </Table>
      </section>
    </div>
  );
}

/** Interrupteurs de la plateforme (démo et API). */
function PlatformSwitches({ readOnly = false }) {
  const st = S.get();
  const [message, setMessage] = useState(st.platform.maintenanceMessage);
  const switches = S.BACKEND ? [...SWITCHES, ['adminMfaRequired', 'Double authentification obligatoire', 'Chaque membre de l’équipe doit utiliser un code à 6 chiffres pour accéder au back-office.']] : SWITCHES;
  const toggle = async (k) => {
    const v = !st.platform[k];
    if (k === 'maintenance' && v && !(await confirmAction({ title: 'Activer la maintenance', text: 'L’app et le site seront fermés au public jusqu’à ce que tu la désactives. L’équipe garde l’accès.', confirm: 'Activer', danger: true }))) return;
    if (k === 'adminMfaRequired' && v && !(await confirmAction({ title: 'Imposer la double authentification', text: 'Les membres sans 2FA devront la configurer à leur prochaine action dans le back-office. Active d’abord la tienne (section Sécurité).', confirm: 'Imposer' }))) return;
    S.setPlatform(k, v);
    toast(`${switches.find((x) => x[0] === k)[1]} : ${v ? 'activé' : 'désactivé'}`);
  };
  return (
    <section className="card" data-enter>
      <div className="card-head"><h2>Plateforme</h2>{readOnly ? <span className="muted small"><Icon name="lock" /> réservé aux administrateurs</span> : null}</div>
      <div className="switches">
        {switches.map(([k, l, d]) => (
          <div key={k} className={`switch-row ${k === 'maintenance' ? 'danger-zone' : ''}`}>
            <span><b>{l}</b><small>{d}</small></span>
            <button className="toggle" role="switch" aria-checked={!!st.platform[k]} data-sw={k} aria-label={l} disabled={readOnly} onClick={() => toggle(k)}><i /></button>
          </div>
        ))}
      </div>
      <div className="field">
        <label htmlFor="mm">Message affiché pendant la maintenance</label>
        <div className="row-input">
          <input id="mm" value={message} maxLength={120} disabled={readOnly} onChange={(e) => setMessage(e.target.value)} />
          <button className="btn btn-secondary btn-sm" data-mm disabled={readOnly || !message.trim()} onClick={() => { S.setPlatform('maintenanceMessage', message.trim()); toast('Message enregistré'); }}>Enregistrer</button>
        </div>
      </div>
    </section>
  );
}

/** Ma double authentification : activation (clé + premier code) ou désactivation (code actuel). */
function MySecurity() {
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = () => S.mfaStatus().then(setStatus, () => setStatus({ error: true }));
  useEffect(() => { load(); }, []);

  const run = async (fn, okText) => {
    setBusy(true); setError('');
    try {
      const r = await fn();
      if (r === 'bad-code') setError('Code incorrect.');
      else { toast(okText); setSetup(null); setCode(''); load(); }
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const start = async () => { setError(''); try { setSetup(await S.startMfaSetup()); } catch (e) { setError(errorMessage(e)); } };
  const codeOk = code.replace(/\s/g, '').length === 6;

  return (
    <section className="card" data-enter data-security>
      <div className="card-head"><h2>Ma sécurité</h2>{status?.enabled ? <Pill tone="good">2FA activée</Pill> : status ? <Pill tone={status.required ? 'bad' : 'neutral'}>2FA désactivée</Pill> : null}</div>
      {!status ? <p className="muted">Chargement…</p> : status.error ? <p className="muted">État indisponible.</p> : status.enabled ? (
        <>
          <p className="muted">Ton compte demande un code à 6 chiffres à chaque connexion (activée {S.timeAgo(status.enabledAt)}).</p>
          <div className="row-input">
            <input inputMode="numeric" maxLength={7} placeholder="Code actuel pour désactiver" aria-label="Code actuel" value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9 ]/g, ''))} />
            <button className="btn btn-ghost danger-text btn-sm" disabled={busy || !codeOk || status.required} onClick={() => run(() => S.disableMfa(code), 'Double authentification désactivée')}>Désactiver</button>
          </div>
          {status.required ? <p className="muted small">Obligatoire pour l’équipe : elle ne peut pas être désactivée.</p> : null}
        </>
      ) : setup ? (
        <>
          <p className="muted small">Dans ton application d’authentification (Google Authenticator, Authy, 1Password…), ajoute un compte avec cette clé, puis entre le code affiché.</p>
          <code className="secret">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
          <a className="link small" href={setup.otpauthUrl}>Ouvrir dans l’application (sur ce téléphone)</a>
          <div className="row-input">
            <input inputMode="numeric" maxLength={7} placeholder="123 456" aria-label="Code à 6 chiffres" value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9 ]/g, ''))} />
            <button className="btn btn-primary btn-sm" disabled={busy || !codeOk} onClick={() => run(() => S.enableMfa(code), 'Double authentification activée 🔐')}>Activer</button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">Protège ton compte : en plus du mot de passe, un code à 6 chiffres de ton téléphone sera demandé à chaque connexion.</p>
          <button className="btn btn-primary btn-sm" data-mfa-start onClick={start}><Icon name="key" /> Activer la double authentification</button>
        </>
      )}
      {error ? <p className="error small">{error}</p> : null}
    </section>
  );
}

/** Connexions au back-office (mot de passe puis code), réussies ou non. */
function LoginHistory({ isAll }) {
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { S.loginHistory({ limit: 50, ...(failed ? { failed: 1 } : {}) }).then((r) => setRows(r.logins), () => setRows([])); }, [failed]);
  return (
    <section className="card" data-enter data-logins>
      <div className="card-head"><h2>{isAll ? 'Connexions de l’équipe' : 'Mes connexions'}</h2>
        <label className="small muted"><input type="checkbox" checked={failed} onChange={(e) => setFailed(e.target.checked)} /> échecs seulement</label></div>
      {!rows ? <p className="muted">Chargement…</p> : (
        <Table head={['Date', 'Membre', 'Étape', 'Résultat', 'Adresse IP', 'Appareil']} empty="Aucune connexion enregistrée.">
          {rows.map((l) => (
            <tr key={l.id} className={l.success ? '' : 'row-alert'}>
              <td className="nowrap">{S.fmtDate(l.createdAt)}</td>
              <td>@{l.admin?.username}</td>
              <td>{l.step === 'mfa' ? 'Code 2FA' : 'Mot de passe'}</td>
              <td>{l.success ? <Pill tone="good">Réussie</Pill> : <Pill tone="bad">Échec</Pill>}</td>
              <td className="nowrap">{l.ip ?? '—'}</td>
              <td className="text-cell"><span className="clamp small muted">{l.userAgent ?? '—'}</span></td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}

function DemoSettings() {
  const st = S.get();
  const ref = useEnter();
  const navigate = useNavigate();
  const team = S.users().filter((u) => u.role !== 'user');

  const reset = async () => {
    if (!(await confirmAction({ title: 'Réinitialiser la démo', text: 'Toutes les actions faites dans ce navigateur seront effacées.', confirm: 'Réinitialiser', danger: true }))) return;
    S.resetDemo(); toast('Démo réinitialisée'); navigate('/');
  };

  return (
    <div className="view" ref={ref}>
      <PageHead title="Paramètres" sub="Interrupteurs de la plateforme, équipe et sécurité." />
      <PlatformSwitches />
      <section className="card" data-enter>
        <div className="card-head"><h2>Équipe ({team.length})</h2><Link className="link" to="/users">Ajouter depuis Utilisateurs</Link></div>
        <Table head={['Membre', 'Rôle', 'Dernière activité', '']}>
          {team.map((u) => <tr key={u.id} data-id={u.id}><td><UserCell user={u} sub={u.email} /></td><td><RolePill role={u.role} /></td><td>{S.timeAgo(u.lastActiveAt)}</td><td><MenuButton user={u} /></td></tr>)}
        </Table>
        <p className="muted small">Pour nommer un modérateur ou un administrateur : ouvre son profil dans Utilisateurs, puis « Rôle ».</p>
      </section>
      <section className="card" data-enter>
        <div className="card-head"><h2>Droits par rôle</h2></div>
        <Table head={['Action', 'Modérateur', 'Administrateur']}>
          {RIGHTS.map(([a, m, ad]) => <tr key={a}><td>{a}</td><td>{m ? <Icon name="check" className="ok-text" /> : '—'}</td><td>{ad ? <Icon name="check" className="ok-text" /> : '—'}</td></tr>)}
        </Table>
      </section>
      <section className="card danger-card" data-enter>
        <div className="card-head"><h2>Démo</h2></div>
        <p className="muted">Les données de ce back-office sont simulées dans le navigateur en attendant l’API (voir BACKEND.md). Tu peux tout remettre à zéro.</p>
        <button className="btn btn-secondary btn-sm" data-reset onClick={reset}><Icon name="restore" /> Réinitialiser les données de démo</button>
      </section>
    </div>
  );
}
