import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import * as S from '../lib/store.js';
import {
  browserNotifSupported, browserPermission, disablePush, enableBrowserNotifs, enablePush, getAlertsState,
  markAlertsRead, pushOnThisDevice, pushSupported, startAlerts, subscribeAlerts,
} from '../lib/alerts.js';
import { toast } from '../lib/toast.js';
import { errorMessage } from '../lib/api.js';
import { Icon } from './ui.jsx';

const KIND_ICON = { season: 'trendingUp', first_bading: 'penLine', signup: 'userCheck', report: 'flag', autohide: 'eyeOff', badge: 'badgeCheck', deletion: 'database', server: 'activity', database: 'database' };
const PUSH_RESULT = {
  denied: 'Notifications refusées : autorise-les pour ce site dans les réglages du navigateur.',
  unsupported: 'Ce navigateur ne sait pas recevoir le push (sur iPhone : ajoute d’abord le back-office à l’écran d’accueil).',
  no_key: 'Le serveur n’a pas de clés VAPID : le push est indisponible pour l’instant.',
};

/** Cloche des alertes de l'équipe (barre du haut) : liste, pastille des non lues, réglages des notifications. */
export function AlertsBell() {
  const st = useSyncExternalStore(subscribeAlerts, getAlertsState);
  const [open, setOpen] = useState(false);
  const [, rerender] = useState(0);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  const navigate = useNavigate();
  const lastSeen = useRef(st.seenAt);

  useEffect(() => startAlerts(), []);
  useEffect(() => {
    if (!open) return undefined;
    const out = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', out); // pas « click » : le clic qui ouvre la liste la refermerait aussitôt
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', esc); };
  }, [open]);

  const toggle = () => {
    if (!open) {
      lastSeen.current = st.seenAt; // les alertes arrivées depuis restent surlignées pendant que la liste est ouverte
      if (st.unread) markAlertsRead();
    }
    setOpen(!open);
  };
  const go = (a) => { setOpen(false); if (a.url) navigate(a.url); };

  const askBrowser = async () => {
    const r = await enableBrowserNotifs();
    rerender((n) => n + 1);
    if (r === 'granted') toast('Notifications du navigateur activées');
    else if (r === 'denied') toast(PUSH_RESULT.denied, 'bad');
  };
  const togglePush = async () => {
    setBusy(true);
    try {
      if (pushOnThisDevice()) { await disablePush(); toast('Push coupé sur cet appareil'); }
      else {
        const r = await enablePush();
        if (r === 'on') toast('Push activé : les alertes arriveront même back-office fermé');
        else toast(PUSH_RESULT[r] ?? 'Push impossible', 'bad');
      }
    } catch (e) {
      toast(errorMessage(e, 'Push impossible'), 'bad');
    } finally {
      setBusy(false);
      rerender((n) => n + 1);
    }
  };

  const unread = st.unread;
  const permission = browserPermission();
  return (
    <div className="alerts" ref={box}>
      <button className="icon-btn" data-alerts aria-label={unread ? `Alertes, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Alertes'} aria-expanded={open} onClick={toggle}>
        <Icon name="bell" />
        {unread ? <b className="alerts-count" data-unread>{unread > 99 ? '99+' : unread}</b> : null}
      </button>
      {open ? (
        <div className="alerts-panel card" role="dialog" aria-label="Alertes de l’équipe" data-alerts-panel>
          <div className="card-head"><h2>Alertes</h2><span className="muted small">inscriptions, modération, serveur</span></div>
          <ul className="alerts-list">
            {st.alerts.length ? st.alerts.map((a) => (
              <li key={a.id}>
                <button className={`alert-row ${a.severity} ${lastSeen.current === null || a.createdAt > lastSeen.current ? 'new' : ''}`} onClick={() => go(a)} data-alert={a.kind}>
                  <span className="alert-ic"><Icon name={a.severity === 'critical' ? 'alert' : KIND_ICON[a.kind] ?? 'bell'} /></span>
                  <span className="alert-txt"><b>{a.title}</b><small>{a.body}</small><time>{S.timeAgo(a.createdAt)}</time></span>
                </button>
              </li>
            )) : <li className="muted small alerts-empty">{st.error ? errorMessage(st.error, 'Alertes indisponibles') : 'Aucune alerte pour l’instant.'}</li>}
          </ul>
          <div className="alerts-settings">
            <div>
              <span><b>Notifications du navigateur</b><small>tant que le back-office est ouvert</small></span>
              {!browserNotifSupported() ? <span className="muted small">indisponible</span>
                : permission === 'granted' ? <span className="pill good">Activées</span>
                : permission === 'denied' ? <span className="pill bad" title={PUSH_RESULT.denied}>Bloquées</span>
                : <button className="btn btn-secondary btn-sm" data-enable-notifs onClick={askBrowser}>Activer</button>}
            </div>
            <div>
              <span><b>Push sur cet appareil</b><small>même back-office fermé</small></span>
              {pushSupported()
                ? <button className={`btn btn-sm ${pushOnThisDevice() ? 'btn-ghost' : 'btn-secondary'}`} data-push disabled={busy} onClick={togglePush}>{pushOnThisDevice() ? 'Couper' : 'Activer'}</button>
                : <span className="muted small">indisponible</span>}
            </div>
            <p className="muted small">Les pannes du serveur partent aussi par e-mail à toute l’équipe, avec un récapitulatif chaque jour.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
