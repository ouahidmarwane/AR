# ADR 0001 : Next.js + monorepo pnpm + organisation par features

- **Statut** : accepté ; la partie base de données / authentification / stockage est **remplacée par l'[ADR 0002](0002-mysql-drizzle-better-auth.md)**
- **Date** : 2026-11-24

## Contexte

Nous construisons un SaaS multi-tenant de menus de restaurant en réalité augmentée, à deux développeurs (plateforme/back-end et front-end/produit). Besoins :

- pages publiques rapides et bien référencées (menu via QR code, site vitrine) ;
- dashboard authentifié multi-organisation avec isolation stricte des données ;
- stockage de fichiers (photos, modèles 3D), webhooks (paiement, GPU) ;
- intégration IA (Claude API) et, plus tard, un worker GPU séparé.

## Décision

1. **Next.js (App Router, TypeScript strict)** pour l'app web : rendu serveur et statique, Server Actions, Route Handlers pour les webhooks, un seul déploiement pour le public, le dashboard et l'admin.
2. **Monorepo pnpm workspaces** : `apps/web`, `packages/config` (configs partagées), `services/gpu-worker` (à venir) dans le même repo, pour des PR atomiques (code + migration) et un outillage commun.
3. **Organisation par features** dans `apps/web/src/features`, avec import uniquement via `index.ts` (règle ESLint), pour permettre aux deux développeurs de travailler en parallèle avec peu de conflits.
4. **Zod** pour valider toutes les entrées (formulaires, actions, variables d'environnement).
5. Base de données, authentification et stockage : choix initial d'une plateforme BaaS managée, **abandonné** au profit de MySQL + Drizzle + Better Auth (voir ADR 0002).

## Alternatives écartées

- **Back-end séparé (NestJS, Express)** : plus de code et d'infrastructure à maintenir pour une équipe de deux.
- **Turborepo / Nx** : inutile à ce stade avec une seule app ; pourra être ajouté plus tard sans restructurer.
- **Repos séparés** : complique la synchronisation entre migrations, schéma et code.

## Conséquences

- Une seule app Next.js à déployer, sur un hébergement Node.js.
- Les règles d'import entre modules sont imposées par ESLint et vérifiées en CI.
