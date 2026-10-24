import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Mirrors the written rules in .cursor/rules/coding-style.mdc and the frontend rules. */
const restrictedSyntax = [
  { selector: "ClassDeclaration", message: "Do not use classes. Use plain objects and named functions." },
  { selector: "ClassExpression", message: "Do not use classes. Use plain objects and named functions." },
  { selector: "ExportDefaultDeclaration", message: "Do not use default exports. Use named exports." },
  { selector: "ThrowStatement > Literal", message: "Throw an Error made with createApplicationError, never a string." },
];

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**", ".data/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "func-style": ["error", "declaration", { allowArrowFunctions: true }],
      "no-restricted-syntax": ["error", ...restrictedSyntax],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["frontend/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-syntax": [
        "error",
        ...restrictedSyntax,
        { selector: "JSXAttribute[name.name=/^data-/]", message: "Use .is-* classes for state. Do not use data-* attributes." },
        { selector: "JSXAttribute[name.name='style']", message: "Style with SCSS, not inline styles." },
      ],
    },
  },
  {
    files: ["**/vite.config.ts", "**/vitest.config.ts", "eslint.config.js"],
    rules: { "no-restricted-syntax": "off" },
  },
);
