/**
 * TEMP (ws3 verification) — render a sample market-report email for a real
 * subscription area (bend) using the production data path
 * (getMarketReportData → renderMarketReportEmail), write it to
 * out/ws3/email-sample.html + email-sample.txt + traces.json, then verify
 * every numeric figure in the html appears in the traces.
 *
 * Run: npx tsx scripts/tmp-ws3-render-sample.ts
 * Safe to delete after review.
 */
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })

import { mkdirSync, writeFileSync } from 'node:fs'

async function main() {
  const { getMarketReportData } = await import('@/lib/data/crm/getMarketReportData')
  const { renderMarketReportEmail } = await import('@/lib/crm/market-report-email')

  const blocks = await getMarketReportData(['bend'])
  if (blocks.length === 0) {
    console.error('No cache data for bend — cannot render sample')
    process.exit(1)
  }

  const out = renderMarketReportEmail({
    contactName: 'Jordan Avery',
    areas: blocks,
    unsubscribeUrl: 'https://ryan-realty.com/api/email/unsubscribe?preview=1',
  })

  mkdirSync('out/ws3', { recursive: true })
  writeFileSync('out/ws3/email-sample.html', out.html)
  writeFileSync('out/ws3/email-sample.txt', out.text)
  writeFileSync('out/ws3/email-sample-traces.json', JSON.stringify(out.traces, null, 2))

  console.log('subject:', out.subject)
  console.log('traces:')
  for (const t of out.traces) console.log(`  - ${t.figure} — ${t.source}`)

  // ── Figure audit: every displayed number must appear in some trace figure ──
  const visible = out.html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&middot;|&rarr;|&amp;|&quot;|&#39;/g, ' ')
  // Money, "N days", "N.N months", percents, and bare counts over 2 digits.
  const figures = new Set<string>(
    [
      ...visible.matchAll(/\$[\d,]+/g),
      ...visible.matchAll(/\b\d+ days?\b/g),
      ...visible.matchAll(/\b\d+(?:\.\d+)? months\b/g),
      ...visible.matchAll(/\d+\.\d+%/g),
      ...visible.matchAll(/\b\d{1,3}(?:,\d{3})+\b/g),
    ].map((m) => m[0]),
  )
  const traceText = out.traces.map((t) => t.figure).join('\n')
  const missing = [...figures].filter((f) => !traceText.includes(f))
  if (missing.length > 0) {
    console.error('\nFIGURES MISSING FROM TRACES:', missing)
    process.exit(1)
  }
  console.log(`\nAll ${figures.size} distinct displayed figures appear in the traces. OK`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
