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

const TABS = [['flames', '🔥 Flammes'], ['badescore', 'BadeScore'], ['activity', 'Activité']];

export default function Leaderboard() {
  const ref = useEnter();
  const [f, set] = useQuery({ tab: 'flames', days: '7', sort: 'score', season: '', level: '' });
  const tab = TABS.some(([k]) => k === f.tab) ? f.tab : 'flames';
  return (
    <div className="view" ref={ref}>
      <PageHead title="Classement" sub="Flammes de la saison, rangs BadeScore, Badeurs les plus actifs et hashtags." />
      <div className="seg lb-tabs" role="tablist" aria-label="Classement" data-enter>
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} data-tab={k} onClick={() => set({ tab: k })}>{label}</button>)}
      </div>
      {tab === 'flames' ? <FlamesBoard f={f} set={set} /> : tab === 'badescore' ? <BadeScoreBoard f={f} set={set} /> : <ActivityBoard f={f} set={set} />}
    </div>
  );
}

/** Chargement / erreur communs. */
function Pending({ error, onRetry, label }) {
  return (
    <div className="empty card" aria-busy={!error}><Icon name={error ? 'alert' : 'clock'} /><h2>{error ? 'Impossible de charger le classement' : label}</h2>
      {error ? <><p className="muted">{error}</p><button className="btn btn-secondary" onClick={onRetry}>Réessayer</button></> : null}
    </div>
  );
}

/** Flammes : saison (en cours ou passée), résumé, classement par série, records de tous les temps. */
function FlamesBoard({ f, set }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null); setData(null);
    if (!S.BACKEND) { setError('Flammes indisponibles en mode démo (données du serveur uniquement).'); return; }
    api.getFlames({ season: f.season }).then(setData).catch((e) => setError(errorMessage(e, 'Flammes indisponibles')));
  }, [f.season]);
  useEffect(() => { load(); }, [load]);
  if (!data) return <Pending error={error} onRetry={load} label="Calcul des flammes…" />;
  const { season, summary } = data;
  const left = season.length - season.day;
  return (
    <>
      <div className="toolbar card lb-tools" data-enter>
        <label className="lb-sort">Saison
          <select data-season value={season.number} onChange={(e) => set({ season: e.target.value })}>
            {data.seasons.map((s) => <option key={s.number} value={s.number}>Saison {s.number} · {s.startsOn} → {s.endsOn}{s.current ? ' (en cours)' : s.closed ? ' (close)' : ''}</option>)}
          </select>
        </label>
        <span className="muted lb-hint">{season.current ? `Jour ${season.day}/${season.length} · ${left > 0 ? `fin dans ${left} jour${left > 1 ? 's' : ''}` : 'dernier jour'}` : season.closed ? 'Saison close : résultats figés' : 'Saison terminée, clôture à la prochaine tâche planifiée'}</span>
      </div>
      <section className="kpis small" data-enter>
        <div className="kpi card"><span className="kpi-top"><span>🔥</span><span>Actifs aujourd’hui</span></span><b data-kpi="today">{fmt(summary.activeToday)}</b><span className="kpi-sub">flammes gagnées aujourd’hui</span></div>
        <div className="kpi card"><span className="kpi-top"><Icon name="users" /><span>Participants</span></span><b data-kpi="participants">{fmt(summary.participants)}</b><span className="kpi-sub">au moins 1 jour actif cette saison · {fmt(summary.ranked)} classés</span></div>
        <div className="kpi card"><span className="kpi-top"><Icon name="trendingUp" /><span>Plus longue série</span></span><b>{fmt(summary.topStreak)}</b><span className="kpi-sub">{season.current ? 'en cours' : 'en fin de saison'}</span></div>
        <div className="kpi card"><span className="kpi-top"><Icon name="flag" /><span>Meilleur record</span></span><b>{fmt(summary.bestRecord?.record ?? 0)}</b><span className="kpi-sub">{summary.bestRecord ? `@${summary.bestRecord.user.pseudo}` : 'aucun'}</span></div>
      </section>
      <div className="lb-grid">
        <section data-enter>
          <h2 className="lb-title">Classement de la saison {season.number}</h2>
          <p className="muted lb-hint">Série en cours, puis jours actifs de la saison, puis le premier arrivé. Comptes suspendus et en cours de suppression exclus.</p>
          <Table head={['#', 'Badeur', <span key="s" className="lb-active">Flammes</span>, 'Jours actifs', 'Meilleure série (saison)', 'Record', 'Total jours', 'Aujourd’hui']} empty="Personne n’a de flamme sur cette saison.">
            {data.badeurs.map((b) => (
              <tr key={b.user.id} data-flame-badeur={b.user.pseudo}>
                <td className="nowrap lb-rank">{MEDALS[b.rank - 1] ?? b.rank}</td>
                <td><Link to={`/users/${b.user.id}`}><UserCell user={b.user} /></Link></td>
                <td className="num lb-active">{fmt(b.streak)} 🔥</td>
                <td className="num">{fmt(b.seasonDays)}<span className="muted">/{season.length}</span></td>
                <td className="num">{fmt(b.seasonBest)}</td>
                <td className="num">{fmt(b.record)}</td>
                <td className="num">{fmt(b.totalDays)}</td>
                <td className="num">{season.current ? (b.today ? '✓' : <span className="muted" title="Pas encore publié aujourd’hui : la série tombe à minuit">à faire</span>) : '—'}</td>
              </tr>
            ))}
          </Table>
        </section>
        <section data-enter>
          <h2 className="lb-title">Records de tous les temps</h2>
          <Table head={['#', 'Badeur', 'Record (jours d’affilée)', 'Jours actifs au total']} empty="Aucune flamme pour l’instant.">
            {data.records.map((r, i) => (
              <tr key={r.user.id}>
                <td className="lb-rank">{MEDALS[i] ?? i + 1}</td>
                <td><Link to={`/users/${r.user.id}`}><UserCell user={r.user} /></Link></td>
                <td className="num lb-active">{fmt(r.record)}</td>
                <td className="num">{fmt(r.totalDays)}</td>
              </tr>
            ))}
          </Table>
        </section>
      </div>
    </>
  );
}

