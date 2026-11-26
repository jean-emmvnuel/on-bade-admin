// Rétention (GET /api/admin/retention) : les Badeurs reviennent-ils ? Chiffres clés, cohortes par semaine
// d'inscription (retour à J1, J7, J30), actifs par jour, profondeur d'usage, effet de la première réaction,
// et effet des relances automatiques (rappel de série, inactifs, premier bading, saison, bienvenue).
import { useCallback, useEffect, useState } from 'react';
import * as S from '../lib/store.js';
import * as api from '../lib/api.js';
import { errorMessage } from '../lib/api.js';
import { useEnter } from '../lib/motion.js';
import { Icon, LineChart, PageHead, Table } from '../components/ui.jsx';

const fmt = (n) => (n ?? 0).toLocaleString('fr-FR');
const pct = (v) => (v === null || v === undefined ? '—' : `${v} %`);
/** Couleur d'un taux de retour : bon, moyen, faible. */
const tone = (v, good, ok) => (v === null || v === undefined ? '' : v >= good ? 'rt-good' : v >= ok ? 'rt-ok' : 'rt-bad');

export const NUDGES = {
  streak: ['🔥 Rappel de série', 'Push à 19 h : « ta série s’éteint à minuit »'],
  streak_late: ['⏰ Dernier rappel (push)', 'À 21 h : « plus que 3 heures », s’il n’a toujours rien publié'],
  streak_late_mail: ['⏰ Dernier rappel (e-mail)', 'À 21 h, en même temps que la notification'],
  inactive_push: ['📲 Inactif (push)', 'Après 3 jours sans venir, s’il y a du neuf'],
  inactive_mail: ['✉️ Inactif (e-mail)', 'Après 7 jours, au plus 1 relance par semaine'],
  first_bading: ['✍️ Premier bading', 'Le lendemain de l’inscription, sans bading publié'],
  season_start: ['🏁 Nouvelle saison', 'Le premier jour de chaque saison'],
  welcome_mail: ['👋 Bienvenue', 'E-mail à l’inscription'],
};

