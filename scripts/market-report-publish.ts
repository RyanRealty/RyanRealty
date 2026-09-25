/**
 * Build, render and publish monthly market report editions.
 *
 *   npx tsx --conditions=react-server scripts/market-report-publish.ts --from 2026-07 --to 2026-07 --out out/market-report
 *   npx tsx --conditions=react-server scripts/market-report-publish.ts --from 2006-01 --to 2026-08 --publish
 *
 * Flags
 *   --from YYYY-MM / --to YYYY-MM   edition (data) months, inclusive
 *   --publish                       gate, render, upload and publish each edition (lib/market-report/pipeline.ts)
 *   --draft                         the same, stored as a draft (not visible on the site); published months are left alone
 *   --skip-published                leave months that are already published alone
 *   --rebuilt-since <iso>           leave months whose stored edition was generated at or after this
 *                                   time alone (resume a republish of editions already published)
 *   --out <dir>                     render <dir>/<month>.pdf, .html and .citations.json locally for review (no writes)
 *   --no-pdf                        build payloads only (fast check of every month)
 *   --series-cache <file>           reuse loaded series and bands from a JSON file (write it when absent); local review only
 *
 * --publish and --draft run the Spark × Supabase reconciliation gate on every
 * month (CLAUDE.md §0, lib/market-report/reconcile.ts): a month where any
 * figure Spark can reproduce is more than 1% off is stored as a held draft with
 * the reason and is not published. Without --publish or --draft nothing is written
 * to Supabase. The series must already be computed (scripts/market-report-compute.ts).
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { REPORT_DEFINITION_ID } from '@/lib/data/market-report/compute'
import { getEditionForWrite } from '@/lib/data/market-report/editions'
import type { ReportBandRow, ReportSeriesRow } from '@/lib/data/market-report/series'
import { buildEdition } from '@/lib/market-report/build-edition'
import { addMonths } from '@/lib/market-report/format'
import { loadEditionInputs, publishEdition } from '@/lib/market-report/pipeline'
import { liveReconcileSources } from '@/lib/market-report/reconcile'
import { renderEditionHtmlDocument, renderEditionPdf } from '@/lib/market-report/pdf/render'

const argv = process.argv.slice(2)
const flag = (n: string) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const has = (n: string) => argv.includes(`--${n}`)

function months(from: string, to: string): string[] {
  const out: string[] = []
  for (let k = from; k <= to; k = addMonths(k, 1)) out.push(k)
  return out
}

function pageCount(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

async function main() {
  const from = flag('from')
  const to = flag('to')
  if (!from || !to || !/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) {
    throw new Error('usage: --from YYYY-MM --to YYYY-MM [--publish|--draft] [--skip-published] [--out dir] [--no-pdf]')
  }
  if (!process.env.PUPPETEER_EXECUTABLE_PATH && !process.env.VERCEL) {
    process.env.PUPPETEER_EXECUTABLE_PATH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  }
  const status = has('publish') ? 'published' : has('draft') ? 'draft' : null
  const outDir = flag('out')
  if (outDir) mkdirSync(outDir, { recursive: true })

  const t0 = Date.now()
  const cacheFile = flag('series-cache')
  let inputs: { series: ReportSeriesRow[]; bands: ReportBandRow[] }
  if (cacheFile && existsSync(cacheFile)) {
    inputs = JSON.parse(readFileSync(cacheFile, 'utf8'))
  } else {
    inputs = await loadEditionInputs(from, to)
    if (cacheFile) writeFileSync(cacheFile, JSON.stringify(inputs))
  }
  console.log(`loaded ${inputs.series.length} series rows and ${inputs.bands.length} band rows in ${((Date.now() - t0) / 1000).toFixed(0)}s`)

  const counts = { published: 0, draft: 0, held: 0, skipped: 0, built: 0 }
  // One set of sources for the run: each month is pulled from Spark once, not once per edition.
  const sources = liveReconcileSources()
  for (const month of months(from, to)) {
    if (status) {
      const rebuiltSince = flag('rebuilt-since')
      // A draft run never touches a published month (publishEdition refuses it too).
      const skipPublished = has('skip-published') || status === 'draft'
      if (skipPublished || rebuiltSince) {
        const existing = await getEditionForWrite(month)
        const fresh = rebuiltSince && existing && Date.parse(existing.generated_at) >= Date.parse(rebuiltSince)
        if ((skipPublished && existing?.status === 'published') || fresh) {
          counts.skipped += 1
          continue
        }
      }
      const t1 = Date.now()
      const outcome = await publishEdition({ month, inputs, status, sources })
      counts[outcome.status] += 1
      console.log(
        outcome.status === 'held'
          ? `${month}: HELD, ${outcome.holdReason}`
          : `${month}: ${outcome.pages} pages, ${((outcome.bytes ?? 0) / 1024).toFixed(0)} KB, ${((Date.now() - t1) / 1000).toFixed(1)}s → ${outcome.status}`,
      )
      continue
    }

    const payload = buildEdition({
      editionMonth: month,
      series: inputs.series,
      bands: inputs.bands,
      generatedAt: new Date().toISOString(),
      definitionId: REPORT_DEFINITION_ID,
    })
    counts.built += 1
    if (has('no-pdf')) {
      console.log(`${month}: payload ok (${payload.monthly.length} monthly, ${payload.towns.length} towns, ${payload.citations.length} citations)`)
      continue
    }
    const t1 = Date.now()
    const html = await renderEditionHtmlDocument(payload)
    if (outDir) {
      writeFileSync(path.join(outDir, `${month}.html`), html)
      writeFileSync(path.join(outDir, `${month}.citations.json`), JSON.stringify(payload.citations, null, 2))
    }
    const { pdf } = await renderEditionPdf(payload, html)
    if (outDir) writeFileSync(path.join(outDir, `${month}.pdf`), pdf)
    console.log(`${month}: ${pageCount(pdf)} pages, ${(pdf.length / 1024).toFixed(0)} KB, ${((Date.now() - t1) / 1000).toFixed(1)}s`)
  }
  console.log(`done: ${JSON.stringify(counts)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
