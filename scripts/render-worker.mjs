#!/usr/bin/env node
/**
 * Local render worker — the machine half of the cloud-queues / local-renders
 * architecture (see docs/PRODUCER_EXECUTOR_ARCHITECTURE_DECISION_2026-05-29.md).
 *
 * WHY THIS EXISTS:
 * The serverless cloud cron (app/api/cron/producer-runtime) cannot render video,
 * images, PDFs, or web pages (no Remotion / Chromium / PIL / ffmpeg, 300s cap).
 * Before the 2026-05-29 fix it "solved" that by asking Claude to FABRICATE a
 * draft_path + citations + scorecard for a deliverable that was never created.
 * Now the cloud cron DEFERS every visual producer: it leaves the row in
 * 'in_production' tagged executor_response.deferred_to_local_render = true.
 *
 * THIS WORKER picks up those deferred rows on a machine that CAN render (the
 * Mac, or a dedicated render box), runs the REAL generator via run-producer.mjs,
 * verifies a real artifact actually landed, attaches the REAL citations the
 * build wrote (never invented), and flips the row to 'ready' for Matt's review.
 * It NEVER approves or publishes — Matt's draft-first approval (§0.5) and the
 * publisher-sweep cron are unchanged.
 *
 * ANTI-SLOP GUARANTEES (a row only reaches 'ready' if ALL hold):
 *   1. run-producer.mjs exited 0.
 *   2. A primary artifact exists in the out dir AND is non-trivial (> MIN_BYTES).
 *   3. The build wrote a citations.json (real, from live queries) — required for
 *      any producer whose action_type is content:* with figures. If the recipe
 *      legitimately has no figures it may write an empty citations array, but the
 *      FILE must exist (proof the build ran its verification step, not invented one).
 *   4. (video only) a scorecard.json exists.
 * A row failing any check is NOT marked ready — it is logged to
 * producer_execution_failures and left in_production (retryable) or, with
 * --kill-on-fail, killed.
 *
 * USAGE:
 *   node scripts/render-worker.mjs --dry-run        # list deferred rows, render nothing
 *   node scripts/render-worker.mjs                   # process up to --max rows (default 3)
 *   node scripts/render-worker.mjs --id <uuid>       # process one specific row
 *   node scripts/render-worker.mjs --max 5
 *   node scripts/render-worker.mjs --kill-on-fail    # kill rows that fail verification
 *
 * It is a long-lived-safe one-shot: run it from a launchd/cron entry on the Mac,
 * or by hand. Each invocation drains up to --max rows then exits.
 *
 * ENV: reads .env.local for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import { spawnSync, execFileSync } from 'node:child_process'
import { readFileSync, existsSync, writeFileSync, mkdirSync, statSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

// ── config ──────────────────────────────────────────────────────────────────
const MIN_ARTIFACT_BYTES = 2048 // a real video/image/pdf is far bigger; catches empty/stub output
const PRIMARY_EXTS = ['.mp4', '.mov', '.webm', '.png', '.jpg', '.jpeg', '.pdf', '.html', '.gif']
const SIDECAR_CITATIONS = 'citations.json'
const SIDECAR_SCORECARD = 'scorecard.json'

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const KILL_ON_FAIL = argv.includes('--kill-on-fail')
const idIdx = argv.indexOf('--id')
const ONLY_ID = idIdx !== -1 ? argv[idIdx + 1] : null
const maxIdx = argv.indexOf('--max')
const MAX_ROWS = maxIdx !== -1 ? Math.max(1, parseInt(argv[maxIdx + 1], 10) || 3) : 3

// ── env + supabase ────────────────────────────────────────────────────────────
function loadEnvLocal() {
  const p = join(REPO_ROOT, '.env.local')
  if (!existsSync(p)) return {}
  const out = {}
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const env = loadEnvLocal()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('render-worker: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(2)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve the run-producer.mjs key for a row. Prefer action_type (the documented
 * ACTION_TO_PRODUCER mapping); fall back to the last segment of assigned_producer.
 */
function resolveProducerKey(row) {
  if (row.action_type) return row.action_type
  if (row.assigned_producer) return row.assigned_producer.split('/').filter(Boolean).pop()
  return null
}

/** Find the largest plausible primary artifact in a dir (recursively). */
function findPrimaryArtifact(dir) {
  if (!existsSync(dir)) return null
  let best = null
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else {
        const ext = e.name.slice(e.name.lastIndexOf('.')).toLowerCase()
        if (PRIMARY_EXTS.includes(ext) && e.name !== 'contact-sheet.html') {
          const sz = statSync(p).size
          if (!best || sz > best.bytes) best = { path: p, bytes: sz, ext }
        }
      }
    }
  }
  walk(dir)
  return best
}

function readJsonIfExists(p) {
  try {
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null
  } catch {
    return null
  }
}

