// Animations GSAP partagées, toujours désactivées si l'utilisateur préfère moins de mouvement.
import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';

export { gsap };
export const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Apparition en cascade des blocs `[data-enter]` d'une page, au montage puis à chaque changement de `deps`.
 * Renvoie la ref à poser sur le conteneur.
 */
export function useEnter(deps = []) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (!ref.current || reduceMotion()) return undefined;
    const ctx = gsap.context(() => {
      const els = ref.current.querySelectorAll('[data-enter]');
      if (els.length) gsap.from(els, { y: 14, opacity: 0, duration: 0.5, stagger: 0.05, ease: 'expo.out', clearProps: 'transform,opacity' });
    }, ref);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
