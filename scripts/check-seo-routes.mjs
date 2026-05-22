import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const TARGET_DIRS = ['app', 'components', 'lib']
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx'])

// Allow-list patterns that apply to EVERY rule. Files that match are
// scanned but rule violations are ignored. Use for paths where legacy
// URL strings appear by design — analytics correlation, archival
// references in JSDoc, internal admin tooling, out-of-scope subsystems.
const GLOBAL_ALLOW_PATHS = [
  // Out of scope per /goal — marketing brain pipeline. Has lots of
  // legacy URL references in prompt examples, audit scripts, brief
  // generators. Excluded so the public-LP gate isn't polluted.
  /^lib[\\/]marketing-brain[\\/]/,
  // Internal admin tooling — analytics pages READ legacy paths from
  // production data to correlate clicks. Those strings reference what
  // users actually clicked historically; they're not WRITING new URLs.
  /^app[\\/]admin[\\/]\(protected\)[\\/]/,
  // Cron routes that generate emails / digests with embedded analytics
  // references to legacy paths (same correlation reason).
  /^app[\\/]api[\\/]cron[\\/]/,
  // Test fixtures often mock upstream API shapes (e.g. Spark's
  // ResourceUri='/listings/<key>') that aren't user-facing routes.
  /\.test\.(ts|tsx|js|jsx)$/,
  // Lib files that document legacy URLs in JSDoc for historical context
  // (e.g. lib/cma-delivery.ts mentions the old /home-valuation path).
  // Inline-comment legacy mentions are acceptable.
  /^lib[\\/]cma-delivery\.ts$/,
]

const RULES = [
  {
    id: 'legacy-listings-path',
    pattern: /(['"`])\/listings(\b|[/?`'"])/g,
    message: 'Use canonical listings browse path `/homes-for-sale` (via `listingsBrowsePath()`).',
    allowPaths: [
      /^app[\\/]+listings[\\/]/,
      /^app[\\/]admin[\\/].*[\\/]listings[\\/]/,
    ],
  },
  {
    id: 'legacy-agents-path',
    pattern: /(['"`])\/agents(\b|[/?`'"])/g,
    message: 'Use canonical team path `/team` (via `teamPath()`).',
    allowPaths: [
      /^app[\\/]+agents[\\/]/,
    ],
  },
  {
    id: 'legacy-home-valuation-path',
    pattern: /(['"`])\/home-valuation(\b|[/?`'"])/g,
    message: 'Use canonical valuation path `/sell/valuation` (via `valuationPath()`).',
    allowPaths: [
      /^app[\\/]+home-valuation[\\/]/,
    ],
  },
]

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
      continue
    }
    if (EXTENSIONS.has(path.extname(entry.name))) out.push(full)
  }
}

function toRel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/')
}

function normalizeForRule(relPath) {
  return relPath.replace(/\//g, path.sep)
}

const files = []
for (const dir of TARGET_DIRS) {
  const full = path.join(ROOT, dir)
  if (fs.existsSync(full)) walk(full, files)
}

const failures = []

for (const file of files) {
  const rel = toRel(file)
  const relForRule = normalizeForRule(rel)
  const content = fs.readFileSync(file, 'utf8')

  if (GLOBAL_ALLOW_PATHS.some((allow) => allow.test(relForRule))) continue

  for (const rule of RULES) {
    if (rule.allowPaths.some((allow) => allow.test(relForRule))) continue
    rule.pattern.lastIndex = 0
    let match
    while ((match = rule.pattern.exec(content)) != null) {
      const line = content.slice(0, match.index).split('\n').length
      failures.push({
        rel,
        line,
        ruleId: rule.id,
        message: rule.message,
      })
    }
  }
}

if (failures.length > 0) {
  console.error('SEO route guardrails failed:\n')
  for (const failure of failures) {
    console.error(`- ${failure.rel}:${failure.line} [${failure.ruleId}] ${failure.message}`)
  }
  console.error('\nUpdate links to canonical helpers before merging.')
  process.exit(1)
}

console.log('SEO route guardrails passed.')
