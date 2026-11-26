import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

import { loadRootEnv } from "./scripts/lib/root-env.mjs";

// Même fichier d'environnement que Next.js (apps/web/.env.local), puis le .env de la racine
// du repo (écrit par Hostinger), sans écraser les variables déjà définies.
config({ path: ".env.local", quiet: true });
loadRootEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL manquante (voir .env.example).");
}

export default defineConfig({
  dialect: "mysql",
  schema: "./src/lib/db/schema",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
