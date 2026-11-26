/**
 * pnpm db:reset : supprime et recrée la base LOCALE (vide).
 * Le script racine enchaîne ensuite db:migrate puis db:seed.
 * Refuse de s'exécuter sur une base distante (voir assertLocalDatabase).
 */
import { databaseName, loadDatabaseUrl, recreateDatabase } from "./lib/db";

const url = loadDatabaseUrl();
await recreateDatabase(url);
console.log(`Base "${databaseName(url)}" supprimée et recréée.`);
