import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import rrBrandVoice from "./eslint-rules/no-brand-voice-violations.js";

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
      "rr-brand-voice": rrBrandVoice,
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
      // Brand-voice gate: block em-dash, en-dash, semicolon, exclamation,
      // and the §6.2 banned-word list in JSX text + string-literal JSX
      // attribute values. Standalone "—" stays allowed as data placeholder.
      // Canonical source: marketing_brain_skills/brand-voice/voice_guidelines.md §6.1 + §6.2.
      "rr-brand-voice/no-violations": "error",
      // Design-system compliance is enforced by scripts/lint-design-tokens.sh
      // Run: npm run lint:design-tokens
      //
      // DAL boundary: only lib/data/ may call supabase.from('<bannedTable>').
      // Flipped to `error` on 2026-05-27 per the brand-voice + DAL guardrails
      // commit. The ratchet check (scripts/check-dal-boundary.mjs) remains the
      // CI gate; the editor rule now hard-blocks too. See docs/DATA_ACCESS_LAYER.md.
      "no-restricted-syntax": ["error", {
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
  {
    // Brand-voice rule is OFF in surfaces that are not user-facing prose:
    //   - API routes + server actions
    //   - admin tools (internal-only UI)
    //   - lib/ (data + helpers, not strings shown to users)
    //   - scripts/ (dev tooling)
    //   - eslint-rules/ (lint rules themselves contain example banned tokens)
    //   - any *.test.* file (RuleTester payloads contain banned tokens by design)
    // Main block above leaves it ON at error level everywhere else, which is
    // the user-facing surface: app/* pages + components/* + LP routes.
    files: [
      "app/api/**/*.{ts,tsx}",
      "app/admin/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
      "scripts/**/*.{ts,tsx,mjs,js}",
      "eslint-rules/**/*.{js,mjs}",
      "**/*.test.{ts,tsx,mjs}",
    ],
    rules: {
      "rr-brand-voice/no-violations": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Parallel-agent worktrees — these are scratch copies of the
    // repo that other Claude sessions create. They're not part of
    // this checkout's source and shouldn't be lint-gated.
    ".claude/worktrees/**",
    // OUT OF SCOPE per /goal — video production pipeline + marketing
    // flyer generators live in their own Remotion + node-script worlds
    // and use legacy CommonJS require(). Linting them gates the
    // public LP work behind unrelated cleanup. Tracked exception
    // per docs/EXECUTION_PLAN.md.
    "listing_video_v4/**",
    "video/**",
    "scripts/render-tumalo-flyers*.js",
  ]),
]);

export default eslintConfig;
