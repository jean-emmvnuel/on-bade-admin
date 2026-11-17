import { useCallback, useEffect, useState } from 'react';
import * as S from '../lib/store.js';
import * as api from '../lib/api.js';
import { errorMessage } from '../lib/api.js';
import { useEnter } from '../lib/motion.js';
import { BarList, Icon, LineChart, PageHead, Pill, Table } from '../components/ui.jsx';

const REFRESH_MS = 15_000;
const RANGES = [['1h', '1 heure'], ['6h', '6 heures'], ['24h', '24 heures']];
const CHARTS = [['perMinute', 'Requêtes / min'], ['avgMs', 'Temps moyen (ms)'], ['errors', 'Erreurs 5xx'], ['rssMb', 'Mémoire (Mo)'], ['cpu', 'CPU (%)'], ['lagMs', 'Boucle Node (ms)']];
const ROUTE_SORTS = [['count', 'Les plus appelées'], ['p95Ms', 'Les plus lentes'], ['errors', 'Avec erreurs']];
const STATUS_LABELS = { 200: 'OK', 201: 'Créé', 204: 'Sans contenu', 400: 'Requête invalide', 401: 'Non connecté', 403: 'Interdit', 404: 'Introuvable', 409: 'Conflit', 422: 'Refusé (règles)', 429: 'Trop de requêtes', 500: 'Erreur serveur', 502: 'Passerelle', 503: 'Indisponible' };

/** Toutes les routes commencent par /api : on ne l'affiche pas. */
const short = (path) => path.replace(/^\/api(?=\/)/, '');
const nf1 = (n) => (n ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
export const fmtMs = (ms) => (ms >= 1000 ? `${nf1(ms / 1000)} s` : `${nf1(ms)} ms`);
export function fmtUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d} j ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

/** Ce qui mérite l'attention, du plus grave au moins grave : [{ tone: 'bad' | 'warn', text }]. */
export function health(s) {
  const out = [];
  if (!s) return out;
  if (s.database && !s.database.ok) out.push({ tone: 'bad', text: `Base de données injoignable : ${s.database.message ?? 'pas de réponse'}` });
  const hour = s.timeline?.points ?? [];
  const lastHour = hour.slice(-Math.ceil(60 / (s.timeline?.stepMinutes || 1)));
  const count = lastHour.reduce((n, p) => n + p.count, 0);
  const errors = s.totals.errorsLastHour ?? lastHour.reduce((n, p) => n + p.errors, 0);
  if (errors && count && errors / count >= 0.02) out.push({ tone: 'bad', text: `${S.fmt(errors)} erreurs serveur sur la dernière heure (${nf1((errors / count) * 100)} % des requêtes)` });
  else if (errors) out.push({ tone: 'warn', text: `${S.fmt(errors)} erreur${errors > 1 ? 's' : ''} serveur sur la dernière heure` });
  if (s.totals.p95Ms >= 1000) out.push({ tone: 'warn', text: `Réponses lentes : 5 % des requêtes prennent plus de ${fmtMs(s.totals.p95Ms)}` });
  if (s.process.lagP99Ms >= 100) out.push({ tone: 'warn', text: `Node est surchargé : la boucle d’événements prend jusqu’à ${fmtMs(s.process.lagP99Ms)} de retard` });
  if (s.process.cpu >= 80) out.push({ tone: 'warn', text: `CPU du serveur à ${nf1(s.process.cpu)} %` });
  if (s.host.totalMemMb && s.host.freeMemMb / s.host.totalMemMb < 0.1) out.push({ tone: 'warn', text: `Mémoire de la machine presque pleine : ${S.fmt(Math.round(s.host.freeMemMb))} Mo libres` });
  if (s.database?.ok && s.database.pingMs >= 100) out.push({ tone: 'warn', text: `La base de données répond lentement (${fmtMs(s.database.pingMs)})` });
  return out;
}