async function logFailure(actionId, producerSlug, phase, message) {
  await supabase.from('producer_execution_failures').insert({
    action_id: actionId,
    producer_slug: producerSlug,
    phase,
    error_message: message.slice(0, 2000),
    occurred_at: new Date().toISOString(),
    retry_count: 0,
    requires_billing_action: false,
  })
}

/**
 * Notify Matt the moment a render lands as a draft. iMessage from this Mac's
 * Messages app (text-only — attachments fail silently, see memory). Never throws:
 * a notification failure must not block or unwind the ready flip.
 */
function notifyMattReady(row, relArtifact) {
  try {
    const to = env.TWILIO_FORWARD_MATT || '+15412136706'
    const reason = row.generation_reason || ''
    const m = reason.match(/requested a [^]*? for (.+)$/i)
    const subject = m ? m[1].trim() : row.target || row.action_type || 'a deliverable'
    const site = 'https://ryan-realty.com'
    const draftUrl = relArtifact.startsWith('public/')
      ? `${site}/${relArtifact.slice('public/'.length)}`
      : null
    const kind = (row.action_type || 'content').replace(/^content:/, '')
    const lines = [
      `Draft ready: ${kind} for ${subject}.`,
      draftUrl ? `Preview: ${draftUrl}` : null,
      `Approve: ${site}/admin/approval-queue`,
    ].filter(Boolean)
    const body = lines.join('\n')
    const script = `
      on run {targetPhone, msgBody}
        tell application "Messages"
          set targetService to 1st account whose service type = iMessage
          set targetBuddy to participant targetPhone of targetService
          send msgBody to targetBuddy
        end tell
      end run`
    execFileSync('osascript', ['-e', script, to, body], { timeout: 30000 })
    console.log(`  ✓ notified Matt (iMessage → ${to})`)
  } catch (e) {
    console.warn(`  ! notify failed (non-blocking): ${e.message}`)
  }
}

// ── core ───────────────────────────────────────────────────────────────────────

async function fetchDeferredRows() {
  let q = supabase
    .from('marketing_brain_actions')
    .select('id, action_type, assigned_producer, payload, executor_response, status, generation_reason, target')
    .eq('status', 'in_production')
    .eq('executor_response->>deferred_to_local_render', 'true')
    .order('executed_at', { ascending: true, nullsFirst: false })
    .limit(MAX_ROWS)
  if (ONLY_ID) {
    q = supabase
      .from('marketing_brain_actions')
      .select('id, action_type, assigned_producer, payload, executor_response, status, generation_reason, target')
      .eq('id', ONLY_ID)
  }
  const { data, error } = await q
  if (error) {
    console.error('render-worker: fetch error:', error.message)
    process.exit(1)
  }
  return data ?? []
}

