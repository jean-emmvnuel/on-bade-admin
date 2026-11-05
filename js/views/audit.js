import * as S from '../store.js';
import { $, enter, esc, icon, pageHead, table, userCell } from '../ui.js';
import { actionLabel } from './dashboard.js';

export function auditView(root, { query, go }) {
  const f = { q: query.q || '', actor: query.actor || 'all', target: query.target || '' };
  const set = (p) => go(`/audit?${new URLSearchParams({ ...f, ...p })}`);
  const st = S.get();
  const actors = [...new Set(st.audit.map((l) => l.actor))];
  const list = st.audit.filter((l) => (f.actor === 'all' || l.actor === f.actor) && (!f.target || l.target === f.target) && (!f.q || `${l.detail} ${actionLabel(l.action)}`.toLowerCase().includes(f.q.toLowerCase())));
  const targetLink = (t) => {
    if (!t) return '—';
    if (S.user(t)) return `<a href="#/users/${t}">@${esc(S.user(t).pseudo)}</a>`;
    if (S.bading(t)) return `<a href="#/badings/${t}">Bading ${t}</a>`;
    return esc(t);
  };
  root.innerHTML = `
    ${pageHead('Journal d’audit', 'Toutes les actions de l’équipe, sans possibilité de modification. Conservé 12 mois.', `<button class="btn btn-secondary btn-sm" data-export>${icon('download')} Exporter (CSV)</button>`)}
    <div class="toolbar card" data-enter>
      <div class="search-inline">${icon('search')}<input data-q type="search" placeholder="Rechercher dans le journal…" value="${esc(f.q)}"/></div>
      <select data-actor aria-label="Membre"><option value="all">Toute l’équipe</option>${actors.map((a) => `<option value="${a}" ${f.actor === a ? 'selected' : ''}>@${esc(S.user(a)?.pseudo ?? a)}</option>`).join('')}</select>
      ${f.target ? `<button class="btn btn-ghost btn-sm" data-clear>${icon('x')} Cible : ${esc(S.user(f.target)?.pseudo ?? f.target)}</button>` : ''}
    </div>
    <div data-enter>${table(['Date', 'Membre', 'Action', 'Cible', 'Détail'], list.slice(0, 200).map((l) => `<tr class="${l.action === 'vault.reveal' ? 'row-alert' : ''}"><td class="nowrap">${S.fmtDate(l.at)}</td><td>${userCell(S.user(l.actor))}</td><td class="nowrap"><b>${actionLabel(l.action)}</b></td><td>${targetLink(l.target)}</td><td>${esc(l.detail ?? '')}</td></tr>`), 'Aucune entrée.')}</div>`;
  enter(root);
  let t; $('[data-q]', root).oninput = (e) => { clearTimeout(t); t = setTimeout(() => set({ q: e.target.value }), 350); };
  $('[data-actor]', root).onchange = (e) => set({ actor: e.target.value });
  $('[data-clear]', root)?.addEventListener('click', () => set({ target: '' }));
  $('[data-export]', root).onclick = () => {
    const rows = [['date', 'membre', 'action', 'cible', 'detail'], ...list.map((l) => [new Date(l.at).toISOString(), S.user(l.actor)?.pseudo ?? l.actor, l.action, l.target ?? '', l.detail ?? ''])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv' })), download: `jebade-audit-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  if (f.q) { const i = $('[data-q]', root); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
