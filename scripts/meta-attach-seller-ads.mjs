#!/usr/bin/env node
/**
 * Upload seller-draft static images and attach PAUSED link ads to existing tier shells.
 *
 * Usage:
 *   vercel env pull /tmp/.env --environment=production --yes
 *   set -a && source /tmp/.env && set +a
 *   node scripts/meta-attach-seller-ads.mjs --dry-run
 *   node scripts/meta-attach-seller-ads.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')
const DRY_RUN = process.argv.includes('--dry-run')

// Prefer the USER access token (Matt's personal certified-for-Housing FB
// user) for ad creation. The system-user PAGE token doesn't inherit Matt's
// Housing non-discrimination cert reliably, so Meta returns
// "Certification Required" (error_subcode 2859002) on every ad-create call.
// Falls back to the page token if the user token isn't set — for non-Housing
// scopes it still works.
const TOKEN = (
  process.env.META_USER_ACCESS_TOKEN_USER ||
  process.env.META_PAGE_ACCESS_TOKEN ||
  process.env.META_PAGE_TOKEN ||
  ''
).trim()
const PAGE_ID = (process.env.META_PAGE_ID || process.env.META_FB_PAGE_ID || '').trim()
const AD_ACCT_RAW = (process.env.META_AD_ACCOUNT_ID || '').trim()
if (!TOKEN || !PAGE_ID || !AD_ACCT_RAW) {
  console.error('Missing META_USER_ACCESS_TOKEN_USER (or META_PAGE_ACCESS_TOKEN), META_PAGE_ID/META_FB_PAGE_ID, META_AD_ACCOUNT_ID')
  process.exit(1)
}
console.log(`Using ${process.env.META_USER_ACCESS_TOKEN_USER ? 'USER' : 'PAGE'} token for Meta API calls`)
const AD_ACCT = AD_ACCT_RAW.startsWith('act_') ? AD_ACCT_RAW : `act_${AD_ACCT_RAW}`
const API = 'https://graph.facebook.com/v21.0'

const LP =
  'https://ryan-realty.com/lp/seller-home-value?utm_source=meta&utm_medium=paid_social'

/** @type {Array<{ name: string, adset_id: string, image: string, utm_content: string, message: string, headline: string, description?: string }>} */
const ADS = [
  {
    name: 'RR — T1 — Offer card (free CMA)',
    adset_id: '120244224327800698',
    image: 'out/schoolhouse-just-sold/offer-first/fb-offer-card-1080x1080.jpg',
    utm_content: 't1-offer-card',
    headline: 'What is your Bend home worth?',
    description: 'Free CMA · Bend, Oregon',
    message:
      'Wondering what your place would bring in today\'s market? Ryan Realty will build a real comparative market analysis from local closed sales, not an online guess. No spam and no obligation. We just closed $3,025,000 off-market in Vandevert Ranch. Delivered within one business day.',
  },
  {
    name: 'RR — T1 — Offer photo (Old Mill)',
    adset_id: '120244224327800698',
    image: 'out/schoolhouse-just-sold/offer-first/fb-offer-photo-1080x1080.jpg',
    utm_content: 't1-offer-photo',
    headline: 'What is your Bend home worth?',
    description: 'Free CMA · one business day',
    message:
      'A real number from real local sales. Not a Zillow guess. Free comparative market analysis for your Bend home. No obligation.',
  },
  {
    name: 'RR — T4 — MOFU soft re-approach',
    adset_id: '120244224342140698',
    image: 'out/schoolhouse-just-sold/offer-first/fb-offer-photo-1080x1080.jpg',
    utm_content: 't4-b1-soft',
    headline: 'Still curious what your home is worth?',
    description: 'Free CMA · Ryan Realty',
    message:
      'No pressure. The team that closed $3,025,000 off-market in Vandevert Ranch will tell you the real number for your home within one business day.',
  },
  {
    name: 'RR — T5 — BOFU hot valuation',
    adset_id: '120244224344090698',
    image: 'out/schoolhouse-just-sold/offer-first/fb-offer-card-1080x1080.jpg',
    utm_content: 't5-bofu-cma',
    headline: 'Your Bend home value',
    description: 'Free CMA today',
    message:
      'You looked at our seller page. Want the real number for your home? Free comparative market analysis from local closed sales. One business day.',
  },
  {
    name: 'RR — T2A — Cold CMA offer',
    adset_id: '120244224332950698',
    image: 'out/schoolhouse-just-sold/offer-first/fb-offer-card-1080x1080.jpg',
    utm_content: 't2a-cold-cma',
    headline: 'Your Bend home is worth more than Zillow says',
    description: 'Free CMA · local comps',
    message:
      'Zillow\'s median error rate is about 7%. On an $850,000 home that is a $59,500 swing. We send the real number from comparable sales actually closing near you. Within one business day, no obligation.',
  },
]

