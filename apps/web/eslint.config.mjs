import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Existing client graph/session initialization deliberately synchronizes
      // component state from mount-time props and browser APIs. Refactor these
      // components independently instead of changing their behavior as part of
      // the Next.js security upgrade.
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "**/.next/**",
    ".open-next/**",
    "**/.open-next/**",
    "out/**",
    "build/**",
    ".claude/**",
    ".omc/**",
    "next-env.d.ts",
    "worker-configuration.d.ts",
  ]),
]);

export default eslintConfig;
