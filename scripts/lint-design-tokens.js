#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "components"];
const FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const EXCLUDED_DIRS = new Set(["node_modules", ".next", "out", "build", "dist"]);
const EXCLUDED_PATHS = [
  "components/ui/",
  // components/site/ blanket exclusion REMOVED 2026-06-09 (P1.20 / Gate 3):
  // all components/site/ files are now scanned by DISALLOWED_PRIMITIVES.
  // Map .client files still need literal hex for Google Maps isolation:
  "components/site/NeighborhoodMap.client.tsx",
  "components/site/PriceChart.client.tsx",
  "components/site/listing-detail/ListingLocationMap.client.tsx",
  // Non-site map .client files with the same Google Maps isolation constraint:
  "components/seller-lp/MarketVisuals.client.tsx",
  "components/tools/EquityProjectionChart.client.tsx", // recharts — hex literals required in chart config
  "components/tools/RentalCalculator.tsx",             // recharts chart axes (same class as above)
  // Email templates — email clients don't support CSS variables:
  "lib/email-templates/",
  "lib/digest-email-templates.tsx",
  // Console — the brand-free broker workspace (Matt directive 2026-06-15: "we do
  // not need to enforce the styles from our brand in the admin, it just needs to
  // be ultra intuitive"). The console gets its NEUTRAL look from the .console-root
  // token scope (app/admin/console/console-theme.css), not the brand palette, so
  // the brand design-token gate does not apply here. It still uses shadcn/ui
  // components + semantic token classes by convention; it is simply exempt from
  // the brand-enforcement primitives/color/hex checks.
  "app/admin/console/",
  "components/console/",
  "_style_backup/",
  "app/globals.css",
  "scripts/",
];
const IGNORE_FILE = ".design-token-lint-ignore";
const BASELINE_PATH = path.join(ROOT, "scripts/design-tokens-baseline.json");

const DISALLOWED_CLASSES = /\b(card-base|btn-cta)\b/g;
const DISALLOWED_COLOR_CLASSES =
  /\b(?:bg|text|border|from|to|via)-(?:white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{1,3})?(?:\/\d{1,3})?\b/g;
// Negative lookbehind excludes "design-audit #132" / "audit #150" style code
// comments referencing an issue number — a 3-digit decimal issue number is
// indistinguishable from a 3-digit hex color to this regex otherwise, and
// this comment convention is used throughout the design-audit remediation.
const DISALLOWED_HEX = /(?<!audit )#[0-9a-fA-F]{3,8}\b/gi;
const DISALLOWED_PRIMITIVES =
  /<(button|input|select|textarea|label|hr|table)(\s|>)/g;
const DISALLOWED_STYLE_BACKUP_IMPORT =
  /(?:from|import)\s*["'][^"']*_style_backup\/[^"']*["']/g;

// G26 — Arbitrary Tailwind brackets (closes DESIGN_DIRECTIVES.md
// D17/D18/D19/D20/D21/D22). Drift from the locked layout ladder:
// arbitrary `max-w-[1200px]`, `py-[120px]`, `gap-[18px]`,
// `p-[22px]`, `rounded-[16px]` etc. silently fork the design system
// per-page. Allowed exceptions: `rounded-[10px]` (the canonical
// button radius), `ring-[3px]` (the canonical focus ring).
const ARBITRARY_BRACKET_ALLOWLIST = new Set([
  'rounded-[10px]', // D21 canonical button radius
  'rounded-[14px]', // D22 canonical card radius (Tailwind `rounded-xl` is equivalent — both allowed)
  'ring-[3px]', // D25 canonical focus ring width
  'tracking-[-0.01em]', // D14 hero H1 tracking
  'tracking-[-0.02em]', // D14 hero H1 tracking variant
  'tracking-[0.08em]', // D14 all-caps signage tracking
  'tracking-[0.12em]', // D13 eyebrow tracking
])
const DISALLOWED_ARBITRARY_BRACKETS =
  /\b(?:max-w|min-w|w|h|max-h|min-h|py|px|pt|pb|pl|pr|p|mt|mb|ml|mr|m|gap|gap-x|gap-y|rounded|shadow|text|leading|tracking)-\[[^\]]+\]/g

