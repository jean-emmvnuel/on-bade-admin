import { Link } from 'react-router-dom';
import * as S from '../lib/store.js';
import { useStore } from '../lib/useStore.js';
import { useQuery } from '../lib/useQuery.js';
import { useEnter } from '../lib/motion.js';
import { Icon, PageHead, Table, useDebouncedField, UserCell } from '../components/ui.jsx';
import { actionLabel } from './Dashboard.jsx';

function TargetLink({ id }) {
  if (!id) return '—';
  if (S.user(id)) return <Link to={`/users/${id}`}>@{S.user(id).pseudo}</Link>;
  if (S.bading(id)) return <Link to={`/badings/${id}`}>Bading {id}</Link>;
  return id;
}

/** Journal d'audit : toutes les actions de l'équipe, filtrables et exportables en CSV. */
export default function Audit() {
  const st = useStore();
  const [f, set] = useQuery({ q: '', actor: 'all', target: '' });
  const [search, setSearch] = useDebouncedField(f.q, (q) => set({ q }));
  const ref = useEnter();

  const actors = [...new Set(st.audit.map((l) => l.actor))];
  const q = f.q.toLowerCase();
  const list = st.audit.filter((l) => (f.actor === 'all' || l.actor === f.actor) && (!f.target || l.target === f.target)
    && (!q || `${l.detail} ${actionLabel(l.action)}`.toLowerCase().includes(q)));

  const exportCsv = () => {
    const rows = [['date', 'membre', 'action', 'cible', 'detail'], ...list.map((l) => [new Date(l.at).toISOString(), S.user(l.actor)?.pseudo ?? l.actor, l.action, l.target ?? '', l.detail ?? ''])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv' })), download: `jebade-audit-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="view" ref={ref}>
      <PageHead title="Journal d’audit" sub="Toutes les actions de l’équipe, sans possibilité de modification. Conservé 12 mois."
        actions={<button className="btn btn-secondary btn-sm" data-export onClick={exportCsv}><Icon name="download" /> Exporter (CSV)</button>} />
      <div className="toolbar card" data-enter>
        <div className="search-inline"><Icon name="search" /><input data-q type="search" placeholder="Rechercher dans le journal…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select data-actor aria-label="Membre" value={f.actor} onChange={(e) => set({ actor: e.target.value })}>
          <option value="all">Toute l’équipe</option>
          {actors.map((a) => <option key={a} value={a}>{a === 'system' ? 'Automatique' : `@${S.user(a)?.pseudo ?? a}`}</option>)}
        </select>
        {f.target ? <button className="btn btn-ghost btn-sm" data-clear onClick={() => set({ target: '' })}><Icon name="x" /> Cible : {S.user(f.target)?.pseudo ?? f.target}</button> : null}
      </div>
      <div data-enter>
        <Table head={['Date', 'Membre', 'Action', 'Cible', 'Détail']} empty="Aucune entrée.">
          {list.slice(0, 200).map((l) => (
            <tr key={l.id} className={l.action === 'vault.reveal' ? 'row-alert' : ''}>
              <td className="nowrap">{S.fmtDate(l.at)}</td>
              <td><UserCell user={S.user(l.actor)} /></td>
              <td className="nowrap"><b>{actionLabel(l.action)}</b></td>
              <td><TargetLink id={l.target} /></td>
              <td>{l.detail ?? ''}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}
