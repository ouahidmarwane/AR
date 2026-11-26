import type { TenantContext } from "@/lib/db/tenant";

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Vérifie qu'une clé ne contient que des segments sûrs (pas de "..", pas de chemin absolu). */
export function assertValidStorageKey(key: string): void {
  const segments = key.split("/");
  if (segments.length < 2 || !segments.every((segment) => SAFE_SEGMENT.test(segment))) {
    throw new Error(`Clé de stockage invalide : "${key}"`);
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Clé de stockage invalide : "${key}"`);
  }
}

/**
 * Construit une clé de stockage isolée par organisation :
 *   {organizationId}/{restaurantId}/{...segments}
 * L'organizationId vient du TenantContext, jamais d'une entrée client.
 */
export function tenantStorageKey(
  ctx: TenantContext,
  restaurantId: string,
  ...segments: string[]
): string {
  const key = [ctx.organizationId, restaurantId, ...segments].join("/");
  assertValidStorageKey(key);
  return key;
}

/** Organisation propriétaire d'une clé (1er segment), pour le contrôle d'accès à la lecture. */
export function storageKeyOrganizationId(key: string): string {
  assertValidStorageKey(key);
  return key.split("/")[0]!;
}
