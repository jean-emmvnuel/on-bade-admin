import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as S from '../lib/store.js';
import { useStore } from '../lib/useStore.js';
import { useEnter } from '../lib/motion.js';
import { BarList, CountUp, Icon, LineChart, PageHead, UserCell } from '../components/ui.jsx';

const D = 86_400_000;
const ACTIONS = {
  'auth.login': 'Connexion', 'auth.logout': 'Déconnexion', 'report.resolve': 'Signalement', 'bading.hide': 'Bading masqué', 'bading.delete': 'Bading supprimé', 'bading.restore': 'Bading rétabli',
  'vault.reveal': 'Auteur révélé', 'comment.delete': 'Commentaire supprimé', 'comment.restore': 'Commentaire rétabli', 'user.sanction': 'Sanction', 'user.unsanction': 'Sanction levée',
  'badge.grant': 'Badge attribué', 'badge.revoke': 'Badge retiré', 'badge.decision': 'Demande de badge', 'user.role': 'Rôle modifié', 'user.pseudo': 'Pseudo modifié',
  'user.password_reset': 'Mot de passe', 'user.delete': 'Compte supprimé', 'data.process': 'Données perso', 'data.cancel': 'Données perso', 'announcement.send': 'Annonce',
  'sticker.remove': 'Sticker retiré', 'sticker.restore': 'Sticker rétabli', 'words.add': 'Mot interdit', 'words.remove': 'Mot interdit', 'rules.update': 'Règles', 'platform.update': 'Plateforme', 'platform.reset': 'Démo',
  // Codes du journal du serveur
  'bading.pin': 'Bading épinglé', 'bading.unpin': 'Épinglage retiré', 'bading.autohide': 'Masquage automatique', 'comment.hide': 'Commentaire masqué',
  'user.warn': 'Avertissement', 'user.message': 'Message', 'user.manager_add': 'Gestionnaire', 'user.manager_remove': 'Gestionnaire',
  'report.open': 'Signalement rouvert', 'report.resolved': 'Signalement traité', 'report.dismissed': 'Signalement classé',
  'admin.add': 'Équipe', 'admin.permission': 'Droits modifiés', 'admin.remove': 'Équipe', 'settings.update': 'Réglages', 'data.export': 'Copie des données',
  'rank.grant': 'Badge de rang', 'rank.revoke': 'Badge de rang', 'rank.create': 'Badge de rang', 'rank.update': 'Badge de rang', 'rank.delete': 'Badge de rang',
  'mfa.enable': '2FA activée', 'mfa.disable': '2FA désactivée', 'mfa.reset': '2FA réinitialisée',
};
export const actionLabel = (a) => ACTIONS[a] ?? a;

/** Motifs des signalements reçus du serveur (texte libre choisi dans l'app), du plus fréquent au moins fréquent. */
export function reportReasons(reports) {
  const counts = new Map();
  reports.forEach((r) => { const k = S.REASONS[r.reason] ?? r.reason ?? 'Autre'; counts.set(k, (counts.get(k) ?? 0) + 1); });
  return [...counts].map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v);
}

const METRICS = [['badings', 'Badings'], ['signups', 'Inscriptions'], ['active', 'Actifs'], ['laughs', 'Rires'], ['comments', 'Commentaires']];

