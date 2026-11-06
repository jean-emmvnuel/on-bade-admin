// Données de la plateforme + actions d'administration (maquette locale).
// Chaque action correspond à une route /admin/* de BACKEND.md : remplacer le corps par un appel API.
// Toutes les actions sont inscrites dans le journal d'audit.

const MIN = 60_000, H = 60 * MIN, D = 24 * H;
const KEY = 'jebade-admin-v1';

// Démo : admin@jebade.app / JeBade2026!  (hash SHA-256 salé ; en prod, l'API vérifie un hash argon2)
const ADMIN_HASH = '6230cc7849e264edd951bb046f65d35970d1d7d940951937b0912a8fa8fa406d';

export const ROLES = { user: 'Utilisateur', moderator: 'Modérateur', admin: 'Administrateur' };
export const REASONS = { haine: 'Haine / discrimination', harcelement: 'Harcèlement', choquant: 'Contenu choquant', spam: 'Spam / arnaque', usurpation: 'Usurpation', vraie_personne: 'Personne réelle exposée', autre: 'Autre' };
export const SANCTIONS = { 1: 'Avertissement', 2: 'Suspension 7 jours', 3: 'Bannissement définitif' };

// ─── Génération déterministe des données de démo ─────────────
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const PSEUDOS = ['Koffi225', 'AwaLaGo', 'LeVraiZoba', 'Tantie_Brou', 'Djidji_Kpakpato', 'YopougonFM', 'Bintou_Abj', 'KouameLeVrai', 'Ama_Treichville', 'Seydou.Cocody', 'Mariam_Bk', 'Gbaka_Boss', 'Aya_Plateau', 'DoroLaGarba', 'ZouZou225', 'Brice_Marcory', 'Fanta.Ci', 'Drogba_Fan', 'Nanan_Yao', 'Kiki_Adjame', 'Siaka_Bouake', 'Rokia.K', 'Tchep_Master', 'Akissi_SanPedro', 'Lassina_Abobo', 'Affoue.Dja', 'Moussa_Wo', 'Clarisse_225', 'Yannick.Kore', 'Salimata_B', 'AttiekeLover', 'Cedric_Bingerville', 'Fatou_Daloa', 'Junior_Koumassi', 'Adjoua.M', 'Ibrahim_Korhogo', 'Prisca_Yamoussou', 'Wilfried.K', 'Ange_Riviera', 'Nadia_Port-Bouet', 'Ousmane_Man', 'Edwige_Gagnoa'];

const TEXTS = [
  "Gbaka m'a déposé devant la maison, j'ai dit merci au chauffeur comme si c'était un taxi privé. Tout le gbaka a applaudi.",
  "J'ai envoyé « ma chérie tu me manques » dans le groupe de la famille. Papa a répondu « moi aussi ».",
  "Coupure de courant à 21h. Courant revient. Tout le quartier crie « ÉHHH » comme si on venait de marquer.",
  "Au maquis j'ai commandé « comme d'habitude ». C'était ma première fois là-bas. Elle m'a amené attiéké poisson quand même.",
  "Ma mère m'a demandé de « regarder » la sauce sur le feu. J'ai regardé. Elle a brûlé pendant que je regardais.",
  "J'ai dit à mon patron que j'étais malade. Il m'a vu au match le soir à la télé, au premier rang.",
  "Le woro-woro m'a demandé la monnaie de 10 000. Il a sorti la monnaie de sa poche pour me montrer qu'il en a, lui.",
  "Ma tante a envoyé un vocal de 7 minutes pour dire « ok ». Les 6 premières minutes c'était le bruit du marché.",
  "Mon voisin met la musique à fond à 6h. Je suis allé me plaindre. Maintenant on danse ensemble à 6h.",
  "J'ai fait semblant de comprendre l'anglais pendant toute une réunion. À la fin on m'a demandé de faire le résumé.",
  "Le vendeur d'alloco m'a fait crédit. Le lendemain il m'a salué par mon montant : « Bonjour 500 francs ».",
  "J'ai pris le mauvais gbaka, je suis arrivé à Bingerville. J'ai dit au chauffeur que c'était voulu. Il m'a cru.",
  "Mon petit frère a vendu mon vieux téléphone à mon cousin. Avec ma puce dedans. Mon cousin m'appelle avec mon numéro.",
  "Au bureau, le climatiseur et moi on ne s'entend pas. Il a gagné : je travaille en pull à Abidjan.",
  "Ma grand-mère a découvert les notes vocales. Elle les écoute en haut-parleur au marché. Tout le monde connaît mes secrets.",
  "Le taxi compteur a compté plus vite que mon cœur. J'ai demandé s'il compte aussi les embouteillages de demain.",
  "J'ai mis « en réunion » sur WhatsApp. Ma mère m'a appelé pour demander quelle réunion.",
  "J'ai voulu faire le grand devant ma go au restaurant. J'ai lu le menu de droite à gauche. On a partagé une eau.",
  "Le prof a dit « ceux qui ne sont pas là, levez la main ». Mon voisin a levé la main.",
  "Chez nous on applaudit même le frigo quand il redémarre après la coupure.",
  "J'ai couru derrière le bus pendant 200 m. Il s'est arrêté. Ce n'était pas mon bus. Je suis monté quand même par respect.",
  "Ma copine a dit « fais comme tu veux ». J'ai fait comme je voulais. On ne se parle plus depuis mardi.",
  "Mon oncle dit qu'il a arrêté de boire. Il a juste changé de maquis.",
  "Le mouton de la Tabaski s'est échappé. Tout le quartier l'a poursuivi. Il est revenu tout seul pour manger.",
];
const BAD_TEXTS = [
  "Regardez la photo de mon voisin Konan qui dort au bureau, son adresse c'est rue 12 Yopougon 😂",
  "Gagnez 500 000 F en 24h, envoyez 10 000 F au 07 00 00 00 00 pour commencer !!!",
  "Les gens de ce quartier sont tous des voleurs, c'est dans le sang.",
];
const COMMENTS = ['😂😂😂 je suis mort', 'Le « moi aussi » de papa là 💀', 'Ça c\'est la Côte d\'Ivoire', 'On veut la suite !', 'Je me suis reconnu', 'Tu m\'as tuée 😭', 'Pardon c\'est trop vrai', 'Mon gbaka du matin exactement', 'La maman là a raison', 'Hahaha le meilleur bading de la semaine'];


