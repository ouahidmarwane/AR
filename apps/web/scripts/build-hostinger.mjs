/**
 * pnpm build:hostinger : build de production pour l'hébergement mutualisé Hostinger.
 *
 * - webpack au lieu de Turbopack : sur Hostinger, Turbopack ne peut pas lancer ses
 *   processus de traitement CSS ("node process exited before we could connect to it").
 * - NEXT_BUILD_LOW_RESOURCES=1 : next.config.ts limite le parallélisme (1 CPU, sans workers).
 *
 * Script Node plutôt que `VAR=1 next build` dans package.json : fonctionne aussi sous Windows.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

const child = spawn(process.execPath, [nextBin, "build", "--webpack"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_BUILD_LOW_RESOURCES: "1" },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
