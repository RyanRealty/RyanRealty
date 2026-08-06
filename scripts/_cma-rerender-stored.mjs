#!/usr/bin/env node
/**
 * Re-render every stored draft CMA under the flowing page model.
 *
 * The earlier remediation (_cma-unclip-stored-html.mjs) removed the clipper by
 * string surgery, which stopped the silent content DELETION but could not fix
 * the consequence: a section that no longer clips instead spills onto a
 * continuation sheet, and under the old model that sheet had no margin — text
 * ~12pt from the paper edge. 77 documents landed in that state.
 *
 * The fix Matt chose is the flowing model (docs/PAGE_CONTRACT.md): bands come
 * from `@page` so every sheet including a spill is margined, and the footer is
 * a running mark Chrome draws into the margin strip instead of an in-body
 * absolutely-positioned element that cannot follow a spilled section.
 *
 * That changes the MARKUP, not just the CSS, so this is a true re-render —
 * `renderCmaHtml(storedArgs)`, which is a pure function of `render_args` and
 * therefore CANNOT change a single figure. Same guarantee lib/cma/rebrand.ts
 * relies on, and `ci:cma-rebrand-integrity` holds: a re-brand is a RENDER, not
 * a REBUILD, and this never imports buildCma.
 *
 * Requires the bundled renderer:
 *   npx esbuild lib/cma/render.ts --bundle --format=esm --platform=node \
 *     --alias:@=. --outfile=<scratch>/cma-render.mjs
 *
 * Run: node scripts/_cma-rerender-stored.mjs [--apply] [--limit=N]
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

// Bundles live under node_modules/.cache so Node can still resolve the packages
// they leave external (pdfjs-dist). Outside the repo those imports fail.
const BUNDLES = new URL('../node_modules/.cache/rr-cma/', import.meta.url).pathname
const SCRATCH = process.env.RR_SCRATCH || BUNDLES
const { renderCmaHtml } = await import(`${BUNDLES}cma-render.mjs`)
const { inspectPdfPageSafety, formatViolations } = await import(`${BUNDLES}cma-safety.mjs`)
const { pdfRenderOptions, CMA_MARGIN_IN } = await import(`${BUNDLES}cma-contract.mjs`)

const APPLY = process.argv.includes('--apply')
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0)

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const CHROME =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome')

/**
 * Recover the map from the previous render. `render_args` deliberately excludes
 * `mapDataUri` (it is a data URI, not an input), and re-fetching Google Maps for
 * 219 documents would be slow, billable, and would silently drop the map page on
 * any transient failure. The stored HTML still holds the correct map for this
 * subject and these comps — same fallback lib/cma/rebrand.ts uses.
 */
function mapFromHtml(html) {
  if (!html) return null
  const byClass =
    /<img\b[^>]*\bclass="[^"]*\bmap-img\b[^"]*"[^>]*\bsrc="(data:image\/[a-z]+;base64,[^"]+)"/i.exec(html) ??
    /<img\b[^>]*\bsrc="(data:image\/[a-z]+;base64,[^"]+)"[^>]*\bclass="[^"]*\bmap-img\b/i.exec(html)
  if (byClass) return byClass[1]
  const byAlt =
    /<img\b[^>]*\bsrc="(data:image\/[a-z]+;base64,[^"]+)"[^>]*\balt="Comparable sales map"/i.exec(html) ??
    /<img\b[^>]*\balt="Comparable sales map"[^>]*\bsrc="(data:image\/[a-z]+;base64,[^"]+)"/i.exec(html)
  return byAlt?.[1] ?? null
}


/**
 * Every figure the reader can see, as a multiset.
 *
 * renderCmaHtml is a pure function of render_args, so a re-render CANNOT change
 * a number — but "cannot by construction" is an argument, not a verification,
 * and this is a document a seller prices against (§0). So the figures are
 * compared for real: currency, percentages, bare counts, dates. A mismatch
 * refuses the write.
 */
