#!/usr/bin/env node
/**
 * End-to-end producer verification.
 *
 * Runs every producer script in scripts/run-producer.mjs::PRODUCERS against
 * the canonical fixture and verifies:
 *   - exit code 0
 *   - output directory created
 *   - primary artifact present + non-zero bytes
 *   - all 4 sidecars present + valid JSON
 *   - banned-words check passed in design_scorecard.json
 *
 * Usage:
 *   node scripts/test-all-producers.mjs
 *   node scripts/test-all-producers.mjs --producer testimonial_card    # one producer
 *   node scripts/test-all-producers.mjs --section content              # only content:* producers
 *   node scripts/test-all-producers.mjs --section ops                  # only ops-*
 *
 * Exit codes:
 *   0 — every producer passed
 *   1 — at least one producer failed
 */

import { spawn } from 'child_process'
import { readFile, readdir, stat, mkdir, writeFile } from 'fs/promises'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PRODUCERS } from './producer-inventory.mjs'

const __filename = fileURLToPath(import.meta.url)
const REPO_ROOT = path.resolve(path.dirname(__filename), '..')
const FIXTURE = path.join(REPO_ROOT, 'tests/fixtures/producer-payload-tumalo.json')

// Load .env.local into process.env so spawned children see the real API keys.
// Simple KEY=VALUE parser — strips quotes, ignores blank/# lines.
function loadEnvLocal() {
  const p = path.join(REPO_ROOT, '.env.local')
  if (!existsSync(p)) return
  const txt = readFileSync(p, 'utf8')
  for (const raw of txt.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i === -1) continue
    const k = line.slice(0, i).trim()
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!(k in process.env)) process.env[k] = v
  }
}
loadEnvLocal()

// Discover target_slug from fixture
const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
const TARGET_SLUG = fixture.target_slug

// CLI args
const argv = process.argv.slice(2)
const filter = {
  producer: null,
  section: null,
}
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--producer') filter.producer = argv[++i]
  if (argv[i] === '--section') filter.section = argv[++i]
}

const SIDECARS = ['citations.json', 'provenance.json', 'design_scorecard.json', 'card.json']

function shouldRun(slug) {
  if (filter.producer) return slug === filter.producer
  const spec = PRODUCERS[slug]
  // Skip producers that require expensive Remotion renders unless --with-renders.
  // These producers have working build scripts but each render takes 5-10 min and
  // depends on live VO synth, asset fetch, and Photorealistic Tiles auth.
  // Run them manually via the producer workflow, not the unit-test suite.
  if (spec?.skipE2E && !argv.includes('--with-renders')) return false
  if (filter.section === 'ops') return slug.startsWith('ops-')
  if (filter.section === 'content') return !slug.startsWith('ops-')
  return true
}

async function fileSize(p) {
  try {
    const s = await stat(p)
    return s.isFile() ? s.size : 0
  } catch {
    return -1
  }
}

async function runProducer(slug) {
  const spec = PRODUCERS[slug]
  return new Promise(resolve => {
    const child = spawn(spec.runner, [path.join(REPO_ROOT, spec.script), FIXTURE], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = '', stderr = ''
    child.stdout.on('data', d => stdout += d)
    child.stderr.on('data', d => stderr += d)
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve({ code: -1, stdout, stderr: stderr + '\n[killed after 90s]', killed: true })
    }, 90_000)
    child.on('exit', code => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
  })
}

