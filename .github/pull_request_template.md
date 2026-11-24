## Quoi

<!-- Ce que change cette PR, en quelques lignes. -->

## Pourquoi

<!-- Le besoin ou le problème résolu. Lien vers l'issue : Closes #... -->

## Captures

<!-- Captures d'écran ou vidéo pour tout changement visible (sinon : N/A). -->

## Migration

- [ ] Non
- [ ] Oui : une seule migration, `pnpm db:types` relancé et `src/types/database.ts` commité

## Checklist

- [ ] La PR fait moins de 400 lignes (hors fichiers générés)
- [ ] `pnpm lint`, `pnpm typecheck` et `pnpm build` passent en local
- [ ] Imports entre modules `features/` uniquement via leur `index.ts`
- [ ] Aucun secret, aucune clé, aucun fichier `.env` commité
- [ ] Textes visibles ajoutés dans `messages/` (fr, ar, en) si applicable
- [ ] Politiques RLS ajoutées ou mises à jour pour toute nouvelle table
