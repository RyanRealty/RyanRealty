#!/usr/bin/env node
/**
 * Download distinct listing photos from Supabase (listing_photos) for flyer compositor.
 *
 * Usage:
 *   node scripts/fetch-listing-photos-for-flyer.mjs --mls 220221088 --out-dir out/flyers/220221088
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

loadEnv({ path: join(REPO_ROOT, '.env.local') })

async function downloadToFile(url, dest) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`GET ${url.slice(0, 80)}… → ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(dest, buf)
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      mls: { type: 'string' },
      'out-dir': { type: 'string' },
      limit: { type: 'string', default: '4' },
    },
    allowPositionals: false,
  })

  const mls = String(values.mls || '').trim()
  const outDir = resolve(process.cwd(), values['out-dir'] || `out/flyers/${mls}`)
  const limit = Math.min(12, Math.max(1, parseInt(values.limit || '4', 10) || 4))

  if (!mls) {
    console.error('Usage: node scripts/fetch-listing-photos-for-flyer.mjs --mls 220221088 --out-dir out/flyers/220221088')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const sb = createClient(url, key)

  const { data: listing, error: le } = await sb
    .from('listings')
    .select(
      'ListingKey, ListNumber, StreetNumber, StreetName, City, State, PostalCode, ListPrice, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, lot_size_acres, public_remarks, StandardStatus'
    )
    .eq('ListNumber', mls)
    .maybeSingle()

  if (le) {
    console.error('[fetch-listing-photos]', le.message)
    process.exit(1)
  }
  if (!listing?.ListingKey) {
    console.error(`No listing row for ListNumber=${mls}`)
    process.exit(1)
  }

  const lk = String(listing.ListingKey)
  const { data: rows, error: pe } = await sb
    .from('listing_photos')
    .select('photo_url, cdn_url, sort_order, id')
    .eq('listing_key', lk)
    .order('sort_order', { ascending: true })

  if (pe) {
    console.error('[fetch-listing-photos]', pe.message)
    process.exit(1)
  }

  /** @type {string[]} */
  let urls = []

  if (rows && rows.length > 0) {
    const seen = new Set()
    for (const r of rows) {
      const u = String(r.cdn_url || r.photo_url || '').trim()
      if (!u || seen.has(u)) continue
      seen.add(u)
      urls.push(u)
      if (urls.length >= limit) break
    }
  }

  if (urls.length === 0) {
    const { data: row, error: de } = await sb
      .from('listings')
      .select('PhotoURL, details')
      .eq('ListingKey', lk)
      .maybeSingle()
    if (de) {
      console.error('[fetch-listing-photos] details fallback', de.message)
      process.exit(1)
    }
    const d = row?.details && typeof row.details === 'object' ? row.details : {}
    const sparkPhotos = Array.isArray(d.Photos) ? d.Photos : []
    const seen = new Set()
    if (sparkPhotos.length > 0) {
      for (let i = 0; i < sparkPhotos.length; i++) {
        const p = sparkPhotos[i] && typeof sparkPhotos[i] === 'object' ? sparkPhotos[i] : {}
        const u = String(
          p.Uri1600 ?? p.Uri1280 ?? p.Uri1024 ?? p.Uri800 ?? p.Uri640 ?? p.Uri300 ?? p.Uri ?? p.URL ?? p.Url ?? ''
        ).trim()
        if (!u || seen.has(u)) continue
        seen.add(u)
        urls.push(u)
        if (urls.length >= limit) break
      }
    }
    const hero = String(row?.PhotoURL || '').trim()
    if (hero && !seen.has(hero)) {
      urls.push(hero)
      seen.add(hero)
    }
  }

  if (urls.length === 0) {
    console.error(`No photos for ListingKey=${lk} (MLS ${mls}): empty listing_photos and no details.Photos / PhotoURL`)
    process.exit(1)
  }

  mkdirSync(outDir, { recursive: true })

  /** @type {string[]} */
  const localNames = []
  for (let i = 0; i < urls.length; i++) {
    const extGuess = urls[i].toLowerCase().includes('.png') ? 'png' : 'jpg'
    const name = `mls-${mls}-${String(i + 1).padStart(2, '0')}.${extGuess}`
    const dest = join(outDir, name)
    // eslint-disable-next-line no-await-in-loop
    await downloadToFile(urls[i], dest)
    localNames.push(name)
    console.log('saved', dest)
  }

  const cfgPath = join(outDir, 'config.json')
  /** @type {Record<string, unknown>} */
  let cfg = {}
  if (existsSync(cfgPath)) {
    try {
      cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
    } catch {
      cfg = {}
    }
  }

  cfg.photos = localNames
  const remarks = listing.public_remarks ? String(listing.public_remarks).trim() : ''
  if (remarks) cfg.description = remarks
  const acres = listing.lot_size_acres
  if (acres != null && !Number.isNaN(Number(acres))) cfg.acres = Number(acres)
  cfg.mls = mls
  if (listing.StandardStatus) cfg.status = String(listing.StandardStatus)
  if (listing.BedroomsTotal != null) cfg.beds = Number(listing.BedroomsTotal)
  if (listing.BathroomsTotal != null) cfg.baths = Number(listing.BathroomsTotal)
  if (listing.TotalLivingAreaSqFt != null) cfg.sqft = Number(listing.TotalLivingAreaSqFt)
  const street = [listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ').trim()
  if (street) cfg.address = street
  const cityParts = [listing.City, listing.State, listing.PostalCode].filter(Boolean)
  if (cityParts.length) cfg.cityLine = cityParts.join(', ')
  if (listing.ListPrice != null) {
    const p = Number(listing.ListPrice)
    if (!Number.isNaN(p)) cfg.price = `$${p.toLocaleString('en-US')}`
  }

  writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`)

  if (localNames.length < 4) {
    console.warn(
      `[fetch-listing-photos] Only ${localNames.length} distinct photo(s) in DB. Add more MLS media or lower flyer strip expectations.`
    )
  }
  console.log('Updated', cfgPath, 'photos:', localNames.join(', '))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
