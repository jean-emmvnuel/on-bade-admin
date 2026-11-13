import { useState } from 'react';
import * as S from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { useStore } from '../lib/useStore.js';
import { useEnter } from '../lib/motion.js';
import { confirmAction } from '../components/overlays.jsx';
import { Icon, PageHead } from '../components/ui.jsx';

const FIELDS = [
  ['Publication', [['minLength', 'Longueur minimale d’un bading', 'caractères'], ['maxLength', 'Longueur maximale d’un bading', 'caractères'], ['captionMax', 'Légende d’un bading avec image', 'caractères'], ['dailyLimit', 'Badings par jour et par compte', 'badings'], ['maxMentions', 'Mentions maximum par bading', 'mentions'], ['opinionMax', 'Longueur d’un avis de rebade', 'caractères'], ['commentMax', 'Longueur d’un commentaire', 'caractères']]],
  ['Stickers', [['myStickersMax', 'Stickers par collection', 'stickers']]],
  ['Modération', [['autoHideThreshold', 'Masquage automatique après', 'signalements']]],
  ['Badge vérifié', [['badgeActiveDays', 'Actif : dernier bading signé il y a moins de', 'jours'], ['badgeMinLaughs', 'Rires reçus minimum (badings signés)', 'rires'], ['badgeRetryDays', 'Délai avant nouvelle demande', 'jours']]],
  ['Données personnelles', [['deletionDays', 'Délai de traitement des demandes', 'jours']]],
];
const KEYS = FIELDS.flatMap(([, fs]) => fs.map(([k]) => k));
const pickRules = (rules) => Object.fromEntries(KEYS.map((k) => [k, String(rules[k])]));

export default function Moderation() {
  const st = useStore();
  const ref = useEnter();
  const [word, setWord] = useState('');
  const [test, setTest] = useState('');
  const [draft, setDraft] = useState(() => pickRules(st.rules));

  const add = (e) => {
    e.preventDefault();
    if (S.addBannedWord(word)) { toast('Mot ajouté'); setWord(''); } else toast('Déjà dans la liste ou vide');
  };
  const remove = async (w) => {
    if (await confirmAction({ title: 'Retirer ce mot', text: `« ${w} » ne sera plus bloqué.`, confirm: 'Retirer', danger: true })) S.removeBannedWord(w);
  };
  const save = async (e) => {
    e.preventDefault();
    const next = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Math.max(1, Math.round(+v) || 1)]));
    if (next.minLength >= next.maxLength) { toast('La longueur minimale doit être inférieure à la maximale', 'bad'); return; }
    if (!(await confirmAction({ title: 'Appliquer les nouvelles règles', text: 'Elles s’appliquent tout de suite à tous les utilisateurs.', confirm: 'Appliquer' }))) return;
    const n = S.setRules(next);
    setDraft(pickRules(S.get().rules));
    toast(n ? `${n} règle(s) modifiée(s)` : 'Aucun changement');
  };

  // Testeur du filtre : un bading passerait-il ?
  const t = test.toLowerCase(), hits = st.bannedWords.filter((w) => t.includes(w));
  const verdict = !t ? ['small muted', '—']
    : hits.length ? ['small error', `Bloqué : contient ${hits.map((w) => `« ${w} »`).join(', ')}`]
      : t.trim().length < st.rules.minLength ? ['small ok-text', `Trop court (min. ${st.rules.minLength} caractères)`]
        : ['small ok-text', 'Passerait le filtre ✓'];

  return (
    <div className="view" ref={ref}>
      <PageHead title="Mots interdits & règles" sub="Le filtre bloque un bading avant sa publication. Les règles s’appliquent à l’app et au site." />
      <div className="grid-2">
        <section className="card" data-enter>
          <div className="card-head"><h2>Mots interdits ({st.bannedWords.length})</h2></div>
          <form className="add-word" data-add onSubmit={add}>
            <input data-word placeholder="Ajouter un mot ou une expression" maxLength={40} aria-label="Mot interdit" value={word} onChange={(e) => setWord(e.target.value)} />
            <button className="btn btn-primary btn-sm"><Icon name="plus" /> Ajouter</button>
          </form>
          <ul className="words">
            {st.bannedWords.map((w) => <li key={w}><span>{w}</span><button className="icon-btn" aria-label={`Retirer ${w}`} onClick={() => remove(w)}><Icon name="x" /></button></li>)}
          </ul>
          <div className="tester">
            <label htmlFor="test">Tester un texte</label>
            <textarea id="test" rows={2} placeholder="Colle un bading pour voir s’il passerait…" value={test} onChange={(e) => setTest(e.target.value)} />
            <p data-res className={verdict[0]}>{verdict[1]}</p>
          </div>
        </section>
        <form className="card" data-rules data-enter onSubmit={save}>
          <div className="card-head"><h2>Règles de la plateforme</h2></div>
          {FIELDS.map(([g, fs]) => (
            <fieldset key={g}>
              <legend>{g}</legend>
              {fs.map(([k, l, unit]) => (
                <label className="rule" key={k}>
                  <span>{l}</span>
                  <span className="num-input"><input type="number" min="1" max="100000" name={k} value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} /><small>{unit}</small></span>
                </label>
              ))}
            </fieldset>
          ))}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" data-reset onClick={() => setDraft(pickRules(st.rules))}>Annuler</button>
            <button className="btn btn-primary" data-save>Enregistrer les règles</button>
          </div>
        </form>
      </div>
    </div>
  );
}
