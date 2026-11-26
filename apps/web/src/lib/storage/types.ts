/**
 * Contrat commun à tous les pilotes de stockage (local, r2...).
 * Les clés sont des chemins relatifs "/"-séparés, TOUJOURS préfixés par l'organisation :
 *   {organizationId}/{restaurantId}/...
 * Utiliser tenantStorageKey() pour les construire, jamais de concaténation à la main.
 */
export interface StorageDriver {
  /** Écrit (ou remplace) un fichier. */
  put(key: string, data: Uint8Array, options?: { contentType?: string }): Promise<void>;
  /** Lit un fichier ; null s'il n'existe pas. */
  get(key: string): Promise<Uint8Array | null>;
  /** Supprime un fichier (sans erreur s'il n'existe pas). */
  delete(key: string): Promise<void>;
  /** URL par laquelle le navigateur récupère le fichier (après contrôle d'accès). */
  getUrl(key: string): string;
}
