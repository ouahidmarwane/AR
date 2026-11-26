import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: ".env.local", quiet: true });

/**
 * Base de test DÉDIÉE : TEST_DATABASE_URL, sinon DATABASE_URL avec le suffixe "_test"
 * (ar_menu -> ar_menu_test, créée par docker/mysql/init en local, par le service MySQL en CI).
 * Elle est vidée et migrée au début de chaque exécution (tests/global-setup.ts).
 */
function resolveTestDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("TEST_DATABASE_URL ou DATABASE_URL requise pour les tests.");
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/_test$/, "")}_test`;
  return url.toString();
}

const testDatabaseUrl = resolveTestDatabaseUrl();
if (!new URL(testDatabaseUrl).pathname.endsWith("_test")) {
  throw new Error("Par sécurité, le nom de la base de test doit finir par _test.");
}

// Transmis au global setup (même processus) et aux workers de test (hérité).
process.env.DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Better Auth est transformé par Vitest (au lieu d'être chargé tel quel depuis node_modules)
    // pour que les tests puissent simuler next/headers, y compris dans son plugin nextCookies.
    server: { deps: { inline: [/better-auth/] } },
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // Tous les fichiers partagent la même base : exécution séquentielle.
    fileParallelism: false,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      DB_CONNECTION_LIMIT: "2",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0000",
      BETTER_AUTH_URL: "http://localhost:3000",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    },
  },
});
