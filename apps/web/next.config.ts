import type { NextConfig } from "next";

import { loadRootEnv } from "./scripts/lib/root-env.mjs";

/**
 * Variables du .env de la RACINE du repo (Hostinger y écrit ses variables au lieu de les passer
 * dans process.env, et Next.js ne lit que apps/web/.env*). Chargées ici car next.config.ts est
 * évalué par `next build` ET `next start`, avant le code serveur. Une variable déjà présente
 * dans process.env (y compris issue de apps/web/.env*) n'est jamais écrasée.
 */
const rootEnv = loadRootEnv();
if (rootEnv.added.length > 0) {
  console.info(
    `[env] ${rootEnv.added.length} variable(s) chargée(s) depuis ${rootEnv.file} : ${rootEnv.added.join(", ")}`,
  );
}

/**
 * Build pour hébergement contraint (Hostinger mutualisé) : `pnpm build:hostinger`
 * (scripts/build-hostinger.mjs) pose NEXT_BUILD_LOW_RESOURCES=1 et lance `next build --webpack`.
 * Sans cette variable, le comportement local et CI par défaut (Turbopack) est inchangé.
 */
const lowResources = process.env.NEXT_BUILD_LOW_RESOURCES === "1";

type LoaderEntry = string | { loader?: string; options?: unknown };
type WebpackRule = { use?: unknown; oneOf?: unknown; rules?: unknown };

/**
 * Ajoute @tailwindcss/webpack en DERNIER loader (donc exécuté en premier) de chaque chaîne CSS
 * de Next.js, juste après son postcss-loader : Tailwind compile `@import "tailwindcss"`, puis
 * Next.js traite le CSS comme d'habitude.
 * On n'ajoute PAS de nouvelle règle `.css` : Next.js désactiverait alors son support CSS intégré.
 * Lève une erreur si aucune chaîne CSS n'est trouvée (pour ne jamais livrer un build sans styles).
 */
function addTailwindToCssPipelines(rules: unknown[]): void {
  let patched = 0;
  const isPostcssLoader = (entry: LoaderEntry) =>
    (typeof entry === "string" ? entry : (entry.loader ?? "")).includes("postcss-loader");

  const visit = (list: unknown): void => {
    if (!Array.isArray(list)) return;
    for (const rule of list as WebpackRule[]) {
      if (!rule || typeof rule !== "object") continue;
      if (Array.isArray(rule.use) && (rule.use as LoaderEntry[]).some(isPostcssLoader)) {
        const use = rule.use as LoaderEntry[];
        if (!use.some((e) => typeof e !== "string" && e.loader === "@tailwindcss/webpack")) {
          use.push({ loader: "@tailwindcss/webpack" });
          patched += 1;
        }
      }
      visit(rule.oneOf);
      visit(rule.rules);
    }
  };

  visit(rules);
  if (patched === 0) {
    throw new Error(
      "next.config.ts : aucune chaîne CSS (postcss-loader) trouvée pour brancher Tailwind sur webpack.",
    );
  }
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,

  // Tailwind CSS v4 avec Turbopack (next dev / next build par défaut).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  // Tailwind CSS v4 avec webpack (next build --webpack, utilisé pour Hostinger).
  // N'a aucun effet sur les builds Turbopack.
  webpack(config) {
    addTailwindToCssPipelines(config.module.rules);
    return config;
  },

  // Hébergement contraint : un seul processus, pas de workers ni de compilations parallèles.
  ...(lowResources && {
    experimental: {
      cpus: 1,
      memoryBasedWorkersCount: false,
      workerThreads: false,
      webpackBuildWorker: false,
      parallelServerCompiles: false,
      parallelServerBuildTraces: false,
      webpackMemoryOptimizations: true,
      staticGenerationMaxConcurrency: 1,
    },
  }),
};

export default nextConfig;
