# Contribuer

## Workflow Git

- `main` est **protégée** : aucun push direct, tout passe par une **Pull Request**.
- Une PR est mergée si : **1 relecture approuvée** + **CI verte** (lint, typecheck, test, build).
- Merge en **squash merge** uniquement : un commit par PR sur `main`.
- Les relecteurs sont assignés automatiquement via [`.github/CODEOWNERS`](.github/CODEOWNERS).
  Tout `repository.ts` est relu par le responsable plateforme.

### Noms de branches

| Préfixe  | Usage                                | Exemple                   |
| -------- | ------------------------------------ | ------------------------- |
| `feat/`  | Nouvelle fonctionnalité              | `feat/public-menu-layout` |
| `fix/`   | Correction de bug                    | `fix/qr-code-download`    |
| `chore/` | Outillage, dépendances, config, docs | `chore/update-eslint`     |
| `db/`    | Migration de base de données         | `db/create-menus`         |

### Commits : Conventional Commits

Vérifiés par commitlint (hook `commit-msg`) :

```
feat(menu): ajouter la création de catégories
fix(auth): corriger la redirection après connexion
chore: mettre à jour les dépendances
```

Types courants : `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`, `build`.

Le hook `pre-commit` lance `eslint --fix` et `prettier` sur les fichiers modifiés (lint-staged).

### Taille des PR

- Viser **moins de 400 lignes** modifiées (hors fichiers générés et lockfile).
- Une PR = un sujet. Découper si besoin.

## Base de données (MySQL + Drizzle)

- Le schéma est la source de vérité : `apps/web/src/lib/db/schema/`.
- Pour changer la base : **modifier le schéma Drizzle**, puis **`pnpm db:generate`** (crée la migration SQL dans `apps/web/drizzle/`), puis `pnpm db:migrate` en local. Commiter le schéma ET la migration.
- **Une migration par PR maximum.**
- **Ne jamais modifier une migration déjà mergée** : créer une nouvelle migration corrective.
- Les tables d'authentification (`schema/auth.ts`) sont générées par le CLI Better Auth : ne pas les éditer à la main.
- Toute nouvelle table métier : colonne `organization_id` NOT NULL + index (voir [docs/security.md](docs/security.md)).
- `pnpm db:reset` recrée la base locale ; il refuse toute base distante.

## Sécurité multi-tenant

Il n'y a pas de sécurité au niveau de la base : l'isolation entre organisations est garantie par le code. Lire [docs/security.md](docs/security.md) avant de toucher à la base. En résumé :

- l'`organizationId` vient **toujours** de `requireTenant()` (session + table `member`), jamais du client ;
- seuls les `repository.ts` parlent à la base, et chaque fonction applique `tenantWhere()` ;
- chaque nouvelle fonction de repository a son **test d'isolation** dans `apps/web/tests/`.

## Secrets

- **Ne jamais commiter de fichier `.env`** ni aucune clé, token ou mot de passe.
- Seul [`.env.example`](.env.example) est versionné, sans valeurs secrètes.
- Variables lues via `getPublicEnv()` / `getServerEnv()` de `src/lib/env.ts` (validation Zod), jamais `process.env` directement.

## Organisation du code

Le code métier vit dans `apps/web/src/features/<module>/`. Chaque module contient :

| Fichier / dossier | Contenu                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| `components/`     | Composants React propres au module                                         |
| `repository.ts`   | **Seul** accès à la base ; chaque fonction prend un `TenantContext` en 1er |
| `actions.ts`      | Server Actions : `requireTenant()` → validation Zod → repository           |
| `queries.ts`      | Lectures côté serveur : `requireTenant()` → repository                     |
| `schemas.ts`      | Schémas Zod (formulaires, entrées des actions)                             |
| `types.ts`        | Types TypeScript du module                                                 |
| `index.ts`        | **API publique** du module : seul point d'entrée depuis l'extérieur        |
| `README.md`       | Une ligne décrivant le rôle du module                                      |

Le module `features/restaurants` est l'**exemple de référence** à copier.

### Règles d'import (vérifiées par ESLint)

- `drizzle-orm`, `mysql2` et `@/lib/db/client` ne sont importables **que** dans `src/lib/db/**`, `src/lib/auth/server.ts` et les `src/features/*/repository.ts`.
- Un module n'importe un autre module **que via son `index.ts`** :
  - ✅ `import { getOrganizationRestaurants } from "@/features/restaurants";`
  - ❌ `import { listRestaurants } from "@/features/restaurants/repository";`
- `components/` et `lib/` **n'importent jamais** `features/`.
- Utiliser l'alias `@/` (→ `apps/web/src`) plutôt que des chemins relatifs qui sortent du module.

## Avant d'ouvrir une PR

```bash
pnpm db:up && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