export function sortRoutes(routes, by) {
  const list = by === 'errors' ? routes.filter((r) => r.errors || r.clientErrors) : [...routes];
  return list.sort((a, b) => (by === 'errors' ? (b.errors - a.errors) || (b.clientErrors - a.clientErrors) : b[by] - a[by]) || b.count - a.count);
}

/** Données d'exemple pour le mode démo (sans serveur). */
function demoSnapshot(range) {
  const [minutes, step] = { '1h': [60, 1], '6h': [360, 5], '24h': [1440, 15] }[range];
  const now = Math.floor(Date.now() / 60_000) * 60_000;
  const points = Array.from({ length: Math.ceil(minutes / step) }, (_, i) => {
    const t = now - (minutes - 1 - i * step) * 60_000;
    const wave = 40 + 25 * Math.sin(i / 6) + (i % 7) * 3;
    const count = Math.round(wave * step);
    return { t, count, errors: i % 23 === 0 ? 1 : 0, clientErrors: Math.round(count * 0.03), slow: i % 31 === 0 ? 1 : 0, avgMs: 38 + (i % 9) * 4, perMinute: Math.round(wave), rssMb: 180 + (i % 12), cpu: 6 + (i % 10), lagMs: 12 + (i % 5) };
  });
  const route = (method, path, count, avgMs, p95Ms, errors = 0, clientErrors = 0) => ({ method, path, count, avgMs, p50Ms: avgMs * 0.8, p95Ms, maxMs: p95Ms * 2.4, errors, clientErrors, lastAt: Date.now() - 4000 });
  const errorsLastHour = points.slice(-Math.ceil(60 / step)).reduce((n, p) => n + p.errors, 0);
  return {
    demo: true,
    startedAt: Date.now() - 3 * 86400_000 - 4 * 3600_000,
    uptimeS: 3 * 86400 + 4 * 3600,
    node: 'v22.22.1',
    process: { rssMb: 186.4, heapUsedMb: 92.1, heapTotalMb: 128, externalMb: 6.3, cpu: 8.2, lagMs: 10.4, lagP99Ms: 16.2, lagMaxMs: 41 },
    host: { cpus: 4, load: [0.42, 0.37, 0.31], totalMemMb: 7820, freeMemMb: 3140 },
    totals: { requests: 182_340, errors: 12, clientErrors: 4210, avgMs: 46.3, p50Ms: 31, p95Ms: 182, p99Ms: 640, lastMinute: 52, last5Minutes: 231, errorsLastHour },
    statuses: { 200: 160_200, 201: 6120, 204: 11_798, 401: 2210, 404: 980, 422: 1020, 500: 12 },
    routes: [
      route('GET', '/api/feed', 41_200, 58, 190), route('GET', '/api/uploads/:id', 38_900, 12, 40), route('POST', '/api/badings/:id/views', 30_100, 18, 52),
      route('GET', '/api/notifications/unread', 22_400, 9, 25), route('POST', '/api/badings/:id/like', 12_800, 24, 70, 0, 120), route('GET', '/api/badings/:id', 11_300, 64, 210, 3, 410),
      route('POST', '/api/badings', 2100, 220, 900, 6, 640), route('POST', '/api/login', 1900, 310, 520, 0, 1500), route('POST', '/api/register/code', 300, 1400, 2900, 3, 40),
    ],
    timeline: { range, stepMinutes: step, points },
    recentErrors: [
      { at: Date.now() - 40 * 60_000, method: 'POST', path: '/api/register/code', status: 500, ms: 3120, message: 'Envoi de l’e-mail impossible (délai dépassé)' },
      { at: Date.now() - 3 * 3600_000, method: 'GET', path: '/api/badings/:id', status: 500, ms: 88, message: 'Can’t reach database server' },
    ],
    slowRequests: [{ at: Date.now() - 40 * 60_000, method: 'POST', path: '/api/register/code', status: 500, ms: 3120 }, { at: Date.now() - 2 * 3600_000, method: 'POST', path: '/api/badings', status: 201, ms: 1240 }],
    slowThresholdMs: 1000,
    database: { ok: true, pingMs: 1.4, sizeMb: 48.2, connections: { idle: 6, active: 1 }, tables: [{ name: 'posts', sizeMb: 14.2, rows: 18_400 }, { name: 'comments', sizeMb: 9.8, rows: 41_000 }, { name: 'likes', sizeMb: 7.1, rows: 120_000 }, { name: 'users', sizeMb: 3.2, rows: 4200 }] },
  };
}

