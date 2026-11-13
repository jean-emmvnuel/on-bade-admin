import { Link } from 'react-router-dom';
import * as S from '../lib/store.js';
import { useStore } from '../lib/useStore.js';
import { useQuery } from '../lib/useQuery.js';
import { useEnter } from '../lib/motion.js';
import { menu } from '../components/overlays.jsx';
import { Icon, PageHead, Sticker, StatusPill, Table, useDebouncedField, UserCell } from '../components/ui.jsx';
import { commentAction } from '../actions.jsx';

export default function Comments() {
  const st = useStore();
  const [f, set] = useQuery({ q: '', status: 'all' });
  const [search, setSearch] = useDebouncedField(f.q, (q) => set({ q }));
  const ref = useEnter();

  const q = f.q.toLowerCase();
  const list = st.comments
    .filter((c) => (f.status === 'all' || (f.status === 'sticker' ? !!c.sticker : c.status === f.status))
      && (!q || c.text.toLowerCase().includes(q) || S.user(c.authorId)?.pseudo.toLowerCase().includes(q)))
    .sort((a, b) => S.reportsOn('comment', b.id).length - S.reportsOn('comment', a.id).length || b.createdAt - a.createdAt)
    .slice(0, 60);

  const openMenu = async (e, c) => {
    const k = await menu(e.currentTarget, [
      { k: 'author', icon: 'user', label: 'Voir l’auteur' },
      { k: 'sanction', icon: 'ban', label: 'Sanctionner l’auteur' },
      '-',
      c.status === 'deleted' ? { k: 'restore', icon: 'restore', label: 'Rétablir' } : { k: 'delete', icon: 'trash', label: 'Supprimer', danger: true },
    ]);
    if (k) commentAction(k, c);
  };

  return (
    <div className="view" ref={ref}>
      <PageHead title="Commentaires" sub="Les commentaires signalés apparaissent en premier." />
      <div className="toolbar card" data-enter>
        <div className="search-inline"><Icon name="search" /><input data-q type="search" placeholder="Texte ou pseudo…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select data-f="status" aria-label="Statut" value={f.status} onChange={(e) => set({ status: e.target.value })}>
          {[['all', 'Tous'], ['visible', 'Visibles'], ['sticker', 'Stickers'], ['deleted', 'Supprimés']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div data-enter>
        <Table head={['Commentaire', 'Auteur', 'Sur le bading', 'Signal.', 'Statut', 'Date', '']} empty="Aucun commentaire.">
          {list.map((c) => {
            const rep = S.reportsOn('comment', c.id).length, b = S.bading(c.badingId);
            return (
              <tr key={c.id} data-id={c.id}>
                <td className="text-cell">{c.sticker ? <span className="c-stk small"><Sticker id={c.sticker} size={64} /></span> : <span className="clamp">{c.text}</span>}</td>
                <td><UserCell user={S.user(c.authorId)} /></td>
                <td className="text-cell"><Link className="clamp muted" to={`/badings/${c.badingId}`}>{b?.text ? `${b.text.slice(0, 60)}…` : '📷 Bading en image'}</Link></td>
                <td className="num">{rep ? <span className="flag-n"><Icon name="flag" /> {rep}</span> : '—'}</td>
                <td><StatusPill status={c.status} /></td>
                <td className="nowrap">{S.timeAgo(c.createdAt)}</td>
                <td><button className="icon-btn" data-menu aria-label="Actions" onClick={(e) => openMenu(e, c)}><Icon name="ellipsis" /></button></td>
              </tr>
            );
          })}
        </Table>
      </div>
    </div>
  );
}
