/**
 * Build the Vault mail-filing golden evaluation set from the 2026-09-24
 * six-auditor mail accuracy audit, corrected by its own adversarial
 * verification pass. Reads each slice's `rows.json` (outside the repo, in
 * the audit's own scratch folder — see `--audit-dir` below), maps every
 * hand or classifier verdict to a golden expectation
 * (lib/tc/mail-golden.ts `mapVerdictToExpectation`), applies
 * `VERIFIED_OVERRIDES` below (highest confidence — a targeted re-check that
 * read the disputed messages directly and cross-checked tc_deals/tc_cycles/
 * tc_deal_people/tc_deal_contacts, `mail-audit/verify/findings.json`),
 * dedupes a message judged in more than one slice, and writes
 * `data/tc-mail-golden.json`.
 *
 * The golden file carries NO content — ids, the expectation and provenance
 * only (docs/TC_MAIL_FILING_RULES.md "Golden evaluation set"). It is
 * committed to the repo; nothing this script reads from the audit folder is.
 *
 *   npx tsx scripts/tc-mail-golden-build.ts [--audit-dir <path>] [--out <path>] [--force]
 *
 * Refuses to overwrite an existing golden file with one less than half its
 * size (the usual cause: --audit-dir's default is this session's own
 * ephemeral scratchpad, gone in a later session) — pass --force to write
 * anyway.
 *
 * Six slices, one auditor each: filed-matt, filed-rp, missed-notdeal,
 * missed-bulk, deal-recall (the one classifier-confidence slice — every
 * other slice was judged by reading the message), and queue. `queue` was
 * still being written when this script was first run; a missing slice
 * directory is a warning, not an error, so this script is safe to re-run
 * once a slice appears.
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  buildGoldenRows,
  confidenceForSlice,
  mapVerdictToExpectation,
  normalizeMailbox,
  type GoldenJudgment,
  type GoldenRow,
  type MailAuditRow,
} from '@/lib/tc/mail-golden'

const SLICES = ['filed-matt', 'filed-rp', 'missed-notdeal', 'missed-bulk', 'deal-recall', 'queue'] as const

const DEFAULT_AUDIT_DIR =
  '/tmp/claude-0/-home-user-RyanRealty/9fe9d814-a247-5921-8288-dab9436e06db/scratchpad/mail-audit'
const DEFAULT_OUT = path.resolve(__dirname, '../data/tc-mail-golden.json')

const DROUILLARD = '2f376f00-2132-46a6-b621-db86351d4472' // 2354 NW Drouillard Ave
const NORDIC = 'c2a820d2-2e72-423e-8e75-374aa8dc7aba' // 2680 NW Nordic Avenue
const TUMALO_RESERVOIR = '58bc2719-d052-4f5e-919b-482471875e9f' // 19496 Tumalo Reservoir Rd

/**
 * `mail-audit/verify/findings.json`, an adversarial re-check of specific
 * disputed rows (read each message directly via peek.ts, cross-checked
 * against tc_deals/tc_cycles/tc_deal_people/tc_deal_contacts) — highest
 * confidence, applied above every hand or classifier judgment for the same
 * key. Two findings:
 *
 *  - Item 1 ("Nordic vs Drouillard"), five disputed messages: the
 *    missed-notdeal slice's auditor read "Nordic" as a nickname for 2354 NW
 *    Drouillard Ave and filed three Nordic-only messages there. "Nordic" is
 *    not a nickname — 2680 NW Nordic Avenue is its own deal (the Uchikawas
 *    buying from the Halpins, two earlier offers having fallen through), and
 *    196645cc31da3c7c / 198fb78d54c898dc / 198fb7c01424bc40 are all about it.
 *    198f626ee1e2a852, the fourth, genuinely names BOTH deals in one email
 *    (two separate numbered questions) — no single deal_id is more right
 *    than the other, so it is a queue row, not a file: `either file is
 *    defensible; a person or a future two-deal path decides` (excludes it
 *    from wrong-deal scoring by construction — `queue` never scores WRONG).
 *    The fifth, 1991a4131b546694 ("Re: Drouillard Sellers Repair Addendum"),
 *    IS plain Drouillard — the auditor's original correct_deal_id for it was
 *    already right; this override just carries it into `verified`, same
 *    value, so it is not re-litigated by a later hand or classifier pass.
 *  - Item 5 ("CMA comps misfile"): confirms the filed-matt slice's own
 *    correct_deal_id for the CMA-attachment message (58bc2719, 19496 Tumalo
 *    Reservoir Rd, not the comp property whose MLS number the CMA also
 *    happens to cite) — already correct in that slice, now double-confirmed.
 */
