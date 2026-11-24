import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Règles d'architecture (voir CONTRIBUTING.md) :
 * 1. Un module de features/ n'importe un autre module QUE via son index.ts
 *    -> `@/features/menu` est autorisé, `@/features/menu/schemas` est interdit.
 * 2. components/ et lib/ n'importent jamais features/.
 *
 * Attention : no-restricted-imports n'est pas cumulatif entre blocs de config,
 * chaque bloc reprend donc la liste complète des motifs qui s'appliquent.
 */

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
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/types/database.ts"]),
  {
    rules: {
      "no-restricted-imports": restrict(deepFeatureImport),
    },
  },
  {
    files: ["src/features/*/*.{ts,tsx}"],
    rules: { "no-restricted-imports": restrict(deepFeatureImport, escapeModule(1)) },
  },
  {
    files: ["src/features/*/*/*.{ts,tsx}"],
    rules: { "no-restricted-imports": restrict(deepFeatureImport, escapeModule(2)) },
  },
  {
    files: ["src/features/*/*/*/*.{ts,tsx}"],
    rules: { "no-restricted-imports": restrict(deepFeatureImport, escapeModule(3)) },
  },
  {
    files: ["src/components/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": restrict(anyFeatureImport) },
  },
]);

export default nextAppConfig;