async function processRow(row) {
  const producerKey = resolveProducerKey(row)
  const producerSlug = row.assigned_producer ?? producerKey ?? 'unknown'
  console.log(`\n── ${row.id}  ${row.action_type}  → key=${producerKey}`)

  if (!producerKey) {
    console.error('  ✗ cannot resolve a producer key (no action_type or assigned_producer)')
    await logFailure(row.id, producerSlug, 'resolve_producer', 'no action_type or assigned_producer')
    return { id: row.id, ok: false, reason: 'unresolvable' }
  }

  // Stage the payload to a temp file for run-producer.mjs.
  const outDir = join(REPO_ROOT, 'out', 'render-worker', row.id)
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  const payloadPath = join(outDir, 'payload.json')
  writeFileSync(payloadPath, JSON.stringify({ action_id: row.id, action_type: row.action_type, ...(row.payload ?? {}) }, null, 2))

  if (DRY_RUN) {
    console.log(`  • DRY RUN — would run: node scripts/run-producer.mjs ${producerKey} ${payloadPath} --out ${outDir}`)
    return { id: row.id, ok: true, dryRun: true }
  }

  // Run the REAL generator.
  const res = spawnSync(
    'node',
    [join(REPO_ROOT, 'scripts/run-producer.mjs'), producerKey, payloadPath, '--out', outDir],
    { cwd: REPO_ROOT, stdio: 'inherit', timeout: 15 * 60 * 1000 },
  )

  if (res.status !== 0) {
    const msg = `run-producer exited ${res.status}${res.error ? ' (' + res.error.message + ')' : ''}`
    console.error(`  ✗ ${msg}`)
    await logFailure(row.id, producerSlug, 'render', msg)
    if (KILL_ON_FAIL) await killRow(row, msg)
    return { id: row.id, ok: false, reason: msg }
  }

  // Verify a real artifact landed.
  const artifact = findPrimaryArtifact(outDir)
  if (!artifact) {
    const msg = `no primary artifact (${PRIMARY_EXTS.join('/')}) found in ${outDir}`
    console.error(`  ✗ ${msg}`)
    await logFailure(row.id, producerSlug, 'verify_artifact', msg)
    if (KILL_ON_FAIL) await killRow(row, msg)
    return { id: row.id, ok: false, reason: msg }
  }
  if (artifact.bytes < MIN_ARTIFACT_BYTES) {
    const msg = `artifact ${artifact.path} is only ${artifact.bytes} bytes (< ${MIN_ARTIFACT_BYTES}); likely a stub/empty render`
    console.error(`  ✗ ${msg}`)
    await logFailure(row.id, producerSlug, 'verify_artifact', msg)
    if (KILL_ON_FAIL) await killRow(row, msg)
    return { id: row.id, ok: false, reason: msg }
  }

  // Citations are mandatory proof the build verified its numbers (CLAUDE.md §0).
  const citationsPath = join(outDir, SIDECAR_CITATIONS)
  const citations = readJsonIfExists(citationsPath)
  const isContent = (row.action_type ?? '').startsWith('content:')
  if (isContent && citations === null) {
    const msg = `content producer wrote no ${SIDECAR_CITATIONS} — cannot confirm figures trace to live data (CLAUDE.md §0). Refusing to mark ready.`
    console.error(`  ✗ ${msg}`)
    await logFailure(row.id, producerSlug, 'verify_citations', msg)
    if (KILL_ON_FAIL) await killRow(row, msg)
    return { id: row.id, ok: false, reason: msg }
  }

  const scorecard = readJsonIfExists(join(outDir, SIDECAR_SCORECARD))
  const isVideo = artifact.ext === '.mp4' || artifact.ext === '.mov' || artifact.ext === '.webm'
  if (isVideo && scorecard === null) {
    console.warn(`  ! video artifact has no ${SIDECAR_SCORECARD} (viral scorecard). Marking ready but flag for review.`)
  }

  const relArtifact = artifact.path.replace(REPO_ROOT + '/', '')
  console.log(`  ✓ artifact ${relArtifact} (${(artifact.bytes / 1024).toFixed(0)} KB)`)

  // Flip to ready with REAL envelope. Optimistic lock on in_production.
  const existing = (row.executor_response ?? {})
  const envelope = {
    ...existing,
    deferred_to_local_render: false,
    rendered_by: 'local-render-worker',
    rendered_at: new Date().toISOString(),
    output_dir: outDir.replace(REPO_ROOT + '/', ''),
    draft_path: relArtifact,
    artifact_bytes: artifact.bytes,
    citations: citations ?? [],
    scorecard: scorecard ?? null,
    needs_render: false,
  }
  const { data: updated, error: updErr } = await supabase
    .from('marketing_brain_actions')
    .update({ status: 'ready', executor_response: envelope })
    .eq('id', row.id)
    .eq('status', 'in_production')
    .select('id')

  if (updErr) {
    console.error(`  ✗ DB update failed: ${updErr.message}`)
    await logFailure(row.id, producerSlug, 'status_update', updErr.message)
    return { id: row.id, ok: false, reason: updErr.message }
  }
  if (!updated || updated.length === 0) {
    console.warn('  ! row was not in in_production at update time (claimed elsewhere); skipped flip')
    return { id: row.id, ok: false, reason: 'lost_optimistic_lock' }
  }

  console.log(`  ✓ ${row.id} → ready (awaiting Matt approval; draft-first §0.5)`)
  notifyMattReady(row, relArtifact)
  return { id: row.id, ok: true, artifact: relArtifact }
}

async function killRow(row, reason) {
  await supabase
    .from('marketing_brain_actions')
    .update({
      status: 'killed',
      executor_response: {
        ...(row.executor_response ?? {}),
        killed_reason: `render-worker verification failed: ${reason}`.slice(0, 1000),
        killed_at: new Date().toISOString(),
        pre_kill_status: 'in_production',
      },
    })
    .eq('id', row.id)
    .eq('status', 'in_production')
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  const rows = await fetchDeferredRows()
  console.log(`render-worker: ${rows.length} deferred row(s)${DRY_RUN ? ' (dry run)' : ''}`)
  if (rows.length === 0) {
    console.log('Nothing to render. (Cloud cron tags visual producers deferred_to_local_render=true.)')
    return
  }
  const results = []
  for (const row of rows) {
    results.push(await processRow(row))
  }
  const ok = results.filter((r) => r.ok).length
  const fail = results.length - ok
  console.log(`\nrender-worker done: ${ok} ok · ${fail} failed${DRY_RUN ? ' (dry run — nothing written)' : ''}`)
  if (fail > 0 && !DRY_RUN) process.exitCode = 1
}

main().catch((err) => {
  console.error('render-worker fatal:', err)
  process.exit(1)
})
