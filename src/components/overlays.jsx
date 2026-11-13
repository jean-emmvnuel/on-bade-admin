// Fenêtres modales, confirmations avec motif, menus d'actions et toasts.
// Les fonctions confirmAction() et menu() renvoient une promesse : les actions s'écrivent comme un dialogue
// (« demander, puis agir »), et les composants <ModalHost>, <MenuHost> et <Toaster> les affichent.
import { Fragment, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ui.jsx';
import { gsap, reduceMotion } from '../lib/motion.js';
import { onToast } from '../lib/toast.js';

// ─── Mini-store des calques ────────────────────────────────
function layer(initial) {
  let value = initial;
  const subs = new Set();
  return {
    get: () => value,
    set: (v) => { value = typeof v === 'function' ? v(value) : v; subs.forEach((fn) => fn()); },
    subscribe: (fn) => (subs.add(fn), () => subs.delete(fn)),
  };
}
const useLayer = (l) => useSyncExternalStore(l.subscribe, l.get);

// ─── Fenêtre modale ────────────────────────────────────────
const modals = layer([]);
let nextId = 1;

/**
 * Ouvre une fenêtre. `render(close)` dessine son contenu. `onDismiss` est appelé si on la ferme sans valider
 * (croix, fond, Échap) ; `abandon` si elle est remplacée ou fermée par un changement de page.
 */
export function openModal({ title, wide = false, render, onDismiss, abandon }) {
  closeModal(true);
  const entry = { id: nextId++, title, wide, render, onDismiss, abandon, closing: false };
  modals.set((list) => [...list, entry]);
  return entry.id;
}

/** Ferme la fenêtre ouverte (avec un fondu, sauf `instant`). */
export function closeModal(instant = false) {
  const list = modals.get();
  if (!list.length) return;
  if (instant || reduceMotion()) {
    list.forEach((e) => { if (!e.closing) e.abandon?.(); });
    modals.set([]);
    return;
  }
  modals.set(list.map((e) => (e.closing ? e : { ...e, closing: true })));
}
const removeModal = (id) => modals.set((list) => list.filter((e) => e.id !== id));
const dismiss = (entry) => (entry.onDismiss ? entry.onDismiss() : closeModal());

function ModalFrame({ entry }) {
  const scrim = useRef(null);
  const box = useRef(null);

  // Les animations sont annulées au démontage (ctx.revert) : sinon, en mode strict de React (effets joués deux fois
  // en développement), le second gsap.from() prendrait l'état à moitié transparent comme état final.
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (reduceMotion()) return;
      gsap.from(scrim.current, { opacity: 0, duration: 0.2 });
      gsap.from(box.current, { y: 20, scale: 0.97, opacity: 0, duration: 0.35, ease: 'expo.out' });
    });
    (box.current.querySelector('input, textarea, select, button:not([data-close])') || box.current).focus?.();
    return () => ctx.revert();
  }, []);

  useLayoutEffect(() => {
    if (!entry.closing) return undefined;
    const tw = gsap.to([scrim.current, box.current], { opacity: 0, duration: 0.15, onComplete: () => removeModal(entry.id) });
    return () => tw.kill();
  }, [entry.closing, entry.id]);

  useEffect(() => {
    if (entry.closing) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') dismiss(entry); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [entry]);

  // Une fenêtre qui s'efface n'est plus une boîte de dialogue : elle ne capte ni clics ni lecteurs d'écran.
  const live = !entry.closing;
  return (
    <>
      <div ref={scrim} className="scrim" onClick={live ? () => dismiss(entry) : undefined} style={live ? undefined : { pointerEvents: 'none' }} />
      <div ref={box} className={`modal ${entry.wide ? 'wide' : ''}`} tabIndex={-1}
        {...(live ? { role: 'dialog', 'aria-modal': 'true', 'aria-label': entry.title } : { 'aria-hidden': 'true', style: { pointerEvents: 'none' } })}>
        <header><h2>{entry.title}</h2><button className="icon-btn" data-close aria-label="Fermer" onClick={() => live && dismiss(entry)}><Icon name="x" /></button></header>
        <div className="modal-body">{entry.render(() => closeModal())}</div>
      </div>
    </>
  );
}

export function ModalHost() {
  const list = useLayer(modals);
  return <div id="modal-root">{list.map((e) => <Fragment key={e.id}><ModalFrame entry={e} /></Fragment>)}</div>;
}

// ─── Confirmation (avec motif obligatoire si `reason`) ─────
function ConfirmBody({ text, confirm, danger, reason, reasonLabel, reasonHint, presets, finish }) {
  const [why, setWhy] = useState('');
  const ta = useRef(null);
  const ok = !reason || why.trim().length >= 3;
  return (
    <>
      {text ? <p className="muted">{text}</p> : null}
      {reason ? (
        <div className="field">
          <label htmlFor="reason">{reasonLabel}</label>
          {presets.length ? (
            <div className="chips">{presets.map((p) => <button key={p} type="button" className="chip" onClick={() => { setWhy(p); ta.current?.focus(); }}>{p}</button>)}</div>
          ) : null}
          <textarea ref={ta} id="reason" rows={3} maxLength={300} placeholder="Explique la décision…" value={why} onChange={(e) => setWhy(e.target.value)} />
          <small className="hint">{reasonHint}</small>
        </div>
      ) : null}
      <div className="modal-actions">
        <button className="btn btn-ghost" data-cancel onClick={() => finish(null)}>Annuler</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} data-ok disabled={!ok} onClick={() => finish(reason ? why.trim() : true)}>{confirm}</button>
      </div>
    </>
  );
}

