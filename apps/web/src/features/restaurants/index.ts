// API publique du module restaurants : seul point d'entrée autorisé depuis l'extérieur.
// Le repository n'est PAS exporté : les autres modules passent par queries/actions,
// qui appellent requireTenant().
export { renameRestaurant } from "./actions";
export { getOrganizationRestaurant, getOrganizationRestaurants } from "./queries";
export { renameRestaurantSchema, restaurantIdSchema } from "./schemas";
export type { RenameRestaurantInput, Restaurant } from "./types";
