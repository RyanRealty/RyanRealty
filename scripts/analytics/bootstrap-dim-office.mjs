#!/usr/bin/env node
/**
 * bootstrap-dim-office.mjs — seed analytics_dim_office from mart office names
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
config({ path: join(ROOT, '.env.local') })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

function brandFamily(name) {
  const k = name.toLowerCase()
  if (k.includes('re/max') || k.includes('remax')) return 'RE/MAX'
  if (k.includes('john l')) return 'John L. Scott'
  if (k.includes("sotheby") || k.includes('cascade hasson')) return "Cascade Hasson / Sotheby's"
  if (k.includes('coldwell')) return 'Coldwell Banker'
  if (k.includes('keller williams') || k.includes('kw ')) return 'Keller Williams'
  if (k.includes('exp ')) return 'eXp'
  if (k.includes('windermere')) return 'Windermere'
  if (k.includes('duke warner')) return 'Duke Warner'
  if (k.includes('century 21')) return 'Century 21'
  if (k.includes('ryan realty')) return 'Ryan Realty'
  if (k.includes('stellar')) return 'Stellar'
  if (k.includes('pahlisch')) return 'Pahlisch'
  return null
}

const { data, error } = await sb
  .from('analytics_mart_office_share_annual')
  .select('office_name')
  .eq('geo_slug', 'central-oregon')
  .eq('year', 2024)
if (error) throw new Error(error.message)

const names = [...new Set((data || []).map((r) => r.office_name).filter(Boolean))]
let upserted = 0
for (const canonical_name of names) {
  const is_ryan = /ryan realty/i.test(canonical_name)
  const { error: e } = await sb.from('analytics_dim_office').upsert(
    {
      canonical_name,
      brand_family: brandFamily(canonical_name),
      is_ryan_realty: is_ryan,
      aliases: [canonical_name],
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'canonical_name', ignoreDuplicates: false },
  )
  // unique on lower(canonical) may not match onConflict — use insert ignore
  if (e) {
    // try plain insert skip
    const { error: e2 } = await sb.from('analytics_dim_office').insert({
      canonical_name,
      brand_family: brandFamily(canonical_name),
      is_ryan_realty: is_ryan,
      aliases: [canonical_name],
    })
    if (e2 && !/duplicate|unique/i.test(e2.message)) console.warn(canonical_name, e2.message)
    else upserted++
  } else upserted++
}
console.log(JSON.stringify({ names: names.length, upserted, ryan: names.filter((n) => /ryan/i.test(n)) }))
