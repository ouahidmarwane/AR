# AR Menu

SaaS de menus de restaurant en réalité augmentée :

- **menu public** consulté par les clients via QR code ;
- **dashboard restaurant** pour gérer menus, catégories et plats ;
- **import du menu par IA** (Claude API) depuis une photo, un PDF, un tableur ou une URL ;
- **viewer AR** des plats avec `<model-viewer>` ;
- **génération 3D** des plats avec TRELLIS.2 sur GPU (phase finale).

Stack : monorepo pnpm, Next.js (App Router, TypeScript strict, Tailwind CSS), Supabase (Postgres, Auth, Storage, Realtime), Zod.

## Prérequis

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/), version fixée dans [`.nvmrc`](.nvmrc) (`nvm use`)
- [pnpm](https://pnpm.io/) 12+ (`npm install -g pnpm`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Supabase local)
- [Supabase CLI](https://supabase.com/docs/guides/cli) : installée comme dépendance du repo, utilisable via `pnpm exec supabase` et les scripts `db:*`

## Installation

```bash
git clone https://github.com/ouahidmarwane/AR.git
cd AR
nvm use                                # ou installer la version de .nvmrc
pnpm install                           # installe aussi les hooks Git (Husky)
cp .env.example apps/web/.env.local    # puis compléter les valeurs
pnpm db:start                          # Supabase local (Docker requis)
pnpm dev                               # http://localhost:3000
```

En local, `pnpm db:start` affiche l'URL et la clé `anon` à mettre dans `apps/web/.env.local`.

## Scripts

| Script                    | Rôle                                                            |
| ------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                | Lance l'app web en développement                                |
| `pnpm build`              | Build de production de l'app web                                |
| `pnpm lint`               | ESLint (dont les règles d'import entre modules)                 |
| `pnpm typecheck`          | Vérification TypeScript                                         |
| `pnpm test`               | Tests (placeholder pour l'instant)                              |
| `pnpm format`             | Formate tout le repo avec Prettier                              |
| `pnpm format:check`       | Vérifie le formatage sans modifier                              |
| `pnpm db:start`           | Démarre Supabase en local                                       |
| `pnpm db:stop`            | Arrête Supabase local                                           |
| `pnpm db:reset`           | Recrée la base locale (migrations + `seed.sql`)                 |
| `pnpm db:migration <nom>` | Crée un nouveau fichier de migration                            |
| `pnpm db:types`           | Régénère `apps/web/src/types/database.ts` depuis la base locale |

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) : workflow Git, conventions, règles de code
- [docs/architecture.md](docs/architecture.md) : architecture, multi-tenant, routes, roadmap
- [docs/decisions/](docs/decisions/) : décisions d'architecture (ADR)
