import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import rrBrandVoice from "./eslint-rules/no-brand-voice-violations.js";
import rrNoDynamicRevalidate from "./eslint-rules/no-dynamic-revalidate.js";

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
      "no-restricted-syntax": ["error",
        {
          // G1: DAL boundary
          // Gate 6 (2026-06-09): blog_posts, guides, market_reports added — DAL readers now exist.
          selector: "CallExpression[callee.property.name='from'][arguments.0.value=/^(listings|listing_videos|video_tours_cache|listing_history|market_stats_cache|market_pulse_live|engagement_metrics|properties|neighborhoods|communities|cities|listing_photos|listing_agents|open_houses|boundaries|neighborhood_subdivisions|subdivision_flags|app_config|activity_events|expired_listings|cmas|cma_comps|guest_search_alerts|blog_posts|guides|market_reports)$/]",
          message: "DAL boundary: supabase.from('<table>') is banned outside lib/data/. Use the canonical function from @/lib/data/ instead. See docs/DATA_ACCESS_LAYER.md.",
        },
        {
          // G29: D32/D33 — inline <style> JSX element banned in app/** and components/site/**
          // (this selector matches anywhere; lib/data/ override below turns it off there).
          selector: "JSXElement[openingElement.name.name='style']",
          message: "D32: inline <style> JSX elements are banned in user-facing code. Use Tailwind utilities, app/globals.css, or CSS modules. The design-system primitives (DisplayHeading, CTAButton, Container etc.) own typography/layout — do not re-define them per-page.",
        },
        {
          // G29: D33 — client-side <style> injection (styled-components / createGlobalStyle)
          selector: "CallExpression[callee.name='createGlobalStyle']",
          message: "D33: client-side <style> injection (styled-components / createGlobalStyle / similar) is banned. Use Tailwind utilities + app/globals.css.",
        },
      ],
    },
  },
  {
    // G18 — force-dynamic + revalidate coexistence detection (closes GAP-5).
    // EXECUTION_PLAN §0.4 calls for a rule that blocks the combination of
    // `export const dynamic = 'force-dynamic'` with `export const revalidate = N`
    // in the same file because the two settings silently fight each other —
    // force-dynamic disables every caching layer, making any `revalidate`
    // setting a no-op while masking the cold-render cost. The rule lives in
    // its own `files` block so it scopes ONLY to App Router route files
    // (page.tsx, layout.tsx, route.ts) where the two exports are meaningful.
    files: [
      "app/**/page.{ts,tsx}",
      "app/**/layout.{ts,tsx}",
      "app/**/route.{ts,tsx}",
    ],
    plugins: { "rr-no-dynamic-revalidate": rrNoDynamicRevalidate },
    rules: {
      "rr-no-dynamic-revalidate/no-dynamic-revalidate": "error",
    },
  },
  {
    // G19 — Sentry tracesSampleRate budget guard (closes GAP-6). Blocks
    // accidentally re-enabling 100% trace sampling in sentry.{client,server,edge}.config.ts.
    // > 0.2 silently drains the Sentry monthly quota and slows production.
    files: ["sentry.*.config.{ts,tsx,js,mjs}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Property[key.name='tracesSampleRate'][value.type='Literal'][value.value>0.2]",
          message:
            "G19: tracesSampleRate must be <= 0.2 in Sentry config. Values above 0.2 drain Sentry quota and slow production. If a temporary boost is needed for debugging, use the SENTRY_TRACES_SAMPLE_RATE env variable rather than hard-coding.",
        },
      ],
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
    // scripts/ + eslint-rules/ are dev tooling, NOT the Next.js app runtime:
    //   - one-off ops scripts (backfills, seeds, migrations, audits) must use
    //     raw supabase.from(). The cached DAL is for the app, not maintenance
    //     jobs that read/write arbitrary tables (CLAUDE.md: scripts use raw SQL).
    //   - both legitimately use CommonJS require().
    // The DAL boundary + require-import rules are therefore off here. The
    // brand-voice rule is already off for these dirs (see block below).
    files: [
      "scripts/**/*.{ts,tsx,mjs,js,cjs}",
      "eslint-rules/**/*.{js,mjs,cjs}",
    ],
    rules: {
      "no-restricted-syntax": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // Inline-<style> (D32/D33) + DAL-boundary allowlist — specific files
    // where the construct is legitimate, NOT the anti-pattern the rule
    // targets:
    //   - components/ui/chart.tsx: vendored shadcn primitive whose per-chart
    //     CSS-variable <style> block is upstream-owned. Do not refactor it.
    //   - components/pulse/*: self-contained @keyframes for the like/pulse
    //     micro-animations (scoped, not design-system typography redefinition).
    //   - app/lp/*: standalone landing pages with bespoke scoped <style>.
    //   - data/golf/*: a data-loader module (reads market_stats_cache +
    //     listings); treated as a data layer per Matt 2026-06-03.
    // D32/D33/DAL stay ON everywhere else, so any NEW inline <style> or raw
    // query still errors and forces a conscious addition to this list.
    files: [
      "components/ui/chart.tsx",
      "components/pulse/HeartBurst.tsx",
      "components/pulse/PulseCard.tsx",
      "app/lp/bend/page.tsx",
      "app/lp/central-oregon-golf/page.tsx",
      "app/lp/tetherow/page.tsx",
      "data/golf/community-kpis.ts",
      "data/golf/featured-listings.ts",
    ],
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
