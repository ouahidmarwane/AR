/**
 * EXEMPLE DE RÉFÉRENCE — lectures côté serveur pour les Server Components.
 * Même règle que les actions : requireTenant() puis repository.
 */
import { requireTenant } from "@/lib/db/tenant";

import { getRestaurant, listRestaurants } from "./repository";

/** Restaurants de l'organisation de l'URL (/[locale]/app/[org]), si l'utilisateur en est membre. */
export async function getOrganizationRestaurants(orgSlug: string) {
  const ctx = await requireTenant(orgSlug);
  return listRestaurants(ctx);
}

/** Un restaurant de l'organisation de l'URL ; 404 s'il appartient à une autre organisation. */
export async function getOrganizationRestaurant(orgSlug: string, restaurantId: string) {
  const ctx = await requireTenant(orgSlug);
  return getRestaurant(ctx, restaurantId);
}
