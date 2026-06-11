#!/usr/bin/env node
/**
 * NeverBounce email validation — runs every email in 06-master-enriched.csv
 * through NeverBounce, tags each row with email:valid / risky / invalid / etc.
 *
 * Per memory `feedback_smoke_test_before_bulk_spend.md` — always smoke test
 * 10 emails first (~$0.08), validate response shape, THEN scale.
 *
 * Usage:
 *   node --env-file=.env.local scripts/_neverbounce-validate.mjs --dry-run
 *   node --env-file=.env.local scripts/_neverbounce-validate.mjs --apply --limit 10   # smoke
 *   node --env-file=.env.local scripts/_neverbounce-validate.mjs --apply              # full
 *
 * Env:
 *   NEVERBOUNCE_API_KEY  (sign up at https://app.neverbounce.com/signup)
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const INPUT = path.join(ROOT, 'out/westside-bend-merge/06-master-enriched.csv')
const OUTPUT = path.join(ROOT, 'out/westside-bend-merge/07-master-email-validated.csv')
const RAW = path.join(ROOT, 'out/westside-bend-merge/neverbounce-raw-responses.jsonl')
const SUMMARY = path.join(ROOT, 'out/westside-bend-merge/summary-neverbounce.json')

const NB_BASE = 'https://api.neverbounce.com/v4'
const COST_PER_CHECK_USD = 0.008
const RATE_LIMIT_MS = 100

function parseArgs(argv) {
  const out = { dryRun: false, apply: false, limit: Infinity }
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i]
    if (t === '--dry-run') out.dryRun = true
    else if (t === '--apply') out.apply = true
    else if (t === '--limit') out.limit = parseInt(argv[++i], 10)
  }
  return out
}

function parseCsv(text) {
  const rows = []
  let cur = [], field = '', inQuote = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i], n = text[i + 1]
    if (inQuote) {
      if (c === '"' && n === '"') { field += '"'; i += 1 }
      else if (c === '"') inQuote = false
      else field += c
    } else {
      if (c === '"') inQuote = true
      else if (c === ',') { cur.push(field); field = '' }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = '' }
      else if (c === '\r') {}
      else field += c
    }
  }
  if (field || cur.length) { cur.push(field); rows.push(cur) }
  return rows
}

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

// NeverBounce v4 single check returns `result` as a STRING:
// "valid" | "invalid" | "disposable" | "catchall" | "unknown"
// (NOT integer codes — those were a stale assumption from v3.)
const VALID_RESULTS = new Set(['valid', 'invalid', 'disposable', 'catchall', 'unknown'])

async function checkOne(apiKey, email) {
  const url = `${NB_BASE}/single/check?key=${apiKey}&email=${encodeURIComponent(email)}&address_info=1&credits_info=1`
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
  if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + (await r.text()).slice(0, 120))
  const j = await r.json()
  return j
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const apiKey = (process.env.NEVERBOUNCE_API_KEY || '').trim()

  const text = await fs.readFile(INPUT, 'utf8')
  const rows = parseCsv(text)
  const headers = rows[0]
  const data = rows.slice(1)
  const idx = {
    email: headers.indexOf('enriched_email'),
    fubEmail: headers.indexOf('fub_email'),
    nbResult: headers.indexOf('nb_result'),
    nbScore: headers.indexOf('nb_score'),
    nbFlags: headers.indexOf('nb_flags'),
  }
  const NEW_COLS = ['nb_result', 'nb_score', 'nb_flags', 'nb_checked_at']
  for (const c of NEW_COLS) if (!headers.includes(c)) headers.push(c)

  // Build candidates: rows with an email that haven't been NB-checked yet
  const candidates = []
  for (let i = 0; i < data.length; i += 1) {
    const r = data[i]
    while (r.length < headers.length) r.push('')
    const email = (r[headers.indexOf('enriched_email')] || r[headers.indexOf('fub_email')] || '').trim().toLowerCase()
    if (!email || !email.includes('@')) continue
    if (r[headers.indexOf('nb_result')]) continue // already checked
    candidates.push({ idx: i, email })
  }

  const selected = Math.min(candidates.length, args.limit)
  const cost = (selected * COST_PER_CHECK_USD).toFixed(2)
  console.log(`[nb] Emails eligible for validation: ${candidates.length}`)
  console.log(`[nb] Will check: ${selected} (limit=${args.limit === Infinity ? 'all' : args.limit})`)
  console.log(`[nb] Projected cost @ $${COST_PER_CHECK_USD}/check: $${cost}`)

  if (args.dryRun || !args.apply) {
    await fs.writeFile(SUMMARY, JSON.stringify({
      generatedAt: new Date().toISOString(),
      eligible: candidates.length,
      willCheck: selected,
      projectedCostUsd: Number(cost),
      costPerCheckUsd: COST_PER_CHECK_USD,
    }, null, 2))
    console.log(`[nb] Dry run. Wrote estimate to ${path.relative(ROOT, SUMMARY)}`)
    return
  }

  if (!apiKey) {
    console.error(`
[nb] Missing NEVERBOUNCE_API_KEY.

To set up:
  1. Sign up at https://app.neverbounce.com/signup (free account, no card needed to start)
  2. Add credits: https://app.neverbounce.com/billing/credits  ($50 covers our 7,075 emails)
  3. Get API key: https://app.neverbounce.com/account/api-keys → "Create API Key"
  4. Add to .env.local: NEVERBOUNCE_API_KEY=secret_xxxxxxxx
  5. Re-run this script
`)
    process.exit(1)
  }

  await fs.writeFile(RAW, '')
  const stats = { processed: 0, valid: 0, invalid: 0, disposable: 0, catchall: 0, unknown: 0, errors: 0 }
  for (let n = 0; n < selected; n += 1) {
    const { idx: i, email } = candidates[n]
    try {
      const resp = await checkOne(apiKey, email)
      await fs.appendFile(RAW, JSON.stringify({ email, response: resp }) + '\n')
      const label = VALID_RESULTS.has(resp.result) ? resp.result : 'unknown'
      const flags = (resp.flags || []).join(';')
      data[i][headers.indexOf('nb_result')] = label
      data[i][headers.indexOf('nb_score')] = resp.suggested_correction ? 'suggested:' + resp.suggested_correction : (resp.confidence || '')
      data[i][headers.indexOf('nb_flags')] = flags
      data[i][headers.indexOf('nb_checked_at')] = new Date().toISOString().slice(0, 10)
      stats[label] = (stats[label] || 0) + 1
      stats.processed += 1
      if ((n + 1) % 100 === 0) console.log(`[nb] ${n + 1}/${selected} valid=${stats.valid} invalid=${stats.invalid}`)
    } catch (e) {
      stats.errors += 1
      if (stats.errors > 5 && stats.errors / (n + 1) > 0.3) {
        console.error('[nb] Error rate too high — aborting:', e.message)
        break
      }
    }
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS))
  }

  const out = [headers.map(csvEscape).join(',')]
  for (const r of data) out.push(headers.map((_, j) => csvEscape(r[j])).join(','))
  await fs.writeFile(OUTPUT, out.join('\n') + '\n')
  await fs.writeFile(SUMMARY, JSON.stringify({ ...stats, generatedAt: new Date().toISOString() }, null, 2))

  console.log('\n[nb] === Done ===')
  console.log(JSON.stringify(stats, null, 2))
  console.log(`Output: ${path.relative(ROOT, OUTPUT)}`)
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1) })
