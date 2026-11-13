import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import * as S from './lib/store.js';
import { errorMessage } from './lib/api.js';
import { setNavigator } from './lib/nav.js';
import { toast } from './lib/toast.js';
import { useStore } from './lib/useStore.js';
import { closeMenu, closeModal, menu, MenuHost, ModalHost, Toaster } from './components/overlays.jsx';
import { Avatar, Icon, Logo } from './components/ui.jsx';
import Login from './views/Login.jsx';
import Dashboard from './views/Dashboard.jsx';
import Reports from './views/Reports.jsx';
import { BadingDetail, Badings } from './views/Badings.jsx';
import Comments from './views/Comments.jsx';
import Stickers from './views/Stickers.jsx';
import { UserDetail, Users } from './views/Users.jsx';
import Badges from './views/Badges.jsx';
import DataRequests from './views/DataRequests.jsx';
import Announcements from './views/Announcements.jsx';
import Moderation from './views/Moderation.jsx';
import Settings from './views/Settings.jsx';
import Audit from './views/Audit.jsx';

// Entrées du menu : [clé, chemin, icône, libellé, compteur éventuel].
const NAV = [
  ['Vue d’ensemble', [['dashboard', '/', 'dashboard', 'Tableau de bord']]],
  ['Modération', [
    ['reports', '/reports', 'flag', 'Signalements', () => S.openReports().length],
    ['badings', '/badings', 'quote', 'Badings'],
    ['comments', '/comments', 'message', 'Commentaires'],
    ['stickers', '/stickers', 'sticker', 'Stickers', () => S.get().reports.filter((r) => r.targetType === 'sticker' && r.status === 'open').length],
    ['moderation', '/moderation', 'shield', 'Mots interdits & règles'],
  ]],
  ['Communauté', [
    ['users', '/users', 'users', 'Utilisateurs'],
    ['badges', '/badges', 'badgeCheck', 'Badges vérifiés', () => S.pendingBadges().length],
    ['announcements', '/announcements', 'megaphone', 'Annonces'],
  ]],
  ['Conformité', [
    ['data', '/data', 'database', 'Données personnelles', () => S.pendingData().length],
    ['audit', '/audit', 'fileText', 'Journal d’audit'],
  ]],
  ['Plateforme', [['settings', '/settings', 'sliders', 'Paramètres']]],
];

