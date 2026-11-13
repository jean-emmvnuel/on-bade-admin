# Routes admin du backend utilisées par le back-office

État : branchées dans `src/lib/api.js`, `src/lib/server.js` et `src/lib/store.js` (mode API). Le mode démo reste inchangé.

Backend : `onbad-backend` (dossier `~/Downloads/onbad-backend-main`). API locale : `http://localhost:3000/api` (CORS autorisé pour `http://localhost:5173`).
Réponses `{ success, message, data }` (déballées par `src/lib/api.js`), dates en millisecondes, erreurs `{ code, message }`.
Référence complète : README du backend, section « Routes du back-office ».

Tous les écrans sont actifs en mode API (`SERVER_FEATURES` dans `src/lib/store.js`) ; révélation, suppression de compte, données personnelles et copie des données sont réservées aux administrateurs ALL (`ALL_ONLY`).

## Tableau de bord

- `GET /admin/stats` → champs existants + `activeUsers` (7 j), `anonymousShare` (0–1), `laughs30d`, `hiddenBadings`, `hiddenComments`, `removedStickers`, `warnings30d`, `daily [{ date: 'YYYY-MM-DD', signups, badings, laughs, comments }]` (30 jours), `reportReasons [{ reason, count }]`, `topBadings [AdminBading]`, `recentActions [Action]`.

## Journal d'audit

- `GET /admin/audit?adminId&action&targetType&targetId&q&since&until&page&limit` → `{ actions, total, page }` (`action` accepte un préfixe, ex. `bading`).
- `Action { id, adminId, actor: { id, username } | null, action, targetType, targetId, detail, meta?, createdAt }` — `actor` null = action automatique.
- Codes : `bading.hide|restore|delete|pin|unpin|autohide`, `vault.reveal`, `comment.hide|restore|delete`, `sticker.remove|restore`, `user.sanction|unsanction|warn|message|pseudo|delete|password_reset|manager_add|manager_remove`, `badge.grant|revoke|decision`, `rank.*`, `report.open|resolved|dismissed`, `admin.add|permission|remove`, `announcement.send`, `settings.update`, `data.export|process|cancel`, `mfa.enable|disable|reset`.

## Badings

- `GET /admin/badings?q&status=visible|hidden|deleted|all&type=signed|anonymous|image|reported|pinned&authorId&sort=recent|laughs|reports&page&limit` → `{ badings, total, page, counts: { visible, hidden, deleted } }`
- `AdminBading { id, text, image?{src,ratio}, anonymous, authorId|null, author{id,username}|null (null si anonyme), rebadeOf?, status: 'visible'|'hidden'|'deleted', createdAt, deletedAt, hidden{at,byId,reason,auto}|null, pinned{at,until,byId,label}|null, likes, comments, shares, views, openReports }`
- `GET /admin/badings/:id` → `{ bading, comments: [AdminComment] (masqués compris), reports, history: [Action] }`
- `PATCH /admin/badings/:id { status: 'hidden'|'visible', reason }` — motif obligatoire pour masquer ; 409 si supprimé.
- `DELETE /admin/badings/:id { reason? }`
- `POST /admin/badings/:id/reveal { reason }` → `{ user: { id, username, email } }` — permission ALL, journalisé.
- `PUT /admin/badings/:id/pin { until?: ms, label?: ≤ 40 car. }` → `{ pinned }` ; `DELETE /admin/badings/:id/pin`.

## Commentaires

- `GET /admin/comments?q&status=visible|hidden|all&sticker=1&reported=1&badingId&authorId&page&limit` → `{ comments, total, page }`
- `AdminComment { id, badingId, authorId, author{id,username}, text, sticker?, parentId, createdAt, status, hidden{at,byId,reason}|null, likes, replies, openReports }`
- `PATCH /admin/comments/:id { status: 'hidden'|'visible', reason }` ; `DELETE /admin/comments/:id { reason? }` (définitif).

## Stickers

