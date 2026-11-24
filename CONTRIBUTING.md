# Contribuer

## Workflow Git

- `main` est **protégée** : aucun push direct, tout passe par une **Pull Request**.
- Une PR est mergée si : **1 relecture approuvée** + **CI verte** (lint, typecheck, build).
- Merge en **squash merge** uniquement : un commit par PR sur `main`.
- Les relecteurs sont assignés automatiquement via [`.github/CODEOWNERS`](.github/CODEOWNERS).

### Noms de branches

| Préfixe  | Usage                                | Exemple                   |
| -------- | ------------------------------------ | ------------------------- |
| `feat/`  | Nouvelle fonctionnalité              | `feat/public-menu-layout` |
| `fix/`   | Correction de bug                    | `fix/qr-code-download`    |
| `chore/` | Outillage, dépendances, config, docs | `chore/update-eslint`     |
| `db/`    | Migration de base de données         | `db/create-restaurants`   |

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

## Base de données (Supabase)

- **Une migration par PR maximum**, créée avec `pnpm db:migration <nom>`.
- **Ne jamais modifier une migration déjà mergée** : créer une nouvelle migration corrective.
- Après chaque migration : `pnpm db:reset` puis **`pnpm db:types`**, et commiter `apps/web/src/types/database.ts`.
- Toute nouvelle table : RLS activée + politiques basées sur `organization_id` (voir [docs/architecture.md](docs/architecture.md)).
- Ne jamais lancer de commande qui modifie la base distante depuis un poste de dev.

## Secrets

- **Ne jamais commiter de fichier `.env`** ni aucune clé, token ou mot de passe.
- Seul [`.env.example`](.env.example) est versionné, sans valeurs secrètes.
- Variables lues via `getPublicEnv()` / `getServerEnv()` de `src/lib/env.ts` (validation Zod), jamais `process.env` directement.
- `SUPABASE_SERVICE_ROLE_KEY` et toutes les variables serveur ne doivent jamais atteindre le navigateur.

## Organisation du code

Le code métier vit dans `apps/web/src/features/<module>/`. Chaque module contient :

| Fichier / dossier | Contenu                                                             |
| ----------------- | ------------------------------------------------------------------- |
| `components/`     | Composants React propres au module                                  |
| `actions.ts`      | Server Actions (mutations), entrées validées avec Zod               |
| `queries.ts`      | Lectures de données (Server Components)                             |
| `schemas.ts`      | Schémas Zod (formulaires, entrées des actions)                      |
| `types.ts`        | Types TypeScript du module                                          |
| `index.ts`        | **API publique** du module : seul point d'entrée depuis l'extérieur |
| `README.md`       | Une ligne décrivant le rôle du module                               |

### Règles d'import (vérifiées par ESLint)

- Un module n'importe un autre module **que via son `index.ts`** :
  - ✅ `import { MenuCard } from "@/features/menu";`
  - ❌ `import { MenuCard } from "@/features/menu/components/menu-card";`
- `components/` et `lib/` **n'importent jamais** `features/`.
- Utiliser l'alias `@/` (→ `apps/web/src`) plutôt que des chemins relatifs qui sortent du module.

## Avant d'ouvrir une PR

```bash
pnpm lint && pnpm typecheck && pnpm build
```
