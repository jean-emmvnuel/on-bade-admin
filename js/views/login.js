import * as S from '../store.js';
import { $, icon, logo, reduceMotion } from '../ui.js';

export function loginView(root, { go }) {
  root.innerHTML = `
  <div class="login">
    <section class="login-brand">
      <div class="brand">${logo(40, '#fff')}<span>je bade <em>admin</em></span></div>
      <div><h1>Le back-office<br/>de Je Bade.</h1><p>Modération, utilisateurs, badges, données personnelles et réglages de la plateforme. Chaque action est inscrite au journal d'audit.</p></div>
      <div class="login-foot"><p class="small">${icon('lock')} Accès réservé à l'équipe Je Bade</p>
        <p class="small credit">Je Bade · une app ORIVERSE · Créée par <a href="https://jeanemmanuel-portfolio-gamma.vercel.app/" target="_blank" rel="noopener">Jean Emmanuel Ahossi</a></p></div>
    </section>
    <section class="login-form">
      <form data-form novalidate>
        <h2>Connexion administrateur</h2>
        <div class="field"><label for="email">Adresse e-mail</label><input id="email" type="email" autocomplete="username" placeholder="admin@jebade.app" required/></div>
        <div class="field"><label for="pw">Mot de passe</label>
          <div class="pw"><input id="pw" type="password" autocomplete="current-password" placeholder="••••••••" required/><button type="button" class="icon-btn" data-reveal aria-label="Afficher le mot de passe">${icon('eye')}</button></div></div>
        <p class="error" data-err hidden></p>
        <button class="btn btn-primary btn-block" data-submit>Se connecter</button>
        <p class="demo">Démo : <code>admin@jebade.app</code> · <code>JeBade2026!</code></p>
      </form>
    </section>
  </div>`;
  if (!reduceMotion()) {
    gsap.from('.login-brand > *', { y: 24, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'expo.out' });
    gsap.from('.login-form form', { x: 24, opacity: 0, duration: 0.6, delay: 0.15, ease: 'expo.out' });
  }
  const form = $('[data-form]', root), err = $('[data-err]', root), btn = $('[data-submit]', root), pw = $('#pw', root);
  $('[data-reveal]', root).onclick = (e) => { const show = pw.type === 'password'; pw.type = show ? 'text' : 'password'; e.currentTarget.innerHTML = icon(show ? 'eyeOff' : 'eye'); e.currentTarget.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'); };
  form.addEventListener('input', () => (err.hidden = true));
  form.onsubmit = async (e) => {
    e.preventDefault();
    btn.disabled = true; btn.textContent = 'Connexion…';
    const ok = await S.logIn($('#email', root).value, pw.value);
    btn.disabled = false; btn.textContent = 'Se connecter';
    if (!ok) {
      err.textContent = 'E-mail ou mot de passe incorrect.'; err.hidden = false;
      gsap.fromTo(form, { x: 0 }, { keyframes: [{ x: 10 }, { x: -10 }, { x: 6 }, { x: -6 }, { x: 0 }], duration: 0.3 });
      return;
    }
    go('/');
  };
  $('#email', root).focus();
}