// Illustrations de démo pour les badings en image (en prod : URL du CDN).
const DEMO_IMAGES = {
  sunset: { src: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20800%201000%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%220%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23ff9a4d%22/%3E%3Cstop%20offset%3D%22.6%22%20stop-color%3D%22%237a3f6b%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%231f2340%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22800%22%20height%3D%221000%22%20fill%3D%22url%28%23g%29%22/%3E%3Ccircle%20cx%3D%22560%22%20cy%3D%22380%22%20r%3D%22110%22%20fill%3D%22%23ffd27a%22/%3E%3Crect%20y%3D%22620%22%20width%3D%22800%22%20height%3D%22380%22%20fill%3D%22%231e2a48%22/%3E%3Crect%20x%3D%2290%22%20y%3D%22470%22%20width%3D%22420%22%20height%3D%22190%22%20rx%3D%2234%22%20fill%3D%22%23f2c62c%22/%3E%3Cg%20fill%3D%22%2338425c%22%3E%3Crect%20x%3D%22120%22%20y%3D%22500%22%20width%3D%2270%22%20height%3D%2260%22%20rx%3D%228%22/%3E%3Crect%20x%3D%22210%22%20y%3D%22500%22%20width%3D%2270%22%20height%3D%2260%22%20rx%3D%228%22/%3E%3Crect%20x%3D%22300%22%20y%3D%22500%22%20width%3D%2270%22%20height%3D%2260%22%20rx%3D%228%22/%3E%3Crect%20x%3D%22390%22%20y%3D%22500%22%20width%3D%2270%22%20height%3D%2260%22%20rx%3D%228%22/%3E%3C/g%3E%3Ccircle%20cx%3D%22170%22%20cy%3D%22665%22%20r%3D%2242%22%20fill%3D%22%23141414%22/%3E%3Ccircle%20cx%3D%22430%22%20cy%3D%22665%22%20r%3D%2242%22%20fill%3D%22%23141414%22/%3E%3C/svg%3E", width: 800, height: 1000 },
  plate: { src: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20800%20800%22%3E%3Crect%20width%3D%22800%22%20height%3D%22800%22%20fill%3D%22%23c9733a%22/%3E%3Ccircle%20cx%3D%22400%22%20cy%3D%22400%22%20r%3D%22300%22%20fill%3D%22%23f4f1f1%22/%3E%3Ccircle%20cx%3D%22400%22%20cy%3D%22400%22%20r%3D%22240%22%20fill%3D%22%23f7e9b8%22/%3E%3Cg%20fill%3D%22%23efe0a0%22%3E%3Ccircle%20cx%3D%22300%22%20cy%3D%22300%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22337%22%20cy%3D%22353%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22374%22%20cy%3D%22406%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22411%22%20cy%3D%22459%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22448%22%20cy%3D%22512%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22485%22%20cy%3D%22345%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22302%22%20cy%3D%22398%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22339%22%20cy%3D%22451%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22376%22%20cy%3D%22504%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22413%22%20cy%3D%22337%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22450%22%20cy%3D%22390%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22487%22%20cy%3D%22443%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22304%22%20cy%3D%22496%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22341%22%20cy%3D%22329%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22378%22%20cy%3D%22382%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22415%22%20cy%3D%22435%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22452%22%20cy%3D%22488%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22489%22%20cy%3D%22321%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22306%22%20cy%3D%22374%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22343%22%20cy%3D%22427%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22380%22%20cy%3D%22480%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22417%22%20cy%3D%22313%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22454%22%20cy%3D%22366%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22491%22%20cy%3D%22419%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22308%22%20cy%3D%22472%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22345%22%20cy%3D%22305%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22382%22%20cy%3D%22358%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22419%22%20cy%3D%22411%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22456%22%20cy%3D%22464%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22493%22%20cy%3D%22517%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22310%22%20cy%3D%22350%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22347%22%20cy%3D%22403%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22384%22%20cy%3D%22456%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22421%22%20cy%3D%22509%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22458%22%20cy%3D%22342%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22495%22%20cy%3D%22395%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22312%22%20cy%3D%22448%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22349%22%20cy%3D%22501%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22386%22%20cy%3D%22334%22%20r%3D%229%22/%3E%3Ccircle%20cx%3D%22423%22%20cy%3D%22387%22%20r%3D%229%22/%3E%3C/g%3E%3Cellipse%20cx%3D%22470%22%20cy%3D%22420%22%20rx%3D%22150%22%20ry%3D%2270%22%20fill%3D%22%238a5a2b%22%20transform%3D%22rotate%28-20%20470%20420%29%22/%3E%3Cpath%20d%3D%22M330%20470%20l40%20-20%20l10%2040z%22%20fill%3D%22%233a8a3a%22/%3E%3Ccircle%20cx%3D%22300%22%20cy%3D%22500%22%20r%3D%2222%22%20fill%3D%22%23d33%22/%3E%3C/svg%3E", width: 800, height: 800 },
  market: { src: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20800%201000%22%3E%3Crect%20width%3D%22800%22%20height%3D%221000%22%20fill%3D%22%23f5d48a%22/%3E%3Cpath%20d%3D%22M0%20260%20L400%20120%20L800%20260%20Z%22%20fill%3D%22%23c0392b%22/%3E%3Crect%20y%3D%22260%22%20width%3D%22800%22%20height%3D%2240%22%20fill%3D%22%23e74c3c%22/%3E%3Cg%3E%3Ccircle%20cx%3D%22120%22%20cy%3D%22420%22%20r%3D%2248%22%20fill%3D%22%23e67e22%22/%3E%3Ccircle%20cx%3D%22260%22%20cy%3D%22420%22%20r%3D%2248%22%20fill%3D%22%2327ae60%22/%3E%3Ccircle%20cx%3D%22400%22%20cy%3D%22420%22%20r%3D%2248%22%20fill%3D%22%23c0392b%22/%3E%3Ccircle%20cx%3D%22540%22%20cy%3D%22420%22%20r%3D%2248%22%20fill%3D%22%23f1c40f%22/%3E%3Ccircle%20cx%3D%22680%22%20cy%3D%22420%22%20r%3D%2248%22%20fill%3D%22%23e67e22%22/%3E%3Ccircle%20cx%3D%22120%22%20cy%3D%22540%22%20r%3D%2248%22%20fill%3D%22%2327ae60%22/%3E%3Ccircle%20cx%3D%22260%22%20cy%3D%22540%22%20r%3D%2248%22%20fill%3D%22%23c0392b%22/%3E%3Ccircle%20cx%3D%22400%22%20cy%3D%22540%22%20r%3D%2248%22%20fill%3D%22%23f1c40f%22/%3E%3Ccircle%20cx%3D%22540%22%20cy%3D%22540%22%20r%3D%2248%22%20fill%3D%22%23e67e22%22/%3E%3Ccircle%20cx%3D%22680%22%20cy%3D%22540%22%20r%3D%2248%22%20fill%3D%22%2327ae60%22/%3E%3Ccircle%20cx%3D%22120%22%20cy%3D%22660%22%20r%3D%2248%22%20fill%3D%22%23c0392b%22/%3E%3Ccircle%20cx%3D%22260%22%20cy%3D%22660%22%20r%3D%2248%22%20fill%3D%22%23f1c40f%22/%3E%3Ccircle%20cx%3D%22400%22%20cy%3D%22660%22%20r%3D%2248%22%20fill%3D%22%23e67e22%22/%3E%3Ccircle%20cx%3D%22540%22%20cy%3D%22660%22%20r%3D%2248%22%20fill%3D%22%2327ae60%22/%3E%3Ccircle%20cx%3D%22680%22%20cy%3D%22660%22%20r%3D%2248%22%20fill%3D%22%23c0392b%22/%3E%3C/g%3E%3Crect%20y%3D%22780%22%20width%3D%22800%22%20height%3D%22220%22%20fill%3D%22%237a4a2a%22/%3E%3C/svg%3E", width: 800, height: 1000 },
  neighbour: { src: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20800%201000%22%3E%3Crect%20width%3D%22800%22%20height%3D%221000%22%20fill%3D%22%233b4a5a%22/%3E%3Crect%20x%3D%2280%22%20y%3D%22560%22%20width%3D%22640%22%20height%3D%22200%22%20fill%3D%22%236b4b33%22/%3E%3Ccircle%20cx%3D%22400%22%20cy%3D%22440%22%20r%3D%22120%22%20fill%3D%22%238a5a3a%22/%3E%3Crect%20x%3D%22250%22%20y%3D%22540%22%20width%3D%22300%22%20height%3D%22220%22%20rx%3D%2260%22%20fill%3D%22%232d6cdf%22/%3E%3Ctext%20x%3D%22400%22%20y%3D%22900%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-size%3D%2244%22%20fill%3D%22%23fff%22%3Ezzz%E2%80%A6%3C/text%3E%3C/svg%3E", width: 800, height: 1000 },
};
// Stickers personnels de démo (créés par des Badeurs).
const DEMO_STICKERS = {
  us1: { ownerId: 'u1', label: "Gbaka boss", src: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20512%20512%22%3E%3Crect%20x%3D%2216%22%20y%3D%2216%22%20width%3D%22480%22%20height%3D%22480%22%20rx%3D%2296%22%20fill%3D%22%23ffb547%22/%3E%3Crect%20x%3D%2270%22%20y%3D%22150%22%20width%3D%22372%22%20height%3D%22190%22%20rx%3D%2240%22%20fill%3D%22%231a1919%22/%3E%3Crect%20x%3D%22100%22%20y%3D%22180%22%20width%3D%2270%22%20height%3D%2260%22%20rx%3D%2210%22%20fill%3D%22%235ab0ff%22/%3E%3Crect%20x%3D%22190%22%20y%3D%22180%22%20width%3D%2270%22%20height%3D%2260%22%20rx%3D%2210%22%20fill%3D%22%235ab0ff%22/%3E%3Crect%20x%3D%22280%22%20y%3D%22180%22%20width%3D%2270%22%20height%3D%2260%22%20rx%3D%2210%22%20fill%3D%22%235ab0ff%22/%3E%3Crect%20x%3D%22370%22%20y%3D%22180%22%20width%3D%2244%22%20height%3D%2260%22%20rx%3D%2210%22%20fill%3D%22%235ab0ff%22/%3E%3Ccircle%20cx%3D%22150%22%20cy%3D%22345%22%20r%3D%2238%22%20fill%3D%22%231a1919%22%20stroke%3D%22%23ffb547%22%20stroke-width%3D%2214%22/%3E%3Ccircle%20cx%3D%22362%22%20cy%3D%22345%22%20r%3D%2238%22%20fill%3D%22%231a1919%22%20stroke%3D%22%23ffb547%22%20stroke-width%3D%2214%22/%3E%3Ctext%20x%3D%22256%22%20y%3D%22120%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Black%2C%20Arial%2C%20sans-serif%22%20font-weight%3D%22900%22%20font-size%3D%2270%22%20fill%3D%22%231a1919%22%3EGBAKA%3C/text%3E%3Ctext%20x%3D%22256%22%20y%3D%22455%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Black%2C%20Arial%2C%20sans-serif%22%20font-weight%3D%22900%22%20font-size%3D%2264%22%20fill%3D%22%231a1919%22%3EBOSS%3C/text%3E%3C/svg%3E" },
  us2: { ownerId: 'u2', label: "Tantie a dit non", src: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20512%20512%22%3E%3Crect%20x%3D%2216%22%20y%3D%2216%22%20width%3D%22480%22%20height%3D%22480%22%20rx%3D%2296%22%20fill%3D%22%23ff6fa8%22/%3E%3Ccircle%20cx%3D%22256%22%20cy%3D%22230%22%20r%3D%22140%22%20fill%3D%22%238a4b2a%22/%3E%3Cpath%20d%3D%22M116%20210%20Q256%2040%20396%20210%20Q330%20130%20256%20140%20Q182%20130%20116%20210Z%22%20fill%3D%22%231a1919%22/%3E%3Cpath%20d%3D%22M180%20205%20l50%2018%20M332%20205%20l-50%2018%22%20stroke%3D%22%231a1919%22%20stroke-width%3D%2214%22%20stroke-linecap%3D%22round%22/%3E%3Ccircle%20cx%3D%22208%22%20cy%3D%22240%22%20r%3D%2214%22%20fill%3D%22%231a1919%22/%3E%3Ccircle%20cx%3D%22304%22%20cy%3D%22240%22%20r%3D%2214%22%20fill%3D%22%231a1919%22/%3E%3Cpath%20d%3D%22M206%20305%20Q256%20280%20306%20305%22%20stroke%3D%22%231a1919%22%20stroke-width%3D%2214%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22/%3E%3Ctext%20x%3D%22256%22%20y%3D%22455%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Black%2C%20Arial%2C%20sans-serif%22%20font-weight%3D%22900%22%20font-size%3D%2272%22%20fill%3D%22%231a1919%22%3ENON%20%21%3C/text%3E%3C/svg%3E" },
  us3: { ownerId: 'u6', label: "Yop City", src: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20512%20512%22%3E%3Crect%20x%3D%2216%22%20y%3D%2216%22%20width%3D%22480%22%20height%3D%22480%22%20rx%3D%2296%22%20fill%3D%22%239810e6%22/%3E%3Crect%20x%3D%2270%22%20y%3D%22250%22%20width%3D%2270%22%20height%3D%22170%22%20fill%3D%22%23ede3fa%22/%3E%3Crect%20x%3D%22155%22%20y%3D%22190%22%20width%3D%2280%22%20height%3D%22230%22%20fill%3D%22%23ffffff%22/%3E%3Crect%20x%3D%22250%22%20y%3D%22230%22%20width%3D%2270%22%20height%3D%22190%22%20fill%3D%22%23ede3fa%22/%3E%3Crect%20x%3D%22335%22%20y%3D%22170%22%20width%3D%2290%22%20height%3D%22250%22%20fill%3D%22%23ffffff%22/%3E%3Ccircle%20cx%3D%22390%22%20cy%3D%22105%22%20r%3D%2242%22%20fill%3D%22%23ffb547%22/%3E%3Ctext%20x%3D%22256%22%20y%3D%22130%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Black%2C%20Arial%2C%20sans-serif%22%20font-weight%3D%22900%22%20font-size%3D%2274%22%20fill%3D%22%23ffffff%22%3EYOP%3C/text%3E%3Ctext%20x%3D%22256%22%20y%3D%22480%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Black%2C%20Arial%2C%20sans-serif%22%20font-weight%3D%22900%22%20font-size%3D%2254%22%20fill%3D%22%23ffffff%22%3ECITY%3C/text%3E%3C/svg%3E" },
  us4: { ownerId: 'u29', label: 'Konan le nul', src: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20512%20512%22%3E%3Crect%20x%3D%2216%22%20y%3D%2216%22%20width%3D%22480%22%20height%3D%22480%22%20rx%3D%2296%22%20fill%3D%22%235ab0ff%22/%3E%3Ccircle%20cx%3D%22256%22%20cy%3D%22220%22%20r%3D%22120%22%20fill%3D%22%238a5a3a%22/%3E%3Crect%20x%3D%22150%22%20y%3D%22320%22%20width%3D%22212%22%20height%3D%22140%22%20rx%3D%2240%22%20fill%3D%22%232d6cdf%22/%3E%3Ctext%20x%3D%22256%22%20y%3D%22110%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%20Black%2C%20Arial%22%20font-size%3D%2248%22%20fill%3D%22%231a1919%22%3EKONAN%20LE%20NUL%3C/text%3E%3C/svg%3E" },
};

function seed() {
  const r = rng(225), now = Date.now();
  const pick = (a) => a[Math.floor(r() * a.length)];
  const int = (a, b) => a + Math.floor(r() * (b - a + 1));

  const users = {};
  users.admin = { id: 'admin', pseudo: 'JeanEmmanuel', email: 'admin@jebade.app', role: 'admin', verified: true, hue: 280, joinedAt: now - 120 * D, lastActiveAt: now, status: 'active', sanctions: [] };
  PSEUDOS.forEach((p, i) => {
    const id = `u${i + 1}`;
    users[id] = {
      id, pseudo: p, email: `${p.toLowerCase().replace(/[^a-z0-9]/g, '')}@${pick(['gmail.com', 'yahoo.fr', 'outlook.com', 'orange.ci'])}`,
      role: i === 4 ? 'moderator' : 'user', verified: [2, 5, 17].includes(i), hue: int(0, 359),
      joinedAt: now - int(1, 110) * D - int(0, 23) * H, lastActiveAt: now - int(0, 20 * 24) * H,
      status: 'active', sanctions: [],
    };
  });
  users.u12.status = 'suspended'; users.u12.suspendedUntil = now + 4 * D; users.u12.sanctions.push({ level: 2, reason: 'Harcèlement répété en commentaires', at: now - 3 * D, by: 'admin' });
  users.u29.status = 'banned'; users.u29.sanctions.push({ level: 1, reason: 'Spam', at: now - 20 * D, by: 'u5' }, { level: 3, reason: 'Arnaques répétées', at: now - 9 * D, by: 'admin' });
  users.u8.sanctions.push({ level: 1, reason: 'Moquerie sur une ethnie', at: now - 6 * D, by: 'u5' });
  const ids = Object.keys(users).filter((k) => k !== 'admin');

  const badings = [];
  for (let i = 0; i < 70; i++) {
    const age = Math.pow(r(), 1.6) * 30 * D;
    const likes = Math.floor(Math.pow(r(), 3) * 3500);
    badings.push({ id: `b${i + 1}`, authorId: pick(ids), anonymous: r() < 0.3, text: TEXTS[i % TEXTS.length], createdAt: now - age, likes, rebades: Math.floor(likes * r() * 0.15), shares: Math.floor(likes * r() * 0.3), reportsCount: 0, status: 'visible' });
  }
  // Badings en image (F1) : formats 4:5 ou 1:1 seulement, légende courte.
  [['b2', 'sunset', 'Le gbaka de 18h. Regardez bien le chauffeur 😭'], ['b5', 'plate', 'Attiéké « comme d’habitude ». Première fois dans ce maquis.'], ['b9', 'market', ''], ['b16', 'sunset', 'Pendant que vous dormez, le gbaka travaille.']].forEach(([id, img, cap]) => {
    const b = badings.find((x) => x.id === id); b.image = DEMO_IMAGES[img]; b.text = cap;
  });
  BAD_TEXTS.forEach((t, i) => badings.push({ id: `bx${i + 1}`, authorId: ['u29', 'u12', 'u8'][i], anonymous: i === 2, text: t, ...(i === 0 ? { image: DEMO_IMAGES.neighbour } : {}), createdAt: now - (i + 1) * 5 * H, likes: int(0, 30), rebades: 0, shares: 0, reportsCount: [6, 4, 3][i], status: i === 0 ? 'hidden' : 'visible', hiddenReason: i === 0 ? 'Masquage automatique (6 signalements)' : undefined }));

  // Stickers personnels (F8) : créés par des Badeurs, enregistrés par d'autres.
  const customStickers = Object.fromEntries(Object.entries(DEMO_STICKERS).map(([id, st], i) => [id, { id, ...st, createdAt: now - (i + 2) * D, saves: [128, 342, 57, 4][i] ?? 0, status: 'visible' }]));

  const comments = [];
  for (let i = 0; i < 60; i++) {
    const b = pick(badings);
    comments.push({ id: `c${i + 1}`, badingId: b.id, authorId: pick(ids), text: pick(COMMENTS), createdAt: Math.min(now, b.createdAt + int(1, 600) * MIN), likes: int(0, 80), status: 'visible' });
  }
  const STK = ['mort', 'ehhh', 'gate', 'us1', 'us2', 'us3', 'fohi', 'pardon'];
  for (let i = 0; i < 14; i++) { const b = pick(badings); comments.push({ id: `cs${i + 1}`, badingId: b.id, authorId: pick(ids), text: '', sticker: STK[i % STK.length], createdAt: Math.min(now, b.createdAt + int(1, 600) * MIN), likes: int(0, 40), status: 'visible' }); }
  comments.push({ id: 'cs99', badingId: 'b3', authorId: 'u29', text: '', sticker: 'us4', createdAt: now - 2 * H, likes: 0, status: 'visible' });
  comments.push({ id: 'cx1', badingId: 'b3', authorId: 'u12', text: 'Toi tu es vraiment bête, je sais où tu habites', createdAt: now - 7 * H, likes: 0, status: 'visible' });

  const R = (o) => ({ status: 'open', ...o });
  const reports = [
    R({ id: 'r1', targetType: 'bading', targetId: 'bx1', reporterId: 'u3', reason: 'vraie_personne', details: 'Il donne le nom et l\'adresse de son voisin.', createdAt: now - 4 * H }),
    R({ id: 'r2', targetType: 'bading', targetId: 'bx1', reporterId: 'u14', reason: 'harcelement', createdAt: now - 3 * H }),
    R({ id: 'r3', targetType: 'bading', targetId: 'bx2', reporterId: 'u7', reason: 'spam', details: 'Arnaque au transfert d\'argent.', createdAt: now - 9 * H }),
    R({ id: 'r4', targetType: 'bading', targetId: 'bx3', reporterId: 'u22', reason: 'haine', details: 'Généralisation sur les habitants d\'un quartier.', createdAt: now - 14 * H }),
    R({ id: 'r5', targetType: 'comment', targetId: 'cx1', reporterId: 'u2', reason: 'harcelement', details: 'Menace à peine voilée.', createdAt: now - 6 * H }),
    R({ id: 'r6', targetType: 'user', targetId: 'u12', reporterId: 'u9', reason: 'usurpation', details: 'Se fait passer pour un humoriste connu.', createdAt: now - 26 * H }),
    R({ id: 'r10', targetType: 'sticker', targetId: 'us4', reporterId: 'u17', reason: 'vraie_personne', details: 'C’est la photo d’un vrai voisin avec son nom.', createdAt: now - 90 * MIN }),
    R({ id: 'r11', targetType: 'sticker', targetId: 'us4', reporterId: 'u21', reason: 'harcelement', createdAt: now - 60 * MIN }),
    R({ id: 'r7', targetType: 'bading', targetId: 'b14', reporterId: 'u31', reason: 'autre', details: 'Je trouve ça pas drôle.', createdAt: now - 30 * H }),
    { id: 'r8', targetType: 'bading', targetId: 'b20', reporterId: 'u16', reason: 'choquant', createdAt: now - 4 * D, status: 'dismissed', resolvedBy: 'u5', resolvedAt: now - 3 * D, decision: 'Humour sans cible, conforme à la charte' },
    { id: 'r9', targetType: 'bading', targetId: 'b33', reporterId: 'u11', reason: 'spam', createdAt: now - 8 * D, status: 'actioned', resolvedBy: 'admin', resolvedAt: now - 8 * D + 2 * H, decision: 'Bading supprimé + avertissement' },
  ];

  const badgeRequests = [
    { id: 'g1', userId: 'u6', links: ['https://instagram.com/yopougonfm', 'https://facebook.com/yopougonfm'], document: 'RCCM (page)', createdAt: now - 2 * D, status: 'pending' },
    { id: 'g2', userId: 'u1', links: ['https://tiktok.com/@koffi225'], document: 'Carte nationale d\'identité', createdAt: now - 20 * H, status: 'pending' },
    { id: 'g3', userId: 'u24', links: ['https://youtube.com/@tchepmaster'], document: 'Passeport', createdAt: now - 5 * H, status: 'pending' },
    { id: 'g4', userId: 'u10', links: [], document: 'Carte nationale d\'identité', createdAt: now - 12 * D, status: 'refused', reason: 'Il faut au moins 1 000 rires reçus sur ses badings signés', decidedAt: now - 9 * D },
    { id: 'g5', userId: 'u3', links: ['https://x.com/levraizoba'], document: 'Carte nationale d\'identité', createdAt: now - 40 * D, status: 'accepted', decidedAt: now - 38 * D },
  ];

  const dataRequests = [
    { id: 'd1', userId: 'u19', type: 'deletion', reason: 'Je n\'utilise plus l\'app', createdAt: now - 6 * D, status: 'pending' },
    { id: 'd2', userId: 'u27', type: 'export', createdAt: now - 1 * D, status: 'pending' },
    { id: 'd3', userId: 'u35', type: 'deletion', reason: 'Trop de notifications', createdAt: now - 31 * D, status: 'pending' },
    { id: 'd4', userId: 'u15', type: 'export', createdAt: now - 15 * D, status: 'done', doneAt: now - 14 * D },
  ];

  const daily = [];
  for (let i = 29; i >= 0; i--) {
    const t = now - i * D, trend = 1 + (29 - i) / 22, weekend = [0, 6].includes(new Date(t).getDay()) ? 1.25 : 1;
    daily.push({ date: new Date(t).toISOString().slice(0, 10), signups: Math.round((18 + r() * 14) * trend), badings: Math.round((42 + r() * 25) * trend * weekend), laughs: Math.round((900 + r() * 500) * trend * weekend), active: Math.round((310 + r() * 80) * trend * weekend) });
  }

  return {
    v: 2, session: null, users, badings, comments, customStickers, reports, badgeRequests, dataRequests, daily,
    bannedWords: ['connard', 'pute', 'nègre', 'tuer', 'sale race', 'arnaque garantie'],
    rules: { minLength: 10, maxLength: 1000, captionMax: 280, myStickersMax: 1000, opinionMax: 280, commentMax: 500, dailyLimit: 20, maxMentions: 5, autoHideThreshold: 5, badgeActiveDays: 30, badgeMinLaughs: 1000, badgeRetryDays: 30, deletionDays: 30 },
    platform: { signupsOpen: true, anonymousEnabled: true, commentsEnabled: true, maintenance: false, maintenanceMessage: 'On Bade fait une petite pause, on revient vite 😅' },
    announcements: [{ id: 'a1', title: 'Bienvenue sur On Bade 🎉', body: 'Raconte ta galère du jour et fais rire le pays.', audience: 'all', sentAt: now - 25 * D, by: 'admin', reach: 1240 }],
    audit: [
      { id: 'l3', at: now - 3 * D, actor: 'admin', action: 'user.sanction', target: 'u12', detail: 'Suspension 7 jours : Harcèlement répété en commentaires' },
      { id: 'l2', at: now - 8 * D, actor: 'admin', action: 'report.resolve', target: 'r9', detail: 'Bading supprimé + avertissement' },
      { id: 'l1', at: now - 9 * D, actor: 'admin', action: 'user.sanction', target: 'u29', detail: 'Bannissement définitif : Arnaques répétées' },
    ],
  };
}

// ─── État ──────────────────────────────────────────────────
let state;
try { state = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { state = seed(); }
// Nouvelle version des données (images et stickers) : on régénère la démo en gardant la session.
if (state.v !== 2) { const session = state.session ?? null; state = seed(); state.session = session; }
// Nouvelles règles du badge (actif + 1 000 rires) sans perdre les données en place.
// Collections de stickers : la limite passe de 50 à 1 000.
if (state.rules.myStickersMax === 50) state.rules.myStickersMax = 1000;
if (!('badgeMinLaughs' in state.rules)) { state.rules.badgeActiveDays = 30; state.rules.badgeMinLaughs = 1000; delete state.rules.badgeMinAgeDays; delete state.rules.badgeMinBadings; }

const listeners = new Set();
let saveTimer;
function commit() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }, 120);
  listeners.forEach((fn) => fn(state));
}
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const get = () => state;
export function resetDemo() { const s = state.session; state = seed(); state.session = s; log('platform.reset', null, 'Données de démo réinitialisées'); }

function log(action, target, detail) {
  state.audit.unshift({ id: `l${Date.now()}${Math.random().toString(36).slice(2, 5)}`, at: Date.now(), actor: state.session?.userId ?? 'system', action, target, detail });
  commit();
}

// ─── Lecture ───────────────────────────────────────────────
export const me = () => (state.session ? state.users[state.session.userId] : null);
export const user = (id) => state.users[id];
export const bading = (id) => state.badings.find((b) => b.id === id);
export const comment = (id) => state.comments.find((c) => c.id === id);
export const users = () => Object.values(state.users);
export const openReports = () => state.reports.filter((r) => r.status === 'open');
export const pendingBadges = () => state.badgeRequests.filter((g) => g.status === 'pending');
export const pendingData = () => state.dataRequests.filter((d) => d.status === 'pending');
export const commentsOf = (badingId) => state.comments.filter((c) => c.badingId === badingId);
export const badingsOf = (userId) => state.badings.filter((b) => b.authorId === userId);
export const reportsOn = (type, id) => state.reports.filter((r) => r.targetType === type && r.targetId === id);
export const customSticker = (id) => state.customStickers?.[id];
export const stickerUses = (id) => state.comments.filter((c) => c.sticker === id && c.status !== 'deleted').length;
export function targetLabel(type, id) {
  if (type === 'bading') return `Bading ${id}`;
  if (type === 'comment') return `Commentaire ${id}`;
  if (type === 'sticker') return `Sticker ${state.customStickers?.[id]?.label ?? id}`;
  if (type === 'user') return `@${state.users[id]?.pseudo ?? id}`;
  return id ?? '';
}

// ─── Connexion admin ───────────────────────────────────────
async function sha(s) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join(''); }
export async function logIn(email, password) {
  const e = email.trim().toLowerCase();
  const u = Object.values(state.users).find((x) => x.email === e && (x.role === 'admin' || x.role === 'moderator'));
  if (!u || u.id !== 'admin' || (await sha(`jebade-admin:${e}:${password}`)) !== ADMIN_HASH) return false;
  state.session = { userId: u.id, at: Date.now() };
  log('auth.login', u.id, 'Connexion au back-office');
  return true;
}
export function logOut() { log('auth.logout', state.session?.userId, 'Déconnexion'); state.session = null; commit(); }

// ─── Signalements ──────────────────────────────────────────
export function resolveReports(reportIds, status, decision) {
  state.reports.forEach((r) => { if (reportIds.includes(r.id)) Object.assign(r, { status, decision, resolvedBy: state.session.userId, resolvedAt: Date.now() }); });
  log('report.resolve', reportIds.join(', '), `${status === 'dismissed' ? 'Classé sans suite' : 'Traité'} : ${decision}`);
}

// ─── Badings ───────────────────────────────────────────────
export function setBadingStatus(id, status, reason = '') {
  const b = bading(id); if (!b) return;
  b.status = status; b.hiddenReason = status === 'hidden' ? reason : undefined; b.moderatedAt = Date.now();
  log(`bading.${status === 'visible' ? 'restore' : status === 'hidden' ? 'hide' : 'delete'}`, id, reason || (status === 'visible' ? 'Rétabli' : ''));
}
/** Coffre d'anonymat : révèle l'auteur d'un bading anonyme. Motif obligatoire, toujours journalisé. */
export function revealAuthor(id, reason) {
  const b = bading(id); if (!b) return null;
  log('vault.reveal', id, `Auteur révélé (@${state.users[b.authorId]?.pseudo}) — motif : ${reason}`);
  return state.users[b.authorId];
}

// ─── Commentaires ──────────────────────────────────────────
export function setCommentStatus(id, status, reason = '') {
  const c = comment(id); if (!c) return;
  c.status = status;
  log(status === 'deleted' ? 'comment.delete' : 'comment.restore', id, reason);
}

// ─── Stickers personnels ───────────────────────────────────
/** Retire un sticker partout : il s'affiche « Sticker retiré par la modération » dans les commentaires et quitte les collections. */
export function setStickerStatus(id, status, reason = '') {
  const st = state.customStickers?.[id]; if (!st) return;
  st.status = status;
  log(status === 'removed' ? 'sticker.remove' : 'sticker.restore', id, `${st.label ? `« ${st.label} »` : id} de @${state.users[st.ownerId]?.pseudo ?? '?'}${reason ? ` : ${reason}` : ''}`);
}

// ─── Utilisateurs ──────────────────────────────────────────
export function sanction(userId, level, reason) {
  const u = user(userId); if (!u) return;
  u.sanctions.push({ level, reason, at: Date.now(), by: state.session.userId });
  if (level === 2) { u.status = 'suspended'; u.suspendedUntil = Date.now() + 7 * D; }
  if (level === 3) { u.status = 'banned'; u.suspendedUntil = undefined; }
  log('user.sanction', userId, `${SANCTIONS[level]} : ${reason}`);
}
export function liftSanction(userId) {
  const u = user(userId); if (!u) return;
  u.status = 'active'; u.suspendedUntil = undefined;
  log('user.unsanction', userId, 'Sanction levée, compte réactivé');
}
/** Le badge vérifié ne s'attribue, ne se retire et ne se valide que par un administrateur (pas les modérateurs). */
export const canManageBadges = () => me()?.role === 'admin';
/**
 * Conditions pour qu'un Badeur puisse demander le badge : actif (un bading signé ces N derniers jours)
 * et au moins 1 000 rires reçus sur ses badings signés. Les badings anonymes ne comptent jamais.
 */
export function badgeEligibility(userId) {
  const R = state.rules, signed = state.badings.filter((b) => b.authorId === userId && !b.anonymous && b.status !== 'deleted');
  const last = signed.reduce((m, b) => Math.max(m, b.createdAt), 0);
  const lastDays = last ? Math.floor((Date.now() - last) / 86_400_000) : null;
  const laughs = signed.reduce((n, b) => n + (b.likes || 0), 0);
  const active = lastDays !== null && lastDays <= R.badgeActiveDays, enoughLaughs = laughs >= R.badgeMinLaughs;
  return { active, lastDays, laughs, enoughLaughs, eligible: active && enoughLaughs };
}
export function setVerified(userId, v) { if (!canManageBadges()) return false; const u = user(userId); if (!u) return false; u.verified = v;
  // Attribuer directement clôt une éventuelle demande en attente.
  if (v) state.badgeRequests.filter((g) => g.userId === userId && g.status === 'pending').forEach((g) => Object.assign(g, { status: 'accepted', decidedAt: Date.now() })); log(v ? 'badge.grant' : 'badge.revoke', userId, v ? 'Badge vérifié attribué' : 'Badge vérifié retiré'); }
export function setRole(userId, role) { const u = user(userId); if (!u) return; const old = u.role; u.role = role; log('user.role', userId, `${ROLES[old]} → ${ROLES[role]}`); }
export function setPseudo(userId, pseudo) { const u = user(userId); if (!u) return; const old = u.pseudo; u.pseudo = pseudo; u.verified = false; log('user.pseudo', userId, `@${old} → @${pseudo} (badge retiré)`); }
export function sendPasswordReset(userId) { const u = user(userId); log('user.password_reset', userId, `Lien de réinitialisation envoyé à ${u?.email}`); }
export function deleteUser(userId, reason) {
  const u = user(userId); if (!u) return;
  u.status = 'deleted'; u.deletedAt = Date.now();
  state.badings.forEach((b) => { if (b.authorId === userId) b.status = 'deleted'; });
  state.comments.forEach((c) => { if (c.authorId === userId) c.status = 'deleted'; });
  log('user.delete', userId, `Compte @${u.pseudo} supprimé : ${reason}`);
}

// ─── Badges ────────────────────────────────────────────────
export function decideBadge(id, accepted, reason = '') {
  if (!canManageBadges()) return false;
  const g = state.badgeRequests.find((x) => x.id === id); if (!g) return false;
  Object.assign(g, { status: accepted ? 'accepted' : 'refused', reason: accepted ? undefined : reason, decidedAt: Date.now(), document: `${g.document} (supprimé après traitement)` });
  if (accepted && user(g.userId)) user(g.userId).verified = true;
  log('badge.decision', g.userId, accepted ? 'Demande acceptée' : `Demande refusée : ${reason}`);
}

// ─── Données personnelles ──────────────────────────────────
export function processDataRequest(id) {
  const d = state.dataRequests.find((x) => x.id === id); if (!d) return;
  d.status = 'done'; d.doneAt = Date.now();
  if (d.type === 'deletion') deleteUser(d.userId, 'Demande de suppression de l\'utilisateur');
  log('data.process', d.userId, d.type === 'deletion' ? 'Suppression du compte effectuée' : 'Copie des données envoyée par e-mail');
}
export function rejectDataRequest(id, reason) {
  const d = state.dataRequests.find((x) => x.id === id); if (!d) return;
  d.status = 'cancelled'; d.reason = reason;
  log('data.cancel', d.userId, `Demande annulée : ${reason}`);
}

// ─── Annonces ──────────────────────────────────────────────
export function sendAnnouncement({ title, body, audience }) {
  const reach = audience === 'all' ? users().filter((u) => u.status === 'active').length : audience === 'verified' ? users().filter((u) => u.verified).length : users().filter((u) => Date.now() - u.lastActiveAt > 7 * D).length;
  state.announcements.unshift({ id: `a${Date.now()}`, title, body, audience, sentAt: Date.now(), by: state.session.userId, reach });
  log('announcement.send', null, `« ${title} » → ${reach} personnes`);
}

// ─── Modération et règles ──────────────────────────────────
export function addBannedWord(w) { const word = w.trim().toLowerCase(); if (!word || state.bannedWords.includes(word)) return false; state.bannedWords.push(word); log('words.add', null, `Mot interdit ajouté : « ${word} »`); return true; }
export function removeBannedWord(w) { state.bannedWords = state.bannedWords.filter((x) => x !== w); log('words.remove', null, `Mot interdit retiré : « ${w} »`); }
export function setRules(next) {
  const changes = Object.entries(next).filter(([k, v]) => state.rules[k] !== v).map(([k, v]) => `${k} ${state.rules[k]} → ${v}`);
  if (!changes.length) return 0;
  state.rules = { ...state.rules, ...next };
  log('rules.update', null, changes.join(' · '));
  return changes.length;
}
export function setPlatform(key, value) {
  state.platform[key] = value;
  const labels = { signupsOpen: 'Inscriptions', anonymousEnabled: 'Publication anonyme', commentsEnabled: 'Commentaires', maintenance: 'Mode maintenance' };
  log('platform.update', null, typeof value === 'boolean' ? `${labels[key]} : ${value ? 'activé' : 'désactivé'}` : `${key} modifié`);
}

// ─── Formats ───────────────────────────────────────────────
export function timeAgo(ts) {
  const s = Math.max(0, Date.now() - ts);
  if (s < MIN) return "à l'instant"; if (s < H) return `il y a ${Math.floor(s / MIN)} min`;
  if (s < D) return `il y a ${Math.floor(s / H)} h`; if (s < 30 * D) return `il y a ${Math.floor(s / D)} j`;
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
export const fmtDate = (ts) => new Date(ts).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const compact = (n) => (n < 1000 ? String(n) : n < 10_000 ? `${(n / 1000).toFixed(1).replace('.0', '').replace('.', ',')} k` : `${Math.round(n / 1000)} k`);
export const fmt = (n) => n.toLocaleString('fr-FR');