export default function Retention() {
  const ref = useEnter();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null);
    if (!S.BACKEND) { setError('Rétention disponible seulement avec le serveur (pas en mode démo).'); return; }
    api.getRetention().then(setData).catch((e) => setError(errorMessage(e, 'Rétention indisponible')));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) {
    return (
      <div className="view" ref={ref}>
        <PageHead title="Rétention" sub="Les Badeurs reviennent-ils ?" />
        <div className="empty card" aria-busy={!error}><Icon name={error ? 'alert' : 'clock'} /><h2>{error ? 'Impossible de charger la rétention' : 'Calcul de la rétention…'}</h2>
          {error ? <><p className="muted">{error}</p><button className="btn btn-secondary" onClick={load}>Réessayer</button></> : null}
        </div>
      </div>
    );
  }
  const { summary: s } = data;
  const stickiness = s.active30 ? Math.round((100 * s.active7) / s.active30) : null;
  return (
    <div className="view" ref={ref}>
      <PageHead title="Rétention" sub="Un jour actif = le Badeur a lu, ri, commenté, publié ou partagé. Que des totaux, aucune donnée personnelle." />

      <section className="kpis" data-enter>
        <div className="kpi card"><span className="kpi-top"><Icon name="activity" /><span>Actifs aujourd’hui</span></span><b data-kpi="today">{fmt(s.activeToday)}</b><span className="kpi-sub">sur {fmt(s.users)} inscrits</span></div>
        <div className="kpi card"><span className="kpi-top"><Icon name="users" /><span>Actifs 7 jours</span></span><b data-kpi="week">{fmt(s.active7)}</b><span className="kpi-sub">{fmt(s.active30)} sur 30 jours · fidélité {pct(stickiness)}</span></div>
        <div className="kpi card"><span className="kpi-top"><Icon name="penLine" /><span>Ont déjà publié</span></span><b>{pct(s.postedPct)}</b><span className="kpi-sub">des inscrits</span></div>
        <div className="kpi card"><span className="kpi-top"><Icon name="bell" /><span>Notifications actives</span></span><b>{pct(s.pushPct)}</b><span className="kpi-sub">des inscrits joignables en push</span></div>
      </section>

      <section className="card rt-chart" data-enter>
        <h2 className="lb-title">Actifs par jour (30 jours)</h2>
        <LineChart points={data.daily.map((d) => ({ label: d.day.slice(5).split('-').reverse().join('/'), v: d.active }))} label="Badeurs actifs" height={180} />
      </section>

      <div className="lb-grid">
        <section data-enter>
          <h2 className="lb-title">Retour après l’inscription, par semaine</h2>
          <p className="muted lb-hint">% des inscrits de la semaine revenus entre J1 et J2, J7 et J13, et après J30. « — » : période pas encore passée.</p>
          <Table head={['Semaine du', 'Inscrits', 'J1', 'J7', 'J30', 'Jamais actifs']} empty="Aucun inscrit ces 12 dernières semaines.">
            {data.cohorts.map((c) => (
              <tr key={c.week} data-cohort={c.week}>
                <td className="nowrap">{c.week.split('-').reverse().join('/')}</td>
                <td className="num">{fmt(c.size)}</td>
                <td className={`num ${tone(c.d1, 40, 25)}`}>{pct(c.d1)}</td>
                <td className={`num ${tone(c.d7, 20, 10)}`}>{pct(c.d7)}</td>
                <td className={`num ${tone(c.d30, 10, 5)}`}>{pct(c.d30)}</td>
                <td className="num muted">{pct(c.never)}</td>
              </tr>
            ))}
          </Table>
        </section>

        <section data-enter>
          <h2 className="lb-title">Relances automatiques (30 jours)</h2>
          <p className="muted lb-hint">Envoyées, et part des Badeurs relancés revenus dans les 48 h (mesurée 2 jours après l’envoi).</p>
          <Table head={['Relance', 'Envoyées', 'Revenus sous 48 h']}>
            {data.nudges.map((n) => (
              <tr key={n.kind} data-nudge={n.kind}>
                <td><b>{NUDGES[n.kind]?.[0] ?? n.kind}</b><br /><span className="muted t-small">{NUDGES[n.kind]?.[1]}</span></td>
                <td className="num">{fmt(n.sent30)}</td>
                <td className={`num ${tone(n.backPct, 40, 20)}`}>{n.measured ? `${pct(n.backPct)} (${fmt(n.measured)})` : '—'}</td>
              </tr>
            ))}
          </Table>
        </section>

        <div className="grid-2">
          <section data-enter>
            <h2 className="lb-title">Jours actifs par Badeur</h2>
            <Table head={['Jours actifs', 'Badeurs']}>
              {data.depth.map((d) => <tr key={d.bucket}><td>{d.bucket === '0' ? 'Jamais actif' : `${d.bucket} jour${d.bucket === '1' ? '' : 's'}`}</td><td className="num">{fmt(d.users)}</td></tr>)}
            </Table>
          </section>
          <section data-enter>
            <h2 className="lb-title">Le premier bading a-t-il fait réagir ?</h2>
            <p className="muted lb-hint">Auteurs revenus 7 jours après leur premier bading, selon qu’il a reçu un rire ou un commentaire d’un autre Badeur.</p>
            <Table head={['Premier bading', 'Auteurs', 'Revenus à J7+']} empty="Pas encore assez de recul (7 jours).">
              {[...data.firstBading].sort((a, b) => Number(b.reaction) - Number(a.reaction)).map((f) => (
                <tr key={String(f.reaction)}><td>{f.reaction ? '😂 Avec réaction' : '😶 Sans réaction'}</td><td className="num">{fmt(f.authors)}</td><td className={`num ${tone(f.backPct, 40, 20)}`}>{pct(f.backPct)}</td></tr>
              ))}
            </Table>
          </section>
        </div>
      </div>
    </div>
  );
}