// Écrans protégés : [chemin, composant, clé de droit].
const PAGES = [
  ['/', Dashboard, 'dashboard'],
  ['/reports', Reports, 'reports'],
  ['/badings', Badings, 'badings'],
  ['/badings/:id', BadingDetail, 'badings'],
  ['/comments', Comments, 'comments'],
  ['/stickers', Stickers, 'stickers'],
  ['/users', Users, 'users'],
  ['/users/:id', UserDetail, 'users'],
  ['/badges', Badges, 'badges'],
  ['/data', DataRequests, 'data'],
  ['/announcements', Announcements, 'announcements'],
  ['/moderation', Moderation, 'moderation'],
  ['/settings', Settings, 'settings'],
  ['/audit', Audit, 'audit'],
];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  useStore();

  useEffect(() => { setNavigator((path) => navigate(path)); }, [navigate]);
  // Changement de page : fenêtres et menus fermés, retour en haut.
  useEffect(() => {
    closeModal(true); closeMenu();
    document.body.classList.remove('nav-open');
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  return (
    <>
      <Routes>
        <Route path="/login" element={S.me() ? <Navigate to="/" replace /> : <main id="view"><Login /></main>} />
        <Route element={<RequireAuth />}>
          {PAGES.map(([path, Page, feature]) => (
            <Route key={path} path={path} element={<Allowed feature={feature}><Page /></Allowed>} />
          ))}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ModalHost />
      <MenuHost />
      <Toaster />
    </>
  );
}

/** Avec l'API, les écrans dont le serveur n'a pas encore les routes ne sont pas proposés. */
function Allowed({ feature, children }) {
  if (feature !== 'dashboard' && !S.can(feature)) return <Navigate to="/" replace />;
  return children;
}

function RequireAuth() {
  if (!S.me()) return <Navigate to="/login" replace />;
  return <Shell><DataGate><Outlet /></DataGate></Shell>;
}

/** Premières données pas encore reçues du serveur : écran d'attente, puis la page demandée. */
function DataGate({ children }) {
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const loaded = S.isLoaded();
  useEffect(() => {
    if (loaded) return undefined;
    let alive = true;
    setError(null);
    S.ensureLoaded().catch((e) => { if (alive) setError(e); });
    return () => { alive = false; };
  }, [loaded, attempt]);

  if (loaded) return children;
  if (error) {
    return (
      <div className="empty card"><Icon name="alert" /><h2>Impossible de charger les données</h2><p className="muted">{errorMessage(error)}</p>
        <button className="btn btn-secondary" data-retry onClick={() => setAttempt((n) => n + 1)}>Réessayer</button></div>
    );
  }
  return <div className="empty card" aria-busy="true"><Icon name="restore" /><h2>Chargement des données…</h2><p className="muted">Statistiques, utilisateurs, signalements et demandes de badge.</p></div>;
}

function Shell({ children }) {
  const st = useStore();
  const navigate = useNavigate();
  const me = S.me();
  const maint = st.platform.maintenance;
  const [reloading, setReloading] = useState(false);

  const reload = async () => {
    setReloading(true);
    try { await S.ensureLoaded(true); toast('Données à jour'); } catch (e) { toast(errorMessage(e), 'bad'); } finally { setReloading(false); }
  };
  const openAccount = async (e) => {
    const k = await menu(e.currentTarget, [
      { k: 'profile', icon: 'user', label: 'Mon profil' },
      S.can('audit') && { k: 'audit', icon: 'fileText', label: 'Mes actions' },
      '-',
      { k: 'logout', icon: 'logOut', label: 'Se déconnecter', danger: true },
    ]);
    if (k === 'profile') navigate(`/users/${me.id}`);
    if (k === 'audit') navigate(`/audit?actor=${me.id}`);
    if (k === 'logout') { S.logOut(); toast('À bientôt 👋'); navigate('/login'); }
  };

  return (
    <div className="shell">
      <aside className="side" aria-label="Navigation">
        <Link className="brand" to="/"><Logo size={30} /><span>on bade <em>admin</em></span></Link>
        <nav>
          {NAV.map(([group, items]) => [group, items.filter(([k]) => k === 'dashboard' || S.can(k))])
            .filter(([, items]) => items.length)
            .map(([group, items]) => (
              <Fragment key={group}>
                <p className="nav-group">{group}</p>
                {items.map(([k, href, ic, label, count]) => {
                  const n = count?.() ?? 0;
                  return (
                    <NavLink key={k} className="nav" data-nav={k} to={href} end={href === '/'}>
                      <Icon name={ic} /><span>{label}</span>{n ? <b className="count" data-count={k}>{n}</b> : null}
                    </NavLink>
                  );
                })}
              </Fragment>
            ))}
        </nav>
        <div className="side-foot"><span className={`dot-live ${maint ? 'off' : ''}`} />Plateforme <b data-live>{maint ? 'en maintenance' : 'en ligne'}</b></div>
      </aside>
      <div className="scrim-nav" data-close-nav onClick={() => document.body.classList.remove('nav-open')} />
      <div className="content">
        <header className="topbar">
          <button className="icon-btn only-mobile" data-open-nav aria-label="Menu" onClick={() => document.body.classList.add('nav-open')}><Icon name="menu" /></button>
          <GlobalSearch />
          {S.BACKEND ? <button className="icon-btn" data-reload aria-label="Actualiser les données" title="Actualiser les données" disabled={reloading} onClick={reload}><Icon name="restore" /></button> : null}
          <button className="me-btn" data-me aria-label="Mon compte" onClick={openAccount}>
            <Avatar user={me} size={34} />
            <span className="hide-sm"><b>@{me?.pseudo}</b><small>{S.ROLES[me?.role]}</small></span>
          </button>
        </header>
        {maint ? <div className="maintenance-banner" data-maint><Icon name="alert" /> Mode maintenance actif : l'app est fermée au public.</div> : null}
        <main id="view" className="page">{children}</main>
      </div>
    </div>
  );
}

/** Recherche globale : utilisateurs (pseudo, e-mail) et badings (texte, identifiant). Raccourci « / ». */
function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const input = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const out = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const slash = (e) => {
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName ?? '')) { e.preventDefault(); input.current?.focus(); }
    };
    document.addEventListener('click', out);
    document.addEventListener('keydown', slash);
    return () => { document.removeEventListener('click', out); document.removeEventListener('keydown', slash); };
  }, []);

  const term = q.trim().toLowerCase();
  const users = term.length < 2 ? [] : S.users().filter((u) => u.pseudo.toLowerCase().includes(term) || u.email.includes(term)).slice(0, 5);
  const badings = term.length < 2 ? [] : S.get().badings.filter((b) => b.id === term || b.text.toLowerCase().includes(term)).slice(0, 5);
  const first = users[0] ? `/users/${users[0].id}` : badings[0] ? `/badings/${badings[0].id}` : null;
  const pick = () => { setOpen(false); setQ(''); };

  return (
    <div className="search" role="search" ref={box}>
      <Icon name="search" />
      <input ref={input} data-search type="search" placeholder="Rechercher un utilisateur, un e-mail, un bading…" aria-label="Recherche globale"
        value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { pick(); e.currentTarget.blur(); }
          if (e.key === 'Enter' && first) { navigate(first); pick(); }
        }} />
      <div className="search-results" data-results hidden={!open || term.length < 2} onClick={pick}>
        {users.length || badings.length ? (
          <>
            {users.length ? <p>Utilisateurs</p> : null}
            {users.map((u) => <Link key={u.id} to={`/users/${u.id}`}><Avatar user={u} size={26} /><span>@{u.pseudo}<small>{u.email}</small></span></Link>)}
            {badings.length ? <p>Badings</p> : null}
            {badings.map((b) => (
              <Link key={b.id} to={`/badings/${b.id}`}><Icon name="quote" />
                <span>{b.text.slice(0, 70)}…<small>{b.id} · {b.anonymous ? 'anonyme' : `@${S.user(b.authorId)?.pseudo}`}</small></span></Link>
            ))}
          </>
        ) : <p className="none">Aucun résultat</p>}
      </div>
    </div>
  );
}
