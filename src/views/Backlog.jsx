// Backlog du projet en Kanban : Idées → À faire → En cours → Fait.
// Toute l'équipe le lit ; les comptes avec droit d'écriture ajoutent, modifient et déplacent les cartes
// (glisser-déposer sur ordinateur, choix de la colonne dans la fiche sur téléphone). Chaque action va au journal d'audit.
import { useEffect, useMemo, useState } from 'react';
import * as S from '../lib/store.js';
import * as api from '../lib/api.js';
import { errorMessage } from '../lib/api.js';
import { toast } from '../lib/toast.js';
import { useEnter } from '../lib/motion.js';
import { closeModal, confirmAction, openModal } from '../components/overlays.jsx';
import { Empty, Icon, PageHead, Pill } from '../components/ui.jsx';

export const COLUMNS = [
  { id: 'idee', label: 'Idées', hint: 'À discuter avant de s’engager' },
  { id: 'todo', label: 'À faire', hint: 'Décidé, par ordre de priorité' },
  { id: 'doing', label: 'En cours', hint: 'Sur l’établi en ce moment' },
  { id: 'done', label: 'Fait', hint: 'En production' },
];
export const AREAS = ['Produit', 'Contenu', 'Rétention', 'Croissance', 'Notifications', 'SEO', 'Administration', 'Sécurité', 'Infra'];
export const PARTS = { site: 'Site', backend: 'Backend', dashboard: 'Back-office', serveur: 'Serveur' };
const PRIO = { haute: 'bad', moyenne: 'warn', basse: 'good' };
const PRIO_RANK = { haute: 0, moyenne: 1, basse: 2 };

/** Ordre dans une colonne : priorité puis position ; « Fait » du plus récent au plus ancien. */
export function sortCards(cards, column) {
  return [...cards].sort((a, b) => {
    if (column === 'done') return String(b.doneAt ?? '').localeCompare(String(a.doneAt ?? '')) || a.title.localeCompare(b.title, 'fr');
    return (PRIO_RANK[a.priority] ?? 3) - (PRIO_RANK[b.priority] ?? 3) || (a.position ?? 0) - (b.position ?? 0) || a.title.localeCompare(b.title, 'fr');
  });
}

/** Filtre texte, domaine, partie du projet et priorité. */
export function matches(card, { q, area, part, prio }) {
  if (area && card.area !== area) return false;
  if (part && !(card.parts ?? []).includes(part)) return false;
  if (prio && card.priority !== prio) return false;
  if (q && !`${card.title} ${card.detail ?? ''} ${card.area}`.toLowerCase().includes(q.toLowerCase())) return false;
  return true;
}

const canWrite = () => ['WRITE', 'READWRITE', 'ALL'].includes(S.me()?.permission);
const fmtDay = (d) => { try { return new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; } };

