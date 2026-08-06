import next from "eslint-config-next";

/**
 * Root ESLint flat config (ESLint 9 / flat-config).
 *
 * eslint-config-next v16 exports a ready-to-use flat array as its default
 * export (no `.flat` / `.configs` namespace). It is shared by the workspace
 * packages that have no app-specific config; apps/web has its own. We relax
 * the two rules that fight a hand-rolled design system and disable the
 * set-state-in-effect rule (see apps/web/eslint.config.mjs for the rationale).
 */
const config = [
  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/artifacts/**",
      "**/*.config.*",
    ],
  },
  ...next,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;

