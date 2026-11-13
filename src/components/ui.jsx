// Briques d'interface partagées : icônes, avatars, pastilles, tableaux, graphiques, stickers.
import { useLayoutEffect, useRef } from 'react';
import { ICONS } from '../lib/icons-data.js';
import { sticker as builtinSticker } from '../lib/stickers.js';
import { customSticker } from '../lib/store.js';
import { gsap, reduceMotion } from '../lib/motion.js';

const nf = (v) => v.toLocaleString('fr-FR');

/** Icône Lucide (tracés statiques de icons-data.js). */
export const Icon = ({ name, className = '' }) => (
  <svg className={`i ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] ?? '' }} />
);

export const Logo = ({ size = 28, color = '#9810e6' }) => (
  <svg viewBox="0 0 256 256" width={size} height={size} fill={color} role="img" aria-label="On Bade">
    <path d="M40 46a22 22 0 0 1 44 0V214a22 22 0 0 1-44 0Z" />
    <path fillRule="evenodd" d="M68 158A78 78 0 1 0 224 158A78 78 0 1 0 68 158Z M104 146H188A42 42 0 0 1 104 146Z" />
  </svg>
);

export const Verified = () => (
  <svg className="verified" viewBox="0 0 24 24" aria-label="Compte vérifié">
    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" fill="#9810e6" />
    <path d="m16 9-5.5 5.5L8 12" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Photo, initiale colorée, ou masque pour un Badeur anonyme (`user` absent). */
export function Avatar({ user: u, size = 36 }) {
  const s = { width: size, height: size };
  if (!u) return <span className="avatar anon" style={s} role="img" aria-label="Badeur anonyme"><Icon name="mask" /></span>;
  if (u.photo) return <img className="avatar" style={{ ...s, objectFit: 'cover' }} src={u.photo} alt={u.pseudo} loading="lazy" />;
  return (
    <span className="avatar" style={{ ...s, background: `hsl(${u.hue},38%,30%)`, color: `hsl(${u.hue},80%,86%)`, fontSize: Math.round(size * 0.42) }} role="img" aria-label={u.pseudo}>
      {u.pseudo?.[0]?.toUpperCase()}
    </span>
  );
}

export const UserCell = ({ user: u, sub }) => (
  <span className="who">
    <Avatar user={u} size={32} />
    <span><b>@{u?.pseudo ?? 'inconnu'}{u?.verified ? <Verified /> : null}</b>{sub ? <small>{sub}</small> : null}</span>
  </span>
);

export const Pill = ({ tone = 'neutral', children }) => <span className={`pill ${tone}`}>{children}</span>;

const STATUS = {
  active: ['Actif', 'good'], suspended: ['Suspendu', 'warn'], banned: ['Banni', 'bad'], deleted: ['Supprimé', 'neutral'],
  visible: ['Visible', 'good'], hidden: ['Masqué', 'warn'], open: ['À traiter', 'warn'], dismissed: ['Classé', 'neutral'], actioned: ['Traité', 'good'],
  pending: ['En attente', 'warn'], accepted: ['Accepté', 'good'], refused: ['Refusé', 'bad'], done: ['Effectué', 'good'], cancelled: ['Annulé', 'neutral'],
};
export function StatusPill({ status }) {
  const [text, tone] = STATUS[status] ?? [status, 'neutral'];
  return <Pill tone={tone}>{text}</Pill>;
}

/** Tableau : `head` = intitulés, `children` = lignes <tr>. */
export function Table({ head, children, empty = 'Rien à afficher.' }) {
  const rows = [children].flat(Infinity).filter(Boolean);
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{rows.length ? rows : <tr><td colSpan={head.length} className="empty-row">{empty}</td></tr>}</tbody>
      </table>
    </div>
  );
}

export const PageHead = ({ title, sub, actions }) => (
  <header className="page-head" data-enter>
    <div><h1>{title}</h1>{sub ? <p className="muted">{sub}</p> : null}</div>
    {actions ? <div className="page-actions">{actions}</div> : null}
  </header>
);

export const Empty = ({ icon, title, children }) => (
  <div className="empty card" data-enter><Icon name={icon} /><h2>{title}</h2>{children}</div>
);

/** Sticker de la bibliothèque (dessiné en CSS) ou sticker personnel (image), éventuellement retiré par la modération. */
export function Sticker({ id, size = 128 }) {
  const c = customSticker(id);
  if (c) {
    if (c.removed || c.status === 'removed') return <span className="stk stk-removed" style={{ '--w': `${size}px` }}>Sticker retiré par la modération</span>;
    return <span className="stk stk-img" style={{ '--w': `${size}px` }} role="img" aria-label={c.label ? `Sticker ${c.label}` : 'Sticker personnel'}><img src={c.src} alt="" draggable="false" /></span>;
  }
  const s = builtinSticker(id);
  if (!s) return null;
  return (
    <span className="stk" style={{ '--w': `${size}px`, '--sbg': s.bg, '--sfg': s.fg, '--rot': `${s.rot}deg` }} role="img" aria-label={`Sticker ${s.label}`}>
      <span className="stk-e">{s.emoji}</span><span className="stk-t">{s.label}</span>
    </span>
  );
}

/** Nombre qui défile de 0 à `value` à l'apparition. */
export function CountUp({ value, duration = 0.9 }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduceMotion()) return undefined;
    const o = { v: 0 };
    const tw = gsap.to(o, { v: value, duration, ease: 'power2.out', onUpdate: () => { el.textContent = nf(Math.round(o.v)); } });
    return () => tw.kill();
  }, [value, duration]);
  return <b ref={ref}>{nf(value)}</b>;
}

/** Courbe d'une série dans le temps, avec aire légère et dernière valeur marquée. */
export function LineChart({ points, height = 220, label = '', color = 'var(--brand-ink)' }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (!ref.current || reduceMotion()) return undefined;
    const ctx = gsap.context(() => {
      const line = ref.current.querySelector('.line');
      const L = line?.getTotalLength?.() || 1000;
      gsap.fromTo(line, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.out' });
      gsap.from(ref.current.querySelector('.area'), { opacity: 0, duration: 1.2, delay: 0.3 });
    }, ref);
    return () => ctx.revert();
  }, [points]);
  if (points.length < 2) return null;

  const W = 640, Hh = height, pad = { l: 40, r: 16, t: 16, b: 28 };
  const max = Math.max(...points.map((p) => p.v)) * 1.1 || 1;
  const x = (i) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / max) * (Hh - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join('');
  const area = `${line}L${x(points.length - 1)} ${Hh - pad.b}L${x(0)} ${Hh - pad.b}Z`;
  const ticks = [0, 0.5, 1].map((f) => Math.round((max * f) / 1.1));
  const step = Math.ceil(points.length / 6);
  const last = points.at(-1);
  return (
    <svg ref={ref} className="chart" viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label={label}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="tick">{nf(t)}</text>
        </g>
      ))}
      {points.map((p, i) => (i % step === 0 || i === points.length - 1
        ? <text key={i} x={x(i)} y={Hh - 8} textAnchor="middle" className="tick">{p.label}</text> : null))}
      <path d={area} fill={color} opacity="0.12" className="area" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="line" />
      <circle cx={x(points.length - 1)} cy={y(last.v)} r="5" fill={color} />
      <text x={x(points.length - 1) - 10} y={y(last.v) - 12} textAnchor="end" className="val">{nf(last.v)}</text>
    </svg>
  );
}

/** Barres horizontales : une mesure pour quelques catégories. */
export function BarList({ items, format = nf }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (!ref.current || reduceMotion()) return undefined;
    const ctx = gsap.context(() => {
      ref.current.querySelectorAll('.bar-track i').forEach((b, i) => gsap.from(b, { width: 0, duration: 0.8, delay: i * 0.05, ease: 'expo.out' }));
    }, ref);
    return () => ctx.revert();
  }, [items.length]);
  const max = Math.max(...items.map((i) => i.v), 1);
  return (
    <div className="barlist" ref={ref}>
      {items.map((i) => (
        <div className="bar-row" key={i.label}>
          <span className="bar-label">{i.label}</span>
          <span className="bar-track"><i style={{ width: `${(i.v / max) * 100}%` }} /></span>
          <b>{format(i.v)}</b>
        </div>
      ))}
    </div>
  );
}

/** Champ de recherche dont la valeur part dans l'adresse après une courte pause de frappe. */
export { useDebouncedField } from './useDebouncedField.js';
