# On Bade — Administration

Le back-office de **On Bade**, écrit en **HTML, CSS et JavaScript natif**, animé avec **GSAP**. Même identité que l'app et le site.

L'administrateur a **tous les accès** ; chaque action est inscrite au **journal d'audit**.

## Écrans

| Écran | Ce qu'on y fait |
|---|---|
| Tableau de bord | Utilisateurs, actifs, badings, rires (avec l'évolution sur 7 jours), tâches en attente, courbe sur 30 jours, motifs de signalement, badings les plus drôles, dernières actions de l'équipe |
| Signalements | File regroupée par contenu : classer sans suite, masquer, garder masqué, supprimer, sanctionner l'auteur |
| Badings | Recherche, filtres (statut, signés/anonymes/signalés), tri, détail avec commentaires, signalements et historique ; masquer, rétablir, supprimer, **révéler l'auteur anonyme** (motif obligatoire, journalisé) |
| Commentaires | Recherche, suppression, rétablissement, sanction de l'auteur |
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
js/views/*.js       ← un fichier par écran
```

---

**On Bade** · une app **ORIVERSE** · Créée par **Jean Emmanuel Ahossi** — [portfolio](https://jeanemmanuel-portfolio-gamma.vercel.app/)
