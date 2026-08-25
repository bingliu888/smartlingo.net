import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "dist/**",
    ".wrangler/**",
    ".sites-runtime/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "output/**",
    "tmp/**",
    "public/pdf.worker.min.mjs",
    "public/wallet-assets/greatlove-onboard.js",
  ]),
]);

export default eslintConfig;
