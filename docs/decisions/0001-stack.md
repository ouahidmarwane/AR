# ADR 0001 : Next.js + Supabase + monorepo pnpm

- **Statut** : accepté
- **Date** : 2026-11-24

## Contexte

Nous construisons un SaaS multi-tenant de menus de restaurant en réalité augmentée, à deux développeurs (plateforme/back-end et front-end/produit). Besoins :

- pages publiques rapides et bien référencées (menu via QR code, site vitrine) ;
- dashboard authentifié multi-organisation avec isolation stricte des données ;
- stockage de fichiers (photos, modèles 3D), temps réel, webhooks (paiement, GPU) ;
- intégration IA (Claude API) et, plus tard, un worker GPU séparé ;
- mise en production rapide avec peu d'infrastructure à gérer.

## Décision

1. **Next.js (App Router, TypeScript strict)** pour l'app web : rendu serveur et statique, Server Actions, Route Handlers pour les webhooks, un seul déploiement pour le public, le dashboard et l'admin.
2. **Supabase** comme back-end : Postgres avec **RLS** pour l'isolation multi-tenant par `organization_id`, Auth, Storage, Realtime et Edge Functions, migrations SQL versionnées et environnement local via la CLI.
3. **Monorepo pnpm workspaces** : `apps/web`, `packages/config` (configs partagées), `services/gpu-worker` (à venir) et `supabase/` dans le même repo, pour des PR atomiques (code + migration) et un outillage commun.
4. **Organisation par features** dans `apps/web/src/features`, avec import uniquement via `index.ts` (règle ESLint), pour permettre aux deux développeurs de travailler en parallèle avec peu de conflits.
5. **Zod** pour valider toutes les entrées (formulaires, actions, variables d'environnement).

## Alternatives écartées

- **Back-end séparé (NestJS, Express)** : plus de code et d'infrastructure à maintenir pour une équipe de deux.
- **Firebase** : modèle NoSQL moins adapté aux données relationnelles (organisations → restaurants → menus → plats) et à la RLS SQL.
- **Turborepo / Nx** : inutile à ce stade avec une seule app ; pourra être ajouté plus tard sans restructurer.
- **Repos séparés** : complique la synchronisation entre migrations, types générés et code.

## Conséquences

- La sécurité des données repose sur la RLS : chaque table doit avoir ses politiques, revues en PR.
- Les types de la base sont générés (`pnpm db:types`) et commités après chaque migration.
- Dépendance au fournisseur Supabase, limitée car Postgres reste standard et les migrations sont en SQL.
- Le worker GPU (Python) vivra dans `services/` en dehors du workspace pnpm.
