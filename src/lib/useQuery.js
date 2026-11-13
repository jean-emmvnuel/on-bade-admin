import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Filtres d'un écran gardés dans l'adresse (#/badings?status=hidden&page=2) : partageables et conservés au retour.
 * Renvoie [valeurs (avec défauts), set(patch)]. Un changement de filtre ramène à la page 1.
 */
export function useQuery(defaults) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const q = { ...defaults };
  Object.keys(defaults).forEach((k) => { if (params.has(k)) q[k] = params.get(k); });
  if ('page' in defaults) q.page = Math.max(1, +q.page || 1);
  const set = (patch) => navigate(`${pathname}?${new URLSearchParams({ ...q, ...('page' in defaults && !('page' in patch) ? { page: 1 } : {}), ...patch })}`);
  return [q, set];
}
