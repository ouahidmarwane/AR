/**
 * Outils partagés des scripts de base de données (seed, reset) et des tests.
 * Exécutés avec tsx depuis apps/web, hors de Next.js.
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

import * as schema from "../../src/lib/db/schema";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "mysql"]);

/** Charge apps/web/.env.local (si présent) puis lit DATABASE_URL. */
export function loadDatabaseUrl(): string {
  config({ path: ".env.local", quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante (voir .env.example).");
  return url;
}

/** Nom de la base contenue dans une URL mysql://... */
export function databaseName(url: string): string {
  const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`Nom de base invalide : "${name}"`);
  return name;
}

/**
 * Garde-fou des opérations destructrices : uniquement sur une base locale (Docker / CI),
 * jamais sur la base Hostinger.
 */
export function assertLocalDatabase(url: string): void {
  const { hostname } = new URL(url);
  if (!LOCAL_HOSTS.has(hostname) || process.env.NODE_ENV === "production") {
    throw new Error(
      `Opération destructrice refusée sur "${hostname}" : réservée à la base locale (localhost).`,
    );
  }
}

/** Supprime puis recrée la base de l'URL (vide). */
export async function recreateDatabase(url: string): Promise<void> {
  assertLocalDatabase(url);
  const name = databaseName(url);
  const serverUrl = new URL(url);
  serverUrl.pathname = "/";
  const connection = await mysql.createConnection(serverUrl.toString());
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await connection.query(
      `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
}

/** Ouvre une connexion Drizzle dédiée au script (à fermer avec close()). */
export async function connect(url: string) {
  const connection = await mysql.createConnection(url);
  const db = drizzle(connection, { schema, mode: "default" });
  return { db, close: () => connection.end() };
}

/** Applique les migrations de apps/web/drizzle (équivalent de drizzle-kit migrate). */
export async function runMigrations(url: string): Promise<void> {
  const { db, close } = await connect(url);
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await close();
  }
}
