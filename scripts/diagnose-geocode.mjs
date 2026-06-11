#!/usr/bin/env node
// Diagnose: pull 20 untagged Bend leads, log what's happening on each
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '/Users/matthewryan/RyanRealty/.env.local' })

const FUB_BASE = 'https://api.followupboss.com/v1'
const FUB_KEY = process.env.FOLLOWUPBOSS_API_KEY.trim()
const AUTH = `Basic ${Buffer.from(`${FUB_KEY}:`).toString('base64')}`
const HEADERS = { Authorization: AUTH, 'Content-Type': 'application/json', Accept: 'application/json' }
const gKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const targets = []
let nextCursor = null, walked = 0
while (targets.length < 20) {
  const url = nextCursor
    ? `${FUB_BASE}/people?tags=city:bend&limit=100&next=${nextCursor}&fields=allFields`
    : `${FUB_BASE}/people?tags=city:bend&limit=100&fields=allFields`
  const r = await fetch(url, { headers: HEADERS })
  const data = await r.json()
  const ps = data.people || []
  if (ps.length === 0) break
  for (const p of ps) {
    if ((p.tags || []).some(t => t.startsWith('neighborhood:'))) continue
    let addr = null
    const a = (p.addresses || []).find(a => a.street && a.city)
    if (a) addr = `${a.street}, ${a.city}, ${a.state || 'OR'} ${a.postalCode || ''}`.trim()
    else if (p.customSellerPropertyAddress) addr = p.customSellerPropertyAddress
    if (addr) targets.push({ id: p.id, addr, tags: p.tags || [] })
    if (targets.length >= 20) break
  }
  walked += ps.length
  nextCursor = data._metadata?.next || null
  if (!nextCursor) break
}
console.log(`Diagnosing ${targets.length} leads, walked ${walked}`)

for (const t of targets) {
  process.stdout.write(`[${t.id}] ${t.addr.padEnd(60)}  →  `)
  try {
    const u = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(t.addr)}&key=${gKey}&region=us&components=country:US|administrative_area:OR`
    const r = await fetch(u)
    const j = await r.json()
    if (j.status !== 'OK') { console.log(`GEOCODE-FAIL ${j.status}${j.error_message ? ' '+j.error_message : ''}`); continue }
    const ll = j.results[0].geometry.location
    const { data: geo, error } = await supabase.rpc('lookup_address_geo', { lat: ll.lat, lng: ll.lng })
    if (error) { console.log(`RPC-FAIL ${error.message}`); continue }
    const g = Array.isArray(geo) ? geo[0] : geo
    if (!g?.neighborhood_slug) { console.log(`NO-NBHD (lat=${ll.lat.toFixed(3)}, lng=${ll.lng.toFixed(3)})`); continue }
    console.log(`OK neighborhood=${g.neighborhood_slug}`)
  } catch (e) {
    console.log(`EXCEPTION ${e.message}`)
  }
  await new Promise(r => setTimeout(r, 150))
}
