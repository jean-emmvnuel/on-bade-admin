// Navigation accessible hors des composants (actions partagées, store) : le routeur enregistre sa fonction au démarrage.
let navigateFn = (path) => { location.hash = `#${path}`; };

export const setNavigator = (fn) => { navigateFn = fn; };
/** Va à une page du back-office, ex. go('/users/u1'). */
export const go = (path) => navigateFn(path);
