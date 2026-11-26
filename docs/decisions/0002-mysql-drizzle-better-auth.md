# ADR 0002 : MySQL (Hostinger) + Drizzle ORM + Better Auth

- **Statut** : accepté (remplace la partie base de données / auth / stockage de l'[ADR 0001](0001-stack.md))
- **Date** : 2026-11-26

## Contexte

Le projet a été initialisé sur une plateforme BaaS managée (Postgres avec sécurité au niveau des lignes, authentification, stockage et temps réel intégrés), avec un hébergement serverless pour l'app.

Nous hébergeons finalement **toute l'application chez Hostinger** : l'app Next.js en « Node.js web app » et la base en **MySQL** inclus dans l'offre. Objectifs : un seul fournisseur, un coût maîtrisé, pas de dépendance à un BaaS propriétaire.

## Décision

1. **MySQL 8** comme base : Hostinger en production, Docker (`docker-compose.yml`) en local, un service MySQL en CI.
2. **Drizzle ORM** (driver `mysql2`) : schéma TypeScript typé (`src/lib/db/schema`), migrations SQL générées par **drizzle-kit** et versionnées (`apps/web/drizzle/`). Pool de connexions unique, limité par `DB_CONNECTION_LIMIT` (défaut 5) pour respecter les limites d'un hébergement mutualisé.
3. **Better Auth** : email + mot de passe, sessions en base, **plugin organization** (organisations, membres, invitations) avec les rôles `owner`, `manager`, `staff` ; tables générées par son CLI dans le schéma Drizzle.
4. **Isolation multi-tenant dans le code** : `src/lib/db/tenant.ts` (`requireTenant`, `tenantWhere`, `assertSameTenant`, `requireSuperAdmin`), repositories obligatoires, règles ESLint et tests d'isolation en CI (voir [security.md](../security.md)).
5. **Stockage via un adaptateur** `StorageDriver` : disque local d'abord, stockage objet compatible S3 ensuite, sans changer le code métier.

## Alternatives écartées

- **Rester sur le BaaS managé** : deuxième fournisseur à payer et à gérer, en plus de l'hébergement Hostinger.
- **Prisma** : plus lourd (moteur, génération de client), moins proche du SQL ; Drizzle est léger et explicite.
- **Auth maison** : trop risqué ; **Auth.js** : support des organisations et des rôles moins complet que le plugin organization de Better Auth.

## Conséquences

- **Pas de RLS** : une requête sans filtre d'organisation expose les données des autres clients. L'isolation repose entièrement sur la couche `tenant.ts`, les repositories, le lint, les tests d'isolation et la relecture (checklist de [security.md](../security.md)).
- **Pas de Realtime** : le suivi des tâches longues (import IA, génération 3D) se fera par **polling** d'une table de jobs.
- **Stockage via adaptateur** : fichiers rangés par `{organizationId}/{restaurantId}/...`, servis uniquement par `/api/files/...` après contrôle d'accès.
- **Migrations** : appliquées sur la base Hostinger avec `pnpm db:migrate` lors des déploiements qui en contiennent.
- **Connexions limitées** : un seul pool par processus, taille réglée par `DB_CONNECTION_LIMIT`.
- **Docker requis** pour développer et lancer les tests en local.
