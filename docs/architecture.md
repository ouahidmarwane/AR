# Architecture

## Stack

| Domaine       | Choix                                                              |
| ------------- | ------------------------------------------------------------------ |
| Monorepo      | pnpm workspaces                                                    |
| App web       | Next.js (App Router, `src/`), React, TypeScript strict             |
| UI            | Tailwind CSS (shadcn/ui à venir)                                   |
| i18n          | fr, ar (RTL), en, routes préfixées `/[locale]` (next-intl à venir) |
| Back-end      | Supabase : Postgres, Auth, Storage, Realtime, Edge Functions       |
| Accès données | `@supabase/ssr` + `@supabase/supabase-js`, types générés           |
| Validation    | Zod (entrées, formulaires, variables d'environnement)              |
| IA            | Claude API (Anthropic) pour l'import de menus                      |
| AR            | `<model-viewer>` (GLB / USDZ)                                      |
| 3D            | TRELLIS.2 sur GPU Vast.ai (`services/gpu-worker`)                  |
| Qualité       | ESLint, Prettier, Husky, lint-staged, commitlint, GitHub Actions   |

## Structure du repo

```
ar/
├── apps/web/              # App Next.js
├── services/gpu-worker/   # Worker GPU TRELLIS.2 (phase 5)
├── packages/config/       # Configs partagées : ESLint, tsconfig, Prettier
├── supabase/              # config.toml, migrations, Edge Functions, seed.sql
├── docs/                  # Architecture et ADR
└── .github/               # CI, templates, CODEOWNERS
```

Dans `apps/web/src/` :

```
app/          # Routes uniquement (pages fines qui assemblent des features)
features/     # Code métier, un dossier par module
components/   # UI générique réutilisable (ui/, layout/), sans logique métier
lib/          # Infrastructure : supabase, env, ai, storage, email, utils
i18n/         # Configuration des langues
messages/     # Traductions fr / ar / en
types/        # Types générés (database.ts)
proxy.ts      # Proxy Next.js (ex-middleware) : préfixe de langue, puis session
```

## Organisation par features

Chaque module de `features/` (auth, organizations, restaurants, menu, menu-import, public-menu, ar-viewer, model-generation, qr-codes, billing, analytics, admin) suit la même structure : `components/`, `actions.ts`, `queries.ts`, `schemas.ts`, `types.ts`, `index.ts`.

Dépendances autorisées :

```
app/  ──►  features/<x>/index.ts  ──►  components/, lib/
features/<a>  ──►  features/<b>/index.ts   (jamais un fichier interne)
components/, lib/  ──✗──►  features/
```

Ces règles sont imposées par ESLint (`packages/config/eslint/next.mjs`).

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

- Chaque table métier porte un **`organization_id`** (dénormalisé si besoin).
- L'isolation entre clients est assurée par la **Row Level Security** de Postgres : un utilisateur n'accède qu'aux lignes des organisations dont il est membre.
- La clé `service_role` (qui contourne la RLS) est réservée aux traitements serveur (webhooks, jobs, admin).
- Le menu public est lu via des politiques de lecture dédiées (menus publiés uniquement).

### Rôles

| Rôle          | Portée       | Droits                                                     |
| ------------- | ------------ | ---------------------------------------------------------- |
| `owner`       | Organisation | Tout, dont facturation, membres et suppression             |
| `manager`     | Organisation | Gestion des restaurants, menus, plats, QR codes            |
| `staff`       | Organisation | Mise à jour opérationnelle (disponibilité des plats, etc.) |
| `super_admin` | Plateforme   | Back-office `/admin`, supervision de tous les tenants      |

## Routes

| Route                    | Groupe        | Rôle                                  |
| ------------------------ | ------------- | ------------------------------------- |
| `/[locale]`              | `(marketing)` | Site vitrine                          |
| `/[locale]/login`        | `(auth)`      | Connexion / inscription               |
| `/[locale]/m/[slug]`     | `(public)`    | Menu public d'un restaurant (QR code) |
| `/[locale]/app/[org]`    | `(dashboard)` | Dashboard d'une organisation          |
| `/[locale]/admin`        | `(admin)`     | Back-office `super_admin`             |
| `/api/webhooks/payments` | —             | Webhooks du fournisseur de paiement   |
| `/api/webhooks/gpu`      | —             | Résultats du worker de génération 3D  |

Les URL sans langue sont redirigées vers `/fr`.

## Roadmap

| Phase | Nom                 | Contenu                                                                     |
| ----- | ------------------- | --------------------------------------------------------------------------- |
| 0     | Fondations          | Monorepo, CI, Supabase local, auth, organisations, rôles, RLS de base, i18n |
| 1     | Menu et menu public | CRUD restaurants / menus / catégories / plats, menu public, QR codes        |
| 2     | Viewer AR           | `<model-viewer>`, upload de modèles 3D (Storage), affichage AR des plats    |
| 3     | Import IA           | Import de menu par Claude API depuis image, PDF, tableur, URL               |
| 4     | Abonnements et SaaS | Plans, paiement, webhooks, limites par plan, back-office admin, analytics   |
| 5     | Génération 3D       | Worker TRELLIS.2 sur GPU Vast.ai, génération de modèles depuis des photos   |