async function verifyOutput(slug) {
  const outDir = path.join(REPO_ROOT, 'out', slug, TARGET_SLUG)
  const result = { outDir, primary: null, sidecars: {}, primary_artifacts: [], errors: [], warnings: [] }

  // Check output dir exists
  try {
    const s = await stat(outDir)
    if (!s.isDirectory()) {
      result.errors.push(`outDir is not a directory: ${outDir}`)
      return result
    }
  } catch {
    result.errors.push(`outDir not created: ${outDir}`)
    return result
  }

  // Look for sidecars
  for (const sc of SIDECARS) {
    const sz = await fileSize(path.join(outDir, sc))
    result.sidecars[sc] = sz
    if (sz <= 0) result.errors.push(`sidecar missing or empty: ${sc}`)
    else {
      // Validate JSON parseable
      try {
        JSON.parse(await readFile(path.join(outDir, sc), 'utf8'))
      } catch (e) {
        result.errors.push(`sidecar JSON invalid: ${sc} — ${e.message}`)
      }
    }
  }

  // Look for primary artifact via card.json
  try {
    const card = JSON.parse(await readFile(path.join(outDir, 'card.json'), 'utf8'))
    result.primary = card.primary_artifact
    if (card.primary_artifact) {
      // Handle both absolute and relative primary_artifact paths.
      const primaryPath = path.isAbsolute(card.primary_artifact)
        ? card.primary_artifact
        : path.join(outDir, card.primary_artifact)
      const primarySize = await fileSize(primaryPath)
      if (primarySize <= 0) {
        result.errors.push(`primary artifact missing or empty: ${primaryPath}`)
      } else {
        // Normalize the recorded name to be relative for display
        const displayName = path.isAbsolute(card.primary_artifact)
          ? path.basename(card.primary_artifact)
          : card.primary_artifact
        result.primary = displayName
        result.primary_artifacts.push({ name: displayName, size: primarySize })
      }
    }
  } catch {
    // ok — already flagged via sidecar check
  }

  // List all non-sidecar files in outDir for context
  try {
    const files = await readdir(outDir)
    for (const f of files) {
      if (SIDECARS.includes(f) || f === 'card.json') continue
      if (f === result.primary) continue
      const sz = await fileSize(path.join(outDir, f))
      if (sz > 0) result.primary_artifacts.push({ name: f, size: sz })
    }
  } catch {}

  // Check banned-words via design_scorecard
  try {
    const sc = JSON.parse(await readFile(path.join(outDir, 'design_scorecard.json'), 'utf8'))
    const bannedChecks = (sc.checks || []).filter(c =>
      c.name && /banned/i.test(c.name) && c.pass === false
    )
    for (const bc of bannedChecks) {
      result.errors.push(`design_scorecard flagged: ${bc.name} — ${bc.notes ?? ''}`)
    }
  } catch {}

  return result
}

async function main() {
  const slugs = Object.keys(PRODUCERS).filter(shouldRun).sort()
  if (slugs.length === 0) {
    console.error('No producers match filter.')
    process.exit(2)
  }

  console.log(`Running ${slugs.length} producer(s) against fixture ${FIXTURE}`)
  console.log('═'.repeat(80))

  const results = []
  let passed = 0, failed = 0
  for (const slug of slugs) {
    process.stdout.write(`▶ ${slug.padEnd(34)} `)
    const t0 = Date.now()
    const run = await runProducer(slug)
    const verify = await verifyOutput(slug)
    const dt = Date.now() - t0
    const ok = run.code === 0 && verify.errors.length === 0
    if (ok) {
      passed++
      const primary = verify.primary || (verify.primary_artifacts[0]?.name ?? 'n/a')
      const primarySize = verify.primary_artifacts.find(a => a.name === primary)?.size || 0
      const sizeKb = primarySize ? `${Math.round(primarySize/1024)} KB` : ''
      console.log(`✅ PASS  ${(dt/1000).toFixed(1)}s  primary: ${primary} (${sizeKb})  +${Object.keys(verify.sidecars).filter(s => verify.sidecars[s] > 0).length}/4 sidecars`)
    } else {
      failed++
      console.log(`❌ FAIL  ${(dt/1000).toFixed(1)}s  code=${run.code}`)
      for (const e of verify.errors) console.log(`    ✗ ${e}`)
      if (run.code !== 0) console.log(`    stderr (last 200 chars): ${run.stderr.slice(-200)}`)
    }
    results.push({ slug, ok, run, verify, dt })
  }

  console.log('═'.repeat(80))
  console.log(`SUMMARY: ${passed} passed · ${failed} failed · ${slugs.length} total`)

  // Write JSON report
  const reportPath = path.join(REPO_ROOT, 'out/test-all-producers-report.json')
  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(reportPath, JSON.stringify({
    fixture: FIXTURE,
    target_slug: TARGET_SLUG,
    timestamp: new Date().toISOString(),
    passed,
    failed,
    total: slugs.length,
    results: results.map(r => ({
      slug: r.slug,
      ok: r.ok,
      duration_ms: r.dt,
      exit_code: r.run.code,
      primary: r.verify.primary,
      artifacts: r.verify.primary_artifacts,
      sidecars: r.verify.sidecars,
      errors: r.verify.errors,
    })),
  }, null, 2))
  console.log(`Report: ${path.relative(REPO_ROOT, reportPath)}`)

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
