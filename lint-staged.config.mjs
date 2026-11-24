import path from "node:path";

const webDir = path.resolve("apps/web");
const quote = (files) => files.map((file) => `"${file}"`).join(" ");

/** @type {import("lint-staged").Configuration} */
const config = {
  // ESLint (flat config de apps/web) sur le code de l'app, puis Prettier.
  "*.{ts,tsx,js,jsx,mjs,cjs}": (files) => {
    const webFiles = files.filter((file) => path.resolve(file).startsWith(webDir + path.sep));
    return [
      ...(webFiles.length ? [`pnpm --filter @ar/web exec eslint --fix ${quote(webFiles)}`] : []),
      `prettier --write ${quote(files)}`,
    ];
  },
  "*.{json,md,css,yml,yaml}": (files) => `prettier --write ${quote(files)}`,
};

export default config;
