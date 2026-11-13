import { useEffect, useRef, useState } from 'react';

/**
 * Valeur d'un champ de recherche, envoyée à `commit` (ex. dans l'adresse) 350 ms après la dernière frappe.
 * Si la valeur change ailleurs (lien, bouton Retour), le champ la reprend.
 */
export function useDebouncedField(external, commit, delay = 350) {
  const [value, setValue] = useState(external);
  const sent = useRef(external);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    if (external !== sent.current) { sent.current = external; setValue(external); }
  }, [external]);

  useEffect(() => {
    if (value === sent.current) return undefined;
    const t = setTimeout(() => { sent.current = value; commitRef.current(value); }, delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return [value, setValue];
}