/** BadeScore : nombre de Badeurs par rang (cliquable pour filtrer), et classement par BadeScore. */
function BadeScoreBoard({ f, set }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null); setData(null);
    if (!S.BACKEND) { setError('BadeScore indisponible en mode démo (données du serveur uniquement).'); return; }
    api.getBadeScores({ level: f.level }).then(setData).catch((e) => setError(errorMessage(e, 'BadeScore indisponible')));
  }, [f.level]);
  useEffect(() => { load(); }, [load]);
  if (!data) return <Pending error={error} onRetry={load} label="Calcul des BadeScores…" />;
  return (
    <>
      <section className="lb-levels" data-enter aria-label="Badeurs par rang">
        {data.levels.map((l) => (
          <button key={l.index} type="button" className={`kpi card${f.level === String(l.index) ? ' on' : ''}`} data-level={l.index}
            onClick={() => set({ level: f.level === String(l.index) ? '' : String(l.index) })}>
            <span className="kpi-top"><span>{l.name}</span></span>
            <b>{fmt(l.badeurs)}</b>
            <span className="kpi-sub">dès {fmt(l.min)} points · {data.total ? Math.round((l.badeurs / data.total) * 100) : 0} %</span>
          </button>
        ))}
      </section>
      <section data-enter>
        <h2 className="lb-title">Classement par BadeScore{f.level !== '' ? ` · ${data.levels[Number(f.level)]?.name ?? ''}` : ''}</h2>
        <p className="muted lb-hint">Score cumulé depuis l’inscription (badings signés seulement). {f.level !== '' ? <button className="btn btn-ghost btn-sm" onClick={() => set({ level: '' })}>Tous les rangs</button> : 'Clique sur un rang pour filtrer.'}</p>
        <Table head={['#', 'Badeur', <span key="s" className="lb-active">BadeScore</span>, 'Rang', 'Prochain rang']} empty="Aucun Badeur à ce rang (score > 0).">
          {data.badeurs.map((b) => (
            <tr key={b.user.id} data-score-badeur={b.user.pseudo}>
              <td className="nowrap lb-rank">{MEDALS[b.rank - 1] ?? b.rank}</td>
              <td><Link to={`/users/${b.user.id}`}><UserCell user={b.user} /></Link></td>
              <td className="num lb-active">{fmt(b.score)}</td>
              <td>{b.level}</td>
              <td className="muted">{b.nextLevel ? `${b.nextLevel} dans ${fmt(b.next - b.score)} pts` : 'rang maximal'}</td>
            </tr>
          ))}
        </Table>
      </section>
    </>
  );
}

/** Activité : rires, commentaires, partages… reçus sur une période, et hashtags les plus utilisés. */
function ActivityBoard({ f, set }) {
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
    <>

      <div className="toolbar card lb-tools" data-enter>
        <div className="seg" role="tablist" aria-label="Période">
          {PERIODS.map(([k, label]) => <button key={k} role="tab" aria-selected={f.days === k} data-days={k} onClick={() => set({ days: k })}>{label}</button>)}
        </div>
        <label className="lb-sort">Classer par
          <select data-sort value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
            {CRITERIA.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        <span className="muted lb-hint">{criterion[2]}{data?.demo ? ' · données d’exemple (mode démo)' : ''}</span>
        <button className="btn btn-secondary btn-sm" data-export onClick={exportCsv} disabled={!data} style={{ marginLeft: 'auto' }}><Icon name="download" /> Exporter (CSV)</button>
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
    </>
  );
}
