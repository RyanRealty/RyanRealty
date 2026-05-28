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
  "components/site/",
  "_style_backup/",
  "app/globals.css",
  "scripts/",
];
const IGNORE_FILE = ".design-token-lint-ignore";

const DISALLOWED_CLASSES = /\b(card-base|btn-cta)\b/g;
const DISALLOWED_COLOR_CLASSES =
  /\b(?:bg|text|border|from|to|via)-(?:white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{1,3})?(?:\/\d{1,3})?\b/g;
const DISALLOWED_HEX = /#[0-9a-fA-F]{3,8}\b/g;
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

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function isExcludedPath(relativePath) {
  const normalized = normalizePath(relativePath);
  return EXCLUDED_PATHS.some((excluded) => normalized.includes(excluded));
}

function loadIgnoredFiles() {
  const ignorePath = path.join(ROOT, IGNORE_FILE);
  if (!fs.existsSync(ignorePath)) return new Set();

  const raw = fs.readFileSync(ignorePath, "utf8");
  const entries = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => normalizePath(line));

  return new Set(entries);
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

  if (!issues.length) return null;
  return { file: relative, issues };
}

function run() {
  const runAll = process.argv.includes("--all");
  const useBaseDiff = process.argv.includes("--base-diff");
  const ignoredFiles = loadIgnoredFiles();
  const candidateFiles = runAll
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

  if (!files.length) {
    console.log("Design-token guardrails skipped (no relevant changed files).");
    return;
  }

  const results = files.map(lintFile).filter(Boolean);

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
