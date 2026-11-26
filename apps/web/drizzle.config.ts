import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Même fichier d'environnement que Next.js ; en production (Hostinger), les
// variables viennent du panneau d'hébergement.
config({ path: ".env.local", quiet: true });

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
