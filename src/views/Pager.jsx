/** Pagination des listes (badings, utilisateurs). */
export function Pager({ page, pages, total, unit, onPage }) {
  if (pages <= 1) return null;
  return (
    <nav className="pager" data-enter>
      <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Précédent</button>
      <span>Page {page} sur {pages} · {total} {unit}</span>
      <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Suivant</button>
    </nav>
  );
}
