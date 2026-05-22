import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Downgrade React Compiler purity rules to warnings.
    // These flag valid pre-compiler React patterns (setState in effects,
    // ref assignments during render, Date.now() in server components)
    // that don't affect runtime correctness.
    plugins: {
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Downgrade React Compiler rules to warnings — these flag valid
      // pre-compiler React patterns that don't affect runtime correctness.
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
            // Downgrade no-explicit-any to warning — Supabase query builder
            // callbacks use pragmatic `any` for filter chain parameters.
            "@typescript-eslint/no-explicit-any": "warn",
      // Design-system compliance is enforced by scripts/lint-design-tokens.sh
      // Run: npm run lint:design-tokens
      //
      // DAL boundary: only lib/data/ may call supabase.from('<bannedTable>').
      // Currently `warn` because 380 baseline violations exist (see
      // scripts/dal-boundary-baseline.json). The ratchet check
      // (scripts/check-dal-boundary.mjs) is the active gate in CI — this rule
      // surfaces the violation in-editor. Flip to `error` once baseline hits 0
      // (end of Wave 2/3 per docs/EXECUTION_PLAN.md). See docs/DATA_ACCESS_LAYER.md.
      "no-restricted-syntax": ["warn", {
        selector: "CallExpression[callee.property.name='from'][arguments.0.value=/^(listings|listing_videos|video_tours_cache|listing_history|market_stats_cache|market_pulse_live|engagement_metrics|properties|neighborhoods|communities|cities|listing_photos|listing_agents|open_houses|boundaries|neighborhood_subdivisions|subdivision_flags|app_config|activity_events|expired_listings|cmas|cma_comps)$/]",
        message: "DAL boundary: supabase.from('<table>') is banned outside lib/data/. Use the canonical function from @/lib/data/ instead. See docs/DATA_ACCESS_LAYER.md.",
      }],
    },
  },
  {
    // lib/data/* IS the canonical Data Access Layer — raw Supabase queries are
    // allowed (and required) here. Override the DAL boundary rule for this dir.
    files: ["lib/data/**/*.{ts,tsx,mjs,js}"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
