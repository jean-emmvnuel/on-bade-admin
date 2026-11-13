import { useEffect, useState } from 'react';
import * as S from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { useStore } from '../lib/useStore.js';
import { useEnter } from '../lib/motion.js';
import { confirmAction } from '../components/overlays.jsx';
import { Icon, Logo, PageHead, UserCell } from '../components/ui.jsx';

const AUDIENCES = { all: 'Tous les utilisateurs actifs', verified: 'Comptes vérifiés', inactive: 'Inactifs depuis 7 jours' };

export default function Announcements() {
  const st = useStore();
  const ref = useEnter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const ready = title.trim() && body.trim();
  const [reach, setReach] = useState(null);
  const [sending, setSending] = useState(false);
  useEffect(() => { let on = true; setReach(null); S.announcementReach(audience).then((n) => { if (on) setReach(n); }); return () => { on = false; }; }, [audience]);

  const send = async (e) => {
    e.preventDefault();
    if (!ready) return;
    if (!(await confirmAction({ title: 'Envoyer l’annonce', text: <>Notification envoyée à : <b>{AUDIENCES[audience]}</b>{reach !== null ? <> ({S.fmt(reach)} personne{reach > 1 ? 's' : ''})</> : null}. Impossible de l’annuler une fois partie.</>, confirm: 'Envoyer maintenant' }))) return;
    setSending(true);
    const ok = await S.sendAnnouncement({ title: title.trim(), body: body.trim(), audience });
    setSending(false);
    if (ok === false) return;
    toast('Annonce envoyée 📣');
    setTitle(''); setBody(''); setAudience('all');
  };

  return (
    <div className="view" ref={ref}>
      <PageHead title="Annonces" sub="Envoie une notification à toute la communauté ou à un groupe." />
      <div className="grid-2">
        <form className="card" data-form data-enter onSubmit={send}>
          <div className="card-head"><h2>Nouvelle annonce</h2></div>
          <div className="field"><label htmlFor="t">Titre</label><input id="t" maxLength={60} placeholder="Ex. Le défi de la semaine est lancé 😂" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="field">
            <label htmlFor="b">Message</label>
            <textarea id="b" rows={4} maxLength={180} placeholder="Raconte ta pire galère en gbaka…" value={body} onChange={(e) => setBody(e.target.value)} />
            <small className="hint"><span data-n>{body.length}</span> / 180</small>
          </div>
          <div className="field">
            <label htmlFor="a">Destinataires</label>
            <select id="a" value={audience} onChange={(e) => setAudience(e.target.value)}>{Object.entries(AUDIENCES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <small className="hint" data-reach>{reach === null ? 'Calcul du nombre de destinataires…' : `${S.fmt(reach)} personne${reach > 1 ? 's' : ''} recevr${reach > 1 ? 'ont' : 'a'} la notification`}</small>
          </div>
          <div className="modal-actions"><button className="btn btn-primary" data-send disabled={!ready || sending || reach === 0}><Icon name="megaphone" /> {sending ? 'Envoi…' : 'Envoyer'}</button></div>
        </form>
        <div className="card" data-enter>
          <div className="card-head"><h2>Aperçu sur le téléphone</h2></div>
          <div className="phone-notif"><span className="app"><Logo size={20} /> ON BADE · maintenant</span><b data-pt>{title || 'Titre de l’annonce'}</b><p data-pb>{body || 'Le message apparaît ici.'}</p></div>
        </div>
      </div>
      <section className="card" data-enter>
        <div className="card-head"><h2>Envoyées</h2></div>
        <ul className="feed-list">
          {st.announcements.map((a) => (
            <li key={a.id}><UserCell user={S.actor(a.by)} sub={`${S.fmtDate(a.sentAt)} · ${AUDIENCES[a.audience]} · ${S.fmt(a.reach)} personnes`} /><p><b>{a.title}</b> — {a.body}</p></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
