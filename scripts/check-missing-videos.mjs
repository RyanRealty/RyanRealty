#!/usr/bin/env node
/**
 * One-shot: hit Spark v1 live for Drouillard + Newport Hills + a sanity check
 * on the three we already have to confirm whether the Supabase cache is stale.
 * If Spark has Videos arrays for the first two, we'll either refresh the cache
 * or add them as ADDRESS_OVERRIDES.
 */
import { readFileSync } from 'node:fs'

const envText = readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(
  envText.split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]
  }),
)

const SPARK_BASE = env.SPARK_API_BASE_URL || 'https://sparkapi.com/v1'
const SPARK_KEY = env.SPARK_API_KEY
const SCHEME = env.SPARK_AUTH_SCHEME || 'Bearer'

const LISTINGS = [
  { key: '20250429180931847661000000', label: 'Drouillard (Rebecca list — Matt says video exists)' },
  { key: '20250120214617650644000000', label: 'Newport Hills (Matt list — Matt says video exists)' },
  { key: '20250321125955542501000000', label: 'Sunstone (confirmed has YouTube video)' },
  { key: '20260225192329433521000000', label: 'Tumalo Reservoir (confirmed has Aryeo video)' },
  { key: '20250707185011121446000000', label: 'Old Bend-Redmond (confirmed has Aryeo video)' },
]

function extractEmbedUrl(objectHtml) {
  if (!objectHtml) return null
  const raw = String(objectHtml).trim()
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^\/\//.test(raw)) return `https:${raw}`
  const m = /<iframe[^>]+\bsrc=["']([^"']+)["']/i.exec(raw)
  if (m && m[1]) {
    const src = m[1]
    if (src.startsWith('//')) return `https:${src}`
    if (/^https?:\/\//i.test(src)) return src
  }
  return null
}

for (const l of LISTINGS) {
  const url = `${SPARK_BASE}/listings/${encodeURIComponent(l.key)}?_expand=Photos,Videos,VirtualTours`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `${SCHEME} ${SPARK_KEY}`, Accept: 'application/json' },
    })
    if (!res.ok) {
      console.error(`${l.label}: ${res.status}`)
      continue
    }
    const data = await res.json()
    const result = data?.D?.Results?.[0]
    const fields = result?.StandardFields ?? {}
    const videos = fields.Videos ?? []
    const tours = fields.VirtualTours ?? []
    console.log(`# ${l.label}`)
    console.log(`#   ListingKey: ${l.key}`)
    console.log(`#   Videos count: ${videos.length}`)
    console.log(`#   VirtualTours count: ${tours.length}`)
    for (const v of videos) {
      const url = extractEmbedUrl(v.ObjectHtml)
      console.log(`#   Video: ${v.Name || '(no name)'} → ${url || '(no embed URL)'}`)
    }
    for (const t of tours) {
      console.log(`#   Tour: ${t.Name || '(no name)'} → ${t.Uri || '(no uri)'}`)
    }
    console.log('')
  } catch (e) {
    console.error(`${l.label}: ${e.message}`)
  }
}
