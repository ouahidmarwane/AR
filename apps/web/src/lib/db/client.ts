import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { getServerEnv } from "@/lib/env";

import * as schema from "./schema";

/**
 * Pool MySQL unique pour tout le processus Node.
 *
 * - connectionLimit vient de DB_CONNECTION_LIMIT (défaut 5) : les hébergements
 *   mutualisés limitent fortement le nombre de connexions simultanées.
 * - Le pool est mémorisé sur globalThis pour survivre au rechargement à chaud
 *   de `next dev` (sinon chaque modification ouvrirait un nouveau pool).
 *
 * IMPORTANT : ce module ne doit être importé que par src/lib/db/**, src/lib/auth/server.ts
 * et les fichiers src/features/*\/repository.ts (règle ESLint). Le code métier passe
 * toujours par un repository, qui applique l'isolation par organisation.
 */

const globalForDb = globalThis as typeof globalThis & { __arDbPool?: mysql.Pool };

function createPool(): mysql.Pool {
  const env = getServerEnv();
  return mysql.createPool({
    uri: env.DATABASE_URL,
    connectionLimit: env.DB_CONNECTION_LIMIT,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
  });
}

export const pool = globalForDb.__arDbPool ?? createPool();
globalForDb.__arDbPool = pool;

export const db = drizzle(pool, { schema, mode: "default" });

export type Database = typeof db;
