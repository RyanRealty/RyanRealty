#!/usr/bin/env node
/**
 * check-tests-wired.mjs — ci:tests-wired (G78). Every test file runs somewhere.
 *
 * A test file no runner picks up is worse than no test: it reads as coverage in
 * review, in the diff, and in the file tree, and it never runs in the
 * pre-commit hook, in CI, or anywhere else. Founding case 2026-09-24: 18 vitest
 * files matched no project include (components/motion/**, the .tsx tests under
 * app/**\/_v3 and components/site/**, app/<route>/page.test.ts files, data/**),
 * and one of them, app/about/_v3/about-playbook.test.tsx, had been failing
 * since the commit that wrote it.
 *
 * Rules:
 *   R1  Every test file (`*.{test,spec}.{js,jsx,ts,tsx,mjs,cjs,mts,cts}`, git
 *       tracked or untracked-but-not-ignored) is run by one of:
 *         - a vitest project. The oracle is vitest itself
 *           (`vitest list --filesOnly --json`), never a re-implementation of
 *           its glob and `extends` semantics;
 *         - Playwright: the file sits under playwright.config.ts `testDir`;
 *         - a node runner: a package.json script whose command names the file
 *           and which is itself wired (in `ci:gates:chain`, scripts/ci-lanes.json,
 *           or invoked as `npm run <name>` by a workflow or husky hook).
 *   R2  No test file runs in two vitest projects. With `extends: true` a
 *       project's `include` is CONCATENATED onto the root config's, so a root
 *       `include` silently put every unit test into the int project too (1,283
 *       files, run serially, until 2026-09-24).
 *
 * Usage:
 *   node scripts/check-tests-wired.mjs            # check (exit 1 on a violation)
 *   node scripts/check-tests-wired.mjs --report   # print, always exit 0
 *   node scripts/check-tests-wired.mjs --json     # machine-readable result
 *
 * Runs against process.cwd(), so the break-tests point it at a sandbox tree.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectLaneGates, parseChainGateNames } from './check-gates-wired.mjs'

/** Vitest's own default include shape: `**\/*.{test,spec}.?(c|m)[jt]s?(x)`. */
export const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/

/** Never scanned, whatever .gitignore says. */
const NEVER_SCANNED = ['node_modules/', '.next/', '.claude/worktrees/', '.git/']

const toPosix = (p) => p.split(sep).join('/')

/** Test files in the tree: tracked plus untracked-but-not-ignored, still on disk. */
export function listTestFiles(root) {
  const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  if (r.status !== 0) {
    throw new Error(`git ls-files failed in ${root}: ${(r.stderr || r.error?.message || '').trim()}`)
  }
  const seen = new Set()
  for (const f of r.stdout.split('\0')) {
    if (!f || !TEST_FILE.test(f)) continue
    if (NEVER_SCANNED.some((p) => f.startsWith(p) || f.includes(`/${p}`))) continue
    if (!existsSync(join(root, f))) continue // deleted in the worktree, not yet staged
    seen.add(f)
  }
  return [...seen].sort()
}

/**
 * Every (file, project) pair vitest would run, from vitest itself. Returns
 * [{ file: <root-relative posix path>, project: <name> }].
 */
export function vitestProjectFiles(root) {
  const bin = join(root, 'node_modules', 'vitest', 'vitest.mjs')
  if (!existsSync(bin)) throw new Error(`${bin} not found. Run \`npm ci\` first.`)
  const dir = mkdtempSync(join(tmpdir(), 'rr-tests-wired-'))
  const out = join(dir, 'list.json')
  try {
    // A vitest worker running the break-tests exports VITEST_* into this
    // process; a nested vitest must not inherit them.
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('VITEST')))
    const r = spawnSync(process.execPath, [bin, 'list', '--filesOnly', `--json=${out}`], {
      cwd: root,
      encoding: 'utf8',
      env,
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    })
    if (r.status !== 0 || !existsSync(out)) {
      throw new Error(
        `\`vitest list --filesOnly\` exited ${r.status ?? r.signal}:\n${`${r.stdout ?? ''}${r.stderr ?? ''}`.trim()}`,
      )
    }
    const realRoot = realpathSync(root)
    return JSON.parse(readFileSync(out, 'utf8')).map((e) => ({
      file: toPosix(relative(realRoot, realpathSync(e.file))),
      project: e.projectName || '(root)',
    }))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Playwright's testDir, root-relative with a trailing slash, or null when there
 * is no playwright config. A config without a literal testDir is an error: the
 * default is the config's own directory, which would claim every test file.
 */
