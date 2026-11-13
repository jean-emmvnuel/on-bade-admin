import { Link } from 'react-router-dom';
import * as S from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { useStore } from '../lib/useStore.js';
import { useQuery } from '../lib/useQuery.js';
import { useEnter } from '../lib/motion.js';
import { confirmAction } from '../components/overlays.jsx';
import { Empty, Icon, PageHead, Pill, StatusPill, UserCell } from '../components/ui.jsx';
import { badingAction, commentAction, sanctionDialog, TargetPreview } from '../actions.jsx';

const TYPE_LABEL = { bading: 'Bading', comment: 'Commentaire', user: 'Compte', sticker: 'Sticker personnel' };

const authorOf = (type, id) => (type === 'bading' ? S.bading(id)?.authorId : type === 'comment' ? S.comment(id)?.authorId : type === 'sticker' ? S.customSticker(id)?.ownerId : id);
const contentStatus = (type, id) => (type === 'bading' ? S.bading(id)?.status : type === 'comment' ? S.comment(id)?.status
  : type === 'sticker' ? (S.customSticker(id)?.status === 'removed' ? 'deleted' : 'visible') : S.user(id)?.status);

/** File des signalements : regroupés par contenu signalé, du plus signalé au moins signalé. */
export default function Reports() {
  const st = useStore();
  const [{ tab }] = useQuery({ tab: 'open' });
  const ref = useEnter([tab]);
  const list = st.reports.filter((r) => (tab === 'all' ? true : tab === 'open' ? r.status === 'open' : r.status !== 'open'));
  const groups = Object.values(list.reduce((acc, r) => {
    const k = `${r.targetType}:${r.targetId}`;
    (acc[k] ||= { type: r.targetType, id: r.targetId, reports: [] }).reports.push(r);
    return acc;
  }, {})).sort((a, b) => b.reports.length - a.reports.length || Math.max(...b.reports.map((r) => r.createdAt)) - Math.max(...a.reports.map((r) => r.createdAt)));

  return (
    <div className="view" ref={ref}>
      <PageHead title="Signalements" sub={S.BACKEND ? 'Regroupés par contenu signalé. L’équipe voit l’auteur réel, même d’un bading anonyme.' : `Masquage automatique dès ${st.rules.autoHideThreshold} signalements sur un même contenu. Chaque décision est journalisée.`} />
      <div className="tabs" role="tablist" data-enter>
        {[['open', 'À traiter', S.openReports().length], ['done', 'Traités'], ['all', 'Tous']].map(([k, l, n]) => (
          <Link key={k} role="tab" to={`/reports?tab=${k}`} aria-selected={tab === k}>{l}{n ? <> <b className="count">{n}</b></> : null}</Link>
        ))}
      </div>
      {groups.length
        ? groups.map((g) => <ReportGroup key={`${g.type}:${g.id}`} group={g} />)
        : <Empty icon="circleCheck" title={tab === 'open' ? 'Rien à traiter 🎉' : 'Aucun signalement ici'}><p className="muted">{tab === 'open' ? 'La communauté rigole tranquille.' : ''}</p></Empty>}
    </div>
  );
}

