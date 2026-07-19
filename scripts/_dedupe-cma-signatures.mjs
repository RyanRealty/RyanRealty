/**
 * One-off backfill — remove the duplicate broker signature block from stored CMA
 * html_content (2026-07-18). The 2026-07-16 closing-page commit (65a6b378) added a
 * second signature block to the "Your next step" page while the Disclosure page
 * already carried the broker's cursive signature, so every stored doc rendered as
 * double-signed. render.ts is fixed for new builds; this repairs the existing 158.
 *
 * Removes ONLY the signature-page block that lacks the cursive `sig-name` (the
 * closing-page contact-card duplicate), keeping the real cursive signature on the
 * ORS/OAR Disclosure page. Uses a balanced-<div> matcher (nested divs handled).
 *
 * Dry-run by default; pass --apply to write.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const APPLY = process.argv.includes('--apply')

const MARKER = '<div class="signature-page">'

/** End index (just past the matching </div>) of the balanced div starting at startIdx. */
function balancedDivEnd(html, startIdx) {
  const re = /<div\b|<\/div>/g
  re.lastIndex = startIdx
  let depth = 0
  let m
  while ((m = re.exec(html))) {
    if (m[0] === '</div>') { depth--; if (depth === 0) return re.lastIndex }
    else depth++
  }
  return -1
}

function findSignatureBlocks(html) {
  const blocks = []
  let idx = html.indexOf(MARKER)
  while (idx !== -1) {
    const end = balancedDivEnd(html, idx)
    if (end === -1) break
    blocks.push({ start: idx, end, html: html.slice(idx, end) })
    idx = html.indexOf(MARKER, end)
  }
  return blocks
}

async function run() {
  const { data, error } = await sb.from('cmas').select('id, slug, html_content').not('html_content', 'is', null)
  if (error) { console.error(error.message); process.exit(1) }
  let toFix = 0, fixed = 0, alreadyOk = 0, skippedWeird = 0
  for (const row of data) {
    const html = row.html_content
    const blocks = findSignatureBlocks(html)
    if (blocks.length < 2) { alreadyOk++; continue }
    // The nextStep duplicate is the block WITHOUT the cursive sig-name.
    const dup = blocks.find((b) => !b.html.includes('class="sig-name"'))
    if (!dup) { console.warn('SKIP (no non-sig-name block):', row.slug); skippedWeird++; continue }
    const next = html.slice(0, dup.start) + html.slice(dup.end)
    const sigCount = (next.match(/<div class="signature-page">/g) || []).length
    const nameCount = (next.match(/class="sig-name"/g) || []).length
    if (sigCount !== 1 || nameCount !== 1) {
      console.warn('SKIP (unexpected post-counts):', row.slug, 'sig=', sigCount, 'name=', nameCount)
      skippedWeird++
      continue
    }
    toFix++
    if (APPLY) {
      const { error: uErr } = await sb.from('cmas').update({ html_content: next }).eq('id', row.id)
      if (uErr) { console.error('UPDATE FAILED', row.slug, uErr.message); continue }
      fixed++
    }
  }
  console.log(JSON.stringify({ apply: APPLY, total: data.length, alreadyOk, toFix, fixed, skippedWeird }, null, 2))
}
run()
