import { ICONS } from './icons-data.js';

export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;

const LOGO = '<path d="M40 46a22 22 0 0 1 44 0V214a22 22 0 0 1-44 0Z"/><path fill-rule="evenodd" d="M68 158A78 78 0 1 0 224 158A78 78 0 1 0 68 158Z M104 146H188A42 42 0 0 1 104 146Z"/>';
export const logo = (size = 28, color = '#9810e6') => `<svg viewBox="0 0 256 256" width="${size}" height="${size}" fill="${color}" role="img" aria-label="On Bade">${LOGO}</svg>`;
export const verified = () => `<svg class="verified" viewBox="0 0 24 24" aria-label="Compte vérifié"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" fill="#9810e6"/><path d="m16 9-5.5 5.5L8 12" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function avatar(u, size = 36) {
  const s = `width:${size}px;height:${size}px`;
  if (!u) return `<span class="avatar anon" style="${s}" role="img" aria-label="Badeur anonyme">${icon('mask')}</span>`;
  return `<span class="avatar" style="${s};background:hsl(${u.hue},38%,30%);color:hsl(${u.hue},80%,86%);font-size:${Math.round(size * 0.42)}px" role="img" aria-label="${esc(u.pseudo)}">${esc(u.pseudo[0]?.toUpperCase())}</span>`;
}
export const userCell = (u, sub = '') => `<span class="who">${avatar(u, 32)}<span><b>@${esc(u?.pseudo ?? 'inconnu')}${u?.verified ? verified() : ''}</b>${sub ? `<small>${sub}</small>` : ''}</span></span>`;

export const pill = (text, tone = 'neutral') => `<span class="pill ${tone}">${esc(text)}</span>`;
const STATUS = {
  active: ['Actif', 'good'], suspended: ['Suspendu', 'warn'], banned: ['Banni', 'bad'], deleted: ['Supprimé', 'neutral'],
  visible: ['Visible', 'good'], hidden: ['Masqué', 'warn'], open: ['À traiter', 'warn'], dismissed: ['Classé', 'neutral'], actioned: ['Traité', 'good'],
  pending: ['En attente', 'warn'], accepted: ['Accepté', 'good'], refused: ['Refusé', 'bad'], done: ['Effectué', 'good'], cancelled: ['Annulé', 'neutral'],
};
export const statusPill = (s) => pill(...(STATUS[s] ?? [s, 'neutral']));

// ─── Toast ────────────────────────────────────────────────
let toastTimer;
export function toast(msg, tone = '') {
  const el = $('#toast');
  el.innerHTML = `<div class="${tone}">${esc(msg)}</div>`;
  const d = el.firstElementChild;
  if (!reduceMotion()) gsap.from(d, { y: 16, opacity: 0, duration: 0.3, ease: 'expo.out' });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => gsap.to(d, { opacity: 0, y: 8, duration: 0.2, onComplete: () => d.remove() }), 3200);
}

// ─── Fenêtre modale ───────────────────────────────────────
export function modal({ title, html, wide = false, onMount }) {
  closeModal(true);
  const root = $('#modal-root');
  root.insertAdjacentHTML('beforeend', `<div class="scrim" data-close></div><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Fermer">${icon('x')}</button></header>
    <div class="modal-body">${html}</div></div>`);
  const box = $('.modal', root);
  root.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => closeModal()));
  const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', onKey); root._off = () => document.removeEventListener('keydown', onKey);
  if (!reduceMotion()) { gsap.from($('.scrim', root), { opacity: 0, duration: 0.2 }); gsap.from(box, { y: 20, scale: 0.97, opacity: 0, duration: 0.35, ease: 'expo.out' }); }
  onMount?.(box);
  (box.querySelector('input, textarea, select, button:not([data-close])') || box).focus?.();
  return box;
}
export function closeModal(instant = false) {
  const root = $('#modal-root'); if (!root?.firstChild) return;
  root._off?.();
  const nodes = [...root.children];
  if (instant || reduceMotion()) { nodes.forEach((n) => n.remove()); return; }
  // Retire seulement les nœuds de cette fenêtre : une nouvelle modale peut s'ouvrir pendant le fondu.
  nodes.forEach((n) => n.removeAttribute('data-close'));
  gsap.to(nodes, { opacity: 0, duration: 0.15, onComplete: () => nodes.forEach((n) => n.remove()) });
}

/** Confirmation, avec motif obligatoire si `reason` est demandé. Résout le motif (ou true), ou null si annulé. */
export function confirmAction({ title, text = '', confirm = 'Confirmer', danger = false, reason = false, reasonLabel = 'Motif', reasonHint = 'Le motif est inscrit dans le journal d’audit.', presets = [] }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; closeModal(); resolve(v); };
    const box = modal({
      title,
      html: `${text ? `<p class="muted">${text}</p>` : ''}
        ${reason ? `<div class="field"><label for="reason">${reasonLabel}</label>
          ${presets.length ? `<div class="chips">${presets.map((p) => `<button type="button" class="chip" data-preset="${esc(p)}">${esc(p)}</button>`).join('')}</div>` : ''}
          <textarea id="reason" rows="3" maxlength="300" placeholder="Explique la décision…"></textarea><small class="hint">${reasonHint}</small></div>` : ''}
        <div class="modal-actions"><button class="btn btn-ghost" data-cancel>Annuler</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok ${reason ? 'disabled' : ''}>${esc(confirm)}</button></div>`,
    });
    const ok = $('[data-ok]', box), ta = $('#reason', box);
    ta?.addEventListener('input', () => (ok.disabled = ta.value.trim().length < 3));
    box.querySelectorAll('[data-preset]').forEach((b) => (b.onclick = () => { ta.value = b.dataset.preset; ok.disabled = false; ta.focus(); }));
    $('[data-cancel]', box).onclick = () => finish(null);
    ok.onclick = () => finish(reason ? ta.value.trim() : true);
    $('#modal-root').querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => finish(null)));
  });
}

// ─── Menus déroulants d'actions ───────────────────────────
export function menu(anchor, items) {
  closeMenu();
  const m = document.createElement('div');
  m.className = 'menu'; m.setAttribute('role', 'menu');
  m.innerHTML = items.filter(Boolean).map((it) => (it === '-' ? '<hr/>' : `<button role="menuitem" class="${it.danger ? 'danger' : ''}" data-k="${it.k}">${icon(it.icon)}${esc(it.label)}</button>`)).join('');
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  const left = Math.min(innerWidth - m.offsetWidth - 12, Math.max(12, r.right - m.offsetWidth));
  const top = r.bottom + 6 + m.offsetHeight > innerHeight ? r.top - m.offsetHeight - 6 : r.bottom + 6;
  Object.assign(m.style, { left: `${left}px`, top: `${top + scrollY}px` });
  if (!reduceMotion()) gsap.from(m, { y: -6, opacity: 0, duration: 0.18, ease: 'power2.out' });
  return new Promise((resolve) => {
    m.onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) { closeMenu(); resolve(b.dataset.k); } };
    setTimeout(() => { document.addEventListener('click', menu._out = (e) => { if (!m.contains(e.target)) { closeMenu(); resolve(null); } }); }, 0);
  });
}
export function closeMenu() { document.querySelectorAll('.menu').forEach((m) => m.remove()); if (menu._out) document.removeEventListener('click', menu._out); }

// ─── Animations ───────────────────────────────────────────
export function countUp(el, to, duration = 0.9) {
  if (reduceMotion()) { el.textContent = to.toLocaleString('fr-FR'); return; }
  const o = { v: 0 };
  gsap.to(o, { v: to, duration, ease: 'power2.out', onUpdate: () => (el.textContent = Math.round(o.v).toLocaleString('fr-FR')) });
}
export function enter(root, sel = '[data-enter]') {
  if (reduceMotion()) return;
  gsap.from(root.querySelectorAll(sel), { y: 14, opacity: 0, duration: 0.5, stagger: 0.05, ease: 'expo.out', clearProps: 'transform,opacity' });
}

// ─── Graphiques SVG ───────────────────────────────────────
/** Courbe d'une série dans le temps, avec aire légère et dernière valeur marquée. */
export function lineChart(points, { height = 220, label = '', color = 'var(--brand-ink)' } = {}) {
  const W = 640, Hh = height, pad = { l: 40, r: 16, t: 16, b: 28 };
  const max = Math.max(...points.map((p) => p.v)) * 1.1 || 1;
  const x = (i) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / max) * (Hh - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join('');
  const area = `${line}L${x(points.length - 1)} ${Hh - pad.b}L${x(0)} ${Hh - pad.b}Z`;
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f / 1.1));
  const step = Math.ceil(points.length / 6);
  const last = points.at(-1);
  return `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(label)}">
    ${ticks.map((t) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end" class="tick">${t.toLocaleString('fr-FR')}</text>`).join('')}
    ${points.map((p, i) => (i % step === 0 || i === points.length - 1 ? `<text x="${x(i)}" y="${Hh - 8}" text-anchor="middle" class="tick">${p.label}</text>` : '')).join('')}
    <path d="${area}" fill="${color}" opacity="0.12" class="area"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" class="line"/>
    <circle cx="${x(points.length - 1)}" cy="${y(last.v)}" r="5" fill="${color}"/>
    <text x="${x(points.length - 1) - 10}" y="${y(last.v) - 12}" text-anchor="end" class="val">${last.v.toLocaleString('fr-FR')}</text>
  </svg>`;
}
/** Barres horizontales : une mesure pour quelques catégories. */
export function barList(items, { format = (v) => v.toLocaleString('fr-FR') } = {}) {
  const max = Math.max(...items.map((i) => i.v), 1);
  return `<div class="barlist">${items.map((i) => `<div class="bar-row"><span class="bar-label">${esc(i.label)}</span><span class="bar-track"><i style="width:${(i.v / max) * 100}%"></i></span><b>${format(i.v)}</b></div>`).join('')}</div>`;
}
export function animateCharts(root) {
  if (reduceMotion()) return;
  root.querySelectorAll('.chart .line').forEach((p) => { const L = p.getTotalLength?.() || 1000; gsap.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.out' }); });
  root.querySelectorAll('.chart .area').forEach((a) => gsap.from(a, { opacity: 0, duration: 1.2, delay: 0.3 }));
  root.querySelectorAll('.bar-track i').forEach((b, i) => gsap.from(b, { width: 0, duration: 0.8, delay: i * 0.05, ease: 'expo.out' }));
}

/** Tableau triable/filtrable simple. `rows` = HTML des <tr>. */
export const table = (head, rows, empty = 'Rien à afficher.') =>
  `<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${head.length}" class="empty-row">${empty}</td></tr>`}</tbody></table></div>`;

export const pageHead = (title, sub = '', actions = '') => `<header class="page-head" data-enter><div><h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</header>`;
