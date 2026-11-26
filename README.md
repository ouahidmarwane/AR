# AR Menu

SaaS de menus de restaurant en réalité augmentée :

- **menu public** consulté par les clients via QR code ;
- **dashboard restaurant** pour gérer menus, catégories et plats ;
- **import du menu par IA** (Claude API) depuis une photo, un PDF, un tableur ou une URL ;
- **viewer AR** des plats avec `<model-viewer>` ;
- **génération 3D** des plats avec TRELLIS.2 sur GPU (phase finale).

Stack : monorepo pnpm, Next.js (App Router, TypeScript strict, Tailwind CSS), MySQL 8 + Drizzle ORM, Better Auth, Zod, Vitest. Hébergement : Hostinger (Node.js web app + MySQL).

## Prérequis

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) **24 LTS**, version exacte fixée dans [`.nvmrc`](.nvmrc) (`nvm use` ou `fnm use`), la même qu'en production sur Hostinger
- [pnpm](https://pnpm.io/) 12+ (`npm install -g pnpm`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (MySQL local)

## Installation

```bash
git clone https://github.com/ouahidmarwane/AR.git
cd AR
pnpm install                            # installe aussi les hooks Git (Husky)
cp .env.example apps/web/.env.local     # puis renseigner BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm db:up                              # MySQL 8 dans Docker (bases ar_menu et ar_menu_test)
pnpm db:migrate                         # applique les migrations de apps/web/drizzle
pnpm db:seed                            # comptes de démo (voir ci-dessous)
pnpm dev                                # http://localhost:3000
```

### Comptes de démo (base locale)

Créés par `pnpm db:seed`, mot de passe **`password1234`** pour tous (emails déjà vérifiés). Connexion sur `/fr/login`.

| Email                | Organisation (`/fr/app/...`) | Rôle    |
| -------------------- | ---------------------------- | ------- |
| `owner@atlas.test`   | Atlas Food (`atlas`)         | owner   |
| `manager@atlas.test` | Atlas Food (`atlas`)         | manager |
| `staff@atlas.test`   | Atlas Food (`atlas`)         | staff   |
| `owner@babel.test`   | Babel Group (`babel`)        | owner   |

Babel Group sert à vérifier l'isolation : aucun compte Atlas ne doit voir ses données. En local, les emails (vérification, réinitialisation, invitation) ne sont pas envoyés : avec `EMAIL_DRIVER=console`, leurs liens s'affichent dans le terminal de `pnpm dev`.

## Scripts

| Script                 | Rôle                                                                    |
| ---------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`             | Lance l'app web en développement                                        |
| `pnpm build`           | Build de production : Turbopack, ou webpack si `BUILD_TARGET=hostinger` |
| `pnpm build:hostinger` | Build de production pour Hostinger (webpack, parallélisme limité)       |
| `pnpm start`           | Démarre l'app buildée                                                   |
| `pnpm lint`            | ESLint (dont les règles d'accès à la base et d'import entre modules)    |
| `pnpm typecheck`       | Vérification TypeScript                                                 |
| `pnpm test`            | Tests Vitest, dont les tests d'isolation multi-tenant (base `_test`)    |
| `pnpm format`          | Formate tout le repo avec Prettier                                      |
| `pnpm db:up`           | Démarre MySQL local (Docker)                                            |
| `pnpm db:down`         | Arrête MySQL local (les données restent dans le volume)                 |
| `pnpm db:generate`     | Génère une migration SQL depuis le schéma Drizzle                       |
| `pnpm db:migrate`      | Applique les migrations en attente                                      |
| `pnpm db:seed`         | Insère les données de démo                                              |
| `pnpm db:studio`       | Ouvre Drizzle Studio pour explorer la base                              |
| `pnpm db:reset`        | Supprime et recrée la base **locale**, puis migrate + seed              |

## Déploiement sur Hostinger (Node.js web app)

L'app Next.js est dans `apps/web`, mais elle dépend du workspace pnpm (`packages/config`, lockfile à la racine) : le build doit donc partir de la **racine du repo**.

| Réglage Hostinger     | Valeur                                                   |
| --------------------- | -------------------------------------------------------- |
| Preset / framework    | **Next.js**                                              |
| Dossier racine        | racine du repo (l'app elle-même est `apps/web`)          |
| Version de Node.js    | **24** (dernière version proposée par Hostinger)         |
| Commande de build     | `pnpm run build` (lancée par Hostinger, non modifiable)  |
| Variable obligatoire  | **`BUILD_TARGET=hostinger`** (variables d'environnement) |
| Dossier de sortie     | `apps/web/.next`                                         |
| Commande de démarrage | `pnpm start`                                             |

**Build webpack sur Hostinger** : sur l'hébergement mutualisé, le build Turbopack échoue (`TurbopackInternalError … globals.css … node process exited before we could connect to it` : Turbopack ne peut pas y lancer ses processus de traitement CSS). Hostinger lance toujours `pnpm run build` : c'est donc la variable **`BUILD_TARGET=hostinger`**, à définir dans les variables d'environnement Hostinger, qui fait choisir à `pnpm build` (`apps/web/scripts/build.mjs`) le build webpack à ressources limitées, le même que `pnpm build:hostinger` : `next build --webpack` avec `NEXT_BUILD_LOW_RESOURCES=1` (1 CPU, pas de worker webpack ni de compilations parallèles, 1 seul worker de génération statique, Tailwind via `@tailwindcss/webpack`). Le journal de build doit afficher `[build] BUILD_TARGET=hostinger : build webpack à ressources limitées` puis `Next.js … (webpack)` ; s'il affiche `(Turbopack)`, la variable n'est pas transmise au build. Une valeur inconnue fait échouer le build (pas de retour silencieux à Turbopack). Sans la variable, `pnpm build` utilise Turbopack (local et CI) ; la CI lance aussi `pnpm build` avec `BUILD_TARGET=hostinger`.

**Node 24** : Hostinger ne propose pas de version au-delà de Node 24. Le repo vise donc Node 24 LTS partout : [`.nvmrc`](.nvmrc) (version exacte utilisée en local et par la CI), `engines.node` (`>=24`) dans `package.json`, et `@types/node` en 24 pour que TypeScript signale toute API Node plus récente. Ne pas utiliser d'API propre à Node 25 ou plus.

> Si l'hébergeur impose `apps/web` comme dossier racine, il faudra rendre l'app autonome (sortie `standalone` de Next.js ou copie des configs partagées) : à traiter dans une PR dédiée.

**Variables d'environnement** à saisir dans le panneau Hostinger (jamais dans le repo) :
`BUILD_TARGET=hostinger` (choix du build, voir ci-dessus), `DATABASE_URL` (base MySQL Hostinger), `DB_CONNECTION_LIMIT` (garder 5 ou moins), `BETTER_AUTH_SECRET` (nouveau secret de production), `BETTER_AUTH_URL` et `NEXT_PUBLIC_APP_URL` (URL publique du site), `STORAGE_DRIVER`, `STORAGE_LOCAL_PATH` (dossier persistant hors du dossier de l'app), puis selon les fonctionnalités : `ANTHROPIC_API_KEY`, `CLAUDE_MENU_MODEL`, `PAYMENT_*`, `GPU_*`, `RESEND_API_KEY`, `SENTRY_DSN`. Les variables `MYSQL_*` ne servent qu'au Docker local.

**Migrations** : à chaque déploiement qui contient une nouvelle migration, lancer `pnpm db:migrate` avec `DATABASE_URL` pointant sur la base Hostinger (depuis le terminal SSH de l'hébergement, ou depuis un poste autorisé dans « MySQL distant »). Les scripts `db:reset` et `db:seed` refusent toute base non locale.

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) : workflow Git, conventions, migrations, règles de code
- [docs/architecture.md](docs/architecture.md) : architecture, multi-tenant, routes, roadmap
- [docs/security.md](docs/security.md) : isolation entre organisations, checklist de relecture
- [docs/decisions/](docs/decisions/) : décisions d'architecture (ADR)
