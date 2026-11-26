import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { assertValidStorageKey } from "./keys";
import type { StorageDriver } from "./types";

/**
 * Pilote local : fichiers sur le disque du serveur, dans STORAGE_LOCAL_PATH
 * (relatif au dossier de l'app, ex. ../../storage). Ce dossier doit être HORS du
 * dossier de l'app et hors de public/ : les fichiers ne sont jamais servis
 * directement, mais via /api/files/... après contrôle d'accès.
 */
export function createLocalStorage(basePath: string): StorageDriver {
  const root = path.resolve(process.cwd(), basePath);

  function resolveKey(key: string): string {
    assertValidStorageKey(key);
    const filePath = path.resolve(root, ...key.split("/"));
    // Défense en profondeur contre toute sortie du dossier racine.
    if (!filePath.startsWith(root + path.sep)) {
      throw new Error(`Clé de stockage hors du dossier autorisé : "${key}"`);
    }
    return filePath;
  }

  return {
    async put(key, data) {
      const filePath = resolveKey(key);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, data);
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(resolveKey(key)));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async delete(key) {
      await rm(resolveKey(key), { force: true });
    },
    getUrl(key) {
      assertValidStorageKey(key);
      return `/api/files/${key}`;
    },
  };
}