function CardForm({ card, onSave, onDelete, close }) {
  const [form, setForm] = useState({
    title: card?.title ?? '', detail: card?.detail ?? '', status: card?.status ?? 'todo', area: card?.area ?? 'Produit',
    priority: card?.priority ?? '', parts: card?.parts ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editable = canWrite();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const togglePart = (p) => setForm((f) => ({ ...f, parts: f.parts.includes(p) ? f.parts.filter((x) => x !== p) : [...f.parts, p] }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Donne un titre à la carte.'); return; }
    setBusy(true);
    const ok = await onSave({ ...form, title: form.title.trim(), detail: form.detail.trim(), priority: form.priority || null });
    setBusy(false);
    if (ok) close();
  };

  return (
    <form className="backlog-form" data-form onSubmit={submit}>
      <div className="field"><label htmlFor="bl-title">Titre</label><input id="bl-title" maxLength={140} value={form.title} onChange={set('title')} disabled={!editable} autoFocus /></div>
      <div className="field"><label htmlFor="bl-detail">Détail</label>
        <textarea id="bl-detail" rows={5} maxLength={4000} placeholder="Ce qu’il faut faire, pourquoi, et ce qui dira que c’est fini." value={form.detail} onChange={set('detail')} disabled={!editable} /></div>
      <div className="backlog-row">
        <div className="field"><label htmlFor="bl-status">Colonne</label>
          <select id="bl-status" value={form.status} onChange={set('status')} disabled={!editable}>{COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
        <div className="field"><label htmlFor="bl-area">Domaine</label>
          <select id="bl-area" value={form.area} onChange={set('area')} disabled={!editable}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select></div>
        <div className="field"><label htmlFor="bl-prio">Priorité</label>
          <select id="bl-prio" value={form.priority} onChange={set('priority')} disabled={!editable}>
            <option value="">—</option><option value="haute">Haute</option><option value="moyenne">Moyenne</option><option value="basse">Basse</option>
          </select></div>
      </div>
      <fieldset className="field backlog-parts"><legend>Partie du projet</legend>
        <div>{Object.entries(PARTS).map(([k, l]) => (
          <label key={k}><input type="checkbox" checked={form.parts.includes(k)} onChange={() => togglePart(k)} disabled={!editable} /> {l}</label>
        ))}</div>
      </fieldset>
      {card?.doneAt ? <p className="muted small">Mis en production le {fmtDay(card.doneAt)}.</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="modal-actions backlog-actions">
        {card && editable ? <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={onDelete}><Icon name="trash" /> Supprimer</button> : null}
        <span className="spacer" />
        <button type="button" className="btn btn-secondary btn-sm" onClick={close}>{editable ? 'Annuler' : 'Fermer'}</button>
        {editable ? <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button> : null}
      </div>
    </form>
  );
}

export default function Backlog() {
  const ref = useEnter();
  const [cards, setCards] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ q: '', area: '', part: '', prio: '' });
  const [tab, setTab] = useState('todo');
  const [dropOn, setDropOn] = useState(null);
  const editable = canWrite();

  const load = () => api.getBacklog().then((r) => { setCards(r.cards); setError(null); }).catch((e) => setError(errorMessage(e, 'Backlog indisponible')));
  useEffect(() => { if (S.BACKEND) load(); }, []);

  const shown = useMemo(() => (cards ?? []).filter((c) => matches(c, filters)), [cards, filters]);
  const replace = (card) => setCards((list) => [...list.filter((c) => c.id !== card.id), card]);

  const save = async (card, body) => {
    try {
      const { card: saved } = card ? await api.updateBacklogCard(card.id, body) : await api.createBacklogCard(body);
      replace(saved);
      toast(card ? 'Carte enregistrée' : 'Carte ajoutée');
      return true;
    } catch (e) {
      toast(errorMessage(e, 'Enregistrement impossible'), 'bad');
      return false;
    }
  };

  const remove = async (card) => {
    closeModal(true);
    if (!(await confirmAction({ title: 'Supprimer la carte', text: <>« {card.title} » sera retirée du backlog.</>, confirm: 'Supprimer', danger: true }))) return;
    try {
      await api.deleteBacklogCard(card.id);
      setCards((list) => list.filter((c) => c.id !== card.id));
      toast('Carte supprimée');
    } catch (e) { toast(errorMessage(e, 'Suppression impossible'), 'bad'); }
  };

  const move = async (id, status) => {
    const card = cards?.find((c) => c.id === id);
    if (!card || card.status === status) return;
    replace({ ...card, status }); // affichage immédiat, corrigé par la réponse du serveur
    try { replace((await api.updateBacklogCard(id, { status })).card); } catch (e) { replace(card); toast(errorMessage(e, 'Déplacement impossible'), 'bad'); }
  };

  const open = (card) => openModal({
    title: card ? (editable ? 'Modifier la carte' : card.title) : 'Nouvelle carte',
    wide: true,
    render: (close) => <CardForm card={card} close={close ?? (() => closeModal())} onSave={(body) => save(card, body)} onDelete={() => remove(card)} />,
  });

  if (!S.BACKEND) {
    return <div className="view" ref={ref}><PageHead title="Backlog du projet" /><Empty icon="sparkles" title="Disponible avec l’API">Le backlog est enregistré sur le serveur : connecte le back-office à l’API pour le voir.</Empty></div>;
  }

  const count = (s) => (cards ?? []).filter((c) => c.status === s).length;
  const total = cards?.length || 1;
  const setF = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="view backlog" ref={ref}>
      <PageHead title="Backlog du projet" sub="Fonctionnalités livrées, chantiers en cours et idées pour le site, le backend, le back-office et le serveur."
        actions={editable ? <button className="btn btn-primary btn-sm" data-add onClick={() => open(null)}><Icon name="plus" /> Nouvelle carte</button> : <Pill>Lecture seule</Pill>} />

      {error ? <div className="alert bad" data-enter><Icon name="alert" /><span>{error} <button className="link" onClick={load}>Réessayer</button></span></div> : null}

      <section className="kpis small" data-enter>
        <div className="kpi card"><span className="kpi-top"><Icon name="circleCheck" /><span>Livré</span></span><b>{count('done')}</b>
          <span className="backlog-progress" aria-label={`${Math.round((count('done') / total) * 100)} % du backlog livré`}><i style={{ width: `${(count('done') / total) * 100}%` }} /></span></div>
        <div className="kpi card"><span className="kpi-top"><Icon name="clock" /><span>En cours</span></span><b>{count('doing')}</b></div>
        <div className="kpi card"><span className="kpi-top"><Icon name="flag" /><span>À faire</span></span><b>{count('todo')}</b>
          <span className="kpi-sub">dont {(cards ?? []).filter((c) => c.status === 'todo' && c.priority === 'haute').length} prioritaires</span></div>
        <div className="kpi card"><span className="kpi-top"><Icon name="sparkles" /><span>Idées</span></span><b>{count('idee')}</b></div>
      </section>

      <div className="card toolbar" data-enter>
        <input className="backlog-search" type="search" placeholder="Chercher une carte…" aria-label="Chercher une carte" value={filters.q} onChange={setF('q')} />
        <select aria-label="Domaine" value={filters.area} onChange={setF('area')}><option value="">Tous les domaines</option>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
        <select aria-label="Partie du projet" value={filters.part} onChange={setF('part')}><option value="">Tout le projet</option>{Object.entries(PARTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select aria-label="Priorité" value={filters.prio} onChange={setF('prio')}><option value="">Toutes priorités</option><option value="haute">Haute</option><option value="moyenne">Moyenne</option><option value="basse">Basse</option></select>
      </div>

      <div className="seg backlog-tabs" role="tablist" aria-label="Colonnes">
        {COLUMNS.map((c) => <button key={c.id} role="tab" aria-selected={tab === c.id} onClick={() => setTab(c.id)}>{c.label} · {shown.filter((x) => x.status === c.id).length}</button>)}
      </div>

      <div className="kanban" data-kanban>
        {COLUMNS.map((col) => {
          const items = sortCards(shown.filter((c) => c.status === col.id), col.id);
          return (
            <section key={col.id} className={`kanban-col${tab === col.id ? ' current' : ''}${dropOn === col.id ? ' drop' : ''}`} aria-label={col.label} data-col={col.id}
              onDragOver={editable ? (e) => { e.preventDefault(); setDropOn(col.id); } : undefined}
              onDragLeave={editable ? () => setDropOn(null) : undefined}
              onDrop={editable ? (e) => { e.preventDefault(); setDropOn(null); move(e.dataTransfer.getData('text/plain'), col.id); } : undefined}>
              <div className="kanban-head"><h2>{col.label}</h2><small>{items.length}</small></div>
              <p className="muted small kanban-hint">{col.hint}</p>
              {cards === null && !error ? <p className="muted small">Chargement…</p> : null}
              {cards && !items.length ? <p className="muted small">{cards.length ? 'Rien avec ces filtres.' : 'Aucune carte.'}</p> : null}
              {items.map((c) => (
                <button key={c.id} type="button" className="kanban-card" data-card={c.id} data-prio={c.priority ?? ''} data-status={c.status}
                  draggable={editable} onDragStart={(e) => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; }}
                  onClick={() => open(c)}>
                  <b>{c.title}</b>
                  {c.detail ? <span className="kanban-detail">{c.detail}</span> : null}
                  <span className="kanban-meta">
                    <Pill tone="brand">{c.area}</Pill>
                    {c.priority && c.status !== 'done' ? <Pill tone={PRIO[c.priority]}>Priorité {c.priority}</Pill> : null}
                    {(c.parts ?? []).map((p) => <Pill key={p}>{PARTS[p] ?? p}</Pill>)}
                    {c.status === 'done' && c.doneAt ? <small className="muted">livré le {fmtDay(c.doneAt)}</small> : null}
                  </span>
                </button>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