const timeLabel = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** État du serveur : requêtes, temps de réponse, erreurs, mémoire, CPU, base de données. Mis à jour toutes les 15 s. */
export default function Server() {
  const ref = useEnter();
  const [range, setRange] = useState('1h');
  const [chart, setChart] = useState('perMinute');
  const [sort, setSort] = useState('count');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(() => {
    if (!S.BACKEND) { setData(demoSnapshot(range)); setUpdatedAt(Date.now()); return Promise.resolve(); }
    return api.getServer(range)
      .then((d) => { setData(d); setError(null); setUpdatedAt(Date.now()); })
      .catch((e) => setError(errorMessage(e, 'Mesures du serveur indisponibles')));
  }, [range]);

  useEffect(() => {
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const head = (
    <PageHead title="Serveur"
      sub={data ? `En ligne depuis ${fmtUptime(data.uptimeS)} (redémarré le ${S.fmtDate(data.startedAt)}) · mesures depuis ce démarrage${data.demo ? ' · données d’exemple (mode démo)' : ''}` : 'Requêtes, temps de réponse, erreurs, mémoire et base de données.'}
      actions={<button className="btn btn-secondary btn-sm" data-refresh onClick={() => load()}><Icon name="restore" /> Actualiser</button>} />
  );

  if (!data) {
    return (
      <div className="view" ref={ref}>{head}
        <div className="empty card" aria-busy={!error}><Icon name={error ? 'alert' : 'clock'} /><h2>{error ? 'Impossible de lire l’état du serveur' : 'Lecture des mesures…'}</h2>
          {error ? <><p className="muted">{error}</p><button className="btn btn-secondary" onClick={() => load()}>Réessayer</button></> : null}
        </div>
      </div>
    );
  }

  const s = data;
  const issues = health(s);
  const perMinute = Math.round(s.totals.last5Minutes / 5);
  const lastHourErrors = s.totals.errorsLastHour;
  const db = s.database;
  const kpis = [
    { ic: 'trendingUp', label: 'Requêtes', v: `${S.fmt(perMinute)} / min`, sub: `${S.fmt(s.totals.lastMinute)} la dernière minute · ${S.compact(s.totals.requests)} depuis le démarrage` },
    { ic: 'clock', label: 'Temps de réponse', v: fmtMs(s.totals.p50Ms), sub: `médiane · 95 % en moins de ${fmtMs(s.totals.p95Ms)} · 99 % en moins de ${fmtMs(s.totals.p99Ms)}` },
    { ic: 'alert', label: 'Erreurs serveur (1 h)', v: S.fmt(lastHourErrors), sub: `${S.fmt(s.totals.errors)} erreurs 5xx et ${S.compact(s.totals.clientErrors)} refus 4xx depuis le démarrage`, tone: lastHourErrors ? 'bad' : '' },
    { ic: 'database', label: 'Base de données', v: db?.ok ? fmtMs(db.pingMs) : 'Hors ligne', sub: db?.ok ? `temps de réponse · ${nf1(db.sizeMb)} Mo · ${S.fmt(Object.values(db.connections).reduce((a, b) => a + b, 0))} connexions` : db?.message ?? '', tone: db?.ok ? '' : 'bad' },
  ];
  const points = s.timeline.points.map((p) => ({ label: timeLabel(p.t), v: p[chart] ?? 0 }));
  const routes = sortRoutes(s.routes, sort).slice(0, 25);
  const statuses = Object.entries(s.statuses).map(([code, v]) => ({ label: `${code} · ${STATUS_LABELS[code] ?? ''}`, v, code: +code })).sort((a, b) => b.v - a.v);

  return (
    <div className="view" ref={ref} data-server>
      {head}

      {issues.length
        ? issues.map((i) => <div key={i.text} className={`alert ${i.tone}`} data-enter data-issue><Icon name="alert" /><span>{i.text}</span></div>)
        : <div className="alert ok" data-enter data-healthy><Icon name="circleCheck" /><span>Tout va bien : pas d’erreur serveur sur la dernière heure, réponses rapides, base de données joignable.</span></div>}

      <section className="kpis">
        {kpis.map((k) => (
          <div key={k.label} className={`kpi card ${k.tone ?? ''}`} data-enter>
            <span className="kpi-top"><Icon name={k.ic} /><span>{k.label}</span></span>
            <b>{k.v}</b>
            <span className="kpi-sub">{k.sub}</span>
          </div>
        ))}
      </section>

      <div className="card" data-enter>
        <div className="card-head"><h2>Activité</h2>
          <div className="seg" role="tablist" aria-label="Mesure">
            {CHARTS.map(([k, l]) => <button key={k} role="tab" aria-selected={chart === k} onClick={() => setChart(k)}>{l}</button>)}
          </div>
          <div className="seg" role="tablist" aria-label="Période" data-range>
            {RANGES.map(([k, l]) => <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)}>{l}</button>)}
          </div>
        </div>
        <LineChart points={points} label={CHARTS.find(([k]) => k === chart)[1]} />
        <p className="muted small">
          {s.timeline.stepMinutes > 1 ? `Par tranche de ${s.timeline.stepMinutes} minutes` : 'Minute par minute'}
          {updatedAt ? ` · mis à jour à ${new Date(updatedAt).toLocaleTimeString('fr-FR')}, actualisé toutes les 15 s` : ''}
          {' · l’historique repart de zéro à chaque redémarrage du serveur'}
        </p>
      </div>

      <div className="card" data-enter data-routes>
        <div className="card-head"><h2>Routes de l’API</h2>
          <div className="seg" role="tablist" aria-label="Tri">
            {ROUTE_SORTS.map(([k, l]) => <button key={k} role="tab" aria-selected={sort === k} onClick={() => setSort(k)}>{l}</button>)}
          </div>
        </div>
        <Table head={['Route', 'Appels', 'Moyenne', 'p95', 'Max', 'Erreurs', 'Dernier appel']} empty="Aucune requête depuis le démarrage.">
          {routes.map((r) => (
            <tr key={`${r.method} ${r.path}`} className={r.errors ? 'row-alert' : ''}>
              <td className="route"><Pill tone={r.method === 'GET' ? 'info' : r.method === 'DELETE' ? 'bad' : 'neutral'}>{r.method}</Pill> <code>{short(r.path)}</code></td>
              <td className="num">{S.fmt(r.count)}</td>
              <td className="num">{fmtMs(r.avgMs)}</td>
              <td className="num">{r.p95Ms >= s.slowThresholdMs ? <b className="danger-text">{fmtMs(r.p95Ms)}</b> : fmtMs(r.p95Ms)}</td>
              <td className="num">{fmtMs(r.maxMs)}</td>
              <td className="num">{r.errors ? <b className="danger-text">{S.fmt(r.errors)} × 5xx</b> : '—'}{r.clientErrors ? <small>{S.fmt(r.clientErrors)} × 4xx</small> : null}</td>
              <td className="nowrap muted">{S.timeAgo(r.lastAt)}</td>
            </tr>
          ))}
        </Table>
        <p className="muted small">Adresses sans le préfixe /api ; les identifiants sont remplacés par « :id ». p95 : 95 % des appels répondent plus vite. Les refus 4xx (non connecté, introuvable, règles) sont normaux ; les erreurs 5xx sont des pannes.</p>
      </div>

      <section className="grid-2">
        <div className="card" data-enter data-errors>
          <div className="card-head"><h2>Dernières erreurs serveur</h2><span className="muted small">50 au plus</span></div>
          <Table head={['Quand', 'Route', 'Durée', 'Message']} empty="Aucune erreur serveur depuis le démarrage 🎉">
            {s.recentErrors.map((e, i) => (
              <tr key={i}><td className="nowrap muted">{S.timeAgo(e.at)}</td><td className="route"><Pill tone="bad">{e.status}</Pill> <code>{e.method} {short(e.path)}</code></td><td className="num">{fmtMs(e.ms)}</td><td className="text-cell"><span className="clamp">{e.message ?? '—'}</span></td></tr>
            ))}
          </Table>
        </div>
        <div className="card" data-enter>
          <div className="card-head"><h2>Codes de réponse</h2><span className="muted small">depuis le démarrage</span></div>
          {statuses.length ? <BarList items={statuses} /> : <p className="muted">Aucune requête.</p>}
        </div>
      </section>

      <RefusalLog />

      <section className="grid-2">
        <div className="card" data-enter data-slow>
          <div className="card-head"><h2>Requêtes lentes</h2><span className="muted small">plus de {fmtMs(s.slowThresholdMs)}</span></div>
          <Table head={['Quand', 'Route', 'Statut', 'Durée']} empty="Aucune requête lente.">
            {s.slowRequests.map((e, i) => (
              <tr key={i}><td className="nowrap muted">{S.timeAgo(e.at)}</td><td className="route"><code>{e.method} {short(e.path)}</code></td><td><Pill tone={e.status >= 500 ? 'bad' : e.status >= 400 ? 'warn' : 'good'}>{e.status}</Pill></td><td className="num">{fmtMs(e.ms)}</td></tr>
            ))}
          </Table>
        </div>
        <div className="card" data-enter data-machine>
          <div className="card-head"><h2>Machine</h2></div>
          <ul className="kv">
            <li><span>Mémoire de l’API</span><b>{S.fmt(Math.round(s.process.rssMb))} Mo</b><small>dont {S.fmt(Math.round(s.process.heapUsedMb))} Mo de données JavaScript</small></li>
            <li><span>CPU de l’API</span><b>{nf1(s.process.cpu)} %</b><small>d’un cœur, sur les 15 dernières secondes</small></li>
            <li><span>Boucle Node</span><b>{fmtMs(s.process.lagMs)}</b><small>retard moyen · pire {fmtMs(s.process.lagMaxMs)} (au-delà de 100 ms, l’API rame)</small></li>
            <li><span>Charge du VPS</span><b>{s.host.load.map(nf1).join(' · ')}</b><small>moyenne sur 1, 5 et 15 min, pour {s.host.cpus} cœur{s.host.cpus > 1 ? 's' : ''}</small></li>
            <li><span>Mémoire du VPS</span><b>{S.fmt(Math.round(s.host.freeMemMb))} Mo libres</b><small>sur {S.fmt(Math.round(s.host.totalMemMb))} Mo</small></li>
            <li><span>Node.js</span><b>{s.node}</b></li>
          </ul>
        </div>
      </section>

      {db?.ok ? (
        <div className="card" data-enter data-database>
          <div className="card-head"><h2>Base de données</h2><span className="muted small">{nf1(db.sizeMb)} Mo · connexions : {Object.entries(db.connections).map(([k, v]) => `${v} ${k === 'active' ? (v > 1 ? 'actives' : 'active') : k === 'idle' ? 'en attente' : k}`).join(', ')}</span></div>
          <Table head={['Table', 'Lignes', 'Taille']}>
            {db.tables.map((t) => <tr key={t.name}><td><code>{t.name}</code></td><td className="num">{S.fmt(t.rows)}</td><td className="num">{nf1(t.sizeMb)} Mo</td></tr>)}
          </Table>
        </div>
      ) : null}
    </div>
  );
}

