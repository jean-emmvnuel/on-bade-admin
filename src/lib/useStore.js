import { useSyncExternalStore } from 'react';
import * as S from './store.js';

/** Abonne le composant au store : il se redessine à chaque modification des données. Renvoie l'état courant. */
export function useStore() {
  useSyncExternalStore(S.subscribe, S.getVersion);
  return S.get();
}
