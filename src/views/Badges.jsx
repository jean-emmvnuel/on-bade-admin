import { Link } from 'react-router-dom';
import * as S from '../lib/store.js';
import * as api from '../lib/api.js';
import { toast } from '../lib/toast.js';
import { useStore } from '../lib/useStore.js';
import { useQuery } from '../lib/useQuery.js';
import { useEnter } from '../lib/motion.js';
import { confirmAction } from '../components/overlays.jsx';
import { Empty, Icon, PageHead, Pill, StatusPill, UserCell } from '../components/ui.jsx';

const D = 86_400_000;

/** Ouvre la pièce d'identité d'une demande (réservée à l'équipe : envoyée avec le jeton, jamais mise en cache). */
async function openDocument(requestId) {
  const win = window.open('', '_blank');
  try {
    const res = await fetch(api.verificationDocumentUrl(requestId), { headers: { Authorization: `Bearer ${api.getToken()}` } });
    if (!res.ok) throw new api.ApiError(res.status, `http_${res.status}`, res.status === 404 ? 'Pièce introuvable ou déjà supprimée' : '');
    const url = URL.createObjectURL(await res.blob());
    if (win) win.location.href = url; else window.open(url, '_blank');
  } catch (e) {
    win?.close();
    toast(api.errorMessage(e, 'Impossible d’ouvrir la pièce'), 'bad');
  }
}

/** Critères affichés sur une demande : [rempli, texte]. */
function checks(u) {
  const R = S.get().rules;
  // Avec l'API, l'historique complet des rires n'est pas chargé : on montre les points du compte.
  if (S.BACKEND) return [[!u.sanctions.length, u.sanctions.length ? 'Compte bloqué actuellement' : 'Aucun blocage en cours'], [true, `${S.fmt(u.points ?? 0)} points (rires et activité)`]];
  const el = S.badgeEligibility(u.id);
  return [
    [el.active, el.lastDays === null ? 'Aucun bading signé' : `Actif : dernier bading signé il y a ${el.lastDays} j (max. ${R.badgeActiveDays})`],
    [el.enoughLaughs, `${S.compact(el.laughs)} rires reçus (min. ${S.compact(R.badgeMinLaughs)})`],
    [!u.sanctions.length, u.sanctions.length ? `${u.sanctions.length} sanction(s) au dossier` : 'Aucune sanction au dossier'],
  ];
}
const Checks = ({ user }) => (
  <ul className="checks">{checks(user).map(([ok, t]) => <li key={t} className={ok ? 'ok' : 'ko'}><Icon name={ok ? 'circleCheck' : 'circleX'} /> {t}</li>)}</ul>
);

