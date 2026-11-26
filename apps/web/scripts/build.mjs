/**
 * pnpm build : choisit la cible de build selon la variable d'environnement BUILD_TARGET.
 *
 * - BUILD_TARGET absente ou vide : `next build` (Turbopack), en local et en CI.
 * - BUILD_TARGET=hostinger : build webpack à ressources limitées (scripts/build-hostinger.mjs,
 *   le même que `pnpm build:hostinger`). Hostinger lance toujours `pnpm run build` : la variable
 *   se définit dans son panneau (variables d'environnement).
 * - Toute autre valeur : erreur, pour qu'une faute de frappe ne repasse pas en silence sur Turbopack.
 *
 * Script Node (et non `VAR=… next build`) : fonctionne sous Linux comme sous Windows.
 * Les arguments supplémentaires sont transmis à `next build` (ex. `pnpm build --debug`).
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const TARGETS = ["hostinger"];
const target = (process.env.BUILD_TARGET ?? "").trim().toLowerCase();

if (target && !TARGETS.includes(target)) {
  console.error(
    `[build] BUILD_TARGET="${process.env.BUILD_TARGET}" inconnu. Valeurs possibles : ${TARGETS.join(", ")} (ou variable absente pour Turbopack).`,
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
    ? "[build] BUILD_TARGET=hostinger : build webpack à ressources limitées"
    : "[build] build par défaut (Turbopack)",
);

const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