function ReportGroup({ group: g }) {
  const st = S.get();
  const open = g.reports.filter((r) => r.status === 'open');
  const author = S.user(authorOf(g.type, g.id));
  const status = contentStatus(g.type, g.id);
  const { type, id } = g;

  const act = async (action) => {
    const ids = S.get().reports.filter((r) => r.targetType === type && r.targetId === id && r.status === 'open').map((r) => r.id);
    if (action === 'dismiss') {
      const why = await confirmAction({ title: 'Classer sans suite', text: 'Le contenu reste en ligne. Les personnes qui ont signalé sont prévenues que le contenu respecte la charte.', confirm: 'Classer', reason: true, reasonLabel: 'Décision', presets: ['Humour sans cible, conforme à la charte', 'Signalement abusif', 'Doublon'] });
      if (!why) return;
      if (type === 'bading' && S.bading(id)?.status === 'hidden') S.setBadingStatus(id, 'visible', 'Rétabli après examen');
      S.resolveReports(ids, 'dismissed', why); toast('Signalement classé');
      return;
    }
    if (action === 'unsticker') {
      const why = await confirmAction({ title: 'Retirer ce sticker partout', text: 'Il quitte toutes les collections et s’affiche « Sticker retiré par la modération » dans les commentaires.', confirm: 'Retirer', danger: true, reason: true, presets: ['Personne réelle exposée', 'Contenu choquant', 'Haine ou discrimination'] });
      if (!why) return;
      S.setStickerStatus(id, 'removed', why); S.resolveReports(ids, 'actioned', `Sticker retiré : ${why}`); toast('Sticker retiré');
      return;
    }
    if (action === 'sanction') {
      const lvl = await sanctionDialog(authorOf(type, id));
      if (!lvl) return;
      S.resolveReports(ids, 'actioned', `Auteur sanctionné : ${S.SANCTIONS[lvl]}`);
      if (type === 'bading') S.setBadingStatus(id, 'deleted', 'Supprimé avec la sanction');
      if (type === 'comment') S.setCommentStatus(id, 'deleted', 'Supprimé avec la sanction');
      if (type === 'sticker') S.setStickerStatus(id, 'removed', 'Retiré avec la sanction');
      return;
    }
    if (action === 'keep') {
      const why = await confirmAction({ title: 'Garder ce bading masqué', text: 'Il reste invisible dans l’app et peut être rétabli plus tard depuis Badings.', confirm: 'Confirmer', reason: true, reasonLabel: 'Décision', presets: ['Contraire à la charte', 'Personne réelle exposée'] });
      if (!why) return;
      S.setBadingStatus(id, 'hidden', why); S.resolveReports(ids, 'actioned', `Masquage confirmé : ${why}`); toast('Masquage confirmé');
      return;
    }
    const done = type === 'bading' ? await badingAction(action, S.bading(id)) : await commentAction('delete', S.comment(id));
    if (done) S.resolveReports(ids, 'actioned', action === 'hide' ? 'Contenu masqué' : 'Contenu supprimé');
  };

  return (
    <article className="card report" data-enter data-key={`${type}:${id}`}>
      <header className="report-head">
        <span className={`report-count ${g.reports.length >= st.rules.autoHideThreshold ? 'hot' : ''}`}><Icon name="flag" /> {g.reports.length}</span>
        <span>{TYPE_LABEL[type]} {status ? <StatusPill status={status} /> : null}</span>
        <span className="spacer" />
        {author && type !== 'user' ? (
          <span className="muted small">Auteur : <Link to={`/users/${author.id}`}>@{author.pseudo}</Link>{S.bading(id)?.anonymous ? ' (anonyme, visible admin)' : ''} · {author.sanctions.length} sanction(s)</span>
        ) : null}
      </header>
      <TargetPreview type={type} id={id} />
      <ul className="report-list">
        {g.reports.map((r) => (
          <li key={r.id}>
            <UserCell user={S.user(r.reporterId)} sub={S.timeAgo(r.createdAt)} />
            <span><Pill tone="warn">{S.REASONS[r.reason] ?? r.reason}</Pill>{r.details ? <> <span className="muted">« {r.details} »</span></> : null}</span>
            {r.status !== 'open' ? <span className="decision"><StatusPill status={r.status} /> {r.decision ?? ''}</span> : null}
          </li>
        ))}
      </ul>
      {open.length ? (
        <footer className="report-actions">
          <button className="btn btn-ghost btn-sm" data-act="dismiss" onClick={() => act('dismiss')}><Icon name="check" /> Classer sans suite</button>
          {type === 'bading' && S.can('hide') ? (status === 'hidden'
            ? <button className="btn btn-secondary btn-sm" data-act="keep" onClick={() => act('keep')}><Icon name="eyeOff" /> Garder masqué</button>
            : <button className="btn btn-secondary btn-sm" data-act="hide" onClick={() => act('hide')}><Icon name="eyeOff" /> Masquer</button>) : null}
          {type === 'sticker' && status !== 'deleted' ? <button className="btn btn-secondary btn-sm" data-act="unsticker" onClick={() => act('unsticker')}><Icon name="trash" /> Retirer le sticker partout</button> : null}
          {['bading', 'comment'].includes(type) && status !== 'deleted' ? <button className="btn btn-secondary btn-sm" data-act="delete" onClick={() => act('delete')}><Icon name="trash" /> Supprimer le contenu</button> : null}
          <button className="btn btn-danger btn-sm" data-act="sanction" onClick={() => act('sanction')}><Icon name="ban" /> Sanctionner {type === 'user' ? 'le compte' : 'l’auteur'}</button>
        </footer>
      ) : null}
    </article>
  );
}
