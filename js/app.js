import * as S from './store.js';
import { $, avatar, closeMenu, closeModal, esc, icon, logo, menu, toast } from './ui.js';
import { loginView } from './views/login.js';
import { dashboardView } from './views/dashboard.js';
import { reportsView } from './views/reports.js';
import { badingsView, badingDetailView } from './views/badings.js';
import { commentsView } from './views/comments.js';
import { usersView, userDetailView } from './views/users.js';
import { badgesView } from './views/badges.js';
import { dataView } from './views/data.js';
import { announcementsView } from './views/announcements.js';
import { moderationView } from './views/moderation.js';
import { settingsView } from './views/settings.js';
import { auditView } from './views/audit.js';

const routes = [
  { path: /^\/login$/, view: loginView, bare: true },
  { path: /^\/$/, view: dashboardView, nav: 'dashboard' },
  { path: /^\/reports$/, view: reportsView, nav: 'reports' },
  { path: /^\/badings$/, view: badingsView, nav: 'badings' },
  { path: /^\/badings\/([\w-]+)$/, view: badingDetailView, nav: 'badings', keys: ['id'] },
  { path: /^\/comments$/, view: commentsView, nav: 'comments' },
  { path: /^\/users$/, view: usersView, nav: 'users' },
  { path: /^\/users\/([\w-]+)$/, view: userDetailView, nav: 'users', keys: ['id'] },
  { path: /^\/badges$/, view: badgesView, nav: 'badges' },
  { path: /^\/data$/, view: dataView, nav: 'data' },
  { path: /^\/announcements$/, view: announcementsView, nav: 'announcements' },
  { path: /^\/moderation$/, view: moderationView, nav: 'moderation' },
  { path: /^\/settings$/, view: settingsView, nav: 'settings' },
  { path: /^\/audit$/, view: auditView, nav: 'audit' },
];

const NAV = [
  ['Vue d’ensemble', [['dashboard', '/', 'dashboard', 'Tableau de bord']]],
  ['Modération', [['reports', '/reports', 'flag', 'Signalements', () => S.openReports().length], ['badings', '/badings', 'quote', 'Badings'], ['comments', '/comments', 'message', 'Commentaires'], ['moderation', '/moderation', 'shield', 'Mots interdits & règles']]],
  ['Communauté', [['users', '/users', 'users', 'Utilisateurs'], ['badges', '/badges', 'badgeCheck', 'Badges vérifiés', () => S.pendingBadges().length], ['announcements', '/announcements', 'megaphone', 'Annonces']]],
  ['Conformité', [['data', '/data', 'database', 'Données personnelles', () => S.pendingData().length], ['audit', '/audit', 'fileText', 'Journal d’audit']]],
  ['Plateforme', [['settings', '/settings', 'sliders', 'Paramètres']]],
];