export function playwrightTestDir(root) {
  const cfg = ['playwright.config.ts', 'playwright.config.mts', 'playwright.config.js', 'playwright.config.mjs'].find(
    (f) => existsSync(join(root, f)),
  )
  if (!cfg) return null
  const m = readFileSync(join(root, cfg), 'utf8').match(/\btestDir\s*:\s*['"`]([^'"`]+)['"`]/)
  if (!m) throw new Error(`${cfg} declares no literal testDir, so this gate cannot tell which files Playwright owns.`)
  const dir = toPosix(relative(root, resolve(root, m[1])))
  if (!dir || dir.startsWith('..')) throw new Error(`${cfg} testDir "${m[1]}" is not a subdirectory of the repo.`)
  return `${dir}/`
}

/** npm script names that run automatically (chain, lanes, workflows, husky). */
export function wiredScriptNames({ scripts, lanes, hookText }) {
  const wired = new Set(parseChainGateNames(scripts['ci:gates:chain'] ?? ''))
  for (const g of collectLaneGates(lanes)) wired.add(g)
  for (const m of String(hookText).matchAll(/\bnpm\s+run(?:\s+-{1,2}[\w-]+)*\s+([\w:.-]+)/g)) wired.add(m[1])
  if (/\bnpm\s+test(?![\w:.-])/.test(hookText)) wired.add('test')
  return wired
}

/** Test files a wired npm script runs directly: { file -> script name }. */
export function nodeRunTestFiles({ scripts, wired }) {
  const runs = new Map()
  for (const [name, cmd] of Object.entries(scripts)) {
    if (!wired.has(name)) continue
    for (const raw of String(cmd).split(/\s+/)) {
      const tok = raw.replace(/^['"]|['"]$/g, '').replace(/^\.\//, '')
      if (TEST_FILE.test(tok) && !runs.has(tok)) runs.set(tok, name)
    }
  }
  return runs
}

/**
 * Pure verdict. `entries` is vitestProjectFiles() output, `nodeRuns` is
 * nodeRunTestFiles() output, `playwrightDir` is playwrightTestDir() output.
 */
export function classifyTestFiles({ testFiles, entries, playwrightDir = null, nodeRuns = new Map() }) {
  const projectsOf = new Map()
  for (const { file, project } of entries) {
    if (!projectsOf.has(file)) projectsOf.set(file, [])
    projectsOf.get(file).push(project)
  }
  const byRunner = { vitest: {}, playwright: 0, node: {} }
  const orphans = []
  const multiProject = []
  for (const f of testFiles) {
    const projects = projectsOf.get(f)
    if (projects) {
      const unique = [...new Set(projects)].sort()
      if (unique.length > 1) multiProject.push({ file: f, projects: unique })
      for (const p of unique) byRunner.vitest[p] = (byRunner.vitest[p] ?? 0) + 1
    } else if (playwrightDir && f.startsWith(playwrightDir)) {
      byRunner.playwright++
    } else if (nodeRuns.has(f)) {
      const s = nodeRuns.get(f)
      byRunner.node[s] = (byRunner.node[s] ?? 0) + 1
    } else {
      orphans.push(f)
    }
  }
  return { total: testFiles.length, byRunner, orphans, multiProject, failed: orphans.length > 0 || multiProject.length > 0 }
}

function readDirText(dir, keep) {
  let text = ''
  try {
    for (const f of readdirSync(dir)) {
      if (keep && !keep(f)) continue
      try {
        text += `\n${readFileSync(join(dir, f), 'utf8')}`
      } catch {
        /* a subdirectory */
      }
    }
  } catch {
    /* no such dir */
  }
  return text
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** Gather every input from `root` and return the verdict. */
export function evaluateTestsWired(root = process.cwd()) {
  const scripts = readJson(join(root, 'package.json'), {}).scripts ?? {}
  const lanes = readJson(join(root, 'scripts/ci-lanes.json'), null)
  const hookText =
    readDirText(join(root, '.github/workflows'), (f) => /\.ya?ml$/.test(f)) + readDirText(join(root, '.husky'))
  const nodeRuns = nodeRunTestFiles({ scripts, wired: wiredScriptNames({ scripts, lanes, hookText }) })
  return classifyTestFiles({
    testFiles: listTestFiles(root),
    entries: vitestProjectFiles(root),
    playwrightDir: playwrightTestDir(root),
    nodeRuns,
  })
}

function main() {
  const REPORT = process.argv.includes('--report')
  const JSON_OUT = process.argv.includes('--json')
  let result
  try {
    result = evaluateTestsWired(process.cwd())
  } catch (err) {
    console.error(`ci:tests-wired could not measure: ${err.message}`)
    process.exit(REPORT ? 0 : 1)
  }
  if (JSON_OUT) {
    console.log(JSON.stringify(result, null, 2))
    process.exit(result.failed && !REPORT ? 1 : 0)
  }

  console.log('Tests-wired gate (ci:tests-wired, G78)')
  console.log('======================================')
  const vitest = Object.entries(result.byRunner.vitest)
    .map(([p, n]) => `${p} ${n}`)
    .join(', ')
  const node = Object.entries(result.byRunner.node)
    .map(([s, n]) => `${s} ${n}`)
    .join(', ')
  console.log(
    `${result.total} test files · vitest (${vitest || 'none'}) · playwright ${result.byRunner.playwright} · node (${node || 'none'})`,
  )
  if (result.orphans.length) {
    console.error(`\nR1: ${result.orphans.length} test file(s) that NO runner picks up (they never run):`)
    for (const f of result.orphans) console.error(`  ✗ ${f}`)
    console.error(
      '  Widen the owning project\'s `include` in vitest.config.ts (or move the file under one), put a Playwright spec under its testDir, or run a node-script test from a wired ci:* npm script.',
    )
  }
  if (result.multiProject.length) {
    console.error(`\nR2: ${result.multiProject.length} test file(s) run by more than one vitest project:`)
    for (const { file, projects } of result.multiProject.slice(0, 25)) console.error(`  ✗ ${file} (${projects.join(' + ')})`)
    if (result.multiProject.length > 25) console.error(`  … and ${result.multiProject.length - 25} more`)
    console.error(
      '  Give each project its own `include` and keep none at the root: `extends: true` concatenates a root include onto every project\'s.',
    )
  }
  if (result.failed) {
    if (REPORT) process.exit(0)
    console.error('\nci:tests-wired FAILED.')
    process.exit(1)
  }
  console.log('Every test file runs in exactly one place.')
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()
if (invokedDirectly) main()
