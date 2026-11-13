import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as S from '../lib/store.js';
import { errorMessage } from '../lib/api.js';
import { toast } from '../lib/toast.js';
import { useStore } from '../lib/useStore.js';
import { useQuery } from '../lib/useQuery.js';
import { useEnter } from '../lib/motion.js';
import { Avatar, Icon, PageHead, Sticker, StatusPill, Table, useDebouncedField, UserCell } from '../components/ui.jsx';
import { badingAction, badingMenu, commentAction, revealDialog } from '../actions.jsx';
import { Pager } from './Pager.jsx';

const PAGE = 15;

export function Badings() {
  const st = useStore();
  const navigate = useNavigate();
  const [f, set] = useQuery({ q: '', status: 'all', kind: 'all', sort: 'recent', page: 1 });
  const [search, setSearch] = useDebouncedField(f.q, (q) => set({ q }));
  const ref = useEnter();

  const q = f.q.toLowerCase();
  const list = st.badings.filter((b) =>
    (f.status === 'all' || b.status === f.status)
    && (f.kind === 'all' || (f.kind === 'image' ? !!b.image : f.kind === 'anon' ? b.anonymous : f.kind === 'reported' ? b.reportsCount > 0 || S.reportsOn('bading', b.id).length : !b.anonymous))
    && (!q || b.text.toLowerCase().includes(q) || b.id === f.q || S.user(b.authorId)?.pseudo.toLowerCase().includes(q)));
  list.sort(f.sort === 'likes' ? (a, b) => b.likes - a.likes
    : f.sort === 'reports' ? (a, b) => S.reportsOn('bading', b.id).length - S.reportsOn('bading', a.id).length
      : (a, b) => b.createdAt - a.createdAt);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const rows = list.slice((f.page - 1) * PAGE, f.page * PAGE);
  const counts = { all: st.badings.length, visible: 0, hidden: 0, deleted: 0 };
  st.badings.forEach((b) => { counts[b.status] += 1; });

  return (
    <div className="view" ref={ref}>
      <PageHead title="Badings" sub={`${counts.visible} en ligne · ${counts.hidden} masqués · ${counts.deleted} supprimés`} />
      <div className="toolbar card" data-enter>
        <div className="search-inline"><Icon name="search" /><input data-q type="search" placeholder="Texte, pseudo ou identifiant…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select data-f="status" aria-label="Statut" value={f.status} onChange={(e) => set({ status: e.target.value })}>
          {[['all', 'Tous les statuts'], ['visible', 'Visibles'], ['hidden', 'Masqués'], ['deleted', 'Supprimés']].map(([v, l]) => <option key={v} value={v}>{l} ({counts[v]})</option>)}
        </select>
        <select data-f="kind" aria-label="Type" value={f.kind} onChange={(e) => set({ kind: e.target.value })}>
          {[['all', 'Tous les types'], ['signed', 'Signés'], ['anon', 'Anonymes'], ['image', 'Avec image'], ['reported', 'Signalés']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select data-f="sort" aria-label="Tri" value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
          {[['recent', 'Plus récents'], ['likes', 'Plus de rires'], ['reports', 'Plus signalés']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div data-enter>
        <Table head={['Bading', 'Auteur', 'Réactions', 'Signal.', 'Statut', 'Publié', '']} empty="Aucun bading ne correspond.">
          {rows.map((b) => {
            const rep = S.reportsOn('bading', b.id).length;
            return (
              <tr key={b.id} data-id={b.id} className="clickable" onClick={() => navigate(`/badings/${b.id}`)}>
                <td className="text-cell"><span className="with-thumb">{b.image ? <img className="thumb" src={b.image.src} alt="Image du bading" /> : null}<span className="clamp">{b.text || <em className="muted">Image sans légende</em>}</span></span></td>
                <td>{b.anonymous ? <span className="who"><Avatar user={null} size={32} /><span><b>Anonyme</b><small><Icon name="lock" /> coffre</small></span></span> : <UserCell user={S.user(b.authorId)} />}</td>
                <td className="num">😂 {S.compact(b.likes)}<small>{b.rebades} rebades · {b.shares} partages</small></td>
                <td className="num">{rep ? <span className="flag-n"><Icon name="flag" /> {rep}</span> : '—'}</td>
                <td><StatusPill status={b.status} /></td>
                <td className="nowrap">{S.timeAgo(b.createdAt)}</td>
                <td><button className="icon-btn" data-menu aria-label="Actions" onClick={(e) => { e.stopPropagation(); badingMenu(e.currentTarget, b); }}><Icon name="ellipsis" /></button></td>
              </tr>
            );
          })}
        </Table>
      </div>
      <Pager page={f.page} pages={pages} total={list.length} unit="badings" onPage={(page) => set({ page })} />
    </div>
  );
}

export function BadingDetail() {
  const { id } = useParams();
  const st = useStore();
  const ref = useEnter([id]);

  // Avec l'API : commentaires chargés à la première ouverture ; le store prévient l'écran quand ils arrivent.
  useEffect(() => {
    S.loadBadingDetail(id).catch((e) => toast(errorMessage(e, 'Commentaires indisponibles'), 'bad'));
  }, [id]);

  const b = S.bading(id);
  if (!b) {
    return <div className="view"><PageHead title="Bading introuvable" /><Link className="btn btn-secondary" to="/badings">Retour aux badings</Link></div>;
  }
  const u = S.user(b.authorId);
  const reports = S.reportsOn('bading', b.id);
  const comments = S.commentsOf(b.id).sort((a, c) => c.createdAt - a.createdAt);
  const history = st.audit.filter((l) => l.target === b.id);

  const actions = (
    <>
      <StatusPill status={b.status} />
      {!S.can('hide') ? null : b.status === 'visible'
        ? <button className="btn btn-secondary btn-sm" data-a="hide" onClick={() => badingAction('hide', b)}><Icon name="eyeOff" /> Masquer</button>
        : <button className="btn btn-secondary btn-sm" data-a="restore" onClick={() => badingAction('restore', b)}><Icon name="restore" /> Rétablir</button>}
      {b.anonymous && S.can('reveal') ? <button className="btn btn-secondary btn-sm" data-a="reveal" onClick={() => revealDialog(b)}><Icon name="key" /> Révéler l’auteur</button> : null}
      {S.can('pin') && b.status === 'visible'
        ? <button className="btn btn-secondary btn-sm" data-a={b.pinned ? 'unpin' : 'pin'} onClick={() => badingAction(b.pinned ? 'unpin' : 'pin', b)}><Icon name="trendingUp" /> {b.pinned ? 'Désépingler' : 'Épingler'}</button>
        : null}
      {b.status !== 'deleted' ? <button className="btn btn-danger btn-sm" data-a="delete" onClick={() => badingAction('delete', b)}><Icon name="trash" /> Supprimer</button> : null}
    </>
  );

  return (
    <div className="view" ref={ref}>
      <Link className="back" to="/badings"><Icon name="arrowLeft" /> Badings</Link>
      <PageHead title={`Bading ${b.id}`} sub={`Publié le ${S.fmtDate(b.createdAt)}`} actions={actions} />
      <div className="grid-detail">
        <div>
          <article className="card bading-card" data-enter>
            <div className="who-row">
              {b.anonymous
                ? <><Avatar user={null} size={44} /><div><b>Badeur anonyme</b><small><Icon name="lock" /> Auteur protégé par le coffre d’anonymat</small></div></>
                : <><Avatar user={u} size={44} /><div><b><Link to={`/users/${b.authorId}`}>@{u?.pseudo ?? 'inconnu'}</Link></b><small>{u?.email ?? ''}</small></div></>}
            </div>
            {b.text ? <p className="story">{b.text}</p> : null}
            {b.image ? (
              <figure className="detail-img" style={{ aspectRatio: `${b.image.width}/${b.image.height}` }}>
                <img src={b.image.src} alt="Image du bading" />
                <figcaption>{b.image.width === b.image.height ? 'Carré 1:1' : 'Portrait 4:5'} · {b.image.width}×{b.image.height}</figcaption>
              </figure>
            ) : null}
            {b.hiddenReason ? <p className="alert warn"><Icon name="eyeOff" /> {b.hiddenReason}</p> : null}
            {b.pinned ? <p className="alert" data-pinned><Icon name="trendingUp" /> Épinglé en tête du fil{b.pinned.label ? ` · « ${b.pinned.label} »` : ''}{b.pinned.until ? ` · jusqu’au ${S.fmtDate(b.pinned.until)}` : ' · jusqu’au retrait'}</p> : null}
            <div className="stats-row">
              <span><b>{S.fmt(b.likes)}</b> rires</span><span><b>{b.rebades}</b> rebades</span><span><b>{b.shares}</b> partages</span>
              <span><b>{Math.max(comments.length, b.commentCount ?? 0)}</b> commentaires</span>
              {b.views ? <span><b>{S.fmt(b.views)}</b> vues</span> : null}
            </div>
          </article>
          <section className="card" data-enter>
            <div className="card-head"><h2>Commentaires ({comments.length})</h2></div>
            {comments.length ? (
              <ul className="comment-list">
                {comments.map((c) => {
                  const deleted = c.status === 'deleted';
                  return (
                    <li key={c.id} className={deleted ? 'is-deleted' : ''}>
                      <Avatar user={S.user(c.authorId)} size={32} />
                      <div>
                        <b><Link to={`/users/${c.authorId}`}>@{S.user(c.authorId)?.pseudo}</Link></b> <small>{S.timeAgo(c.createdAt)} · 😂 {c.likes}</small>
                        {deleted ? <> <StatusPill status="deleted" /></> : null}
                        {c.sticker ? <div className="c-stk"><Sticker id={c.sticker} size={84} /></div> : <p>{c.text}</p>}
                      </div>
                      {deleted && !S.can('restoreComment') ? null : (
                        <button className="btn btn-ghost btn-sm" data-c={c.id} data-k={deleted ? 'restore' : 'delete'} onClick={() => commentAction(deleted ? 'restore' : 'delete', c)}>{deleted ? 'Rétablir' : 'Supprimer'}</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="muted">Aucun commentaire.</p>}
          </section>
        </div>
        <aside>
          <section className="card" data-enter>
            <div className="card-head"><h2>Signalements ({reports.length})</h2>{reports.some((r) => r.status === 'open') ? <Link className="link" to="/reports">Traiter</Link> : null}</div>
            {reports.length ? (
              <ul className="mini-list">
                {reports.map((r) => (
                  <li key={r.id}><StatusPill status={r.status} /> <b>{S.REASONS[r.reason] ?? r.reason}</b><small>par @{S.user(r.reporterId)?.pseudo} · {S.timeAgo(r.createdAt)}</small>{r.details ? <p>« {r.details} »</p> : null}</li>
                ))}
              </ul>
            ) : <p className="muted">Aucun signalement.</p>}
          </section>
          {S.BACKEND && !S.can('audit') ? null : (
            <section className="card" data-enter>
              <div className="card-head"><h2>Historique de modération</h2></div>
              {history.length ? (
                <ul className="mini-list">{history.map((l) => <li key={l.id}><b>{l.detail}</b><small>@{S.user(l.actor)?.pseudo ?? (l.actor === 'system' ? 'automatique' : 'équipe')} · {S.fmtDate(l.at)}</small></li>)}</ul>
              ) : <p className="muted">Aucune action pour l’instant.</p>}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
