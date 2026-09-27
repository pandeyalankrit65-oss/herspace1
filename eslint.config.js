import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "server/dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // shadcn/ui components export their variant helpers next to the component by design, and
    // these modules pair a provider with its hook/helpers. Fast refresh just reloads them.
    files: ["src/components/ui/**", "src/i18n/index.tsx", "src/components/LegalPage.tsx", "src/contexts/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    files: ["server/**/*.ts", "e2e/**/*.ts", "playwright.config.ts"],
    languageOptions: { globals: globals.node },
  },
);
