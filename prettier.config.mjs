import baseConfig from "@ar/config/prettier";

/** @type {import("prettier").Config} */
const config = {
  ...baseConfig,
  // Tailwind v4 : point d'entrée CSS utilisé par prettier-plugin-tailwindcss pour trier les classes.
  tailwindStylesheet: "./apps/web/src/app/globals.css",
};

export default config;
