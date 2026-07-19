/**
 * One-off backfill — populate expired_listings.cma_id / fsbo_listings.cma_id for
 * existing rows (adversarial audit 2026-07-18: the stamp ran before the row
 * existed, so 0/179 rows were ever linked). Matches each prospect to its built
 * document by the SAME slug basis creation used: slugifyAddress(full_address)
 * (street + city + zip) — the street-only fallback in batch.ts silently missed
 * every non-Bend city, so 54 built audits showed "Needs audit".
 *
 * Links to the latest-version cmas row for the address's base slug, preferring
 * the expected doc_type (expired→expired-audit, fsbo→cma). Dry-run by default;
 * pass --apply to write.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing env'); process.exit(1) }
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const APPLY = process.argv.includes('--apply')

// Copied verbatim from lib/cma/address-slug.ts (keep in sync).
function slugifyAddress(address) {
  const base = String(address).toLowerCase()
    .replace(/[,]/g, ' ')
    .replace(/\b(road|rd|street|st|avenue|ave|drive|dr|lane|ln|court|ct|place|pl|boulevard|blvd|highway|hwy|parkway|pkwy|circle|cir|trail|trl|terrace|ter|way|loop)\b/gi, '')
    .replace(/\b(oregon|or|bend|97701|97702|97703|97703|97707|97712|97739|97759|97760|97741)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
  const slug = `cma-${base}`
  return slug.length > 40 ? slug.slice(0, 40).replace(/-+$/g, '') : slug
}
const baseOf = (s) => String(s).replace(/--v\d+$/, '')
const verOf = (s) => { const m = /--v(\d+)$/.exec(String(s)); return m ? Number(m[1]) : 1 }

async function run() {
  const { data: cmas, error: cErr } = await sb.from('cmas').select('id, slug, doc_type, html_path')
  if (cErr) { console.error(cErr.message); process.exit(1) }
  // group cmas by base slug
  const byBase = new Map()
  for (const c of cmas) {
    const b = baseOf(c.slug)
    ;(byBase.get(b) ?? byBase.set(b, []).get(b)).push(c)
  }
  const pick = (baseSlug, expected) => {
    const group = byBase.get(baseSlug)
    if (!group?.length) return null
    const expType = group.filter((c) => c.doc_type === expected)
    const pool = expType.length ? expType : group
    return pool.slice().sort((a, b) => verOf(b.slug) - verOf(a.slug))[0] ?? null
  }

  const out = { apply: APPLY }
  for (const [table, keyCol, expected] of [['expired_listings', 'listing_key', 'expired-audit'], ['fsbo_listings', 'fsbo_url', 'cma']]) {
    const { data: rows, error } = await sb.from(table).select(`${keyCol}, full_address, street_address, city, postal_code, cma_id`).is('cma_id', null)
    if (error) { console.error(table, error.message); continue }
    let matched = 0, unmatched = 0, applied = 0
    for (const r of rows) {
      const full = r.full_address || [r.street_address, r.city, 'OR', r.postal_code].filter(Boolean).join(', ')
      if (!full) { unmatched++; continue }
      const doc = pick(slugifyAddress(full), expected)
      if (!doc) { unmatched++; continue }
      matched++
      if (APPLY) {
        const { error: uErr } = await sb.from(table).update({ cma_id: doc.id }).eq(keyCol, r[keyCol])
        if (uErr) console.error('update failed', table, r[keyCol], uErr.message)
        else applied++
      }
    }
    out[table] = { total: rows.length, matched, unmatched, applied }
  }
  console.log(JSON.stringify(out, null, 2))
}
run()