export default function Badges() {
  const st = useStore();
  const [{ tab }] = useQuery({ tab: 'pending' });
  const ref = useEnter([tab]);
  const R = st.rules;
  const admin = S.canManageBadges();
  const list = tab === 'eligible' ? [] : st.badgeRequests.filter((g) => (tab === 'pending' ? g.status === 'pending' : g.status !== 'pending')).sort((a, b) => b.createdAt - a.createdAt);
  // Badeurs qui remplissent les conditions mais n'ont pas encore demandé : l'admin peut leur attribuer le badge directement.
  const eligible = S.BACKEND ? [] : S.users()
    .filter((u) => u.role === 'user' && u.status === 'active' && !u.verified && !st.badgeRequests.some((g) => g.userId === u.id && g.status === 'pending'))
    .map((u) => ({ u, el: S.badgeEligibility(u.id) })).filter((x) => x.el.eligible).sort((a, b) => b.el.laughs - a.el.laughs);
  const tabs = [['pending', 'En attente', S.pendingBadges().length], ...(S.BACKEND ? [] : [['eligible', 'Éligibles sans demande', eligible.length]]), ['done', 'Traitées']];

  const decide = async (g, accept) => {
    const u = S.user(g.userId);
    if (accept) {
      if (!(await confirmAction({ title: `Vérifier @${u.pseudo}`, text: 'Le badge apparaît sur son profil et ses badings signés. La pièce fournie est supprimée.', confirm: 'Accepter la demande' }))) return;
      S.decideBadge(g.id, true); toast(`@${u.pseudo} est vérifié ✓`);
    } else {
      const why = await confirmAction({
        title: 'Refuser la demande', text: `@${u.pseudo} pourra refaire une demande dans ${R.badgeRetryDays} jours.`, confirm: 'Refuser', danger: true, reason: true, reasonLabel: 'Motif communiqué',
        presets: [`Il faut au moins ${S.compact(R.badgeMinLaughs)} rires reçus sur ses badings signés`, `Il faut être actif : un bading signé ces ${R.badgeActiveDays} derniers jours`, 'Pièce illisible ou non conforme', 'Identité non vérifiable', 'Notoriété insuffisante'],
      });
      if (!why) return;
      S.decideBadge(g.id, false, why); toast('Demande refusée');
    }
  };
  const grant = async (u) => {
    if (!(await confirmAction({ title: `Attribuer le badge à @${u.pseudo}`, text: 'Il remplit les conditions. Le badge apparaît sur son profil et ses badings signés, et il reçoit une notification.', confirm: 'Attribuer le badge' }))) return;
    S.setVerified(u.id, true); toast(`@${u.pseudo} est vérifié ✓`);
  };

  let body;
  if (tab === 'eligible') {
    body = eligible.length ? (
      <div className="cards">
        {eligible.map(({ u, el }) => (
          <article key={u.id} className="card badge-req" data-enter data-uid={u.id}>
            <header><UserCell user={u} sub="remplit les conditions" /><Pill tone="brand">{S.compact(el.laughs)} rires</Pill></header>
            <Checks user={u} />
            {admin ? <footer><button className="btn btn-primary btn-sm" data-grant onClick={() => grant(u)}><Icon name="badgeCheck" /> Attribuer le badge</button></footer> : null}
          </article>
        ))}
      </div>
    ) : <Empty icon="badgeCheck" title="Aucun Badeur éligible sans demande" />;
  } else if (list.length) {
    body = (
      <div className="cards">
        {list.map((g) => {
          const u = S.user(g.userId), pending = g.status === 'pending', late = pending && Date.now() - g.createdAt > 7 * D;
          return (
            <article key={g.id} className="card badge-req" data-enter data-id={g.id}>
              <header><UserCell user={u} sub={`demande ${S.timeAgo(g.createdAt)}`} /><StatusPill status={g.status} />{late ? <Pill tone="bad">Délai de 7 j dépassé</Pill> : null}</header>
              {pending && u ? <Checks user={u} /> : null}
              <p className="muted small"><Icon name="idCard" /> {g.document}{S.BACKEND && g.hasDocument ? <> · <button className="link" data-doc={g.id} onClick={() => openDocument(g.id)}>Voir la pièce</button></> : null}</p>
              {g.links.length ? (
                <ul className="links">{g.links.map((l) => <li key={l}><Icon name="link" /> <a href={l} target="_blank" rel="noopener noreferrer">{l.replace(/^https?:\/\//, '')}</a></li>)}</ul>
              ) : <p className="muted small">Aucun lien fourni.</p>}
              {pending && admin ? (
                <footer>
                  <button className="btn btn-ghost btn-sm" data-k="refuse" onClick={() => decide(g, false)}>Refuser</button>
                  <button className="btn btn-primary btn-sm" data-k="accept" onClick={() => decide(g, true)}><Icon name="badgeCheck" /> Accepter</button>
                </footer>
              ) : pending ? null : (
                <p className="small">{g.status === 'refused' ? `Motif : ${g.reason ?? ''}` : 'Badge attribué'} · {g.decidedAt ? S.timeAgo(g.decidedAt) : ''}</p>
              )}
            </article>
          );
        })}
      </div>
    );
  } else {
    body = <Empty icon="badgeCheck" title={`Aucune demande ${tab === 'pending' ? 'en attente' : 'traitée'}`} />;
  }

  return (
    <div className="view" ref={ref}>
      <PageHead title="Badges vérifiés" sub={`Pour demander le badge, un Badeur doit être actif (un bading signé ces ${R.badgeActiveDays} derniers jours) et avoir reçu au moins ${S.compact(R.badgeMinLaughs)} rires sur ses badings signés. Seul l’administrateur valide une demande ou attribue un badge. Réponse sous 7 jours ; les pièces d’identité sont supprimées dès la décision.`} />
      {admin ? null : <p className="card muted small" data-enter style={{ padding: '12px 16px' }}><Icon name="lock" /> Lecture seule : seul l’administrateur peut valider, refuser ou attribuer un badge.</p>}
      <div className="tabs" role="tablist" data-enter>
        {tabs.map(([k, l, n]) => <Link key={k} role="tab" to={`/badges?tab=${k}`} aria-selected={tab === k}>{l}{n ? <> <b className="count">{n}</b></> : null}</Link>)}
      </div>
      {body}
    </div>
  );
}
