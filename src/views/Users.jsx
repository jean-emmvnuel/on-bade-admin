import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as S from '../lib/store.js';
import { useStore } from '../lib/useStore.js';
import { useQuery } from '../lib/useQuery.js';
import { useEnter } from '../lib/motion.js';
import { Avatar, Icon, PageHead, Pill, StatusPill, Table, useDebouncedField, UserCell, Verified } from '../components/ui.jsx';
import { badingMenu, userAction, userMenu } from '../actions.jsx';
import { Pager } from './Pager.jsx';

const PAGE = 15;
const RoleCell = ({ role }) => (role === 'user' ? <span className="muted">Utilisateur</span> : <Pill tone={role === 'admin' ? 'brand' : 'info'}>{S.ROLES[role]}</Pill>);

export function Users() {
  useStore();
  const navigate = useNavigate();
  const [f, set] = useQuery({ q: '', status: 'all', role: 'all', sort: 'recent', page: 1 });
  const [search, setSearch] = useDebouncedField(f.q, (q) => set({ q }));
  const ref = useEnter();

  const all = S.users();
  const posts = (u) => u.counts?.posts ?? S.badingsOf(u.id).filter((b) => b.status !== 'deleted').length;
  const q = f.q.toLowerCase();
  const list = all.filter((u) =>
    (f.status === 'all' || (f.status === 'verified' ? u.verified : u.status === f.status))
    && (f.role === 'all' || u.role === f.role)
    && (!q || u.pseudo.toLowerCase().includes(q) || u.email.includes(q)));
  list.sort(f.sort === 'active' ? (a, b) => b.lastActiveAt - a.lastActiveAt
    : f.sort === 'posts' ? (a, b) => posts(b) - posts(a)
      : f.sort === 'sanctions' ? (a, b) => b.sanctions.length - a.sanctions.length
        : (a, b) => b.joinedAt - a.joinedAt);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const n = (fn) => all.filter(fn).length;

  return (
    <div className="view" ref={ref}>
      <PageHead title="Utilisateurs" sub={`${all.length} comptes · ${n((u) => u.status === 'suspended')} suspendus · ${n((u) => u.status === 'banned')} bannis · ${n((u) => u.role !== 'user')} dans l’équipe`} />
      <div className="toolbar card" data-enter>
        <div className="search-inline"><Icon name="search" /><input data-q type="search" placeholder="Pseudo ou e-mail…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select data-f="status" aria-label="Statut" value={f.status} onChange={(e) => set({ status: e.target.value })}>
          {[['all', 'Tous les statuts'], ['active', 'Actifs'], ['suspended', 'Suspendus'], ['banned', 'Bannis'], ...(S.BACKEND ? [] : [['deleted', 'Supprimés']]), ['verified', 'Vérifiés']]
            .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select data-f="role" aria-label="Rôle" value={f.role} onChange={(e) => set({ role: e.target.value })}>
          <option value="all">Tous les rôles</option>
          {Object.entries(S.ROLES).map(([v, l]) => <option key={v} value={v}>{l}s</option>)}
        </select>
        <select data-f="sort" aria-label="Tri" value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
          {[['recent', 'Inscription récente'], ...(S.BACKEND ? [] : [['active', 'Dernière activité']]), ['posts', 'Plus de badings'], ['sanctions', 'Plus de sanctions']]
            .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div data-enter>
        <Table head={['Utilisateur', 'Rôle', 'Badings', 'Sanctions', 'Statut', 'Inscrit', S.BACKEND ? 'Points' : 'Actif', '']} empty="Aucun compte ne correspond.">
          {list.slice((f.page - 1) * PAGE, f.page * PAGE).map((u) => (
            <tr key={u.id} data-id={u.id} className="clickable" onClick={() => navigate(`/users/${u.id}`)}>
              <td><UserCell user={u} sub={u.email} /></td>
              <td><RoleCell role={u.role} /></td>
              <td className="num">{posts(u)}</td>
              <td className="num">{u.sanctions.length || '—'}</td>
              <td><StatusPill status={u.status} /></td>
              <td className="nowrap">{new Date(u.joinedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</td>
              <td className="nowrap">{S.BACKEND ? S.fmt(u.points ?? 0) : S.timeAgo(u.lastActiveAt)}</td>
              <td><button className="icon-btn" data-menu aria-label="Actions" onClick={(e) => { e.stopPropagation(); userMenu(e.currentTarget, u); }}><Icon name="ellipsis" /></button></td>
            </tr>
          ))}
        </Table>
      </div>
      <Pager page={f.page} pages={pages} total={list.length} unit="comptes" onPage={(page) => set({ page })} />
    </div>
  );
}

export function UserDetail() {
  const { id } = useParams();
  const st = useStore();
  const navigate = useNavigate();
  const ref = useEnter([id]);

  // Avec l'API : historique complet des blocages chargé à la première ouverture.
  useEffect(() => { S.loadUserDetail(id).catch(() => {}); }, [id]);

  const u = S.user(id);
  if (!u) return <div className="view"><PageHead title="Compte introuvable" /><Link className="btn btn-secondary" to="/users">Retour</Link></div>;

  const isMe = u.id === S.me().id;
  const badings = S.badingsOf(u.id).sort((a, b) => b.createdAt - a.createdAt);
  const laughs = badings.reduce((n, b) => n + b.likes, 0);
  const reportsAgainst = st.reports.filter((r) => (r.targetType === 'user' && r.targetId === u.id)
    || (r.targetType === 'bading' && S.bading(r.targetId)?.authorId === u.id)
    || (r.targetType === 'comment' && S.comment(r.targetId)?.authorId === u.id));
  const log = st.audit.filter((l) => l.target === u.id || l.actor === u.id).slice(0, 12);
  const badge = st.badgeRequests.filter((g) => g.userId === u.id);
  const btn = (k, cls, icon, label) => <button className={`btn ${cls} btn-sm`} data-k={k} onClick={() => userAction(k, u)}><Icon name={icon} /> {label}</button>;

  return (
    <div className="view" ref={ref}>
      <Link className="back" to="/users"><Icon name="arrowLeft" /> Utilisateurs</Link>
      <section className="card profile-head" data-enter>
        <Avatar user={u} size={72} />
        <div className="profile-id">
          <h1>@{u.pseudo} {u.verified ? <Verified /> : null}</h1>
          <p className="muted">
            {u.email} · inscrit le {new Date(u.joinedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            {S.BACKEND ? `${u.firstName ? ` · ${u.firstName} ${u.lastName ?? ''}` : ''} · ${S.fmt(u.points ?? 0)} points · ${u.lastActiveAt ? `actif ${S.timeAgo(u.lastActiveAt)}` : 'pas d’activité récente'}` : ` · actif ${S.timeAgo(u.lastActiveAt)}`}
          </p>
          <p>
            <StatusPill status={u.status} /> <Pill tone={u.role === 'admin' ? 'brand' : u.role === 'moderator' ? 'info' : 'neutral'}>{S.ROLES[u.role]}</Pill>
            {u.suspendedUntil ? <> <span className="muted small">jusqu’au {S.fmtDate(u.suspendedUntil)}</span></> : null}
            {isMe ? <> <span className="muted small">(c’est toi)</span></> : null}
          </p>
        </div>
        <div className="profile-actions">
          {!isMe && u.status === 'active' ? btn('sanction', 'btn-danger', 'ban', 'Sanctionner') : null}
          {!isMe && ['suspended', 'banned'].includes(u.status) ? btn('lift', 'btn-secondary', 'restore', 'Lever la sanction') : null}
          {S.canManageBadges() ? btn('badge', 'btn-secondary', 'badgeCheck', u.verified ? 'Retirer le badge' : 'Attribuer le badge') : null}
          {!isMe ? btn('role', 'btn-secondary', 'shield', 'Rôle') : null}
          {S.can('pseudo') ? btn('pseudo', 'btn-secondary', 'userPen', 'Pseudo') : null}
          {S.can('message') && !isMe ? btn('message', 'btn-secondary', 'megaphone', 'Message') : null}
          {btn('reset', 'btn-secondary', 'key', 'Mot de passe')}
          {S.BACKEND && S.can('export') ? btn('export', 'btn-secondary', 'download', 'Données') : null}
          {S.can('deleteUser') && !isMe && u.status !== 'deleted' ? btn('delete', 'btn-ghost danger-text', 'trash', 'Supprimer') : null}
        </div>
      </section>
      <section className="kpis small" data-enter>
        <div className="kpi card"><span className="kpi-top"><Icon name="quote" /><span>Badings</span></span><b>{u.counts?.posts ?? badings.length}</b>
          <span className="kpi-sub">{u.counts ? `${S.fmt(u.counts.comments)} commentaires` : `dont ${badings.filter((b) => b.anonymous).length} anonymes`}</span></div>
        <div className="kpi card"><span className="kpi-top"><Icon name="laugh" /><span>Rires reçus</span></span><b>{S.fmt(laughs)}</b></div>
        <div className="kpi card"><span className="kpi-top"><Icon name="flag" /><span>{u.counts ? 'Signalements envoyés' : 'Signalements reçus'}</span></span><b>{u.counts ? u.counts.reports : reportsAgainst.length}</b></div>
        <div className="kpi card"><span className="kpi-top"><Icon name="ban" /><span>Sanctions</span></span><b>{u.sanctions.length}</b></div>
      </section>
      <div className="grid-detail">
        <section className="card" data-enter>
          <div className="card-head"><h2>Badings ({badings.length})</h2><span className="muted small"><Icon name="lock" /> {S.BACKEND ? 'badings signés (les anonymes restent au coffre)' : 'les anonymes ne sont visibles qu’ici'}</span></div>
          {badings.length ? (
            <Table head={['Bading', 'Réactions', 'Statut', '']}>
              {badings.slice(0, 20).map((b) => (
                <tr key={b.id} data-b={b.id} className="clickable" onClick={() => navigate(`/badings/${b.id}`)}>
                  <td className="text-cell"><span className="clamp">{b.anonymous ? <><span className="pill neutral">Anonyme</span> </> : null}{b.text}</span></td>
                  <td className="num">😂 {S.compact(b.likes)}</td>
                  <td><StatusPill status={b.status} /></td>
                  <td><button className="icon-btn" data-menu aria-label="Actions" onClick={(e) => { e.stopPropagation(); badingMenu(e.currentTarget, b); }}><Icon name="ellipsis" /></button></td>
                </tr>
              ))}
            </Table>
          ) : <p className="muted">Aucun bading.</p>}
        </section>
        <aside>
          <section className="card" data-enter>
            <div className="card-head"><h2>Sanctions</h2></div>
            {u.sanctions.length ? (
              <ul className="mini-list">
                {[...u.sanctions].reverse().map((s, i) => (
                  <li key={`${s.at}-${i}`}>
                    <Pill tone={s.level === 3 ? 'bad' : 'warn'}>Niveau {s.level}</Pill> <b>{S.SANCTIONS[s.level]}</b>
                    <small>{s.reason} · par @{S.actor(s.by)?.pseudo ?? 'équipe'} · {S.timeAgo(s.at)}{s.until ? ` · jusqu’au ${S.fmtDate(s.until)}` : ''}{s.revokedAt ? ' · levée' : ''}</small>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">Aucune sanction.</p>}
          </section>
          {badge.length ? (
            <section className="card" data-enter>
              <div className="card-head"><h2>Demandes de badge</h2></div>
              <ul className="mini-list">{badge.map((g) => <li key={g.id}><StatusPill status={g.status} /> <small>{S.timeAgo(g.createdAt)}{g.reason ? ` · ${g.reason}` : ''}</small></li>)}</ul>
            </section>
          ) : null}
          {S.can('audit') ? (
            <section className="card" data-enter>
              <div className="card-head"><h2>Activité liée</h2><Link className="link" to={`/audit?target=${u.id}`}>Tout voir</Link></div>
              {log.length ? (
                <ul className="mini-list">{log.map((l) => <li key={l.id}><b>{l.detail}</b><small>@{S.user(l.actor)?.pseudo ?? 'équipe'} · {S.fmtDate(l.at)}</small></li>)}</ul>
              ) : <p className="muted">Rien pour l’instant.</p>}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
