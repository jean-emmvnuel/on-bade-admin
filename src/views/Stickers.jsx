import { Link } from 'react-router-dom';
import * as S from '../lib/store.js';
import { STICKERS } from '../lib/stickers.js';
import { toast } from '../lib/toast.js';
import { useStore } from '../lib/useStore.js';
import { useQuery } from '../lib/useQuery.js';
import { useEnter } from '../lib/motion.js';
import { confirmAction } from '../components/overlays.jsx';
import { Icon, PageHead, Pill, Sticker, StatusPill, UserCell } from '../components/ui.jsx';
import { sanctionDialog } from '../actions.jsx';

/** Stickers (F8) : ceux créés par les Badeurs (modérables) et la bibliothèque On Bade. */
export default function Stickers() {
  const st = useStore();
  const [{ tab }] = useQuery({ tab: 'custom' });
  const ref = useEnter([tab]);
  const list = Object.values(st.customStickers || {})
    .map((x) => ({ ...x, reports: S.reportsOn('sticker', x.id), uses: S.stickerUses(x.id) }))
    .sort((a, b) => b.reports.filter((r) => r.status === 'open').length - a.reports.filter((r) => r.status === 'open').length || b.createdAt - a.createdAt);
  const openReports = list.reduce((n, x) => n + x.reports.filter((r) => r.status === 'open').length, 0);

  return (
    <div className="view" ref={ref}>
      <PageHead title="Stickers" sub={`Comme sur TikTok, chaque Badeur crée ses stickers et enregistre ceux des autres (jusqu’à ${S.compact(st.rules.myStickersMax)} par collection). Un sticker retiré disparaît des collections et s’affiche « retiré » dans les commentaires.`} />
      <div className="tabs" role="tablist" data-enter>
        <Link role="tab" to="/stickers?tab=custom" aria-selected={tab === 'custom'}>Créés par les Badeurs ({list.length}){openReports ? <> <b className="count">{openReports}</b></> : null}</Link>
        <Link role="tab" to="/stickers?tab=builtin" aria-selected={tab === 'builtin'}>Bibliothèque On Bade ({STICKERS.length})</Link>
      </div>
      {tab === 'builtin' ? (
        <div className="sticker-grid builtin" data-enter>
          {STICKERS.map((x) => (
            <figure key={x.id}><Sticker id={x.id} size={104} /><figcaption>{x.label}<small>{x.theme === 'nouchi' ? 'Nouchi' : 'Réaction'} · {S.stickerUses(x.id)} utilisations</small></figcaption></figure>
          ))}
        </div>
      ) : (
        <div className="sticker-grid" data-enter>
          {list.length ? list.map((x) => <StickerCard key={x.id} item={x} />) : <p className="muted">Aucun sticker personnel pour l’instant.</p>}
        </div>
      )}
    </div>
  );
}

function StickerCard({ item: x }) {
  const open = x.reports.filter((r) => r.status === 'open');
  const saves = x.saves ?? 0;

  const act = async (k) => {
    const openIds = S.reportsOn('sticker', x.id).filter((r) => r.status === 'open').map((r) => r.id);
    if (k === 'remove') {
      const why = await confirmAction({ title: 'Retirer ce sticker partout', text: 'Il quitte toutes les collections et s’affiche « Sticker retiré par la modération » dans les commentaires.', confirm: 'Retirer', danger: true, reason: true, presets: ['Personne réelle exposée', 'Contenu choquant', 'Haine ou discrimination', 'Droits d’auteur'] });
      if (!why) return;
      S.setStickerStatus(x.id, 'removed', why);
      if (openIds.length) S.resolveReports(openIds, 'actioned', `Sticker retiré : ${why}`);
      toast('Sticker retiré');
    }
    if (k === 'restore') { S.setStickerStatus(x.id, 'visible', 'Rétabli'); toast('Sticker rétabli'); }
    if (k === 'dismiss') {
      const why = await confirmAction({ title: 'Classer sans suite', confirm: 'Classer', reason: true, reasonLabel: 'Décision', presets: ['Conforme à la charte', 'Signalement abusif'] });
      if (!why) return;
      S.resolveReports(openIds, 'dismissed', why); toast('Signalements classés');
    }
    if (k === 'sanction') await sanctionDialog(x.ownerId);
  };

  return (
    <article className={`card sticker-card ${open.length ? 'flagged' : ''}`} data-id={x.id}>
      <div className="sticker-prev"><Sticker id={x.id} size={120} /></div>
      <div className="sticker-meta">
        <b>{x.label ?? 'Sans nom'}</b><StatusPill status={x.status === 'removed' ? 'deleted' : 'visible'} />
        {open.length ? <Pill tone="bad">{open.length} signalement{open.length > 1 ? 's' : ''}</Pill> : null}
      </div>
      <UserCell user={S.user(x.ownerId)} sub={`créé ${S.timeAgo(x.createdAt)}`} />
      <p className="small muted">{x.uses} utilisation{x.uses > 1 ? 's' : ''} en commentaire · {saves} enregistrement{saves > 1 ? 's' : ''}</p>
      {open.length ? (
        <ul className="mini-list">
          {open.map((r) => <li key={r.id}><Pill tone="warn">{S.REASONS[r.reason] ?? r.reason}</Pill><small>par @{S.user(r.reporterId)?.pseudo} · {S.timeAgo(r.createdAt)}{r.details ? ` · « ${r.details} »` : ''}</small></li>)}
        </ul>
      ) : null}
      <footer>
        {x.status === 'removed'
          ? <button className="btn btn-secondary btn-sm" data-k="restore" onClick={() => act('restore')}><Icon name="restore" /> Rétablir</button>
          : <button className="btn btn-danger btn-sm" data-k="remove" onClick={() => act('remove')}><Icon name="trash" /> Retirer partout</button>}
        {open.length ? <button className="btn btn-ghost btn-sm" data-k="dismiss" onClick={() => act('dismiss')}>Classer</button> : null}
        <button className="btn btn-ghost btn-sm" data-k="sanction" onClick={() => act('sanction')}><Icon name="ban" /> Sanctionner</button>
      </footer>
    </article>
  );
}