/** Confirmation. Résout le motif (si `reason`) ou true ; null si annulé. `text` peut contenir du JSX. */
export function confirmAction({ title, text = '', confirm = 'Confirmer', danger = false, reason = false, reasonLabel = 'Motif', reasonHint = 'Le motif est inscrit dans le journal d’audit.', presets = [] }) {
  return new Promise((resolve) => {
    let done = false;
    const settle = (v) => { if (!done) { done = true; resolve(v); } };
    const finish = (v) => { settle(v); closeModal(); };
    openModal({
      title,
      onDismiss: () => finish(null),
      abandon: () => settle(null),
      render: () => <ConfirmBody {...{ text, confirm, danger, reason, reasonLabel, reasonHint, presets, finish }} />,
    });
  });
}

/** Fenêtre-formulaire : `render(done)` appelle done(valeur) pour valider. Résout la valeur, ou null si annulé. */
export function dialog({ title, wide, render }) {
  return new Promise((resolve) => {
    let finished = false;
    const settle = (v) => { if (!finished) { finished = true; resolve(v); } };
    const done = (v) => { settle(v); closeModal(); };
    openModal({ title, wide, onDismiss: () => done(null), abandon: () => settle(null), render: () => render(done) });
  });
}

// ─── Menus déroulants d'actions ────────────────────────────
const menus = layer(null);

/** Ouvre un menu sous `anchor`. Résout la clé choisie, ou null. Éléments : { k, icon, label, danger } ou '-'. */
export function menu(anchor, items) {
  closeMenu();
  return new Promise((resolve) => {
    menus.set({ rect: anchor.getBoundingClientRect(), items: items.filter(Boolean), resolve });
  });
}
export function closeMenu(choice = null) {
  const m = menus.get();
  if (!m) return;
  menus.set(null);
  m.resolve(choice);
}

export function MenuHost() {
  const m = useLayer(menus);
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!m || !el) return;
    const r = m.rect;
    const left = Math.min(innerWidth - el.offsetWidth - 12, Math.max(12, r.right - el.offsetWidth));
    const top = r.bottom + 6 + el.offsetHeight > innerHeight ? r.top - el.offsetHeight - 6 : r.bottom + 6;
    Object.assign(el.style, { left: `${left}px`, top: `${top + scrollY}px` });
    const ctx = gsap.context(() => { if (!reduceMotion()) gsap.from(el, { y: -6, opacity: 0, duration: 0.18, ease: 'power2.out' }); });
    el.querySelector('button')?.focus({ preventScroll: true });
    return () => ctx.revert();
  }, [m]);

  useEffect(() => {
    if (!m) return undefined;
    const out = (e) => { if (!ref.current?.contains(e.target)) closeMenu(); };
    const key = (e) => { if (e.key === 'Escape') closeMenu(); };
    // Après le clic qui a ouvert le menu, pour qu'il ne le referme pas aussitôt.
    const t = setTimeout(() => document.addEventListener('click', out), 0);
    document.addEventListener('keydown', key);
    return () => { clearTimeout(t); document.removeEventListener('click', out); document.removeEventListener('keydown', key); };
  }, [m]);

  if (!m) return null;
  return createPortal(
    <div ref={ref} className="menu" role="menu">
      {m.items.map((it, i) => (it === '-'
        ? <hr key={`hr${i}`} />
        : <button key={it.k} role="menuitem" className={it.danger ? 'danger' : ''} data-k={it.k} onClick={() => closeMenu(it.k)}><Icon name={it.icon} />{it.label}</button>))}
    </div>,
    document.body,
  );
}

// ─── Toast ─────────────────────────────────────────────────
export function Toaster() {
  const [t, setT] = useState(null);
  const ref = useRef(null);
  useEffect(() => onToast(setT), []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!t || !el) return undefined;
    const ctx = gsap.context(() => { if (!reduceMotion()) gsap.from(el, { y: 16, opacity: 0, duration: 0.3, ease: 'expo.out' }); });
    let tw;
    const timer = setTimeout(() => { tw = gsap.to(el, { opacity: 0, y: 8, duration: 0.2, onComplete: () => setT((cur) => (cur === t ? null : cur)) }); }, 3200);
    return () => { clearTimeout(timer); tw?.kill(); ctx.revert(); };
  }, [t]);
  return <div id="toast" role="status" aria-live="polite">{t ? <div key={t.id} ref={ref} className={t.tone}>{t.message}</div> : null}</div>;
}
