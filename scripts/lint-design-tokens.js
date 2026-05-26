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
