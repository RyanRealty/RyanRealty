#!/usr/bin/env node
/**
 * check-approval-stamp-wired.mjs — CI gate (`ci:approval-stamp-wired`).
 *
 * Pins the R0.1 fix from docs/plans/BROKER_SMS_AGENT_2026-07-31.md ("D1 —
 * autonomous publish is dead"): before R0.1, publisher-sweep never copied a
 * row's `approved_at`/`approved_by` into anything `/api/social/publish` could
 * verify, so every gated publish failed `validateGate` and the row died after
 * 2 retries. R0.1 wired a DB-verified approval reference (`approvalRef`)
 * end-to-end: publisher-sweep stamps `{ actionId: row.id }` onto the outbound
 * payload, and the publish route resolves it back to the live
 * `marketing_brain_actions` row (status/approved_by/approved_at/citations)
 * instead of trusting a caller-asserted gate object.
 *
 * This is the regression the broker SMS agent depends on: a broker's APPROVE
 * reply stamps `approved_by=<broker email>` on the row (§1 amendment), and
 * that stamp is worthless unless the wiring below actually reaches the
 * publish route. Three literal, structural checks — no baseline, no ratchet:
 * this either holds or it doesn't.
 *
 *   1. app/api/cron/publisher-sweep/route.ts contains `approvalRef` AND the
 *      literal stamp `{ actionId: row.id }`.
 *   2. app/api/social/publish/route.ts contains `validateDbApproval`, calls
 *      it from inside the exported POST handler (not merely defines it), and
 *      the `PublishRequest` interface declares an `approvalRef` field.
 *   3. app/api/social/publish/route.ts still enforces the 7-day approval
 *      freshness window: `GATE_MAX_AGE_MS = 7 * 24` (the R0.1 accept bar
 *      explicitly requires "approved_at (<= 7 days)").
 *
 * Usage:
 *   node scripts/check-approval-stamp-wired.mjs            # CI mode
 *   node scripts/check-approval-stamp-wired.mjs --report    # human, exit 0
 */
import { readFileSync, existsSync } from 'node:fs'

const REPORT = process.argv.includes('--report')

const SWEEP = 'app/api/cron/publisher-sweep/route.ts'
const PUBLISH = 'app/api/social/publish/route.ts'

const problems = []
const passes = []

function read(rel) {
  if (!existsSync(rel)) return null
  return readFileSync(rel, 'utf8')
}

// ── 1. publisher-sweep stamps the approval reference ────────────────────────
const sweepSrc = read(SWEEP)
if (sweepSrc === null) {
  problems.push(`${SWEEP} is missing — publisher-sweep does not exist; the approval stamp cannot be wired.`)
} else {
  if (!sweepSrc.includes('approvalRef')) {
    problems.push(`${SWEEP}: no reference to \`approvalRef\` — the sweep no longer stamps the DB-verified approval reference (R0.1 regressed).`)
  } else {
    passes.push(`${SWEEP}: references \`approvalRef\`.`)
  }
  if (!sweepSrc.includes('{ actionId: row.id }')) {
    problems.push(`${SWEEP}: no literal \`{ actionId: row.id }\` stamp — the sweep is not attaching the row's own id as the approval reference.`)
  } else {
    passes.push(`${SWEEP}: stamps \`{ actionId: row.id }\`.`)
  }
}

// ── 2. the publish route resolves + calls the DB-verified approval check ────
const publishSrc = read(PUBLISH)
if (publishSrc === null) {
  problems.push(`${PUBLISH} is missing — the publish route does not exist; the approval gate cannot be verified.`)
} else {
  if (!publishSrc.includes('validateDbApproval')) {
    problems.push(`${PUBLISH}: no \`validateDbApproval\` — the DB-verified approval check (R0.1) is gone.`)
  } else {
    passes.push(`${PUBLISH}: defines/references \`validateDbApproval\`.`)

    // "call it in the POST handler": bound the POST handler's source to
    // [start of `export ... function POST`, end of file] — POST is the last
    // top-level export in this route file, so this is a reliable, dependency-
    // free approximation of "the handler's body" without a full TS parse.
    const postMatch = publishSrc.match(/export\s+(async\s+)?function\s+POST\s*\(/)
    if (!postMatch) {
      problems.push(`${PUBLISH}: no exported POST handler found — cannot confirm validateDbApproval is called from it.`)
    } else {
      const postBody = publishSrc.slice(postMatch.index)
      if (!/validateDbApproval\s*\(/.test(postBody)) {
        problems.push(`${PUBLISH}: \`validateDbApproval\` is defined but never CALLED from the POST handler — the gate is dead code.`)
      } else {
        passes.push(`${PUBLISH}: POST handler calls \`validateDbApproval(...)\`.`)
      }
    }
  }

  const publishRequestMatch = publishSrc.match(/interface\s+PublishRequest\s*\{([\s\S]*?)\n\}/)
  if (!publishRequestMatch) {
    problems.push(`${PUBLISH}: no \`interface PublishRequest\` found — cannot confirm it declares \`approvalRef\`.`)
  } else if (!/\bapprovalRef\b/.test(publishRequestMatch[1])) {
    problems.push(`${PUBLISH}: \`PublishRequest\` no longer declares \`approvalRef\` — the sweep's stamp has nowhere typed to land.`)
  } else {
    passes.push(`${PUBLISH}: \`PublishRequest\` declares \`approvalRef\`.`)
  }

  // ── 3. the 7-day freshness window survives ────────────────────────────────
  if (!/GATE_MAX_AGE_MS\s*=\s*7\s*\*\s*24/.test(publishSrc)) {
    problems.push(`${PUBLISH}: no \`GATE_MAX_AGE_MS = 7 * 24\` — the R0.1 approval-freshness window (<= 7 days) regressed.`)
  } else {
    passes.push(`${PUBLISH}: \`GATE_MAX_AGE_MS = 7 * 24\` freshness window intact.`)
  }
}

if (REPORT) {
  console.log('Approval-stamp-wired gate (ci:approval-stamp-wired) — report mode')
  console.log('===================================================================')
  for (const p of passes) console.log(`  ✓ ${p}`)
  for (const p of problems) console.log(`  ✗ ${p}`)
  process.exit(0)
}

if (problems.length) {
  console.error('ci:approval-stamp-wired FAILED — the R0.1 approval-stamp wiring regressed:')
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}

for (const p of passes) console.log(`  ✓ ${p}`)
console.log(`✓ ci:approval-stamp-wired passed — ${passes.length} check(s), approval stamp wiring intact.`)
