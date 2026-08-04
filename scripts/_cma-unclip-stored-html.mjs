#!/usr/bin/env node
/**
 * One-off remediation: remove the sheet-clipper from stored CMA HTML.
 *
 * CMA HTML is FROZEN in public.cmas.html_content — lib/cma-pdf.ts serves the
 * stored string, it does not re-render. So the 2026-08-03 stylesheet fix (THE
 * PAGE CONTRACT, docs/PAGE_CONTRACT.md) reaches new builds only. Every CMA
 * built before it still carries, inside its @media print block:
 *
 *     .page { … height: 11in; min-height: 11in; max-height: 11in;
 *             overflow: hidden; … }
 *
 * which deletes any content past the sheet — silently, with no trace in the
 * produced PDF.
 *
 * Surgical, NOT a re-render. All 219 affected drafts share one byte-identical
 * print block (verified: single md5 across the corpus), so this is an exact
 * string replacement that touches nothing else. A full stylesheet swap was
 * rejected: these documents span 2026-05-14 to 2026-08-03 and older markup may
 * depend on the stylesheet it shipped with.
 *
 * Modes:
 *   --audit   measure only. Reports which stored CMAs are ACTUALLY losing
 *             content today, and how much. Writes nothing.
 *   --apply   audit, patch, re-measure the patched HTML, and write back only
 *             the documents whose patched form verifies clean.
 *
 * Scope is `status = 'draft'` only. Delivered and finalized documents are
 * records of what was sent and are never rewritten in place (same rule
 * lib/cma/rebrand.ts enforces).
 *
 * Run: node scripts/_cma-unclip-stored-html.mjs --audit
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const APPLY = process.argv.includes('--apply')
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0)
const REPORT = '/private/tmp/claude-501/-Users-matthewryan-RyanRealty/8845670f-d70e-41f1-946a-5e386f954ef7/scratchpad/cma-unclip-report.json'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/**
 * TWO rules clip, not one — the first pass patched only the @media print rule
 * and 77 documents still clipped, because the BASE rule's `height: 11in` and
 * `overflow: hidden` apply under print media too. The print block overrides
 * only the properties it restates. Both must go.
 *
 * Each replacement is applied independently and only if present, so the script
 * is idempotent and safe to re-run over the 142 already patched by pass 1.
 */
const REPLACEMENTS = [
  {
    name: 'base',
    from: `.page {
    width: 8.5in;
    height: 11in;
    min-height: 11in;
    margin: 0.4in auto;
    background: var(--cream);
    padding: 0.4in 0.6in 0.85in 0.6in;
    box-shadow: 0 6px 24px rgba(16, 39, 66, 0.18);
    position: relative;
    page-break-after: always;
    overflow: hidden;
  }`,
    to: `.page {
    width: 8.5in;
    min-height: 11in;
    margin: 0.4in auto;
    background: var(--cream);
    padding: 0.4in 0.6in 0.85in 0.6in;
    box-shadow: 0 6px 24px rgba(16, 39, 66, 0.18);
    position: relative;
    page-break-after: always;
    overflow: visible;
  }`,
  },
  {
    name: 'print',
    from: `    .page {
      box-shadow: none;
      margin: 0;
      width: 8.5in;
      height: 11in;
      min-height: 11in;
      max-height: 11in;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }`,
    to: `    .page {
      box-shadow: none;
      margin: 0;
      width: 8.5in;
      min-height: 11in;
      page-break-after: always;
      break-after: page;
    }`,
  },
]

/** Apply every replacement that is still present. Returns null if none matched. */
function unclip(html) {
  let out = html
  let hits = 0
  for (const r of REPLACEMENTS) {
    if (out.includes(r.from)) {
      out = out.replace(r.from, r.to)
      hits++
    }
  }
  return hits ? out : null
}

const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome')

/**
 * Per-sheet overflow, measured under print media on the live layout.
 *
 * Reports both how far content ran past its content box and whether the
 * container would clip it — the clip flag is what makes the loss silent.
 */
