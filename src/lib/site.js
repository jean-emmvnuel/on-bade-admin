// Liens vers le site public On Bade (pages lisibles sans compte) et libellés des canaux de partage.
const env = import.meta.env ?? {};
export const SITE_URL = String(env.VITE_SITE_URL || 'https://www.onbade.com').replace(/\/$/, '');

/** Page publique d'un bading : onbade.com/b/<id>. */
export const siteBadingUrl = (id) => `${SITE_URL}/b/${encodeURIComponent(id)}`;
/** Page publique d'un profil : onbade.com/@pseudo. */
export const siteProfileUrl = (pseudo) => `${SITE_URL}/@${encodeURIComponent(pseudo)}`;

/** Canaux de partage choisis dans l'app, et provenance des ouvertures de liens. */
export const SHARE_CHANNELS = { whatsapp: 'WhatsApp', facebook: 'Facebook', story: 'Story', download: 'Image enregistrée', copy: 'Lien copié', other: 'Autres', direct: 'Lien direct', unknown: 'Non précisé' };
