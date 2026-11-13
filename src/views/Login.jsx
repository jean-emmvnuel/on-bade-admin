import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as S from '../lib/store.js';
import { errorMessage } from '../lib/api.js';
import { gsap, reduceMotion } from '../lib/motion.js';
import { Icon, Logo } from '../components/ui.jsx';

export default function Login() {
  const navigate = useNavigate();
  const root = useRef(null);
  const form = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Double authentification : 'mfa' (code demandé) ou 'mfa-setup' (première configuration imposée par l'équipe).
  const [step, setStep] = useState('password');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState(null);

  useLayoutEffect(() => {
    if (reduceMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.from('.login-brand > *', { y: 24, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'expo.out' });
      gsap.from('.login-form form', { x: 24, opacity: 0, duration: 0.6, delay: 0.15, ease: 'expo.out' });
    }, root);
    return () => ctx.revert();
  }, []);

  const shake = () => { if (!reduceMotion()) gsap.fromTo(form.current, { x: 0 }, { keyframes: [{ x: 10 }, { x: -10 }, { x: 6 }, { x: -6 }, { x: 0 }], duration: 0.3 }); };
  const MESSAGES = {
    forbidden: 'Ce compte n’a pas accès au back-office : il doit faire partie de l’équipe On Bade.',
    'bad-code': 'Code incorrect. Vérifie l’heure de ton téléphone et réessaie.',
  };
  /** Résultat d'une étape : connecté, étape suivante, ou erreur à afficher. */
  const handle = async (ok) => {
    if (ok === true) { navigate('/'); return; }
    if (ok === 'mfa') { setStep('mfa'); setCode(''); return; }
    if (ok === 'mfa-setup') {
      setStep('mfa-setup'); setCode('');
      try { setSetup(await S.startMfaSetup()); } catch (err) { setError(errorMessage(err)); }
      return;
    }
    setError(MESSAGES[ok] ?? (typeof ok === 'string' ? ok : 'E-mail ou mot de passe incorrect.'));
    shake();
  };
  const run = async (fn) => {
    setBusy(true);
    let ok;
    try { ok = await fn(); } catch (err) { ok = errorMessage(err, 'Connexion impossible, réessaie.'); }
    setBusy(false);
    await handle(ok);
  };
  const submit = (e) => {
    e.preventDefault();
    if (step === 'mfa') return run(() => S.verifyMfa(code));
    if (step === 'mfa-setup') return run(() => S.enableMfa(code, { duringLogin: true }));
    return run(() => S.logIn(email, password));
  };
  const back = () => { S.logOut(); setStep('password'); setCode(''); setSetup(null); setError(''); };

  return (
    <div className="login" ref={root}>
      <section className="login-brand">
        <div className="brand"><Logo size={40} color="#fff" /><span>on bade <em>admin</em></span></div>
        <div>
          <h1>Le back-office<br />de On Bade.</h1>
          <p>Modération, utilisateurs, badges, données personnelles et réglages de la plateforme. Chaque action est inscrite au journal d'audit.</p>
        </div>
        <div className="login-foot">
          <p className="small"><Icon name="lock" /> Accès réservé à l'équipe On Bade</p>
          <p className="small credit">On Bade · une app ORIVERSE · Créée par la team Oriverse-IT</p>
        </div>
      </section>
      <section className="login-form">
        <form ref={form} noValidate onSubmit={submit} onInput={() => setError('')}>
          {step !== 'password' ? (
            <>
              <h2>{step === 'mfa' ? 'Double authentification' : 'Active la double authentification'}</h2>
              {step === 'mfa-setup' ? (
                <div className="field">
                  <p className="muted small">L’équipe l’impose pour accéder au back-office. Dans ton application d’authentification (Google Authenticator, Authy, 1Password…), ajoute un compte avec cette clé, puis entre le code affiché.</p>
                  {setup ? <><code className="secret" data-secret>{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code><a className="link small" href={setup.otpauthUrl}>Ouvrir dans l’application (sur ce téléphone)</a></> : <p className="muted small">Préparation de la clé…</p>}
                </div>
              ) : <p className="muted small">Entre le code à 6 chiffres affiché par ton application d’authentification.</p>}
              <div className="field">
                <label htmlFor="code">Code</label>
                <input id="code" data-code inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} placeholder="123 456" autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9 ]/g, ''))} />
              </div>
              <p className="error" data-err hidden={!error}>{error}</p>
              <button className="btn btn-primary btn-block" data-submit disabled={busy || code.replace(/\s/g, '').length !== 6}>{busy ? 'Vérification…' : 'Valider'}</button>
              <button type="button" className="btn btn-ghost btn-block" onClick={back}>Changer de compte</button>
            </>
          ) : (<>
          <h2>Connexion administrateur</h2>
          <div className="field">
            <label htmlFor="email">Adresse e-mail</label>
            <input id="email" type="email" autoComplete="username" placeholder="admin@jebade.app" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pw">Mot de passe</label>
            <div className="pw">
              <input id="pw" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="icon-btn" aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setShow((v) => !v)}><Icon name={show ? 'eyeOff' : 'eye'} /></button>
            </div>
          </div>
          <p className="error" data-err hidden={!error}>{error}</p>
          <button className="btn btn-primary btn-block" data-submit disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
          {S.BACKEND
            ? <p className="demo">Connecte-toi avec ton compte On Bade. Il doit faire partie de l’équipe (administrateurs).</p>
            : <p className="demo">Démo : <code>admin@jebade.app</code> · <code>JeBade2026!</code></p>}
          </>)}
        </form>
      </section>
    </div>
  );
}