export default function Dashboard() {
  const st = useStore();
  const ref = useEnter();
  const [metric, setMetric] = useState('badings');
  const now = Date.now();
  const users = S.users().filter((u) => u.status !== 'deleted');
  const daily = st.daily;
  const last7 = daily.slice(-7), prev7 = daily.slice(-14, -7);
  const sum = (arr, k) => arr.reduce((n, d) => n + (d[k] ?? 0), 0);
  const delta = (k) => { const a = sum(last7, k), b = sum(prev7, k); if (!b) return a ? 100 : 0; return Math.round(((a - b) / b) * 100); };
  const active7 = users.filter((u) => now - u.lastActiveAt < 7 * D).length;
  const visible = st.badings.filter((b) => b.status === 'visible');
  const anonShare = Math.round((visible.filter((b) => b.anonymous).length / (visible.length || 1)) * 100);
  const totalLaughs = visible.reduce((n, b) => n + b.likes, 0);

  // Avec l'API : chiffres exacts de /admin/stats ; les courbes viennent des badings et inscriptions chargés.
  const stats = st.stats;
  const live = S.BACKEND && stats;
  const liveAnon = live && stats.anonymousShare !== undefined ? Math.round(stats.anonymousShare * 100) : anonShare;
  const kpis = live ? [
    { label: 'Utilisateurs', v: stats.users, sub: `${S.fmt(stats.newUsers)} nouveaux en 24 h${stats.activeUsers !== undefined ? ` · ${S.fmt(stats.activeUsers)} actifs (7 j)` : ''}`, d: delta('signups'), ic: 'users', href: '/users' },
    { label: 'Badings en ligne', v: stats.badings, sub: `${S.fmt(stats.badingsToday)} publiés en 24 h · ${liveAnon} % en anonyme`, d: delta('badings'), ic: 'quote', href: '/badings' },
    { label: 'Rires (30 jours)', v: stats.laughs30d ?? sum(daily, 'laughs'), sub: `${S.compact(sum(last7, 'laughs'))} cette semaine`, d: delta('laughs'), ic: 'laugh', href: '/badings' },
    { label: 'Commentaires', v: stats.comments, sub: stats.hiddenComments ? `${S.fmt(stats.hiddenComments)} masqués` : 'sur toute la plateforme', d: delta('comments'), ic: 'message', href: '/comments' },
  ] : [
    { label: 'Utilisateurs', v: users.length, sub: `${sum(last7, 'signups')} inscrits cette semaine`, d: delta('signups'), ic: 'users', href: '/users' },
    { label: 'Actifs (7 jours)', v: active7, sub: `${Math.round((active7 / (users.length || 1)) * 100)} % des comptes`, d: delta('active'), ic: 'trendingUp', href: '/users' },
    { label: 'Badings en ligne', v: visible.length, sub: `${anonShare} % en anonyme`, d: delta('badings'), ic: 'quote', href: '/badings' },
    { label: 'Rires', v: totalLaughs, sub: `${S.compact(sum(last7, 'laughs'))} cette semaine`, d: delta('laughs'), ic: 'laugh', href: '/badings' },
  ];
  const todo = live ? [
    { n: stats.openReports, label: 'signalements à traiter', href: '/reports', ic: 'flag', tone: 'warn' },
    { n: stats.pendingVerifications, label: 'demandes de badge', href: '/badges', ic: 'badgeCheck', tone: '' },
    { n: stats.pendingDeletions, label: 'demandes de suppression de compte', href: '/data', ic: 'database', tone: '' },
    { n: stats.blockedUsers, label: 'comptes bloqués', href: '/users?status=suspended', ic: 'ban', tone: '' },
  ] : [
    { n: S.openReports().length, label: 'signalements à traiter', href: '/reports', ic: 'flag', tone: 'warn' },
    { n: S.pendingBadges().length, label: 'demandes de badge', href: '/badges', ic: 'badgeCheck', tone: '' },
    { n: S.pendingData().length, label: 'demandes de données perso', href: '/data', ic: 'database', tone: '' },
    { n: st.badings.filter((b) => b.status === 'hidden').length, label: 'badings masqués à revoir', href: '/badings?status=hidden', ic: 'eyeOff', tone: '' },
  ];
  const recent = [...users].sort((a, b) => b.joinedAt - a.joinedAt).slice(0, 7);
  const dayLabel = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const top = live && stats.topBadings ? stats.topBadings.map((b) => S.bading(b.id) ?? { ...b, authorId: b.authorId }) : [...visible].sort((a, b) => b.likes - a.likes).slice(0, 5);
  const reasons = live && stats.reportReasons
    ? stats.reportReasons.map((r) => ({ label: S.REASONS[r.reason] ?? r.reason, v: r.count }))
    : S.BACKEND
    ? reportReasons(st.reports)
    : Object.entries(S.REASONS).map(([k, l]) => ({ label: l, v: st.reports.filter((r) => r.reason === k).length })).filter((x) => x.v).sort((a, b) => b.v - a.v);
  const overdue = S.pendingData().filter((d) => now - d.createdAt > st.rules.deletionDays * D).length;
  // Le serveur ne garde pas l'activité jour par jour ; la démo ne compte pas les commentaires par jour.
  const metrics = METRICS.filter(([m]) => (S.BACKEND ? m !== 'active' : m !== 'comments'));

  return (
    <div className="view" ref={ref}>
      <PageHead title={`Bonjour, ${S.me().pseudo} 👋`} sub={`Voici l'état de On Bade au ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}.`} />
      {overdue ? (
        <div className="alert bad" data-enter><Icon name="alert" />
          <span><b>{overdue} demande{overdue > 1 ? 's' : ''} de données personnelles dépasse{overdue > 1 ? 'nt' : ''} le délai de {st.rules.deletionDays} jours.</b> La loi impose de les traiter. <Link to="/data">Traiter maintenant</Link></span>
        </div>
      ) : null}

      <section className="kpis">
        {kpis.map((k) => (
          <Link key={k.label} className="kpi card" to={k.href} data-enter>
            <span className="kpi-top"><Icon name={k.ic} /><span>{k.label}</span></span>
            <CountUp value={k.v ?? 0} />
            <span className="kpi-sub">
              {k.d === null ? null : <><span className={`delta ${k.d >= 0 ? 'up' : 'down'}`}>{k.d >= 0 ? '▲' : '▼'} {Math.abs(k.d)} %</span> vs semaine dernière · </>}
              {k.sub}
            </span>
          </Link>
        ))}
      </section>

      <section className="todo" data-enter>
        {todo.map((t) => (
          <Link key={t.label} className={`todo-item ${t.n ? t.tone : 'zero'}`} to={t.href}><Icon name={t.ic} /><b>{t.n}</b><span>{t.label}</span><Icon name="chevronRight" /></Link>
        ))}
      </section>

      <section className="grid-2">
        <div className="card" data-enter>
          <div className="card-head"><h2>Badings publiés par jour</h2>
            <div className="seg" role="tablist" data-metric>
              {metrics.map(([m, l]) => <button key={m} role="tab" aria-selected={metric === m} data-m={m} onClick={() => setMetric(m)}>{l}</button>)}
            </div>
          </div>
          <div data-chart><LineChart points={daily.map((d) => ({ label: dayLabel(d.date), v: d[metric] ?? 0 }))} label={metric} /></div>
          <p className="muted small">30 derniers jours{S.BACKEND ? ' · badings encore en ligne, hors rebades' : ''}</p>
        </div>
        <div className="card" data-enter>
          <div className="card-head"><h2>Motifs de signalement</h2><Link to="/reports" className="link">Voir la file</Link></div>
          {reasons.length ? <BarList items={reasons} /> : <p className="muted">Aucun signalement.</p>}
        </div>
      </section>

      <section className="grid-2">
        <div className="card" data-enter>
          <div className="card-head"><h2>Badings les plus drôles</h2><Link to="/badings?sort=likes" className="link">Tout voir</Link></div>
          <ol className="top-list">
            {top.map((b, i) => (
              <li key={b.id}><span className="rank">{i + 1}</span>
                <Link to={`/badings/${b.id}`}><span className="t">{b.text}</span><small>{b.anonymous ? 'Badeur anonyme' : `@${S.user(b.authorId)?.pseudo}`} · 😂 {S.compact(b.likes)} · {S.timeAgo(b.createdAt)}</small></Link></li>
            ))}
          </ol>
        </div>
        {S.BACKEND && !st.audit.length ? (
          <div className="card" data-enter>
            <div className="card-head"><h2>Derniers inscrits</h2><Link to="/users" className="link">Tous les utilisateurs</Link></div>
            <ul className="feed-list">{recent.map((u) => <li key={u.id}><Link to={`/users/${u.id}`}><UserCell user={u} sub={`inscrit ${S.timeAgo(u.joinedAt)}`} /></Link></li>)}</ul>
          </div>
        ) : (
          <div className="card" data-enter>
            <div className="card-head"><h2>Dernières actions de l'équipe</h2><Link to="/audit" className="link">Journal complet</Link></div>
            <ul className="feed-list">{st.audit.slice(0, 7).map((l) => <li key={l.id}><UserCell user={S.user(l.actor) ?? (l.actor === 'system' ? { pseudo: 'automatique', hue: 0 } : null)} sub={`${actionLabel(l.action)} · ${S.timeAgo(l.at)}`} /><p>{l.detail ?? ''}</p></li>)}</ul>
          </div>
        )}
      </section>
    </div>
  );
}
