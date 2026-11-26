## Quoi

<!-- Ce que change cette PR, en quelques lignes. -->

## Pourquoi

<!-- Le besoin ou le problème résolu. Lien vers l'issue : Closes #... -->

## Captures

<!-- Captures d'écran ou vidéo pour tout changement visible (sinon : N/A). -->

## Migration

- [ ] Non
- [ ] Oui : une seule migration, générée par `pnpm db:generate` depuis le schéma Drizzle (fichiers `apps/web/drizzle/` commités)

## Checklist

- [ ] La PR fait moins de 400 lignes (hors fichiers générés)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` et `pnpm build` passent en local
- [ ] Imports entre modules `features/` uniquement via leur `index.ts`
- [ ] Aucun secret, aucune clé, aucun fichier `.env` commité
- [ ] Textes visibles ajoutés dans `messages/` (fr, ar, en) si applicable

### Sécurité multi-tenant (si la PR touche la base, voir `docs/security.md`)

- [ ] Toute nouvelle table métier a une colonne `organization_id` NOT NULL indexée
- [ ] Accès base uniquement dans un `repository.ts`, chaque fonction prend un `TenantContext` et applique `tenantWhere()`
- [ ] Actions et queries appellent `requireTenant()` avant le repository ; aucun `organizationId` lu depuis l'entrée client
- [ ] Test d'isolation ajouté pour chaque nouvelle fonction de repository
