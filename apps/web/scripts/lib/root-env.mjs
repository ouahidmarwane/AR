/**
 * Fichier .env à la RACINE du repo (écrit par Hostinger : "Environment: variables loaded from .env").
 *
 * Next.js ne lit que apps/web/.env*, et Hostinger ne transmet pas ses variables dans process.env :
 * ce module lit le .env racine pour
 *  - choisir la cible de `pnpm build` (scripts/build.mjs) ;
 *  - compléter process.env au chargement de next.config.ts (next build ET next start).
 * Règle : une variable déjà présente dans process.env n'est JAMAIS écrasée.
 * Module sans dépendance (utilisable avant toute installation des devDependencies).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Cibles de build connues pour BUILD_TARGET. */
export const BUILD_TARGETS = ["hostinger"];

/**
 * Parse le contenu d'un fichier .env (KEY=VALUE, `export KEY=…`, commentaires `#`,
 * valeurs entre guillemets simples, doubles ou backquotes, `\n` dans les doubles guillemets).
 * @param {string} content
 * @returns {Record<string, string>}
 */
export function parseEnv(content) {
  /** @type {Record<string, string>} */
  const result = {};
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = (match[2] ?? "").trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'" || quote === "`") && value.lastIndexOf(quote) > 0) {
      value = value.slice(1, value.lastIndexOf(quote));
      if (quote === '"') value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
    } else {
      // Valeur non entourée de guillemets : un " #" commence un commentaire.
      value = value.replace(/\s+#.*$/, "").trim();
    }
    result[key] = value;
  }
  return result;
}

/**
 * Racine du repo : premier dossier parent (inclus) contenant pnpm-workspace.yaml.
 * @param {string} [startDir]
 * @returns {string | null}
 */
export function findRepoRoot(startDir = process.cwd()) {
  let dir = path.resolve(startDir);
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Lit un fichier .env s'il existe.
 * @param {string} file
 * @returns {Record<string, string> | null}
 */
export function readEnvFile(file) {
  return existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : null;
}

/**
 * Complète `env` (process.env par défaut) avec le .env de la racine du repo, sans jamais
 * écraser une variable déjà définie. Renvoie le fichier lu et les clés ajoutées (jamais les valeurs).
 * @param {{ startDir?: string, env?: Record<string, string | undefined> }} [options]
 * @returns {{ file: string | null, added: string[] }}
 */
export function loadRootEnv({ startDir = process.cwd(), env = process.env } = {}) {
  const root = findRepoRoot(startDir);
  if (!root) return { file: null, added: [] };
  const file = path.join(root, ".env");
  const values = readEnvFile(file);
  if (!values) return { file: null, added: [] };

  const added = [];
  for (const [key, value] of Object.entries(values)) {
    if (env[key] === undefined) {
      env[key] = value;
      added.push(key);
    }
  }
  return { file, added };
}

/**
 * Cible de `pnpm build` et origine de la décision, par ordre de priorité :
 *  1. BUILD_TARGET dans process.env ("process.env") ;
 *  2. BUILD_TARGET dans le .env de la racine du repo (".env racine") ;
 *  3. BUILD_TARGET dans apps/web/.env ("apps/web/.env") ;
 *  4. dossier de build Hostinger (chemin contenant "/hbuilds/") → hostinger ("détection Hostinger") ;
 *  5. sinon : Turbopack ("défaut").
 * Une valeur vide est ignorée ; une valeur inconnue est renvoyée telle quelle (l'appelant échoue).
 * @param {{ env?: Record<string, string | undefined>, cwd?: string, webDir?: string }} [options]
 * @returns {{ target: string, source: "process.env" | ".env racine" | "apps/web/.env" | "détection Hostinger" | "défaut", file?: string }}
 */
export function resolveBuildTarget({ env = process.env, cwd = process.cwd(), webDir = cwd } = {}) {
  const normalize = (/** @type {string | undefined} */ value) => (value ?? "").trim().toLowerCase();

  const fromEnv = normalize(env.BUILD_TARGET);
  if (fromEnv) return { target: fromEnv, source: "process.env" };

  const root = findRepoRoot(webDir);
  if (root) {
    const file = path.join(root, ".env");
    const fromRoot = normalize(readEnvFile(file)?.BUILD_TARGET);
    if (fromRoot) return { target: fromRoot, source: ".env racine", file };
  }

  const webFile = path.join(webDir, ".env");
  const fromWeb = normalize(readEnvFile(webFile)?.BUILD_TARGET);
  if (fromWeb) return { target: fromWeb, source: "apps/web/.env", file: webFile };

  const paths = [cwd, webDir, root ?? ""].map((p) => p.replace(/\\/g, "/"));
  if (paths.some((p) => p.includes("/hbuilds/"))) {
    return { target: "hostinger", source: "détection Hostinger" };
  }

  return { target: "", source: "défaut" };
}
