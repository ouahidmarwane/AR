# Architecture

## Stack

| Domaine     | Choix                                                                |
| ----------- | -------------------------------------------------------------------- |
| Monorepo    | pnpm workspaces                                                      |
| App web     | Next.js (App Router, `src/`), React, TypeScript strict               |
| UI          | Tailwind CSS (shadcn/ui à venir)                                     |
| i18n        | fr, ar (RTL), en, routes préfixées `/[locale]` (next-intl à venir)   |
| Base        | MySQL 8 (Hostinger en production, Docker en local)                   |
| ORM         | Drizzle ORM (driver mysql2), migrations SQL via drizzle-kit          |
| Auth        | Better Auth : email + mot de passe, plugin organization              |
| Stockage    | Adaptateur `StorageDriver` : disque local, stockage objet S3 à venir |
| Validation  | Zod (entrées, formulaires, variables d'environnement)                |
| Tests       | Vitest + base MySQL de test (Docker en local, service MySQL en CI)   |
| IA          | Claude API (Anthropic) pour l'import de menus                        |
| AR          | `<model-viewer>` (GLB / USDZ)                                        |
| 3D          | TRELLIS.2 sur GPU Vast.ai (`services/gpu-worker`)                    |
| Hébergement | Hostinger : Node.js web app + MySQL                                  |
| Qualité     | ESLint, Prettier, Husky, lint-staged, commitlint, GitHub Actions     |

## Structure du repo

```
ar/
├── apps/web/              # App Next.js
│   ├── drizzle/           # Migrations SQL générées (drizzle-kit)
│   ├── scripts/           # seed, reset
│   └── tests/             # Tests Vitest (isolation multi-tenant)
├── docker/mysql/init/     # Init du MySQL local (base de test)
├── services/gpu-worker/   # Worker GPU TRELLIS.2 (phase 5)
├── packages/config/       # Configs partagées : ESLint, tsconfig, Prettier
├── docs/                  # Architecture, sécurité, ADR
├── docker-compose.yml     # MySQL 8 local
└── .github/               # CI, templates, CODEOWNERS
```

Dans `apps/web/src/` :

```
app/          # Routes uniquement (pages fines qui assemblent des features)
  api/auth/[...all]     # Handler Better Auth
  api/files/[...path]   # Fichiers stockés, servis après contrôle d'accès (à venir)
features/     # Code métier, un dossier par module
components/   # UI générique réutilisable (ui/, layout/), sans logique métier
lib/
  db/         # client (pool mysql2), schema/ (Drizzle), tenant.ts (isolation)
  auth/       # server.ts (Better Auth), client.ts, permissions.ts (rôles)
  storage/    # StorageDriver, pilote local, pilote S3 (à venir)
  env.ts      # Variables d'environnement validées par Zod
i18n/         # Configuration des langues
messages/     # Traductions fr / ar / en
proxy.ts      # Proxy Next.js (ex-middleware) : langue + redirection login
```

## Organisation par features

Chaque module de `features/` (auth, organizations, restaurants, menu, menu-import, public-menu, ar-viewer, model-generation, qr-codes, billing, analytics, admin) suit la même structure : `components/`, `repository.ts`, `actions.ts`, `queries.ts`, `schemas.ts`, `types.ts`, `index.ts`. Le module `restaurants` sert d'exemple de référence.

Flux d'une requête :

```
page / composant  ──►  features/<x>/index.ts  ──►  actions.ts | queries.ts
                                                     │ 1. requireTenant(orgSlug, rôle)
                                                     │ 2. validation Zod
                                                     ▼
                                                repository.ts (ctx, ...)  ──►  tenantWhere()  ──►  MySQL
```

Dépendances autorisées (imposées par ESLint, `packages/config/eslint/next.mjs`) :

```
app/  ──►  features/<x>/index.ts  ──►  components/, lib/
features/<a>  ──►  features/<b>/index.ts   (jamais un fichier interne)
components/, lib/  ──✗──►  features/
drizzle-orm, @/lib/db/client  ◄── uniquement lib/db/**, lib/auth/server.ts, features/*/repository.ts
```

## Multi-tenant

Hiérarchie des données :

```
organization
└── restaurants
    └── menus
        └── categories
            └── dishes (plats)
                └── models_3d
```

- Chaque table métier porte un **`organization_id`** NOT NULL et indexé (dénormalisé si besoin).
- **Pas de RLS** : l'isolation est garantie par le code, de façon centralisée dans `src/lib/db/tenant.ts` (`requireTenant`, `tenantWhere`, `assertSameTenant`). Détails et règles : [security.md](security.md).
- Les fichiers stockés sont rangés sous `{organizationId}/{restaurantId}/...`.
- Le menu public est lu par un repository dédié, en lecture seule, limité aux champs publics des restaurants publiés.

### Rôles

| Rôle          | Portée       | Droits                                                     |
| ------------- | ------------ | ---------------------------------------------------------- |
| `owner`       | Organisation | Tout, dont facturation, membres et suppression             |
| `manager`     | Organisation | Gestion des restaurants, menus, plats, QR codes            |
| `staff`       | Organisation | Mise à jour opérationnelle (disponibilité des plats, etc.) |
| `super_admin` | Plateforme   | Back-office `/admin` (`user.is_super_admin`)               |

Les rôles d'organisation sont gérés par le plugin organization de Better Auth (table `member`) ; la hiérarchie `owner > manager > staff` est appliquée par `requireTenant(orgSlug, minRole)`.

## Routes

| Route                    | Groupe        | Rôle                                     |
| ------------------------ | ------------- | ---------------------------------------- |
| `/[locale]`              | `(marketing)` | Site vitrine                             |
| `/[locale]/login`        | `(auth)`      | Connexion / inscription                  |
| `/[locale]/m/[slug]`     | `(public)`    | Menu public d'un restaurant (QR code)    |
| `/[locale]/app/[org]`    | `(dashboard)` | Dashboard d'une organisation             |
| `/[locale]/admin`        | `(admin)`     | Back-office `super_admin`                |
| `/api/auth/*`            | —             | Better Auth (session, organisations...)  |
| `/api/files/*`           | —             | Fichiers stockés, après contrôle d'accès |
| `/api/webhooks/payments` | —             | Webhooks du fournisseur de paiement      |
| `/api/webhooks/gpu`      | —             | Résultats du worker de génération 3D     |

Les URL sans langue sont redirigées vers `/fr`. Sans cookie de session, `/[locale]/app/*` et `/[locale]/admin/*` redirigent vers `/[locale]/login` (contrôle léger ; la vraie vérification est faite côté serveur).

## Tâches longues

Pas de temps réel côté base : l'avancement des tâches longues (import IA, génération 3D) sera suivi par **polling** d'une table de jobs.

## Roadmap

| Phase | Nom                 | Contenu                                                                   |
| ----- | ------------------- | ------------------------------------------------------------------------- |
| 0     | Fondations          | Monorepo, CI, MySQL local, auth, organisations, rôles, isolation, i18n    |
| 1     | Menu et menu public | CRUD restaurants / menus / catégories / plats, menu public, QR codes      |
| 2     | Viewer AR           | `<model-viewer>`, upload de modèles 3D (stockage), affichage AR des plats |
| 3     | Import IA           | Import de menu par Claude API depuis image, PDF, tableur, URL             |
| 4     | Abonnements et SaaS | Plans, paiement, webhooks, limites par plan, back-office admin, analytics |
| 5     | Génération 3D       | Worker TRELLIS.2 sur GPU Vast.ai, génération de modèles depuis des photos |
