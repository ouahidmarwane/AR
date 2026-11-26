import { getServerEnv } from "@/lib/env";

import { createLocalStorage } from "./local";
import { createR2Storage } from "./r2";
import type { StorageDriver } from "./types";

export type { StorageDriver } from "./types";
export { assertValidStorageKey, storageKeyOrganizationId, tenantStorageKey } from "./keys";

let driver: StorageDriver | undefined;

/** Pilote de stockage configuré par STORAGE_DRIVER (serveur uniquement). */
export function getStorage(): StorageDriver {
  if (driver) return driver;
  const env = getServerEnv();
  driver =
    env.STORAGE_DRIVER === "r2" ? createR2Storage() : createLocalStorage(env.STORAGE_LOCAL_PATH);
  return driver;
}
