#!/usr/bin/env node
/**
 * bootstrap-dim-office.mjs — seed / refresh analytics_dim_office
 *
 * Uses curated alias groups from data/analytics/office-brand-aliases.json
 * (true entity merges) + brand_family rules for unlabeled mart strings.
 * Does NOT invent share numbers — dim is identity only.
 *
 * Methodology: docs/plans/seo-voice/DIM_OFFICE_ENTITY_RESOLUTION.md
 *
 * Usage: node scripts/analytics/bootstrap-dim-office.mjs
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
config({ path: join(ROOT, '.env.local') })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const catalog = JSON.parse(
  readFileSync(join(ROOT, 'data/analytics/office-brand-aliases.json'), 'utf8'),
)

function normKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function brandFamilyFromRules(name) {
  const k = String(name || '')
  for (const rule of catalog.brand_family_rules || []) {
    if (new RegExp(rule.pattern, 'i').test(k)) return rule.brand_family
  }
  return null
}

function isRyanName(name) {
  return /ryan\s*realty/i.test(String(name || ''))
}

// Build alias → group index (case-insensitive exact + normalized)
const groups = (catalog.groups || []).map((g) => ({
  canonical_name: g.canonical_name,
  brand_family: g.brand_family ?? null,
  is_ryan_realty: Boolean(g.is_ryan_realty),
  aliases: [...new Set((g.aliases || []).map((a) => String(a).trim()).filter(Boolean))],
}))

const aliasToGroupIdx = new Map()
for (let i = 0; i < groups.length; i++) {
  const g = groups[i]
  const keys = new Set([g.canonical_name, ...g.aliases].map((a) => a.toLowerCase()))
  const norms = new Set([g.canonical_name, ...g.aliases].map(normKey))
  for (const k of keys) aliasToGroupIdx.set(`e:${k}`, i)
  for (const k of norms) aliasToGroupIdx.set(`n:${k}`, i)
}

function resolveGroupIndex(rawName) {
  const name = String(rawName || '').trim()
  if (!name) return null
  if (aliasToGroupIdx.has(`e:${name.toLowerCase()}`)) {
    return aliasToGroupIdx.get(`e:${name.toLowerCase()}`)
  }
  if (aliasToGroupIdx.has(`n:${normKey(name)}`)) {
    return aliasToGroupIdx.get(`n:${normKey(name)}`)
  }
  return null
}

const { data: martRows, error: martErr } = await sb
  .from('analytics_mart_office_share_annual')
  .select('office_name')
  .eq('geo_slug', 'central-oregon')
if (martErr) throw new Error(martErr.message)

const martNames = [
  ...new Set((martRows || []).map((r) => String(r.office_name || '').trim()).filter(Boolean)),
]

// Attach observed mart strings to their groups
const groupObserved = groups.map(() => new Set())
const ungrouped = []
for (const name of martNames) {
  const idx = resolveGroupIndex(name)
  if (idx == null) ungrouped.push(name)
  else groupObserved[idx].add(name)
}

const now = new Date().toISOString()
let upserted = 0
let deletedAbsorbed = 0
const absorbedCanonicals = new Set()

for (let i = 0; i < groups.length; i++) {
  const g = groups[i]
  const aliasSet = new Set(g.aliases)
  for (const o of groupObserved[i]) aliasSet.add(o)
  // Always include canonical
  aliasSet.add(g.canonical_name)
  const aliases = [...aliasSet].sort((a, b) => a.localeCompare(b))

  // Mark non-canonical aliases for absorption cleanup
  for (const a of aliases) {
    if (a.toLowerCase() !== g.canonical_name.toLowerCase()) {
      absorbedCanonicals.add(a.toLowerCase())
    }
  }

  const row = {
    canonical_name: g.canonical_name,
    brand_family: g.brand_family,
    is_ryan_realty: g.is_ryan_realty || isRyanName(g.canonical_name),
    aliases,
    updated_at: now,
  }

  // Prefer update-by-lower-canonical, else insert
  const { data: existing, error: findErr } = await sb
    .from('analytics_dim_office')
    .select('office_id, canonical_name')
    .ilike('canonical_name', g.canonical_name)
    .maybeSingle()
  if (findErr) throw new Error(findErr.message)

  if (existing?.office_id) {
    const { error: upErr } = await sb
      .from('analytics_dim_office')
      .update(row)
      .eq('office_id', existing.office_id)
    if (upErr) throw new Error(`update ${g.canonical_name}: ${upErr.message}`)
  } else {
    const { error: insErr } = await sb.from('analytics_dim_office').insert(row)
    if (insErr) throw new Error(`insert ${g.canonical_name}: ${insErr.message}`)
  }
  upserted++
}

// Self-alias rows for ungrouped mart names
for (const name of ungrouped) {
  if (absorbedCanonicals.has(name.toLowerCase())) continue
  const row = {
    canonical_name: name,
    brand_family: brandFamilyFromRules(name),
    is_ryan_realty: isRyanName(name),
    aliases: [name],
    updated_at: now,
  }
  const { data: existing, error: findErr } = await sb
    .from('analytics_dim_office')
    .select('office_id')
    .ilike('canonical_name', name)
    .maybeSingle()
  if (findErr) throw new Error(findErr.message)
  if (existing?.office_id) {
    const { error: upErr } = await sb
      .from('analytics_dim_office')
      .update(row)
      .eq('office_id', existing.office_id)
    if (upErr) console.warn('update fail', name, upErr.message)
    else upserted++
  } else {
    const { error: insErr } = await sb.from('analytics_dim_office').insert(row)
    if (insErr && !/duplicate|unique/i.test(insErr.message)) {
      console.warn('insert fail', name, insErr.message)
    } else if (!insErr) upserted++
  }
}

// Delete dim rows that were standalone and are now only aliases of a group
if (absorbedCanonicals.size) {
  const { data: allDim, error: dimErr } = await sb
    .from('analytics_dim_office')
    .select('office_id, canonical_name')
  if (dimErr) throw new Error(dimErr.message)
  const groupCanonicalLower = new Set(groups.map((g) => g.canonical_name.toLowerCase()))
  for (const row of allDim || []) {
    const cn = String(row.canonical_name || '')
    if (groupCanonicalLower.has(cn.toLowerCase())) continue
    if (!absorbedCanonicals.has(cn.toLowerCase())) continue
    const { error: delErr } = await sb
      .from('analytics_dim_office')
      .delete()
      .eq('office_id', row.office_id)
    if (delErr) console.warn('delete absorbed fail', cn, delErr.message)
    else deletedAbsorbed++
  }
}

// Summary stats
const { data: brandRows } = await sb
  .from('analytics_dim_office')
  .select('brand_family, aliases, is_ryan_realty, canonical_name')
const withBrand = (brandRows || []).filter((r) => r.brand_family)
const multiAlias = (brandRows || []).filter((r) => (r.aliases || []).length > 1)
const ryan = (brandRows || []).filter((r) => r.is_ryan_realty)

const brandCounts = {}
for (const r of withBrand) {
  brandCounts[r.brand_family] = (brandCounts[r.brand_family] || 0) + 1
}

console.log(
  JSON.stringify(
    {
      catalog_version: catalog.version,
      mart_names: martNames.length,
      curated_groups: groups.length,
      ungrouped_self_alias: ungrouped.length,
      upserted,
      deleted_absorbed: deletedAbsorbed,
      dim_total: (brandRows || []).length,
      with_brand_family: withBrand.length,
      multi_alias_entities: multiAlias.length,
      multi_alias_sample: multiAlias.slice(0, 12).map((r) => ({
        canonical: r.canonical_name,
        brand: r.brand_family,
        aliases: r.aliases,
      })),
      brand_family_office_counts: brandCounts,
      ryan: ryan.map((r) => ({ canonical: r.canonical_name, aliases: r.aliases })),
    },
    null,
    2,
  ),
)
