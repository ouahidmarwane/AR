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
  // Analyse par opérations sur les chaînes (pas d'expression régulière à backtracking).
  for (const rawLine of content.split("\n")) {
    let line = (rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine).trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice("export ".length).trimStart();

    const equals = line.indexOf("=");
    if (equals <= 0) continue;
    const key = line.slice(0, equals).trim();
    if (!ENV_KEY.test(key)) continue;

    result[key] = parseValue(line.slice(equals + 1).trim());
  }
  return result;
}

/** Nom de variable valide : lettre ou `_`, puis lettres, chiffres, `_`, `.` ou `-`. */
const ENV_KEY = /^[A-Za-z_][\w.-]*$/;

/**
 * Valeur d'une ligne .env : entre guillemets (simples, doubles ou backquotes), ou brute
 * avec un éventuel commentaire en fin de ligne (` #...`).
 * @param {string} raw
 * @returns {string}
 */
function parseValue(raw) {
  const quote = raw[0];
  const closing = raw.lastIndexOf(quote);
  if ((quote === '"' || quote === "'" || quote === "`") && closing > 0) {
    const inner = raw.slice(1, closing);
    return quote === '"'
      ? inner.replaceAll(String.raw`\n`, "\n").replaceAll(String.raw`\r`, "\r")
      : inner;
  }
  // Valeur sans guillemets : un "#" précédé d'un espace commence un commentaire.
  for (let i = 1; i < raw.length; i++) {
    if (raw[i] === "#" && (raw[i - 1] === " " || raw[i - 1] === "\t"))
      return raw.slice(0, i).trimEnd();
  }
  return raw;
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

  const paths = [cwd, webDir, root ?? ""].map((p) => p.replaceAll("\\", "/"));
  if (paths.some((p) => p.includes("/hbuilds/"))) {
    return { target: "hostinger", source: "détection Hostinger" };
  }

  return { target: "", source: "défaut" };
}
