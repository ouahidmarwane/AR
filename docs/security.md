# Sécurité : isolation entre organisations

## Pourquoi l'isolation est dans le code

La base MySQL (hébergement Hostinger) n'offre **aucune sécurité au niveau des lignes** : l'application se connecte avec un seul utilisateur MySQL qui voit toutes les données de toutes les organisations. Une requête qui oublie un filtre `organization_id` exposerait les données d'un client à un autre.

L'isolation est donc garantie par le code, de façon **centralisée** (`apps/web/src/lib/db/tenant.ts`) et **difficile à contourner par erreur** (règles ESLint, conventions de signature, tests obligatoires, relecture).

## Les règles

### 1. L'`organizationId` vient toujours de la session

- Le `TenantContext` (`organizationId`, `userId`, `role`) n'est construit **que** par `requireTenant(orgSlug, minRole)`.
- `requireTenant` lit la session Better Auth côté serveur, vérifie dans la table `member` que l'utilisateur appartient à l'organisation et a le rôle minimum (`owner > manager > staff`), sinon lève une erreur 401/403.
- Le slug de l'URL (`/[locale]/app/[org]`) sert seulement à **choisir** l'organisation ; l'appartenance est toujours vérifiée en base.
- **Jamais** d'`organizationId` lu depuis un formulaire, un paramètre, un header ou un body.
- Back-office : `requireSuperAdmin()` (champ `user.is_super_admin`, relu en base, non modifiable par l'utilisateur).

### Rôles d'organisation

Les seuls rôles d'organisation valides sont **`owner`, `manager`, `staff`** (`ORG_ROLES`, `src/lib/auth/permissions.ts`).

- **Créateur** : le créateur d'une organisation reçoit le rôle `owner` (option `creatorRole` du plugin organization) et passe donc `requireTenant(orgSlug, "owner")`.
- **Rôle obligatoire et limité** : par défaut, Better Auth accepte aussi ses rôles intégrés (`member`, `admin`) et donne `member` quand aucun rôle n'est fourni. Les hooks `beforeCreateInvitation`, `beforeAddMember` et `beforeUpdateMemberRole` (`src/lib/auth/server.ts`) **rejettent avec une erreur 400** tout rôle absent, vide, `member`, `admin` ou toute autre valeur, y compris dans une liste (`"owner,member"`). Il faut donc toujours passer un rôle explicite à l'invitation, à l'ajout et au changement de rôle d'un membre.
- **Fail closed** : si une ligne `member` contient malgré tout un rôle hors liste (écriture directe en base, ancienne donnée), `requireTenant()` refuse l'accès (403) : un rôle inconnu ne donne aucun droit.
- Couvert par `apps/web/tests/organization-roles.test.ts` (créateur owner, rejets à l'invitation, à l'ajout et au changement de rôle, rôle hors liste en base).

### Invitations et gestion des membres

Les règles sont appliquées dans `features/organizations/actions.ts` (après `requireTenant()` et lecture de la cible via le repository) **et** par Better Auth (défense en profondeur). Tests : `apps/web/tests/auth-organizations.test.ts`.

| Action                                                              | owner | manager | staff |
| ------------------------------------------------------------------- | ----- | ------- | ----- |
| Inviter un `owner`                                                  | oui   | non     | non   |
| Inviter un `manager` ou un `staff`                                  | oui   | oui     | non   |
| Changer le rôle d'un `manager` / `staff` (vers `manager` / `staff`) | oui   | oui     | non   |
| Nommer un `owner`, modifier ou retirer un `owner`                   | oui   | non     | non   |
| Retirer un `manager` / `staff`                                      | oui   | oui     | non   |

- **Dernier owner** : il ne peut être **ni retiré ni rétrogradé** (`LAST_OWNER`) ; il faut d'abord nommer un autre owner.
- **Invitation** : rôle obligatoire, lien `/[locale]/invitation/[id]` **valable 48 h** ; une invitation expirée, annulée ou déjà traitée est refusée. Réinviter la même adresse remplace l'invitation en attente.
- **Acceptation** : il faut être connecté avec **la même adresse email que l'invitation, et cette adresse doit être vérifiée** (`requireEmailVerificationOnInvitation`). Sans cette vérification, n'importe qui pourrait s'inscrire avec l'adresse d'un invité (sans la posséder) et rejoindre l'organisation à sa place.
- Un id de membre ou d'invitation d'une autre organisation est **introuvable** (`NOT_FOUND`) ; agir sur une organisation dont on n'est pas membre renvoie `FORBIDDEN`.

### Authentification

- **Mot de passe** : 10 caractères minimum (128 maximum), haché par Better Auth (scrypt).
- **Messages génériques** : une connexion échouée renvoie toujours `INVALID_CREDENTIALS`, que l'email existe ou non ; une demande de réinitialisation répond toujours la même chose. _Limite connue_ : l'inscription renvoie `EMAIL_UNAVAILABLE` pour une adresse déjà utilisée (choix d'ergonomie), atténué par le rate limit.
- **Vérification d'email** : envoyée à l'inscription ; la connexion est possible avant vérification (passer `requireEmailVerification: true` dans `src/lib/auth/server.ts` pour l'exiger partout), mais l'acceptation d'une invitation l'exige.
- **Réinitialisation** : lien valable 1 h, à usage unique ; un mot de passe réinitialisé **révoque toutes les sessions**.
- **Déconnexion** : la session est supprimée en base (le cookie seul ne suffit plus).
- **Rate limiting** :
  - requêtes HTTP vers `/api/auth/*` : rate limit intégré de Better Auth (connexion, inscription, réinitialisation, renvoi de vérification) ;
  - server actions : `src/lib/rate-limit.ts` (connexion par IP et par email, inscription, réinitialisation, vérification, invitations), car les appels `auth.api.*` ne passent pas par le rate limit HTTP ;
  - stockage **en mémoire** : valable pour une instance Node unique ; à passer sur un stockage partagé si l'app tourne sur plusieurs instances. L'IP est lue dans `X-Forwarded-For` / `X-Real-IP`, fiables uniquement derrière le proxy de l'hébergeur.
- **Cookies** : `Secure` en production (`useSecureCookies`), `HttpOnly` et `SameSite=Lax` (défauts de Better Auth).
- **Origines de confiance** : `trustedOrigins` = `BETTER_AUTH_URL` et `NEXT_PUBLIC_APP_URL` ; toute autre origine est refusée (403) sur `/api/auth/*`, et les URL de redirection doivent appartenir à ces origines.
- **Emails** : pilote `console` en local (les liens, qui contiennent des jetons, s'affichent dans les logs : **jamais en production**) ; pilote Resend à venir.

### 2. Toutes les requêtes passent par un repository

- Seuls `src/features/*/repository.ts` (et `src/lib/db/**`, `src/lib/auth/server.ts`) peuvent importer `drizzle-orm`, `mysql2` ou `@/lib/db/client`. **ESLint bloque** tout autre import.
- Chaque fonction de repository prend un `TenantContext` en **premier paramètre**.
- Les actions et queries suivent toujours l'ordre : `requireTenant()` → validation Zod → repository.

### 3. `tenantWhere` est obligatoire

- Chaque requête (select, update, delete) sur une table métier inclut `tenantWhere(table, ctx)`, combiné avec `and(...)` aux autres filtres.
- Un id reçu du client n'est **jamais** suffisant seul : `where(and(tenantWhere(t, ctx), eq(t.id, id)))`.
- Les insertions renseignent `organizationId: ctx.organizationId`.
- Une ressource d'une autre organisation est traitée comme **introuvable** (404), pour ne pas révéler son existence.
- `assertSameTenant(row, ctx)` vérifie en plus toute ligne obtenue par un autre chemin (jointure, lecture indirecte).

### 4. Tests d'isolation obligatoires

- Chaque nouvelle fonction de repository a un test dans `apps/web/tests/` qui crée **deux organisations** et vérifie que A ne lit, ne modifie et ne supprime **jamais** les données de B (exemple : `tests/tenant-isolation.test.ts`).
- Ces tests tournent dans la CI sur une vraie base MySQL ; une PR ne peut pas être mergée s'ils échouent.

### 5. Exception : le menu public

- `features/public-menu/repository.ts` est la **seule** exception à la règle du `TenantContext` : le menu est consulté sans compte (QR code).
- Il est limité à de la **lecture seule**, par **slug**, sur les restaurants **publiés**, et ne sélectionne que des **champs publics explicitement listés** (jamais `organization_id`, jamais de `select()` complet).
- Toute nouvelle exception doit être documentée ici et validée en relecture.

### Fichiers

- Les clés de stockage sont toujours `{organizationId}/{restaurantId}/...`, construites par `tenantStorageKey(ctx, ...)`.
- Les fichiers ne sont jamais servis directement : `/api/files/...` vérifie l'accès (organisation propriétaire ou menu publié) avant de répondre.
- Le dossier du pilote local est hors du dossier de l'app et hors de `public/`.

### Proxy

`src/proxy.ts` ne vérifie que la **présence** du cookie de session pour rediriger vers la page de connexion. Ce n'est pas un contrôle d'accès : chaque page, action et route serveur appelle `requireTenant()` ou `requireSuperAdmin()`.

## Checklist de relecture sécurité d'une PR

- [ ] Toute nouvelle table métier a `organization_id` NOT NULL + index (et une clé étrangère vers `organization`).
- [ ] Aucun import de `drizzle-orm`, `mysql2` ou `@/lib/db/client` hors des fichiers autorisés (lint vert).
- [ ] Chaque nouvelle fonction de repository prend un `TenantContext` en 1er paramètre et applique `tenantWhere()` sur **chaque** requête (y compris update/delete et sous-requêtes).
- [ ] Les insertions utilisent `ctx.organizationId`, jamais une valeur venant du client.
- [ ] Chaque action/query appelle `requireTenant()` (avec le bon rôle minimum) **avant** tout accès au repository.
- [ ] Les entrées client sont validées par Zod.
- [ ] Aucun rôle d'organisation autre que `owner | manager | staff` n'est introduit, et les hooks de rôle de `src/lib/auth/server.ts` ne sont ni retirés ni contournés.
- [ ] Les nouvelles actions sensibles (authentification, envoi d'email, invitation) sont limitées en fréquence, et les messages d'erreur ne révèlent pas l'existence d'un compte.
- [ ] Les jointures vers une autre table métier filtrent aussi sur l'organisation, ou le résultat passe par `assertSameTenant()`.
- [ ] Un test d'isolation A/B couvre chaque nouvelle fonction de repository, et il passe en CI.
- [ ] Les erreurs ne révèlent pas l'existence de ressources d'une autre organisation (404 plutôt que 403 sur un id).
- [ ] Pas de nouvelle lecture publique hors de `public-menu`, ou exception documentée ici.
- [ ] Les clés de stockage passent par `tenantStorageKey()`.
- [ ] Aucun secret ni fichier `.env` commité.
