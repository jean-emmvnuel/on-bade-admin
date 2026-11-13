# On Bade — Administration

Le back-office de **On Bade**, écrit en **React** (Vite, React Router), animé avec **GSAP**. Même identité que l'app et le site.

L'administrateur a **tous les accès** ; chaque action est inscrite au **journal d'audit**.

## Écrans

| Écran | Ce qu'on y fait |
|---|---|
| Tableau de bord | Utilisateurs, actifs, badings, rires (avec l'évolution sur 7 jours), tâches en attente, courbe sur 30 jours, motifs de signalement, badings les plus drôles, dernières actions de l'équipe |
| Signalements | File regroupée par contenu : classer sans suite, masquer, garder masqué, supprimer, sanctionner l'auteur |
| Badings | Recherche, filtres (statut, signés/anonymes/avec image/signalés), vignettes des images, tri, détail avec commentaires, signalements et historique ; masquer, rétablir, supprimer, **révéler l'auteur anonyme** (motif obligatoire, journalisé) |
| Commentaires | Recherche, filtre stickers, suppression, rétablissement, sanction de l'auteur |
| Stickers | Stickers créés par les Badeurs (utilisations, enregistrements, signalements) : retirer partout, rétablir, sanctionner ; bibliothèque des 16 stickers On Bade |
| Utilisateurs | Recherche par pseudo ou e-mail, filtres, fiche complète ; sanctions (avertissement, suspension 7 jours, bannissement), lever une sanction, badge, rôle, pseudo, lien de mot de passe, suppression du compte |
| Badges vérifiés | Demandes avec vérification des critères, acceptation ou refus motivé |
| Annonces | Notification à tous, aux comptes vérifiés ou aux inactifs, avec aperçu |
| Mots interdits & règles | Liste des mots bloqués, testeur, toutes les règles chiffrées (longueurs, limite par jour, seuil de masquage, critères du badge, délai légal) |
| Données personnelles | Demandes de suppression et de copie, avec échéance légale |
| Journal d'audit | Toutes les actions, filtres, export CSV |
| Paramètres | Inscriptions, publication anonyme, commentaires, mode maintenance ; équipe et droits par rôle |

## Lancer

```bash
npm install
npm run dev        # démo : données simulées, http://localhost:5175
npm run dev:prod   # vraies données : API de production, http://localhost:5175
npm run dev:local  # vraies données : backend lancé sur ce PC (localhost:3000), http://localhost:5173
```

Connexion de démo : `admin@jebade.app` / `JeBade2026!`. Avec `dev:prod`, connecte-toi avec ton compte On Bade (il doit faire partie de l'équipe).

Sur `localhost`, les données sont simulées par défaut et gardées dans le navigateur (`localStorage`). Une fois publié, le back-office lit l'API de production (`src/lib/api.js`). `VITE_API_URL` et `VITE_ADMIN_MODE` (voir `.env.example`) changent l'adresse de l'API et le mode ; `?demo=1` ou `?demo=0` dans l'adresse force un mode pour ce navigateur. Pour repartir de zéro en démo : Paramètres › Réinitialiser les données de démo.

Le serveur n'accepte que les origines de son `CORS_ORIGINS` : en production, le site et `http://localhost:5175`. Si le back-office est publié ailleurs, ajoute son adresse dans `.env.docker` sur le VPS.

Mise en ligne : `npm run build` produit le dossier `dist/`, à servir tel quel (chemins relatifs, routes en `#/…` : aucun réglage serveur).

## Structure

```
index.html                 ← coquille Vite
src/main.jsx               ← démarrage (HashRouter)
src/App.jsx                ← routes, garde de connexion, chargement des données, barre latérale, recherche globale
src/actions.jsx            ← actions partagées : sanctions, levée d'anonymat, menus bading / commentaire / utilisateur
src/components/ui.jsx      ← icônes, avatars, pastilles, tableaux, graphiques SVG, stickers
src/components/overlays.jsx← fenêtres, confirmations avec motif, menus, toasts (API par promesses : confirmAction(), menu())
src/views/*.jsx            ← un fichier par écran
src/lib/store.js           ← données de démo + actions d'administration + journal d'audit (sans React)
src/lib/api.js, server.js  ← client de l'API et conversion des réponses
src/lib/useStore.js        ← abonnement des composants au store (useSyncExternalStore)
src/lib/useQuery.js        ← filtres gardés dans l'adresse (#/badings?status=hidden)
src/styles/admin.css       ← tokens (identiques à l'app), mise en page, composants
public/assets/             ← favicons et icônes
```

---

**On Bade** · une app **ORIVERSE** · Créée par **Jean Emmanuel Ahossi** — [portfolio](https://jeanemmanuel-portfolio-gamma.vercel.app/)

## Tests

Tests unitaires avec [Vitest](https://vitest.dev) (jsdom).

```bash
npm install
npm test
```

| Fichier | Ce qui est vérifié |
| --- | --- |
| `tests/store.test.js` | Connexion, badge vérifié réservé à l’administrateur (modérateurs en lecture seule), conditions du badge (actif + 1 000 rires, anonymes exclus, seuils réglables), sanctions, suppression de compte, masquage/révélation d’auteur, signalements, stickers retirés, mots interdits, règles, annonces, données personnelles, journal d’audit |
| `tests/migrations.test.js` | Passage aux nouvelles règles du badge et session gardée après rechargement |
| `tests/server.test.js` | Conversion des réponses de l’API (`/api/admin`) vers la forme des écrans |

### Tests de bout en bout (Playwright)

Un vrai navigateur ouvre le back-office (serveur Vite lancé automatiquement) et clique dans les pages, sur ordinateur et sur téléphone (Pixel 7).

```bash
npx playwright install chromium   # une seule fois
npm run test:e2e                  # 43 tests
npm run test:e2e:report           # rapport détaillé (captures en cas d’échec)
npm run test:all                  # unitaires + bout en bout
```

| Fichier | Ce qui est vérifié |
| --- | --- |
| `e2e/auth.spec.js` | Mauvais mot de passe refusé, pages protégées, connexion, déconnexion, session gardée au rechargement |
| `e2e/navigation.spec.js` | Les 12 pages s’ouvrent sans erreur, menu latéral, recherche globale, menu sur téléphone |
| `e2e/moderation.spec.js` | Classer des signalements, masquer/rétablir un bading, filtre « avec image », retirer/rétablir un sticker, mots interdits, journal d’audit |
| `e2e/users.spec.js` | Recherche, suspension puis levée, badge : accepter une demande, attribuer à un éligible, modérateur en lecture seule |
| `e2e/platform.spec.js` | Règles enregistrées et gardées, annonce, copie des données, mode maintenance, Échap, pas de débordement sur téléphone |

Chaque test échoue aussi si la page lève une erreur JavaScript.