- `GET /admin/stickers?status=active|removed|all&ownerId&sort=recent|uses&page&limit` → `{ stickers: [{ id, ownerId, owner, src, createdAt, status, removed{at,byId,reason}|null, uses, saves }], total, page }`
- `PATCH /admin/stickers/:id { status: 'removed'|'active', reason }`

## Utilisateurs

- `GET /admin/users/:id` → `{ user (avec lastActiveAt, counts.warnings), blocks, warnings: [{ id, reason, adminId, createdAt }], history: [Action] }`
- `PATCH /admin/users/:id { username }` — retire le badge vérifié ; 409 `pseudo_taken`.
- `DELETE /admin/users/:id { reason }` — ALL ; 409 `is_admin`.
- `POST /admin/users/:id/warnings { reason }` → avertissement (niveau 1) + notification.
- `POST /admin/users/:id/message { title?, text }` → message direct (notification `admin_message`).
- `POST /admin/users/:id/password-reset` → `{ url, expiresAt }` (lien à transmettre, pas d'e-mail envoyé).
- `GET /admin/users/:id/export` → même forme que `/me/export` — ALL.

## Données personnelles

- `GET /admin/data-requests` → `{ requests: [{ userId, user, type: 'deletion', reason, requestedAt, deadline, overdue }] }`
- `POST /admin/data-requests/:userId { action: 'process'|'reject', reason }` — ALL.

## Annonces

- `GET /admin/announcements` → `{ announcements: [{ id, title, body, audience, reach, by, sentAt }] }`
- `GET /admin/announcements/reach?audience=all|verified|inactive` → `{ reach }` (aperçu avant envoi)
- `POST /admin/announcements { title ≤ 80, body ≤ 1000, audience }`

## Réglages (mots interdits, règles, plateforme)

- `GET /admin/settings` → `{ rules, platform, bannedWords, defaults }`
- `PATCH /admin/settings { rules?, platform?, bannedWords? (liste complète) }` — ALL ; seules les clés envoyées changent.
- `rules` : `minLength, maxLength, captionMax, opinionMax, commentMax, dailyLimit, maxMentions, myStickersMax, autoHideThreshold, badgeActiveDays, badgeMinLaughs, badgeRetryDays, deletionDays` (mêmes noms que `DEFAULT_RULES` du store).
- `platform` : `signupsOpen, anonymousEnabled, commentsEnabled, maintenance, maintenanceMessage, adminMfaRequired`.

## Sécurité de l'équipe (2FA TOTP et connexions)

- Connexion : `POST /login` renvoie `mfaRequired: true` si l'admin a la 2FA → écran de code → `POST /admin/mfa/verify { code }` → `{ token }`, à stocker à la place de l'ancien.
- Sans ce jeton, les routes admin répondent `401 mfa_required`. `403 mfa_setup_required` si `platform.adminMfaRequired` et 2FA non configurée. `429 too_many_attempts` après 5 échecs en 15 min. Un code ne sert qu'une fois (`401 invalid_code` « déjà utilisé » s'il est rejoué).
- `GET /admin/mfa` → `{ enabled, enabledAt, pending, required, verified }`
- `POST /admin/mfa/setup` → `{ secret, otpauthUrl }` (QR code) ; `POST /admin/mfa/enable { code }` → `{ token }` ; `DELETE /admin/mfa { code }`.
- `DELETE /admin/admins/:id/mfa` (ALL, réinitialiser un membre) ; `GET /admin/admins` renvoie aussi `mfaEnabled`.
- `GET /admin/logins?adminId&failed=1&page` → `{ logins: [{ id, adminId, admin{id,username}, step: 'password'|'mfa', success, ip, userAgent, createdAt }] }` (un admin ALL voit toute l'équipe, les autres seulement leurs connexions).

## Tester en local contre la vraie API

Le front lit l'URL de l'API via `window.ONBADE_API_URL` et le mode via `?demo=0`. Un compte admin de test existe dans la base locale ; ses identifiants sont à demander à l'utilisateur.