const VERIFIED_OVERRIDES: ReadonlyArray<{ mailbox: string; gmail_id: string; expect: 'file' | 'queue'; dealId: string | null }> = [
  { mailbox: 'rebeccapeterson@ryan-realty.com', gmail_id: '196645cc31da3c7c', expect: 'file', dealId: NORDIC },
  { mailbox: 'rebeccapeterson@ryan-realty.com', gmail_id: '198fb78d54c898dc', expect: 'file', dealId: NORDIC },
  { mailbox: 'rebeccapeterson@ryan-realty.com', gmail_id: '198fb7c01424bc40', expect: 'file', dealId: NORDIC },
  { mailbox: 'rebeccapeterson@ryan-realty.com', gmail_id: '198f626ee1e2a852', expect: 'queue', dealId: null },
  { mailbox: 'matt@ryan-realty.com', gmail_id: '1991a4131b546694', expect: 'file', dealId: DROUILLARD },
  { mailbox: 'matt@ryan-realty.com', gmail_id: '19bdd978e97c5ba0', expect: 'file', dealId: TUMALO_RESERVOIR },
]

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i > 0 ? (process.argv[i + 1] ?? null) : null
}
const has = (name: string) => process.argv.includes(name)

function readSliceRows(auditDir: string, slice: string): MailAuditRow[] {
  const file = path.join(auditDir, slice, 'rows.json')
  if (!fs.existsSync(file)) {
    console.warn(`[golden-build] ${slice}: no rows.json at ${file} — skipping`)
    return []
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
  const arr = Array.isArray(raw) ? raw : ((raw as { rows?: unknown[] })?.rows ?? [])
  if (!Array.isArray(arr)) {
    console.warn(`[golden-build] ${slice}: rows.json is not an array (or {rows: [...]}) — skipping`)
    return []
  }
  return arr as MailAuditRow[]
}

async function main() {
  const auditDir = arg('--audit-dir') ?? DEFAULT_AUDIT_DIR
  const outPath = arg('--out') ?? DEFAULT_OUT

  const judgments: GoldenJudgment[] = []
  const verdictCountsBySlice: Record<string, Record<string, number>> = {}
  let totalRowsRead = 0
  let malformed = 0

  for (const slice of SLICES) {
    const rows = readSliceRows(auditDir, slice)
    const confidence = confidenceForSlice(slice)
    const counts: Record<string, number> = {}
    for (const row of rows) {
      if (!row || typeof row !== 'object' || !row.mailbox || !row.gmail_id || !row.verdict) {
        malformed++
        continue
      }
      totalRowsRead++
      counts[row.verdict] = (counts[row.verdict] ?? 0) + 1
      const mailbox = normalizeMailbox(row.mailbox)
      const mapped = mapVerdictToExpectation(row, slice)
      judgments.push({ mailbox, gmail_id: row.gmail_id, slice, confidence, mapped })
    }
    verdictCountsBySlice[slice] = counts
    console.log(`[golden-build] ${slice}: ${rows.length} rows read (${confidence})`)
  }

  // Snapshot what the six slices alone would have produced for each
  // overridden key, so the report can show exactly what `verify` changed.
  const preOverride = buildGoldenRows(judgments).rows
  const preByKey = new Map(preOverride.map((r) => [`${r.mailbox}|${r.gmail_id}`, r]))

  const verifyConfidence = confidenceForSlice('verify')
  for (const o of VERIFIED_OVERRIDES) {
    const mailbox = normalizeMailbox(o.mailbox)
    judgments.push({
      mailbox,
      gmail_id: o.gmail_id,
      slice: 'verify',
      confidence: verifyConfidence,
      mapped: { expect: o.expect, dealId: o.dealId, dealNotInVault: false, expectCycleId: null },
    })
  }

  const { rows, conflicts, anomalies } = buildGoldenRows(judgments)
  const sorted = [...rows].sort((a, b) => (a.mailbox === b.mailbox ? a.gmail_id.localeCompare(b.gmail_id) : a.mailbox.localeCompare(b.mailbox)))

  // DEFAULT_AUDIT_DIR is THIS session's ephemeral scratchpad — gone in a
  // later session or on another machine. Without this guard, running this
  // script with no --audit-dir once that folder no longer exists reads 0
  // rows from every slice, keeps only VERIFIED_OVERRIDES' handful of
  // judgments, and would otherwise silently overwrite the committed
  // 1522-row permanent regression set with a near-empty one — unrecoverable,
  // since the raw mail-audit/*/rows.json source is deliberately never
  // committed. Refuse a drop this large unless the caller explicitly forces it.
  const force = has('--force')
  if (fs.existsSync(outPath) && !force) {
    const existingRaw = JSON.parse(fs.readFileSync(outPath, 'utf8')) as unknown
    const existing = Array.isArray(existingRaw) ? existingRaw : []
    if (existing.length > 0 && sorted.length < existing.length * 0.5) {
      console.error(
        `[golden-build] refusing to write ${outPath}: this run produced ${sorted.length} rows, the existing file has ${existing.length} — a drop this large usually means --audit-dir (default: ${DEFAULT_AUDIT_DIR}) does not have the slice folders. Pass --audit-dir <path> pointing at the real audit folder, or --force to write anyway.`,
      )
      process.exitCode = 1
      return
    }
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, `${JSON.stringify(sorted, null, 2)}\n`)

  // ── report ──
  console.log('')
  console.log(`[golden-build] read ${totalRowsRead} judged rows across ${SLICES.length} slices (${malformed} malformed, skipped)`)
  console.log(`[golden-build] ${judgments.length} judgments -> ${rows.length} unique (mailbox, gmail_id) golden rows`)
  console.log(`[golden-build] wrote ${outPath}`)

  console.log('\n[golden-build] verdict counts by slice:')
  for (const slice of SLICES) {
    const counts = verdictCountsBySlice[slice] ?? {}
    const parts = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([v, n]) => `${v}=${n}`)
    console.log(`  ${slice}: ${parts.join(', ') || '(none)'}`)
  }

  const byExpect: Record<string, number> = {}
  const byConfidence: Record<string, number> = {}
  const bySlice: Record<string, number> = {}
  for (const r of sorted) {
    byExpect[r.expect] = (byExpect[r.expect] ?? 0) + 1
    byConfidence[r.confidence] = (byConfidence[r.confidence] ?? 0) + 1
    bySlice[r.slice] = (bySlice[r.slice] ?? 0) + 1
  }
  console.log('\n[golden-build] golden set by expect:', byExpect)
  console.log('[golden-build] golden set by confidence:', byConfidence)
  console.log('[golden-build] golden set by winning slice:', bySlice)

  console.log(`\n[golden-build] ${VERIFIED_OVERRIDES.length} verified override(s) applied (mail-audit/verify/findings.json):`)
  for (const o of VERIFIED_OVERRIDES) {
    const mailbox = normalizeMailbox(o.mailbox)
    const before = preByKey.get(`${mailbox}|${o.gmail_id}`)
    const after = rows.find((r) => r.mailbox === mailbox && r.gmail_id === o.gmail_id)
    const beforeStr = before ? `${before.expect}${before.deal_id ? `(${before.deal_id})` : ''}` : '(new row)'
    const afterStr = after ? `${after.expect}${after.deal_id ? `(${after.deal_id})` : ''}` : '(missing!)'
    const changed = beforeStr !== afterStr
    console.log(`  ${mailbox} ${o.gmail_id}: ${beforeStr} -> ${afterStr}${changed ? '  [CHANGED]' : '  [confirmed, no change]'}`)
  }

  if (anomalies.length) {
    console.log(`\n[golden-build] ${anomalies.length} ANOMALY row(s) — mapped conservatively to queue, needs a human look:`)
    for (const a of anomalies) console.log(`  ${a.slice} ${a.mailbox} ${a.gmail_id}: ${a.anomaly}`)
  } else {
    console.log('\n[golden-build] no anomalies — every row matched a known verdict cleanly')
  }

  if (conflicts.length) {
    console.log(`\n[golden-build] ${conflicts.length} CONFLICT(s) — the same message judged differently in different slices:`)
    for (const c of conflicts) {
      console.log(`  ${c.mailbox} ${c.gmail_id}: ${c.reason}`)
      for (const j of c.judgments) {
        console.log(`    - [${j.slice}/${j.confidence}] expect=${j.expect} deal_id=${j.deal_id ?? 'null'} deal_not_in_vault=${j.deal_not_in_vault}`)
      }
      console.log(`    -> resolved: expect=${c.resolved.expect} deal_id=${c.resolved.deal_id ?? 'null'} (${c.resolved.slice}/${c.resolved.confidence})`)
    }
  } else {
    console.log('\n[golden-build] no cross-slice conflicts')
  }
}

main().catch((err) => {
  console.error('[golden-build] failed:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})

// Re-exported only so a future refresh can compute a diff against a prior
// golden file without re-deriving this type from the JSON shape.
export type { GoldenRow }
