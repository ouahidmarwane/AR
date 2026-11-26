import type { StorageDriver } from "./types";

/**
 * TODO : pilote de stockage objet compatible S3 (Cloudflare R2, Hostinger Object Storage, AWS S3...).
 * - Variables à prévoir : endpoint, bucket, clé d'accès, secret (à ajouter à env.ts et .env.example).
 * - Mêmes clés que le pilote local : {organizationId}/{restaurantId}/...
 * - getUrl() : URL signée de courte durée, générée APRÈS contrôle d'accès.
 */
export function createR2Storage(): StorageDriver {
  throw new Error("Le pilote de stockage r2 n'est pas encore implémenté.");
}
