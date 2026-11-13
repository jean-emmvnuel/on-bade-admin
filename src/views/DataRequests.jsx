import * as S from '../lib/store.js';
import { toast } from '../lib/toast.js';
import { useStore } from '../lib/useStore.js';
import { useEnter } from '../lib/motion.js';
import { confirmAction } from '../components/overlays.jsx';
import { Icon, PageHead, Pill, StatusPill, Table, UserCell } from '../components/ui.jsx';

const D = 86_400_000;

/** Droits des utilisateurs (loi ivoirienne n° 2013-450) : suppression du compte et copie des données. */
export default function DataRequests() {
  const st = useStore();
  const ref = useEnter();
  const limit = st.rules.deletionDays;
  const list = [...st.dataRequests].sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1) || a.createdAt - b.createdAt);

  const process = async (d) => {
    const u = S.user(d.userId), deletion = d.type === 'deletion';
    if (!(await confirmAction({
      title: deletion ? `Supprimer le compte @${u.pseudo}` : `Envoyer les données de @${u.pseudo}`,
      text: deletion ? 'Le compte, ses badings et ses commentaires sont effacés. Action définitive.' : <>Un lien sécurisé valable 7 jours sera envoyé à <b>{u.email}</b>.</>,
      confirm: deletion ? 'Supprimer définitivement' : 'Envoyer', danger: deletion,
    }))) return;
    S.processDataRequest(d.id); toast(deletion ? 'Compte supprimé' : 'Copie envoyée');
  };
  const cancel = async (d) => {
    const why = await confirmAction({ title: 'Annuler la demande', confirm: 'Annuler la demande', reason: true, presets: ['Annulée par l’utilisateur', 'Identité non confirmée'] });
    if (!why) return;
    S.rejectDataRequest(d.id, why); toast('Demande annulée');
  };

  return (
    <div className="view" ref={ref}>
      <PageHead title="Données personnelles" sub={S.BACKEND ? `Demandes de suppression de compte faites depuis l’app. Délai légal : ${limit} jours.` : `Demandes de suppression et de copie des données. Délai légal : ${limit} jours.`} />
      <div data-enter>
        <Table head={['Utilisateur', 'Demande', 'Reçue', 'Échéance', 'Statut', '']} empty="Aucune demande.">
          {list.map((d) => {
            const left = Math.ceil((d.createdAt + limit * D - Date.now()) / D);
            const u = S.user(d.userId);
            return (
              <tr key={d.id} data-id={d.id}>
                <td><UserCell user={u} sub={u?.email ?? ''} /></td>
                <td>
                  {d.type === 'deletion' ? <><Icon name="trash" /> Suppression du compte</> : <><Icon name="download" /> Copie des données</>}
                  {d.reason ? <small className="muted block">« {d.reason} »</small> : null}
                </td>
                <td className="nowrap">{S.timeAgo(d.createdAt)}</td>
                <td className="nowrap">{d.status === 'pending' ? (left < 0 ? <Pill tone="bad">En retard de {-left} j</Pill> : <Pill tone={left <= 5 ? 'warn' : 'neutral'}>{left} j restants</Pill>) : '—'}</td>
                <td><StatusPill status={d.status} /></td>
                <td className="nowrap">
                  {d.status === 'pending' && S.can('dataProcess') ? (
                    <>
                      <button className="btn btn-ghost btn-sm" data-k="cancel" onClick={() => cancel(d)}>Annuler</button>
                      <button className={`btn ${d.type === 'deletion' ? 'btn-danger' : 'btn-primary'} btn-sm`} data-k="process" onClick={() => process(d)}>{d.type === 'deletion' ? 'Supprimer le compte' : 'Envoyer la copie'}</button>
                    </>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </Table>
      </div>
      {S.BACKEND
        ? <p className="muted small" data-enter><Icon name="lock" /> L’utilisateur peut encore annuler sa demande depuis l’app. Le serveur efface le compte à l’échéance ; tu peux aussi le supprimer tout de suite ou annuler la demande (la personne est prévenue). La copie des données se fait depuis l’app, ou depuis la fiche du compte (« Données »).</p>
        : <p className="muted small" data-enter><Icon name="lock" /> Une copie est envoyée par lien sécurisé à l’adresse e-mail du compte. Une suppression efface le compte, ses badings et ses commentaires ; seuls les journaux légaux sont conservés.</p>}
    </div>
  );
}
