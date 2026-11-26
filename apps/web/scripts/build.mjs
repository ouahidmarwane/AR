/**
 * pnpm build : choisit la cible de build (voir resolveBuildTarget dans lib/root-env.mjs).
 *
 * - cible vide (défaut) : `next build` (Turbopack), en local et en CI ;
 * - BUILD_TARGET=hostinger : build webpack à ressources limitées (scripts/build-hostinger.mjs,
 *   le même que `pnpm build:hostinger`) ;
 * - toute autre valeur : erreur, pour qu'une faute de frappe ne repasse pas en silence sur Turbopack.
 *
 * BUILD_TARGET est lu dans process.env, puis dans le .env de la racine du repo (Hostinger y écrit
 * ses variables au lieu de les passer dans process.env), puis dans apps/web/.env ; en dernier
 * recours, le dossier de build Hostinger (/hbuilds/) est détecté. La source est journalisée.
 *
 * Script Node (et non `VAR=… next build`) : fonctionne sous Linux comme sous Windows.
 * Les arguments supplémentaires sont transmis à `next build` (ex. `pnpm build --debug`).
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { BUILD_TARGETS, resolveBuildTarget } from "./lib/root-env.mjs";

const webDir = fileURLToPath(new URL("..", import.meta.url));
const { target, source, file } = resolveBuildTarget({ webDir });
const origin = file ? `${source} (${file})` : source;

if (target && !BUILD_TARGETS.includes(target)) {
  console.error(
    `[build] BUILD_TARGET="${target}" (source : ${origin}) inconnu. Valeurs possibles : ${BUILD_TARGETS.join(", ")} (ou absente pour Turbopack).`,
  );
  process.exit(1);
}

const require = createRequire(import.meta.url);
const extraArgs = process.argv.slice(2);

const args =
  target === "hostinger"
    ? [fileURLToPath(new URL("./build-hostinger.mjs", import.meta.url)), ...extraArgs]
    : [require.resolve("next/dist/bin/next"), "build", ...extraArgs];

console.log(
  target === "hostinger"
    ? `[build] BUILD_TARGET=hostinger (source : ${origin}) : build webpack à ressources limitées`
    : `[build] build par défaut (Turbopack) (source : ${origin})`,
);

const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
