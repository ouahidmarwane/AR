/**
 * EXEMPLE DE RÉFÉRENCE — repository d'un module métier (à copier pour les autres modules).
 *
 * Règles (voir docs/security.md) :
 *  - Ce fichier est le SEUL du module autorisé à importer drizzle-orm et @/lib/db/client
 *    (règle ESLint no-restricted-imports).
 *  - Chaque fonction prend un TenantContext en PREMIER paramètre. Le contexte vient de
 *    requireTenant() : l'appelant ne peut pas choisir l'organisation.
 *  - Chaque requête applique tenantWhere(table, ctx), combiné avec and(...) aux autres filtres.
 *  - Un id reçu du client (ex. restaurantId) n'est JAMAIS suffisant seul : il est toujours
 *    filtré par organisation. Une ligne d'une autre organisation est donc "introuvable".
 *  - Chaque nouveau repository a son test d'isolation (apps/web/tests/).
 */
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { restaurants, type Restaurant } from "@/lib/db/schema";
import { assertSameTenant, tenantWhere, type TenantContext } from "@/lib/db/tenant";
import { NotFoundError } from "@/lib/errors";

/** Tous les restaurants de l'organisation du contexte, triés par nom. */
export async function listRestaurants(ctx: TenantContext): Promise<Restaurant[]> {
  return db
    .select()
    .from(restaurants)
    .where(tenantWhere(restaurants, ctx))
    .orderBy(asc(restaurants.name));
}

/**
 * Un restaurant de l'organisation du contexte.
 * @throws NotFoundError si l'id n'existe pas OU appartient à une autre organisation
 *         (même erreur dans les deux cas, pour ne pas révéler l'existence de la ressource).
 */
export async function getRestaurant(ctx: TenantContext, id: string): Promise<Restaurant> {
  const rows = await db
    .select()
    .from(restaurants)
    .where(and(tenantWhere(restaurants, ctx), eq(restaurants.id, id)))
    .limit(1);

  const restaurant = rows[0];
  if (!restaurant) throw new NotFoundError("Restaurant introuvable");

  // Défense en profondeur : redondant avec tenantWhere, mais protège contre une
  // future modification de la requête (jointure, oubli de filtre...).
  assertSameTenant(restaurant, ctx);
  return restaurant;
}
