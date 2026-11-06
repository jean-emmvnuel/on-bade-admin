# On Bade — Administration

Le back-office de **On Bade**, écrit en **HTML, CSS et JavaScript natif**, animé avec **GSAP**. Même identité que l'app et le site.

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
python3 -m http.server 5175
```

Puis ouvre <http://localhost:5175>. Connexion de démo : `admin@jebade.app` / `JeBade2026!`.

Les données sont simulées et gardées dans le navigateur (`localStorage`) en attendant l'API (routes `/admin/*` de `BACKEND.md` dans le dépôt mobile). Pour repartir de zéro : Paramètres › Réinitialiser les données de démo.

## Structure

```
index.html          ← coquille, chargement de GSAP
css/admin.css       ← tokens (identiques à l'app), mise en page, composants
js/app.js           ← routeur (hash), barre latérale, recherche globale
js/store.js         ← données de démo + actions d'administration (→ API plus tard) + journal d'audit
js/actions.js       ← actions partagées : sanctions, levée d'anonymat, menus
js/ui.js            ← icônes, fenêtres, confirmations avec motif, graphiques SVG, animations GSAP
js/stickers.js      ← bibliothèque de stickers (copie de celle du site et de l'app)
js/views/*.js       ← un fichier par écran
```

---

**On Bade** · une app **ORIVERSE** · Créée par **Jean Emmanuel Ahossi** — [portfolio](https://jeanemmanuel-portfolio-gamma.vercel.app/)

## Tests

Tests unitaires avec [Vitest](https://vitest.dev) (jsdom). Pas de build : `package.json` ne sert qu’aux tests.

```bash
npm install
npm test
```

| Fichier | Ce qui est vérifié |
| --- | --- |
| `tests/store.test.js` | Connexion, badge vérifié réservé à l’administrateur (modérateurs en lecture seule), conditions du badge (actif + 1 000 rires, anonymes exclus, seuils réglables), sanctions, suppression de compte, masquage/révélation d’auteur, signalements, stickers retirés, mots interdits, règles, annonces, données personnelles, journal d’audit |
| `tests/migrations.test.js` | Passage aux nouvelles règles du badge et session gardée après rechargement |

### Tests de bout en bout (Playwright)

Un vrai navigateur ouvre le back-office et clique dans les pages, sur ordinateur et sur téléphone (Pixel 7).

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