async function measure(page, html) {
  await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((r) => {
              img.addEventListener('load', () => r(), { once: true })
              img.addEventListener('error', () => r(), { once: true })
              setTimeout(() => r(), 4000)
            }),
      ),
    )
  })
  await page.evaluateHandle('document.fonts ? document.fonts.ready : Promise.resolve()').catch(() => {})
  await page.emulateMediaType('print')
  return page.evaluate(() => {
    const out = []
    document.querySelectorAll('.page').forEach((el, i) => {
      const cs = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      const padBottom = parseFloat(cs.paddingBottom) || 0
      const contentBottom = rect.bottom - padBottom
      let deepest = contentBottom
      let worstText = ''
      for (const n of el.querySelectorAll('*')) {
        if (n.closest('.pg-header, .pg-footer')) continue
        const p = getComputedStyle(n).position
        if (p === 'absolute' || p === 'fixed') continue
        const r = n.getBoundingClientRect()
        if (!r.width || !r.height) continue
        if (r.bottom > deepest) {
          deepest = r.bottom
          worstText = (n.textContent || '').trim().slice(0, 70)
        }
      }
      const past = Math.round(deepest - contentBottom)
      const clipped = el.scrollHeight - el.clientHeight
      const grown = Math.round(rect.height - 1056)
      if (past > 2 || clipped > 2 || grown > 2) {
        out.push({
          sheet: i + 1,
          pastContentBoxPx: past,
          clippedPx: clipped,
          grownPastSheetPx: grown,
          clips: cs.overflowY === 'hidden' || cs.overflowY === 'clip',
          text: worstText,
        })
      }
    })
    return out
  })
}

const { data: rows, error } = await sb
  .from('cmas')
  .select('slug, html_content, status')
  .eq('status', 'draft')
  // `height: 11in` catches BOTH states: never-patched documents and the 142
  // whose print rule pass 1 already fixed but whose base rule still clips.
  .like('html_content', '%height: 11in%')
  .order('slug')
if (error) throw error

const targets = LIMIT ? rows.slice(0, LIMIT) : rows
console.log(`${rows.length} draft CMAs carry the sheet-clipper; processing ${targets.length}`)
console.log(APPLY ? 'MODE: --apply (will write)' : 'MODE: --audit (read-only)\n')

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1024, height: 1320, deviceScaleFactor: 1 })

const results = []
let losing = 0
let patched = 0
let skippedNoMatch = 0
let refusedDirty = 0

for (const [i, row] of targets.entries()) {
  const before = await measure(page, row.html_content)
  const lost = before.filter((b) => b.clippedPx > 2)
  if (lost.length) losing++

  const rec = { slug: row.slug, before, lostSheets: lost.length }

  const fixed = unclip(row.html_content)
  if (!fixed) {
    // The corpus was verified byte-identical; a miss means an unexpected
    // variant, which must be looked at rather than pattern-matched loosely.
    rec.action = 'skipped:rule-not-found'
    skippedNoMatch++
    results.push(rec)
    continue
  }

  const after = await measure(page, fixed)
  rec.after = after
  rec.stillClipping = after.filter((a) => a.clippedPx > 2).length

  if (APPLY) {
    if (rec.stillClipping > 0) {
      // Patched HTML that still clips means something else caps the sheet.
      // Do not write a document that is not actually fixed.
      rec.action = 'refused:still-clipping'
      refusedDirty++
    } else {
      const { error: upErr } = await sb.from('cmas').update({ html_content: fixed }).eq('slug', row.slug)
      if (upErr) {
        rec.action = `error:${upErr.message}`
      } else {
        rec.action = 'patched'
        patched++
      }
    }
  } else {
    rec.action = 'would-patch'
  }
  results.push(rec)

  if ((i + 1) % 25 === 0) console.log(`  … ${i + 1}/${targets.length}`)
}

await browser.close()
writeFileSync(REPORT, JSON.stringify(results, null, 2))

const overflowOnly = results.filter((r) => r.lostSheets === 0 && r.before.length > 0).length
console.log('\n─── RESULT ───')
console.log(`processed:                    ${results.length}`)
console.log(`ACTUALLY LOSING CONTENT:      ${losing}   (content clipped away, invisible in the PDF)`)
console.log(`overflowing but not clipped:  ${overflowOnly}`)
console.log(`clean:                        ${results.filter((r) => r.before.length === 0).length}`)
if (APPLY) {
  console.log(`patched + verified:           ${patched}`)
  console.log(`refused (still clipping):     ${refusedDirty}`)
}
console.log(`skipped (rule not found):     ${skippedNoMatch}`)
console.log(`\nreport: ${REPORT}`)

if (losing) {
  console.log('\nWorst affected:')
  for (const r of results
    .filter((x) => x.lostSheets)
    .sort((a, b) => Math.max(...b.before.map((s) => s.clippedPx)) - Math.max(...a.before.map((s) => s.clippedPx)))
    .slice(0, 12)) {
    const worst = r.before.filter((s) => s.clippedPx > 2).sort((a, b) => b.clippedPx - a.clippedPx)[0]
    console.log(`  ${r.slug}  sheet ${worst.sheet}: ${worst.clippedPx}px cut  «${worst.text}»`)
  }
}
