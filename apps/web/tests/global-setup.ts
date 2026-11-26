import { recreateDatabase, runMigrations } from "../scripts/lib/db";

/** Avant tous les tests : base de test vide puis migrations de apps/web/drizzle. */
export default async function setup() {
  const url = process.env.DATABASE_URL;
  if (!url?.includes("_test")) throw new Error("DATABASE_URL de test invalide.");
  await recreateDatabase(url);
  await runMigrations(url);
}
