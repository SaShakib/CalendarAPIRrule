import js from "@eslint/js";
import globals from "globals";
import ts from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // JS files
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: { js },
    extends: ["js/recommended"],
  },

  // TS files
  {
    files: ["**/*.{ts,mts,cts}"],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: { ts }, // <-- plugin object key must match how rules are referenced
    rules: {
      "ts/no-explicit-any": "off", // <-- prefix with 'ts/' to reference plugin correctly
      "ts/explicit-function-return-type": "off",
      "ts/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
]);