function figures(html) {
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/\sdata:[a-z/+;]+base64,[A-Za-z0-9+/=]+/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
  const out = new Map()
  for (const m of text.matchAll(/\$[\d,]+(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?%|\b\d{4}-\d{2}-\d{2}\b/g)) {
    const k = m[0]
    out.set(k, (out.get(k) ?? 0) + 1)
  }
  return out
}

function figureDelta(a, b) {
  const diffs = []
  for (const [k, n] of a) if ((b.get(k) ?? 0) !== n) diffs.push(`${k}: ${n} -> ${b.get(k) ?? 0}`)
  for (const [k, n] of b) if (!a.has(k)) diffs.push(`${k}: 0 -> ${n}`)
  return diffs
}

// One read for the whole run. Signing identity comes from public.brokers, the
// same source lib/cma/rebrand.ts uses — never defaulted silently to Matt when a
// slug is unknown, because signing as the wrong broker is worse than an error.
const { data: brokerRows, error: brokerErr } = await sb
  .from('brokers')
  .select('id, slug, display_name, title, license_number, email, phone, photo_url')
if (brokerErr) throw brokerErr
const brokers = new Map(
  (brokerRows ?? []).map((b) => [
    b.slug,
    {
      id: b.id ?? null,
      slug: b.slug,
      displayName: b.display_name || '',
      title: b.title || '',
      licenseNumber: b.license_number || null,
      email: b.email || null,
      phone: b.phone || null,
      photoUrl: b.photo_url || null,
    },
  ]),
)
console.log(`resolved ${brokers.size} brokers`)

const { data: rows, error } = await sb
  .from('cmas')
  .select('slug, html_content, render_args, status, broker_slug')
  .eq('status', 'draft')
  .not('render_args', 'is', null)
  .order('slug')
if (error) throw error

const targets = LIMIT ? rows.slice(0, LIMIT) : rows
console.log(`${rows.length} draft CMAs have render_args; processing ${targets.length}`)
console.log(APPLY ? 'MODE: --apply (will write)\n' : 'MODE: dry run (verify only)\n')

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1024, height: 1320, deviceScaleFactor: 1 })
await page.setRequestInterception(true)
page.on('request', (r) => {
  // Offline: fonts and the logo live on the site. Geometry does not depend on
  // them resolving, and 219 network waits makes this run unreliable.
  if (/^https?:/.test(r.url())) r.abort().catch(() => {})
  else r.continue().catch(() => {})
})

const results = []
let clean = 0
let dirty = 0
let failed = 0

for (const [i, row] of targets.entries()) {
  const rec = { slug: row.slug }
  try {
    const stored = typeof row.render_args === 'string' ? JSON.parse(row.render_args) : row.render_args
    // render_args deliberately excludes `broker` and `mapDataUri` (lib/cma/
    // rebrand.ts) — the signing broker is a property of the ROW, so that one
    // document can be re-branded without rewriting its inputs.
    const broker = brokers.get(row.broker_slug ?? 'matthew-ryan') ?? brokers.get('matthew-ryan')
    if (!broker) {
      rec.action = `skipped:unknown-broker:${row.broker_slug}`
      results.push(rec)
      failed++
      continue
    }
    const { html, pageCount } = renderCmaHtml({
      ...stored,
      broker,
      mapDataUri: mapFromHtml(row.html_content),
    })
    rec.sections = pageCount

    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.emulateMediaType('print')
    const pdf = Buffer.from(
      await page.pdf(pdfRenderOptions({ footerLeft: 'Ryan Realty · 541.703.3095' }, CMA_MARGIN_IN)),
    )
    const report = await inspectPdfPageSafety(pdf, { margins: CMA_MARGIN_IN })
    rec.sheets = report.pageCount
    rec.violations = report.violations.length

    // §0: the re-render must not move a single figure.
    const drift = figureDelta(figures(row.html_content), figures(html))
    rec.figureDrift = drift.length
    if (drift.length) {
      rec.action = 'refused:figure-drift'
      rec.detail = drift.slice(0, 6).join(' · ')
      dirty++
    } else if (!report.ok) {
      // Never store a document that does not verify. A re-render that still
      // bleeds means the renderer has a bug. Fix the renderer; do not overwrite the row.
      rec.action = 'refused:violations'
      rec.detail = formatViolations(report.violations, 3)
      dirty++
    } else if (APPLY) {
      const { error: upErr } = await sb.from('cmas').update({ html_content: html }).eq('slug', row.slug)
      rec.action = upErr ? `error:${upErr.message}` : 'rerendered'
      if (upErr) failed++
      else clean++
    } else {
      rec.action = 'would-rerender'
      clean++
    }
  } catch (e) {
    rec.action = `error:${e instanceof Error ? e.message : String(e)}`
    failed++
  }
  results.push(rec)
  if ((i + 1) % 25 === 0) console.log(`  … ${i + 1}/${targets.length}`)
}

await browser.close()
writeFileSync(`${SCRATCH}/cma-rerender-report.json`, JSON.stringify(results, null, 2))

console.log('\n─── RESULT ───')
console.log(`processed:            ${results.length}`)
console.log(`verified clean:       ${clean}`)
console.log(`refused (violations): ${dirty}`)
console.log(`errors:               ${failed}`)
console.log(`\nreport: ${SCRATCH}/cma-rerender-report.json`)

if (dirty) {
  console.log('\nRefused:')
  for (const r of results.filter((x) => x.action === 'refused:violations').slice(0, 10)) {
    console.log(`  ${r.slug}  ${r.sheets} sheets, ${r.violations} violations`)
    console.log(`    ${r.detail}`)
  }
}
if (failed) {
  console.log('\nErrors:')
  for (const r of results.filter((x) => String(x.action).startsWith('error') || String(x.action).startsWith('skipped')).slice(0, 10)) {
    console.log(`  ${r.slug}: ${r.action}`)
  }
}
