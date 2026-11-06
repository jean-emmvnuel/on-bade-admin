import * as S from '../store.js';
import { $, animateCharts, barList, countUp, enter, esc, icon, lineChart, pageHead, userCell } from '../ui.js';

const D = 86_400_000;
const ACTIONS = {
  'auth.login': 'Connexion', 'auth.logout': 'Déconnexion', 'report.resolve': 'Signalement', 'bading.hide': 'Bading masqué', 'bading.delete': 'Bading supprimé', 'bading.restore': 'Bading rétabli',
  'vault.reveal': 'Auteur révélé', 'comment.delete': 'Commentaire supprimé', 'comment.restore': 'Commentaire rétabli', 'user.sanction': 'Sanction', 'user.unsanction': 'Sanction levée',
  'badge.grant': 'Badge attribué', 'badge.revoke': 'Badge retiré', 'badge.decision': 'Demande de badge', 'user.role': 'Rôle modifié', 'user.pseudo': 'Pseudo modifié',
  'user.password_reset': 'Mot de passe', 'user.delete': 'Compte supprimé', 'data.process': 'Données perso', 'data.cancel': 'Données perso', 'announcement.send': 'Annonce',
  'sticker.remove': 'Sticker retiré', 'sticker.restore': 'Sticker rétabli', 'words.add': 'Mot interdit', 'words.remove': 'Mot interdit', 'rules.update': 'Règles', 'platform.update': 'Plateforme', 'platform.reset': 'Démo',
};
export const actionLabel = (a) => ACTIONS[a] ?? a;