async function meta(method, path, body) {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${API}/${path}${sep}access_token=${encodeURIComponent(TOKEN)}`
  const init = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) init.body = JSON.stringify(body)
  const r = await fetch(url, init)
  const text = await r.text()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { raw: text }
  }
  return { ok: r.ok, status: r.status, body: parsed }
}

async function uploadImage(absPath) {
  const fileName = basename(absPath)
  const bytes = await readFile(absPath)
  const form = new FormData()
  form.append('access_token', TOKEN)
  form.append(fileName, new Blob([bytes], { type: 'image/jpeg' }), fileName)

  const url = `${API}/${AD_ACCT}/adimages`
  const res = await fetch(url, { method: 'POST', body: form })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`adimages upload non-JSON: ${text.slice(0, 300)}`)
  }
  if (data.error) throw new Error(`adimages: ${data.error.message}`)
  const entry = data.images?.[fileName] || Object.values(data.images || {})[0]
  if (!entry?.hash) throw new Error(`adimages: no hash for ${fileName}: ${JSON.stringify(data).slice(0, 200)}`)
  return entry.hash
}

async function findExistingAd(adsetId, name) {
  const filter = encodeURIComponent(
    JSON.stringify([{ field: 'name', operator: 'EQUAL', value: name }])
  )
  const list = await meta('GET', `${adsetId}/ads?fields=id,name,status&limit=50&filtering=${filter}`)
  if (!list.ok) return null
  return list.body?.data?.[0] || null
}

function campaignSlug(utmContent) {
  if (utmContent.startsWith('t1-')) return 'tier1-database'
  if (utmContent.startsWith('t2a-')) return 'tier2a-tofu'
  if (utmContent.startsWith('t4-')) return 'tier4-mofu'
  if (utmContent.startsWith('t5-')) return 'tier5-bofu'
  return 'seller-lp'
}

async function createLinkAd(spec, imageHash) {
  const link = `${LP}&utm_campaign=${campaignSlug(spec.utm_content)}&utm_content=${spec.utm_content}`

  const creativeBody = {
    name: `${spec.name} — creative`,
    object_story_spec: {
      page_id: PAGE_ID,
      link_data: {
        image_hash: imageHash,
        link,
        message: spec.message,
        name: spec.headline.slice(0, 40),
        ...(spec.description ? { description: spec.description.slice(0, 40) } : {}),
        call_to_action: { type: 'LEARN_MORE', value: { link } },
      },
    },
  }

  if (DRY_RUN) {
    console.log(`  [dry] creative + ad for "${spec.name}" → ${link}`)
    return { creative_id: 'dry-creative', ad_id: 'dry-ad', link }
  }

  const cr = await meta('POST', `${AD_ACCT}/adcreatives`, creativeBody)
  if (!cr.ok) throw new Error(`creative: ${JSON.stringify(cr.body).slice(0, 400)}`)
  const creativeId = cr.body.id

  const ad = await meta('POST', `${AD_ACCT}/ads`, {
    name: spec.name,
    adset_id: spec.adset_id,
    creative: { creative_id: creativeId },
    status: 'PAUSED',
  })
  if (!ad.ok) throw new Error(`ad: ${JSON.stringify(ad.body).slice(0, 400)}`)

  return { creative_id: creativeId, ad_id: ad.body.id, link }
}

async function main() {
  console.log(`Meta attach seller ads — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`)
  console.log(`Account ${AD_ACCT}  Page ${PAGE_ID}\n`)

  const results = []
  const hashCache = new Map()

  for (const spec of ADS) {
    const abs = resolve(ROOT, spec.image)
    if (!existsSync(abs)) {
      console.error(`✗ Skip ${spec.name}: missing ${spec.image}`)
      results.push({ ...spec, status: 'skipped', error: 'missing image' })
      continue
    }

    const existing = DRY_RUN ? null : await findExistingAd(spec.adset_id, spec.name)
    if (existing) {
      console.log(`✓ Already in FB: "${spec.name}" ad ${existing.id} (${existing.status})`)
      results.push({ ...spec, status: 'exists', ad_id: existing.id })
      continue
    }

    try {
      let hash = hashCache.get(abs)
      if (!hash) {
        if (DRY_RUN) {
          hash = 'dry-hash'
          console.log(`  [dry] upload ${basename(abs)}`)
        } else {
          hash = await uploadImage(abs)
          hashCache.set(abs, hash)
          console.log(`  ↑ uploaded ${basename(abs)} hash=${hash.slice(0, 12)}…`)
        }
      }
      const out = await createLinkAd(spec, hash)
      console.log(`✓ ${spec.name}`)
      console.log(`    ad ${out.ad_id}  creative ${out.creative_id}`)
      console.log(`    ${out.link}`)
      results.push({ ...spec, status: 'created', ...out })
    } catch (err) {
      console.error(`✗ ${spec.name}: ${err.message}`)
      results.push({ ...spec, status: 'error', error: err.message })
    }
  }

  const outDir = resolve(ROOT, 'out/meta-seller-ads')
  await mkdir(outDir, { recursive: true })
  const manifest = {
    uploaded_at: new Date().toISOString(),
    dry_run: DRY_RUN,
    ad_account: AD_ACCT,
    page_id: PAGE_ID,
    ads_manager: `https://business.facebook.com/adsmanager/manage/campaigns?act=${AD_ACCT.replace('act_', '')}`,
    results,
  }
  await writeFile(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`\nManifest: out/meta-seller-ads/manifest.json`)
  const failed = results.filter((r) => r.status === 'error').length
  if (failed) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
