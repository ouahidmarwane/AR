import { z } from "zod";

/** Identifiant de restaurant (UUID) reçu du client : jamais utilisé sans requireTenant(). */
export const restaurantIdSchema = z.uuid();

/** Exemple : entrée de l'action de renommage (squelette, voir actions.ts). */
export const renameRestaurantSchema = z.object({
  restaurantId: restaurantIdSchema,
  name: z.string().trim().min(1).max(191),
});

export type RenameRestaurantInput = z.infer<typeof renameRestaurantSchema>;