// ─── Journal des refus (4xx) ───────────────────────────────

const DEMO_REFUSALS = [
  { id: 'd1', status: 422, method: 'POST', path: '/api/badings/:id/comments', code: 'invalid_audio', message: 'Note vocale invalide (data URL base64 attendue)', client: 'iPhone iOS 18.7 · Safari 27', count: 1, lastAt: Date.now() - 12 * 60_000 },
  { id: 'd2', status: 429, method: 'POST', path: '/api/login', code: 'too_many_attempts', message: 'Trop de tentatives pour ce compte', client: 'Android 15 · Chrome 131', count: 6, lastAt: Date.now() - 2 * 3600_000 },
  { id: 'd3', status: 404, method: 'GET', path: '/api/badings/:id', code: 'not_found', message: 'Ce bading n’existe pas ou plus', client: 'Windows · Firefox 133', count: 3, lastAt: Date.now() - 26 * 3600_000 },
];

/**
 * Pourquoi une action d'un Badeur a été refusée (vocal invalide, trop de tentatives, introuvable…), gardé 30 jours en base :
 * contrairement aux mesures ci-dessus, il survit aux redémarrages. Les refus identiques d'une même minute sont regroupés.
 */
function RefusalLog() {
  const [q, setQ] = useState('');
  const [hide401, setHide401] = useState(true);
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!S.BACKEND) {
      const list = DEMO_REFUSALS.filter((r) => !q || `${r.path} ${r.code} ${r.message}`.toLowerCase().includes(q.toLowerCase()));
      setRes({ refusals: list, total: list.length, page: 1, keepDays: 30 });
      return;
    }
    api.getRefusals({ q, hide401, page })
      .then((d) => { setRes(d); setError(null); })
      .catch((e) => setError(errorMessage(e, 'Journal des refus indisponible')));
  }, [q, hide401, page]);

  useEffect(() => {
    const timer = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  const pages = res ? Math.max(1, Math.ceil(res.total / 50)) : 1;
  return (
    <div className="card" data-enter data-refusals>
      <div className="card-head">
        <h2>Journal des refus</h2>
        <span className="muted small">{res ? `${S.fmt(res.total)} sur ${res.keepDays} jours · gardé même après un redémarrage` : ''}</span>
      </div>
      <div className="refusal-tools">
        <div className="search-inline"><Icon name="search" /><input type="search" placeholder="Route, code ou motif (ex. vocale)…" aria-label="Chercher dans le journal des refus"
          value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <label className="check"><input type="checkbox" checked={hide401} onChange={(e) => { setHide401(e.target.checked); setPage(1); }} /> Masquer « non connecté » (401)</label>
        <button className="btn btn-secondary btn-sm" onClick={load}><Icon name="restore" /> Actualiser</button>
      </div>
      {error ? <p className="danger-text">{error}</p> : null}
      <Table head={['Quand', 'Route', 'Refus', 'Motif', 'Appareil', 'Fois']} empty={res ? 'Aucun refus sur cette période 🎉' : 'Lecture du journal…'}>
        {(res?.refusals ?? []).map((r) => (
          <tr key={r.id}>
            <td className="nowrap muted" title={new Date(r.lastAt).toLocaleString('fr-FR')}>{S.timeAgo(r.lastAt)}</td>
            <td className="route"><code>{r.method} {short(r.path)}</code></td>
            <td className="nowrap"><Pill tone={r.status === 429 || r.status === 403 ? 'bad' : 'warn'}>{r.status}</Pill> <small>{STATUS_LABELS[r.status] ?? ''}</small></td>
            <td className="text-cell"><span className="clamp">{r.message ?? '—'}</span>{r.code ? <small><code>{r.code}</code></small> : null}</td>
            <td className="muted small">{r.client ?? '—'}</td>
            <td className="num">{S.fmt(r.count)}</td>
          </tr>
        ))}
      </Table>
      {pages > 1 ? (
        <div className="pager">
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédents</button>
          <span className="muted small">Page {page} sur {pages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Suivants</button>
        </div>
      ) : null}
      <p className="muted small">Sans contenu ni donnée personnelle : la route, le code et le message de l’API, et l’appareil. Les refus d’accès décidés avant la route (jeton absent ou invalide) n’y figurent pas.</p>
    </div>
  );
}