export function dashboardView(root) {
  const st = S.get(), now = Date.now();
  const users = S.users().filter((u) => u.status !== 'deleted');
  const daily = st.daily;
  const last7 = daily.slice(-7), prev7 = daily.slice(-14, -7);
  const sum = (arr, k) => arr.reduce((n, d) => n + d[k], 0);
  const delta = (k) => { const a = sum(last7, k), b = sum(prev7, k) || 1; return Math.round(((a - b) / b) * 100); };
  const active7 = users.filter((u) => now - u.lastActiveAt < 7 * D).length;
  const visible = st.badings.filter((b) => b.status === 'visible');
  const anonShare = Math.round((visible.filter((b) => b.anonymous).length / (visible.length || 1)) * 100);
  const totalLaughs = visible.reduce((n, b) => n + b.likes, 0);

  const kpis = [
    { label: 'Utilisateurs', v: users.length, sub: `${sum(last7, 'signups')} inscrits cette semaine`, d: delta('signups'), ic: 'users', href: '/users' },
    { label: 'Actifs (7 jours)', v: active7, sub: `${Math.round((active7 / users.length) * 100)} % des comptes`, d: delta('active'), ic: 'trendingUp', href: '/users' },
    { label: 'Badings en ligne', v: visible.length, sub: `${anonShare} % en anonyme`, d: delta('badings'), ic: 'quote', href: '/badings' },
    { label: 'Rires', v: totalLaughs, sub: `${S.compact(sum(last7, 'laughs'))} cette semaine`, d: delta('laughs'), ic: 'laugh', href: '/badings' },
  ];
  const todo = [
    { n: S.openReports().length, label: 'signalements à traiter', href: '/reports', ic: 'flag', tone: 'warn' },
    { n: S.pendingBadges().length, label: 'demandes de badge', href: '/badges', ic: 'badgeCheck', tone: '' },
    { n: S.pendingData().length, label: 'demandes de données perso', href: '/data', ic: 'database', tone: '' },
    { n: st.badings.filter((b) => b.status === 'hidden').length, label: 'badings masqués à revoir', href: '/badings?status=hidden', ic: 'eyeOff', tone: '' },
  ];
  const label = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const top = [...visible].sort((a, b) => b.likes - a.likes).slice(0, 5);
  const reasons = Object.entries(S.REASONS).map(([k, l]) => ({ label: l, v: st.reports.filter((r) => r.reason === k).length })).filter((x) => x.v).sort((a, b) => b.v - a.v);
  const overdue = S.pendingData().filter((d) => now - d.createdAt > st.rules.deletionDays * D).length;

  root.innerHTML = `
    ${pageHead(`Bonjour, ${esc(S.me().pseudo)} 👋`, `Voici l'état de On Bade au ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}.`)}
    ${overdue ? `<div class="alert bad" data-enter>${icon('alert')}<span><b>${overdue} demande${overdue > 1 ? 's' : ''} de données personnelles dépasse${overdue > 1 ? 'nt' : ''} le délai de ${st.rules.deletionDays} jours.</b> La loi impose de les traiter. <a href="#/data">Traiter maintenant</a></span></div>` : ''}
    <section class="kpis">${kpis.map((k) => `
      <a class="kpi card" href="#${k.href}" data-enter>
        <span class="kpi-top">${icon(k.ic)}<span>${k.label}</span></span>
        <b data-count="${k.v}">0</b>
        <span class="kpi-sub"><span class="delta ${k.d >= 0 ? 'up' : 'down'}">${k.d >= 0 ? '▲' : '▼'} ${Math.abs(k.d)} %</span> vs semaine dernière · ${k.sub}</span>
      </a>`).join('')}</section>

    <section class="todo" data-enter>${todo.map((t) => `<a class="todo-item ${t.n ? t.tone : 'zero'}" href="#${t.href}">${icon(t.ic)}<b>${t.n}</b><span>${t.label}</span>${icon('chevronRight')}</a>`).join('')}</section>

    <section class="grid-2">
      <div class="card" data-enter>
        <div class="card-head"><h2>Badings publiés par jour</h2><div class="seg" role="tablist" data-metric>
          <button role="tab" aria-selected="true" data-m="badings">Badings</button><button role="tab" aria-selected="false" data-m="signups">Inscriptions</button><button role="tab" aria-selected="false" data-m="active">Actifs</button><button role="tab" aria-selected="false" data-m="laughs">Rires</button></div></div>
        <div data-chart></div>
        <p class="muted small">30 derniers jours</p>
      </div>
      <div class="card" data-enter>
        <div class="card-head"><h2>Motifs de signalement</h2><a href="#/reports" class="link">Voir la file</a></div>
        ${reasons.length ? barList(reasons) : '<p class="muted">Aucun signalement.</p>'}
      </div>
    </section>

    <section class="grid-2">
      <div class="card" data-enter>
        <div class="card-head"><h2>Badings les plus drôles</h2><a href="#/badings?sort=likes" class="link">Tout voir</a></div>
        <ol class="top-list">${top.map((b, i) => `<li><span class="rank">${i + 1}</span><a href="#/badings/${b.id}"><span class="t">${esc(b.text)}</span><small>${b.anonymous ? 'Badeur anonyme' : '@' + esc(S.user(b.authorId)?.pseudo)} · 😂 ${S.compact(b.likes)} · ${S.timeAgo(b.createdAt)}</small></a></li>`).join('')}</ol>
      </div>
      <div class="card" data-enter>
        <div class="card-head"><h2>Dernières actions de l'équipe</h2><a href="#/audit" class="link">Journal complet</a></div>
        <ul class="feed-list">${st.audit.slice(0, 7).map((l) => `<li>${userCell(S.user(l.actor), `${actionLabel(l.action)} · ${S.timeAgo(l.at)}`)}<p>${esc(l.detail ?? '')}</p></li>`).join('')}</ul>
      </div>
    </section>`;

  const drawChart = (m) => {
    $('[data-chart]', root).innerHTML = lineChart(daily.map((d) => ({ label: label(d.date), v: d[m] })), { label: m });
    animateCharts($('[data-chart]', root));
  };
  root.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => {
    root.querySelectorAll('[data-m]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    drawChart(b.dataset.m);
  }));
  drawChart('badings');
  enter(root);
  animateCharts(root);
  root.querySelectorAll('[data-count]').forEach((el) => countUp(el, +el.dataset.count));
}
