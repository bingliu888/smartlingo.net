import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // SmartLingo deliberately performs full document navigations after auth,
      // enrollment, payment, and realtime-room state mutations so the server
      // session and entitlements are re-read. A client-router substitution
      // would change that behavior, so the Next 16.3 advisory rule does not
      // apply to these audited transitions.
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
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
    "public/wallet-assets/smartlingo-onboard.js",
  ]),
]);

export default eslintConfig;
