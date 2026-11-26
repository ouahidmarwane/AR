/**
 * Choix de la cible de build et chargement du .env racine (Hostinger écrit ses variables dans
 * un fichier .env à la racine du repo au lieu de les passer dans process.env).
 * Chaque test crée un faux repo dans un dossier temporaire.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  findRepoRoot,
  loadRootEnv,
  parseEnv,
  resolveBuildTarget,
} from "../scripts/lib/root-env.mjs";

const dirs: string[] = [];

/** Faux repo : racine avec pnpm-workspace.yaml et apps/web. Renvoie les chemins. */
function fakeRepo(options: { rootEnv?: string; webEnv?: string; parent?: string } = {}) {
  const base = mkdtempSync(path.join(tmpdir(), "ar-env-"));
  dirs.push(base);
  const root = options.parent ? path.join(base, options.parent) : base;
  const webDir = path.join(root, "apps", "web");
  mkdirSync(webDir, { recursive: true });
  writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages: []\n");
  if (options.rootEnv !== undefined) writeFileSync(path.join(root, ".env"), options.rootEnv);
  if (options.webEnv !== undefined) writeFileSync(path.join(webDir, ".env"), options.webEnv);
  return { root, webDir };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("resolveBuildTarget", () => {
  it("process.env sans BUILD_TARGET + .env racine BUILD_TARGET=hostinger → cible webpack (hostinger)", () => {
    const { root, webDir } = fakeRepo({
      rootEnv: "DATABASE_URL=mysql://x\nBUILD_TARGET=hostinger\n",
    });
    expect(resolveBuildTarget({ env: {}, cwd: webDir, webDir })).toEqual({
      target: "hostinger",
      source: ".env racine",
      file: path.join(root, ".env"),
    });
  });

  it("process.env est prioritaire sur le .env racine", () => {
    const { webDir } = fakeRepo({ rootEnv: "BUILD_TARGET=hostinger\n" });
    expect(resolveBuildTarget({ env: { BUILD_TARGET: "Other" }, cwd: webDir, webDir })).toEqual({
      target: "other",
      source: "process.env",
    });
  });

  it("une valeur vide dans process.env est ignorée", () => {
    const { webDir } = fakeRepo({ rootEnv: "BUILD_TARGET=hostinger\n" });
    expect(resolveBuildTarget({ env: { BUILD_TARGET: " " }, cwd: webDir, webDir }).source).toBe(
      ".env racine",
    );
  });

  it("lit apps/web/.env si le .env racine ne définit pas BUILD_TARGET", () => {
    const { webDir } = fakeRepo({ rootEnv: "FOO=bar\n", webEnv: "BUILD_TARGET='hostinger'\n" });
    expect(resolveBuildTarget({ env: {}, cwd: webDir, webDir })).toMatchObject({
      target: "hostinger",
      source: "apps/web/.env",
    });
  });

  it("détecte le dossier de build Hostinger (/hbuilds/) en dernier recours", () => {
    const { webDir } = fakeRepo({ parent: "domains/site/hbuilds/source/repository" });
    expect(resolveBuildTarget({ env: {}, cwd: webDir, webDir })).toEqual({
      target: "hostinger",
      source: "détection Hostinger",
    });
  });

  it("sans aucune indication → Turbopack (défaut)", () => {
    const { webDir } = fakeRepo();
    expect(resolveBuildTarget({ env: {}, cwd: webDir, webDir })).toEqual({
      target: "",
      source: "défaut",
    });
  });
});

describe("loadRootEnv", () => {
  it("ajoute les variables du .env racine sans écraser celles déjà définies", () => {
    const { webDir } = fakeRepo({
      rootEnv:
        "DATABASE_URL=mysql://root-env\nBETTER_AUTH_SECRET=from-root-env\nEXISTING=from-file\n",
    });
    const env: Record<string, string | undefined> = { EXISTING: "from-process" };

    const result = loadRootEnv({ startDir: webDir, env });

    expect(result.added.sort()).toEqual(["BETTER_AUTH_SECRET", "DATABASE_URL"]);
    expect(env).toMatchObject({
      DATABASE_URL: "mysql://root-env",
      BETTER_AUTH_SECRET: "from-root-env",
      EXISTING: "from-process",
    });
  });

  it("sans .env racine : ne fait rien", () => {
    const { webDir } = fakeRepo();
    const env: Record<string, string | undefined> = {};
    expect(loadRootEnv({ startDir: webDir, env })).toEqual({ file: null, added: [] });
    expect(env).toEqual({});
  });

  it("trouve la racine depuis apps/web", () => {
    const { root, webDir } = fakeRepo();
    expect(findRepoRoot(webDir)).toBe(root);
  });
});

describe("parseEnv", () => {
  it("gère commentaires, export, guillemets et fins de ligne Windows", () => {
    expect(
      parseEnv(
        [
          "# commentaire",
          "export A=1",
          'B="deux mots" ',
          "C='simple # pas un commentaire'",
          "D=valeur # commentaire",
          "E=",
          'F="ligne1\\nligne2"',
          "G=a=b=c",
          "pas une variable",
        ].join("\r\n"),
      ),
    ).toEqual({
      A: "1",
      B: "deux mots",
      C: "simple # pas un commentaire",
      D: "valeur",
      E: "",
      F: "ligne1\nligne2",
      G: "a=b=c",
    });
  });
});
