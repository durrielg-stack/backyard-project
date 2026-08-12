import { dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import prettier from "eslint-config-prettier/flat";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // ---- Repo-wide bans (ported from byp-pos-v2 ADR-021/024) ----
  {
    files: ["**/*.{ts,tsx,mjs}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "react/no-danger": "error",
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Config files at the repo root are tooling, not app code.
  {
    files: ["*.mjs", "*.ts"],
    rules: {
      "import/no-anonymous-default-export": "off",
    },
  },

  // Prettier owns formatting; disable stylistic conflicts. Must stay last.
  prettier,

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
