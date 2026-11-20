// Classement des Badeurs (GET /api/admin/leaderboard) : rires, commentaires, partages, rebades, vues reçus sur leurs
// badings, badings publiés, commentaires écrits, et les hashtags les plus utilisés. Période : 7 jours, 30 jours ou tout.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as S from '../lib/store.js';
import * as api from '../lib/api.js';
import { errorMessage } from '../lib/api.js';
import { useQuery } from '../lib/useQuery.js';
import { useEnter } from '../lib/motion.js';
import { Icon, PageHead, Table, UserCell } from '../components/ui.jsx';

const PERIODS = [['7', '7 jours'], ['30', '30 jours'], ['0', 'Depuis le début']];
/** Critères de tri : [clé, libellé court (colonne), explication]. */
export const CRITERIA = [
  ['score', 'Score', 'Rires + 2 × commentaires + 3 × partages + 3 × rebades reçus'],
  ['laughs', 'Rires', 'Rires reçus sur ses badings'],
  ['comments', 'Commentaires', 'Commentaires reçus sur ses badings'],
  ['shares', 'Partages', 'Partages de ses badings'],
  ['rebades', 'Rebades', 'Rebades de ses badings par d’autres'],
  ['views', 'Vues', 'Vues de ses badings'],
  ['badings', 'Badings', 'Badings publiés (anonymes compris)'],
  ['commentsWritten', 'Comm. écrits', 'Commentaires qu’il a écrits'],
];
const MEDALS = ['🥇', '🥈', '🥉'];
const fmt = (n) => (n ?? 0).toLocaleString('fr-FR');

/** Mode démo : classement calculé sur les données d'exemple. */
function demoLeaderboard(days, sort) {
  const st = S.get();
  const since = Number(days) > 0 ? Date.now() - Number(days) * 86_400_000 : 0;
  const by = new Map();
  const row = (id) => {
    if (!by.has(id)) by.set(id, { user: st.users[id] ?? { id, pseudo: id }, badings: 0, anonymous: 0, laughs: 0, comments: 0, shares: 0, rebades: 0, views: 0, commentsWritten: 0 });
    return by.get(id);
  };
  st.badings.filter((b) => b.createdAt >= since).forEach((b) => {
    const r = row(b.authorId);
    r.badings += 1; if (b.anonymous) r.anonymous += 1;
    r.laughs += b.likes ?? 0; r.shares += b.shares ?? 0; r.rebades += b.rebades ?? 0; r.views += (b.likes ?? 0) * 4;
  });
  st.comments.filter((c) => c.createdAt >= since).forEach((c) => {
    row(c.authorId).commentsWritten += 1;
    const b = st.badings.find((x) => x.id === c.badingId);
    if (b) row(b.authorId).comments += 1;
  });
  const tags = new Map();
  st.badings.filter((b) => b.createdAt >= since).forEach((b) => (b.text ?? '').match(/#[\p{L}\p{N}_]{2,30}/gu)?.forEach((t) => {
    const k = t.slice(1).toLowerCase(); const x = tags.get(k) ?? { tag: k, uses: 0, badings: 0, laughs: 0, authors: 0 };
    x.uses += 1; x.badings += 1; x.laughs += b.likes ?? 0; tags.set(k, x);
  }));
  const badeurs = [...by.values()].map((r) => ({ ...r, score: r.laughs + 2 * r.comments + 3 * r.shares + 3 * r.rebades }))
    .sort((a, b) => b[sort] - a[sort] || b.score - a.score).slice(0, 50).map((r, i) => ({ rank: i + 1, ...r }));
  return { badeurs, hashtags: [...tags.values()].sort((a, b) => b.uses - a.uses).slice(0, 30), demo: true };
}

export default function Leaderboard() {
  const ref = useEnter();
  const [f, set] = useQuery({ days: '7', sort: 'score' });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!S.BACKEND) { setData(demoLeaderboard(f.days, f.sort)); return; }
    setError(null);
    api.getLeaderboard({ days: f.days, sort: f.sort })
      .then(setData)
      .catch((e) => setError(errorMessage(e, 'Classement indisponible')));
  }, [f.days, f.sort]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [['rang', 'pseudo', ...CRITERIA.map(([k]) => k), 'anonymes'], ...data.badeurs.map((b) => [b.rank, b.user.pseudo, ...CRITERIA.map(([k]) => b[k]), b.anonymous])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv' })), download: `onbade-classement-${f.sort}-${f.days === '0' ? 'tout' : `${f.days}j`}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const criterion = CRITERIA.find(([k]) => k === f.sort) ?? CRITERIA[0];
  return (
    <div className="view" ref={ref}>
      <PageHead title="Classement" sub={`Les Badeurs les plus actifs et les hashtags les plus utilisés${data?.demo ? ' · données d’exemple (mode démo)' : ''}.`}
        actions={<button className="btn btn-secondary btn-sm" data-export onClick={exportCsv} disabled={!data}><Icon name="download" /> Exporter (CSV)</button>} />

      <div className="toolbar card lb-tools" data-enter>
        <div className="seg" role="tablist" aria-label="Période">
          {PERIODS.map(([k, label]) => <button key={k} role="tab" aria-selected={f.days === k} data-days={k} onClick={() => set({ days: k })}>{label}</button>)}
        </div>
        <label className="lb-sort">Classer par
          <select data-sort value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
            {CRITERIA.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        <span className="muted lb-hint">{criterion[2]}</span>
      </div>

      {!data ? (
        <div className="empty card" aria-busy={!error}><Icon name={error ? 'alert' : 'clock'} /><h2>{error ? 'Impossible de charger le classement' : 'Calcul du classement…'}</h2>
          {error ? <><p className="muted">{error}</p><button className="btn btn-secondary" onClick={load}>Réessayer</button></> : null}
        </div>
      ) : (
        <div className="lb-grid">
          <section data-enter>
            <h2 className="lb-title">Badeurs</h2>
            <Table head={['#', 'Badeur', ...CRITERIA.map(([k, label]) => <span key={k} className={k === f.sort ? 'lb-active' : ''}>{label}</span>)]} empty="Aucune activité sur cette période.">
              {data.badeurs.map((b) => (
                <tr key={b.user.id} data-badeur={b.user.pseudo}>
                  <td className="nowrap lb-rank">{MEDALS[b.rank - 1] ?? b.rank}</td>
                  <td><Link to={`/users/${b.user.id}`}><UserCell user={b.user} sub={b.anonymous ? `dont ${fmt(b.anonymous)} anonyme${b.anonymous > 1 ? 's' : ''}` : null} /></Link></td>
                  {CRITERIA.map(([k]) => <td key={k} className={`num${k === f.sort ? ' lb-active' : ''}`}>{fmt(b[k])}</td>)}
                </tr>
              ))}
            </Table>
          </section>
          <section data-enter>
            <h2 className="lb-title">Hashtags les plus utilisés</h2>
            <Table head={['#', 'Hashtag', 'Utilisations', 'Badings', 'Rires', 'Auteurs']} empty="Aucun hashtag sur cette période.">
              {data.hashtags.map((h, i) => (
                <tr key={h.tag} data-tag={h.tag}>
                  <td className="lb-rank">{MEDALS[i] ?? i + 1}</td>
                  <td><b className="lb-tag">#{h.tag}</b></td>
                  <td className="num lb-active">{fmt(h.uses)}</td>
                  <td className="num">{fmt(h.badings)}</td>
                  <td className="num">{fmt(h.laughs)}</td>
                  <td className="num">{fmt(h.authors)}</td>
                </tr>
              ))}
            </Table>
          </section>
        </div>
      )}
    </div>
  );
}
