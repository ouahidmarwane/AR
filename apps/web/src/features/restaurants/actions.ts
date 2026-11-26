"use server";

/**
 * EXEMPLE DE RÉFÉRENCE — Server Action (squelette, pas de logique métier).
 *
 * Ordre IMPOSÉ dans chaque action :
 *  1. requireTenant(orgSlug, rôle minimum) : session + appartenance + rôle, sinon 401/403.
 *  2. Validation Zod de l'entrée (schemas.ts) : ne jamais faire confiance au client.
 *  3. Appel du repository avec le TenantContext (jamais d'organizationId venant du client).
 * Les erreurs attendues sont renvoyées sous forme de codes (ActionResult, src/lib/actions.ts).
 */
import { fail, invalidInput, type ActionResult, type CommonActionError } from "@/lib/actions";
import { requireTenant } from "@/lib/db/tenant";

import { getRestaurant } from "./repository";
import { renameRestaurantSchema } from "./schemas";

export async function renameRestaurant(
  orgSlug: string,
  input: unknown,
): Promise<ActionResult<void, CommonActionError | "NOT_IMPLEMENTED">> {
  const ctx = await requireTenant(orgSlug, "manager");

  const parsed = renameRestaurantSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  // Lève NotFoundError si le restaurant n'appartient pas à l'organisation du contexte.
  await getRestaurant(ctx, parsed.data.restaurantId);

  // TODO(restaurants) : ajouter renameRestaurant(ctx, id, name) au repository (avec tenantWhere).
  return fail("NOT_IMPLEMENTED");
}
