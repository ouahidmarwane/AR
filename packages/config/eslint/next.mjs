import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Règles d'architecture et de sécurité (voir CONTRIBUTING.md et docs/security.md) :
 * 1. Accès base : drizzle-orm, mysql2 et @/lib/db/client ne sont importables QUE dans
 *    src/lib/db/**, src/lib/auth/server.ts et src/features/*\/repository.ts.
 * 2. Un module de features/ n'importe un autre module QUE via son index.ts
 *    -> `@/features/menu` est autorisé, `@/features/menu/schemas` est interdit.
 * 3. components/ et lib/ n'importent jamais features/.
 *
 * Attention : no-restricted-imports n'est pas cumulatif entre blocs de config (le
 * dernier bloc qui correspond à un fichier gagne) : chaque bloc reprend donc la
 * liste complète des motifs qui s'appliquent à ses fichiers.
 */

const dbAccess = {
  regex: "^(drizzle-orm|mysql2)(/|$)|^@/lib/db/client$|(^|/)db/client$",
  message:
    "Accès direct à la base interdit ici : passez par le repository.ts du module (isolation par organisation, voir docs/security.md).",
};

const deepFeatureImport = {
  regex: "^@/features/[^/]+/.+",
  message:
    "Importez un module de features/ uniquement via son index.ts (ex. `@/features/menu`), jamais un fichier interne.",
};

const anyFeatureImport = {
  regex: "(^@/features(/|$))|(/features(/|$))",
  message: "components/ et lib/ ne doivent jamais importer features/.",
};

/** Import relatif qui sort du module courant (profondeur = niveau du fichier dans le module). */
const escapeModule = (depth) => ({
  regex: `^(\\.\\./){${depth}}`,
  message:
    "Import relatif sortant du module : utilisez l'index.ts de l'autre module (ex. `@/features/menu`).",
});

const restrict = (...patterns) => ["error", { patterns }];

/** Configuration ESLint d'une app Next.js du monorepo (racine = dossier de l'app). */
export const nextAppConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "drizzle/**"]),

  // Par défaut (app/, i18n/, proxy.ts...) : pas d'accès base, pas d'import profond de features.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": restrict(dbAccess, deepFeatureImport) },
  },

  // features/ : pas d'accès base, pas de sortie relative du module.
  {
    files: ["src/features/*/*.{ts,tsx}"],
    rules: { "no-restricted-imports": restrict(dbAccess, deepFeatureImport, escapeModule(1)) },
  },
  {
    files: ["src/features/*/*/*.{ts,tsx}"],
    rules: { "no-restricted-imports": restrict(dbAccess, deepFeatureImport, escapeModule(2)) },
  },
  {
    files: ["src/features/*/*/*/*.{ts,tsx}"],
    rules: { "no-restricted-imports": restrict(dbAccess, deepFeatureImport, escapeModule(3)) },
  },
  // Exception : le repository de chaque module est le seul point d'accès à la base.
  {
    files: ["src/features/*/repository.ts"],
    rules: { "no-restricted-imports": restrict(deepFeatureImport, escapeModule(1)) },
  },

  // components/ et lib/ : jamais features/, pas d'accès base.
  {
    files: ["src/components/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": restrict(anyFeatureImport, dbAccess) },
  },
  // Exception : la couche base (client, schéma, tenant) et l'instance Better Auth.
  {
    files: ["src/lib/db/**/*.ts", "src/lib/auth/server.ts"],
    rules: { "no-restricted-imports": restrict(anyFeatureImport) },
  },
]);

export default nextAppConfig;
