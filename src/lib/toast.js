// Petit bus de notifications : le store et les écrans appellent toast(), le composant <Toaster> les affiche.
const listeners = new Set();

/** Affiche un message éphémère. `tone` : '' (neutre) ou 'bad' (erreur). */
export function toast(message, tone = '') {
  listeners.forEach((fn) => fn({ id: Date.now() + Math.random(), message, tone }));
}
export const onToast = (fn) => (listeners.add(fn), () => listeners.delete(fn));