// G27 — Decorative gradients (closes D72). Only the navy protection
// scrim is allowed.
const DISALLOWED_LINEAR_GRADIENT =
  /linear-gradient\([^)]*\)/g
const ALLOWED_GRADIENT_PATTERNS = [
  /linear-gradient\([^)]*rgba\(16\s*,\s*39\s*,\s*66/i, // navy protection scrim
  /linear-gradient\([^)]*var\(--rr-navy/i, // navy var scrim
  /linear-gradient\([^)]*to\s+top[^)]*transparent[^)]*black/i, // canonical photo bottom scrim
]

// G28 — Non-token shadow detection (closes D23/D24). Inline
// `box-shadow: 0 ... rgba(0, 0, 0, ...)` on non-photo surfaces.
const DISALLOWED_BLACK_SHADOW =
  /box-shadow\s*:\s*[^;]*rgba\(\s*0\s*,\s*0\s*,\s*0/g

// G24 — Retired-font detection (closes GAP-4 from out/guardrail-inventory-2026-05-28.md).
// Design System v2 locked the brand to Amboqia + Azo Sans + Geist.
// Any of these retired font families showing up in source means brand
// typography is drifting silently. Detection covers:
//   - `font-family:` declarations referencing the retired family
//   - `font-<retired>` tailwind utility (e.g. `font-playfair`)
//   - `next/font/google` imports of the retired family
//   - Bare `@import url(...google...<retired>...)` lines
const RETIRED_FONTS = [
  'Playfair',
  'Helvetica',
  'Inter',
  'AzoSans', // AzoSans was retired from web in DS v2 (still used in print)
  'system-ui',
  'Arial',
]
const DISALLOWED_FONT_FAMILY = new RegExp(
  `font-family\\s*:\\s*[^;\\n]*['\"\`]?(?:${RETIRED_FONTS.join('|')})['\"\`]?`,
  'gi',
)
const DISALLOWED_FONT_TAILWIND_UTILITY = new RegExp(
  `\\bfont-(?:${RETIRED_FONTS.map((f) => f.toLowerCase()).join('|')})\\b`,
  'g',
)
const DISALLOWED_FONT_NEXT_IMPORT = new RegExp(
  `from\\s+['\"\`]next/font/google['\"\`][\\s\\S]{0,200}?\\b(?:${RETIRED_FONTS.join('|')})\\b`,
  'gi',
)
const DISALLOWED_FONT_GOOGLE_CSS = new RegExp(
  `@import\\s+url\\([^)]*fonts\\.googleapis\\.com[^)]*(?:${RETIRED_FONTS.join('|')})`,
  'gi',
)

// ─────────────────────────────────────────────────────────────────────────────
// Gate 3 — Component-discipline detectors (added 2026-06-09 / P2 / Gate 3).
// Each rule is scoped to files that don't import the canonical component,
// so migrated files auto-pass. New violations baseline via the existing
// --write-baseline / --ratchet mechanism (new rule category = new issue string).
// ─────────────────────────────────────────────────────────────────────────────

// (a) Hand-rolled CARD: div/li/figure/article (not inline elements like Label/span)
//     whose className combines rounded-xl/2xl/3xl/lg + border(-*)? +
//     (bg-card|bg-background) + (p-|px-|py-), signalling a container shell.
//     Excludes rounded-full (that's a pill/chip, not a card).
//     File must not import @/components/ui/card.
const HAND_ROLLED_CARD_CLASS =
  /<(?:div|li|figure|article)\b[^>]*className\s*=\s*(?:"[^"]*|'[^']*|`[^`]*)(?=.*\brounded-(?:xl|2xl|3xl|lg)\b)(?=.*\bborder\b)(?=.*\bbg-(?:card|background)\b)(?=.*\b(?:p-|px-|py-)\S+)[^"'`]*/g;
const CARD_IMPORT = /@\/components\/ui\/card/;

// (b) Hand-rolled BADGE: rounded-full <span> with (border-|bg-) + px-/py-
//     in a file not importing @/components/ui/badge.
const HAND_ROLLED_BADGE_SPAN =
  /<span\b[^>]*className\s*=\s*(?:"[^"]*|'[^']*|`[^`]*)(?=.*\brounded-full\b)(?=.*\b(?:border-|bg-)\S+)(?=.*\b(?:px-|py-)\S+)[^"'`]*/g;
const BADGE_IMPORT = /@\/components\/ui\/badge/;

// (c) Link-as-BUTTON: <a> or <Link> className with rounded-* + (bg-primary|
//     bg-accent|border-2 border-primary) + px- + py- + font-semibold, file not
//     using <Button asChild>.
const LINK_AS_BUTTON =
  /<(?:a|Link)\b[^>]*className\s*=\s*(?:"[^"]*|'[^']*|`[^`]*)(?=.*\brounded-\w)(?=.*\b(?:bg-primary|bg-accent|border-2\s+border-primary)\b)(?=.*\bpx-\S+)(?=.*\bpy-\S+)(?=.*\bfont-semibold\b)[^"'`]*/g;
const BUTTON_ASCHILD = /Button\s+asChild|asChild[^>]*Button/;

// (d) Custom MODAL: className containing 'fixed inset-0 z-' on an element
//     with role="dialog" or aria-modal, file not importing ui/dialog.
const CUSTOM_MODAL_CLASS = /className\s*=\s*(?:"[^"]*|'[^']*|`[^`]*)fixed\s+inset-0\s+z-[^"'`]*/g;
const CUSTOM_MODAL_ARIA = /role=["']dialog["']|aria-modal=["']true["']/;
const DIALOG_IMPORT = /@\/components\/ui\/dialog/;

// (e) RETIRED palette — immediate hard-fail, no baseline grandfathering.
//     bg-/text-/border- sky-* or fir-* (deleted --rr-sky / --rr-fir tokens).
const RETIRED_PALETTE_HARD_FAIL =
  /\b(?:bg|text|border|from|to|via)-(?:sky|fir)-\d{1,3}\b/g;

// (f) Primitive chrome-override: an <Input|Textarea|Select|Button element
//     whose className re-declares component-owned chrome (border- AND
//     rounded- AND focus:ring together).
const PRIMITIVE_CHROME_OVERRIDE =
  /<(?:Input|Textarea|Select|Button)\b[^>]*className\s*=\s*(?:"[^"]*|'[^']*|`[^`]*)(?=.*\bborder-\S+)(?=.*\brounded-\S+)(?=.*\bfocus:ring\b)[^"'`]*/g;

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function isExcludedPath(relativePath) {
  const normalized = normalizePath(relativePath);
  return EXCLUDED_PATHS.some((excluded) => normalized.includes(excluded));
}

function loadIgnoredFiles() {
  const ignorePath = path.join(ROOT, IGNORE_FILE);
  if (!fs.existsSync(ignorePath)) return { has: () => false };

  // Exact file paths, plus directory prefixes (entries ending in "/") that
  // exempt a whole sanctioned-bespoke surface in one line (e.g. the KB design
  // system, which carries its own token layer and is not the shadcn system
  // this gate enforces). Returns an object with .has() so call sites are unchanged.
  const raw = fs.readFileSync(ignorePath, "utf8");
  const files = new Set();
  const prefixes = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    if (t.endsWith("/")) prefixes.push(normalizePath(t.replace(/\/$/, "")) + "/");
    else files.add(normalizePath(t));
  }
  return { has: (p) => files.has(p) || prefixes.some((pre) => p.startsWith(pre)) };
}