export const go = (path) => { location.hash = `#${path}`; };
function parse() {
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

let cleanup = null, shellMounted = false;

function render() {
  const { path, query } = parse();
  let route = null; const params = {};
  for (const r of routes) { const m = path.match(r.path); if (m) { route = r; (r.keys || []).forEach((k, i) => (params[k] = m[i + 1])); break; } }
  if (!route) return go('/');
  if (!S.me() && !route.bare) return go('/login');
  if (S.me() && route.bare) return go('/');

  closeModal(true); closeMenu();
  cleanup?.(); cleanup = null;
  const app = $('#app');
  if (route.bare) { shellMounted = false; app.innerHTML = '<main id="view"></main>'; }
  else if (!shellMounted) { app.innerHTML = shell(); shellMounted = true; wireShell(); }
  if (!route.bare) { updateNav(route.nav); document.body.classList.remove('nav-open'); }
  const view = $('#view');
  view.innerHTML = '';
  window.scrollTo(0, 0);
  cleanup = route.view(view, { params, query, go }) || null;
}

function shell() {
  return `
  <div class="shell">
    <aside class="side" aria-label="Navigation">
      <a class="brand" href="#/">${logo(30)}<span>je bade <em>admin</em></span></a>
      <nav>${NAV.map(([group, items]) => `<p class="nav-group">${group}</p>${items.map(([k, href, ic, label]) => `<a class="nav" data-nav="${k}" href="#${href}">${icon(ic)}<span>${label}</span><b class="count" data-count="${k}" hidden></b></a>`).join('')}`).join('')}</nav>
      <div class="side-foot"><span class="dot-live"></span>Plateforme <b data-live>en ligne</b></div>
    </aside>
    <div class="scrim-nav" data-close-nav></div>
    <div class="content">
      <header class="topbar">
        <button class="icon-btn only-mobile" data-open-nav aria-label="Menu">${icon('menu')}</button>
        <div class="search" role="search">${icon('search')}<input data-search type="search" placeholder="Rechercher un utilisateur, un e-mail, un bading…" aria-label="Recherche globale"/><div class="search-results" data-results hidden></div></div>
        <button class="me-btn" data-me aria-label="Mon compte">${avatar(S.me(), 34)}<span class="hide-sm"><b>@${esc(S.me()?.pseudo)}</b><small>${S.ROLES[S.me()?.role]}</small></span></button>
      </header>
      <div class="maintenance-banner" data-maint hidden>${icon('alert')} Mode maintenance actif : l'app est fermée au public.</div>
      <main id="view" class="page"></main>
    </div>
  </div>`;
}

function wireShell() {
  const refresh = () => {
    NAV.flatMap(([, items]) => items).forEach(([k, , , , count]) => {
      const el = $(`[data-count="${k}"]`); if (!el || !count) return;
      const n = count(); el.hidden = !n; el.textContent = n;
    });
    const maint = S.get().platform.maintenance;
    $('[data-maint]').hidden = !maint;
    $('[data-live]').textContent = maint ? 'en maintenance' : 'en ligne';
    $('.dot-live').classList.toggle('off', maint);
  };
  refresh();
  S.subscribe(() => shellMounted && refresh());

  $('[data-open-nav]').onclick = () => document.body.classList.add('nav-open');
  $('[data-close-nav]').onclick = () => document.body.classList.remove('nav-open');

  $('[data-me]').onclick = async (e) => {
    const k = await menu(e.currentTarget, [{ k: 'profile', icon: 'user', label: 'Mon profil' }, { k: 'audit', icon: 'fileText', label: 'Mes actions' }, '-', { k: 'logout', icon: 'logOut', label: 'Se déconnecter', danger: true }]);
    if (k === 'profile') go(`/users/${S.me().id}`);
    if (k === 'audit') go(`/audit?actor=${S.me().id}`);
    if (k === 'logout') { S.logOut(); shellMounted = false; toast('À bientôt 👋'); go('/login'); }
  };

  // Recherche globale : utilisateurs (pseudo, e-mail) et badings (texte, identifiant).
  const input = $('[data-search]'), results = $('[data-results]');
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { results.hidden = true; return; }
    const us = S.users().filter((u) => u.pseudo.toLowerCase().includes(q) || u.email.includes(q)).slice(0, 5);
    const bs = S.get().badings.filter((b) => b.id === q || b.text.toLowerCase().includes(q)).slice(0, 5);
    results.innerHTML = (us.length || bs.length)
      ? `${us.length ? `<p>Utilisateurs</p>${us.map((u) => `<a href="#/users/${u.id}">${avatar(u, 26)}<span>@${esc(u.pseudo)}<small>${esc(u.email)}</small></span></a>`).join('')}` : ''}
         ${bs.length ? `<p>Badings</p>${bs.map((b) => `<a href="#/badings/${b.id}">${icon('quote')}<span>${esc(b.text.slice(0, 70))}…<small>${b.id} · ${b.anonymous ? 'anonyme' : '@' + esc(S.user(b.authorId)?.pseudo)}</small></span></a>`).join('')}` : ''}`
      : '<p class="none">Aucun résultat</p>';
    results.hidden = false;
  };
  input.addEventListener('input', draw);
  input.addEventListener('focus', draw);
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; results.hidden = true; input.blur(); } if (e.key === 'Enter') { const a = results.querySelector('a'); if (a) { location.hash = a.getAttribute('href'); results.hidden = true; input.value = ''; } } });
  results.addEventListener('click', () => { results.hidden = true; input.value = ''; });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) results.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); } });
}

function updateNav(active) {
  document.querySelectorAll('[data-nav]').forEach((a) => (a.dataset.nav === active ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
}

window.addEventListener('hashchange', render);
render();