function walkDirectory(startPath, files = []) {
  if (!fs.existsSync(startPath)) return files;

  const entries = fs.readdirSync(startPath, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;

    const absolute = path.join(startPath, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(absolute, files);
      continue;
    }

    const ext = path.extname(entry.name);
    if (!FILE_EXTENSIONS.has(ext)) continue;

    const relative = path.relative(ROOT, absolute);
    if (isExcludedPath(relative)) continue;
    files.push(absolute);
  }

  return files;
}

function getChangedFiles(useBaseDiff) {
  const commands = useBaseDiff
    ? [
        "git diff --name-only --diff-filter=ACMRTUXB origin/main...HEAD",
        "git diff --name-only --diff-filter=ACMRTUXB HEAD~1",
      ]
    : [
        "git diff --name-only --diff-filter=ACMRTUXB",
        "git diff --name-only --cached --diff-filter=ACMRTUXB",
        "git ls-files --others --exclude-standard",
      ];

  for (const command of commands) {
    try {
      const output = execSync(command, {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (!output) continue;
      return output.split(/\r?\n/).map((file) => path.join(ROOT, file.trim()));
    } catch {
      // Try next strategy.
    }
  }

  return [];
}

function findAll(regex, text) {
  const results = [];
  const localRegex = new RegExp(regex.source, regex.flags);
  let match = localRegex.exec(text);
  while (match) {
    results.push(match[0]);
    match = localRegex.exec(text);
  }
  return Array.from(new Set(results));
}

function hasHorizontalScrollbarWithoutGuardrail(content) {
  const classNameRegex = /className\s*=\s*["'`]([^"'`]+)["'`]/g;
  let match = classNameRegex.exec(content);
  while (match) {
    const classes = match[1];
    if (
      (classes.includes("overflow-x-auto") || classes.includes("overflow-x-scroll")) &&
      !classes.includes("no-scrollbar")
    ) {
      return true;
    }
    match = classNameRegex.exec(content);
  }
  return false;
}

function lintFile(filePath) {
  const relative = normalizePath(path.relative(ROOT, filePath));
  const content = fs.readFileSync(filePath, "utf8");
  const issues = [];

  const badClasses = findAll(DISALLOWED_CLASSES, content);
  if (badClasses.length) {
    issues.push(`custom CSS classes: ${badClasses.join(", ")}`);
  }

  const badColors = findAll(DISALLOWED_COLOR_CLASSES, content);
  if (badColors.length) {
    issues.push(`hardcoded color classes: ${badColors.slice(0, 8).join(", ")}`);
  }

  const badHex = findAll(DISALLOWED_HEX, content);
  if (badHex.length) {
    issues.push(`hex colors: ${badHex.join(", ")}`);
  }

  const primitiveMatches = findAll(DISALLOWED_PRIMITIVES, content).map((m) =>
    m.replace("<", "").replace(/[\s>].*$/, ""),
  );
  if (primitiveMatches.length) {
    issues.push(
      `raw primitive elements: ${Array.from(new Set(primitiveMatches)).join(", ")}`,
    );
  }

  if (hasHorizontalScrollbarWithoutGuardrail(content)) {
    issues.push("horizontal scroll track missing no-scrollbar guardrail");
  }

  const styleBackupImports = findAll(DISALLOWED_STYLE_BACKUP_IMPORT, content);
  if (styleBackupImports.length) {
    issues.push("imports from _style_backup are forbidden");
  }

  // G24 — retired font detection.
  const retiredFontFamily = findAll(DISALLOWED_FONT_FAMILY, content);
  if (retiredFontFamily.length) {
    issues.push(
      `retired font in font-family declaration: ${retiredFontFamily.slice(0, 3).join(", ")} (allowed: Amboqia, Geist, Azo Sans for print)`,
    );
  }

  // G26 — arbitrary Tailwind brackets outside the allowlist.
  const arbitrary = findAll(DISALLOWED_ARBITRARY_BRACKETS, content).filter(
    (m) => !ARBITRARY_BRACKET_ALLOWLIST.has(m),
  );
  if (arbitrary.length) {
    issues.push(
      `arbitrary Tailwind utilities (D17/D18/D19/D20/D21/D22): ${arbitrary.slice(0, 4).join(", ")} (use the locked ladder — max-w-7xl, py-12/14/16, gap-4/5/6, p-5/6, rounded-xl)`,
    );
  }

  // G27 — decorative gradients (D72).
  const gradients = findAll(DISALLOWED_LINEAR_GRADIENT, content).filter(
    (g) => !ALLOWED_GRADIENT_PATTERNS.some((p) => p.test(g)),
  );
  if (gradients.length) {
    issues.push(
      `decorative linear-gradient (D72): ${gradients.slice(0, 1).join("")} (only navy protection scrim is allowed)`,
    );
  }

  // G28 — non-token black shadows (D23/D24).
  const blackShadows = findAll(DISALLOWED_BLACK_SHADOW, content);
  if (blackShadows.length) {
    issues.push(
      `black shadow detected (D23/D24): use --shadow-sm / --shadow-md / --shadow-lg navy-tinted tokens. Found: ${blackShadows.slice(0, 1).join("").slice(0, 60)}...`,
    );
  }
  const retiredFontUtil = findAll(DISALLOWED_FONT_TAILWIND_UTILITY, content);
  if (retiredFontUtil.length) {
    issues.push(
      `retired font Tailwind utility: ${retiredFontUtil.slice(0, 3).join(", ")} (use font-display / font-sans / font-mono per Design System v2)`,
    );
  }
  const retiredFontImport = findAll(DISALLOWED_FONT_NEXT_IMPORT, content);
  if (retiredFontImport.length) {
    issues.push(
      `next/font/google importing a retired font: ${retiredFontImport.slice(0, 1).join("")} — only Geist is allowed (already loaded in app/layout.tsx)`,
    );
  }
  const retiredFontCss = findAll(DISALLOWED_FONT_GOOGLE_CSS, content);
  if (retiredFontCss.length) {
    issues.push(
      `Google Fonts @import for retired font family: ${retiredFontCss.slice(0, 1).join("")}`,
    );
  }

  // ── Gate 3: component-discipline rules ───────────────────────────────────

  // (e) Retired palette — HARD FAIL regardless of baseline.
  const retiredPalette = findAll(RETIRED_PALETTE_HARD_FAIL, content);
  if (retiredPalette.length) {
    issues.push(
      `HARD FAIL — retired palette token (--rr-sky/--rr-fir deleted in DS v2): ${retiredPalette.join(", ")} — use navy/cream tokens only`,
    );
  }

  // (a) Hand-rolled card (only when file doesn't import ui/card).
  if (!CARD_IMPORT.test(content)) {
    const handRolledCards = findAll(HAND_ROLLED_CARD_CLASS, content);
    if (handRolledCards.length) {
      issues.push(
        `hand-rolled card shell (rounded-*+border+bg-card/background without importing @/components/ui/card): ${handRolledCards.length} occurrence(s) — use <Card> from @/components/ui/card`,
      );
    }
  }

  // (b) Hand-rolled badge span (only when file doesn't import ui/badge).
  if (!BADGE_IMPORT.test(content)) {
    const handRolledBadges = findAll(HAND_ROLLED_BADGE_SPAN, content);
    if (handRolledBadges.length) {
      issues.push(
        `hand-rolled badge <span> (rounded-full+border/bg+padding without importing @/components/ui/badge): ${handRolledBadges.length} occurrence(s) — use <Badge> from @/components/ui/badge`,
      );
    }
  }

  // (c) Link-as-button (only when file doesn't use Button asChild).
  if (!BUTTON_ASCHILD.test(content)) {
    const linkAsButtons = findAll(LINK_AS_BUTTON, content);
    if (linkAsButtons.length) {
      issues.push(
        `link-as-button: <a>/<Link> styled as a button (rounded+bg-primary/accent+px+py+font-semibold) without <Button asChild> — use <Button asChild><Link>`,
      );
    }
  }

  // (d) Custom modal (only when file doesn't import ui/dialog).
  if (!DIALOG_IMPORT.test(content) && CUSTOM_MODAL_ARIA.test(content)) {
    const customModals = findAll(CUSTOM_MODAL_CLASS, content);
    if (customModals.length) {
      issues.push(
        `custom modal: fixed inset-0 z- with role=dialog/aria-modal without importing @/components/ui/dialog — use <Dialog>/<DialogContent> for focus-trap + Escape`,
      );
    }
  }

  // (f) Primitive chrome-override: Input/Textarea/Select/Button className
  //     re-declaring border- + rounded- + focus:ring.
  const chromeOverrides = findAll(PRIMITIVE_CHROME_OVERRIDE, content);
  if (chromeOverrides.length) {
    issues.push(
      `primitive chrome-override: <Input|Textarea|Select|Button> className re-declares border-+rounded-+focus:ring — strip to layout-only classes (mt-1, w-full)`,
    );
  }

  if (!issues.length) return null;
  return { file: relative, issues };
}

// Per-file count = number of distinct issue categories flagged in that
// file. Total = sum across files. Mirrors scripts/check-brand-voice.mjs
// so the two gates ratchet the same way.
function summarize(results) {
  const byFile = {};
  let total = 0;
  for (const r of results) {
    byFile[r.file] = r.issues.length;
    total += r.issues.length;
  }
  return { total, byFile };
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function run() {
  const runAll = process.argv.includes("--all");
  const useBaseDiff = process.argv.includes("--base-diff");
  const writeBaseline = process.argv.includes("--write-baseline");
  const ratchet = process.argv.includes("--ratchet");
  const ignoredFiles = loadIgnoredFiles();

  // Ratchet + baseline modes scan the WHOLE tree (a stable repo-wide debt
  // count), mirroring scripts/check-brand-voice.mjs. Default / --base-diff
  // / --all keep the original changed-file behaviour for local dev.
  const scanWholeTree = writeBaseline || ratchet || runAll;
  const candidateFiles = scanWholeTree
    ? SOURCE_DIRS.flatMap((dir) => walkDirectory(path.join(ROOT, dir)))
    : getChangedFiles(useBaseDiff);

  const files = candidateFiles.filter((file) => {
    if (!fs.existsSync(file)) return false;
    const normalized = normalizePath(path.relative(ROOT, file));
    const ext = path.extname(file);
    const inAllowedDir = SOURCE_DIRS.some((dir) => normalized.startsWith(`${dir}/`));
    return (
      inAllowedDir &&
      FILE_EXTENSIONS.has(ext) &&
      !isExcludedPath(normalized) &&
      !ignoredFiles.has(normalized)
    );
  });

  const results = files.map(lintFile).filter(Boolean);
  const summary = summarize(results);

  // ── Baseline writer ────────────────────────────────────────────────
  if (writeBaseline) {
    fs.writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          total: summary.total,
          byFile: summary.byFile,
          note:
            "Pre-existing design-token debt, grandfathered by the G26 ratchet (scripts/lint-design-tokens.js --ratchet). Total must monotonically DECREASE toward 0 — never add to it. New debt fails CI. Regenerate after cleaning a file with: npm run ci:design-tokens -- --write-baseline.",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `✓ Design-token baseline written: ${summary.total} issue-categories across ${results.length} files.`,
    );
    return;
  }

  // ── Ratchet (the CI gate) ──────────────────────────────────────────
  if (ratchet) {
    const baseline = loadBaseline();
    if (!baseline) {
      console.error("✗ No design-token baseline at scripts/design-tokens-baseline.json");
      console.error("  Run: npm run ci:design-tokens -- --write-baseline");
      process.exit(2);
    }
    if (summary.total > baseline.total) {
      console.error(
        `\n✗ Design-token regression: ${summary.total} issue-categories vs baseline ${baseline.total}\n`,
      );
      for (const r of results) {
        const baseCount = baseline.byFile[r.file] ?? 0;
        if (r.issues.length > baseCount) {
          console.error(`- ${r.file} (${r.issues.length}, baseline ${baseCount})`);
          for (const issue of r.issues) console.error(`  - ${issue}`);
        }
      }
      console.error(
        "\nUse the locked ladder / design tokens (DESIGN_DIRECTIVES.md). If a NEW file legitimately needs an exception, add it to .design-token-lint-ignore.",
      );
      process.exit(1);
    }
    if (summary.total < baseline.total) {
      console.log(
        `✓ Design tokens improved: ${summary.total} vs baseline ${baseline.total} (−${baseline.total - summary.total}). Run --write-baseline to ratchet down.`,
      );
    } else {
      console.log(`✓ Design tokens stable: ${summary.total} issue-categories (= baseline).`);
    }
    return;
  }

  // ── Default / --all / --base-diff (local dev feedback) ─────────────
  if (!files.length) {
    console.log("Design-token guardrails skipped (no relevant changed files).");
    return;
  }
  if (!results.length) {
    console.log("Design-token guardrails passed.");
    return;
  }

  console.error("\nDesign-token guardrails failed:\n");
  for (const result of results) {
    console.error(`- ${result.file}`);
    for (const issue of result.issues) {
      console.error(`  - ${issue}`);
    }
  }
  console.error(`\nFound issues in ${results.length} file(s).\n`);
  process.exit(1);
}

run();
