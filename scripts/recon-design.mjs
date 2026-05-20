#!/usr/bin/env node
/**
 * recon-design.mjs — Apify-driven design pattern recon for Ryan Realty.
 *
 * Pulls 30-50 high-performing real-world examples of a flat-design format
 * (FB lead-gen ad / print flyer / LinkedIn doc carousel / IG carousel /
 * map static card / Google Ads SERP card) and saves raw output + imagery
 * to out/design-recon/<format>/ for downstream pattern analysis.
 *
 * See marketing_brain_skills/competitor-design-recon/SKILL.md for the full
 * workflow + producer-consumption contract.
 *
 * Usage:
 *   node scripts/recon-design.mjs --format <key> [--count 40] [--query "..."]
 *
 * Format keys: fb-lead-gen-ad | print-flyer | linkedin-doc-carousel |
 *              ig-carousel | map-static-card | google-ads-serp
 *
 * Env: APIFY_API_TOKEN (set in .env.local).
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const APIFY_BASE = 'https://api.apify.com/v2'

// ─────────────────────────────────────────────────────────────────────────────
// Format registry — keep in sync with the SKILL.md "Five seed formats" table.
// ─────────────────────────────────────────────────────────────────────────────

const FORMAT_REGISTRY = {
  'fb-lead-gen-ad': {
    actor: 'curious_coder/facebook-ads-library-scraper',
    defaultQuery: 'real estate listing',
    description: 'Facebook Ads Library — high-performing real-estate lead-gen ads',
    inputBuilder: (q, count) => ({
      urls: [
        // Active FB ads filtered to real-estate-adjacent in US
        `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${encodeURIComponent(q)}&search_type=keyword_unordered&media_type=image`,
      ],
      count,
    }),
    imageFromItem: (item) =>
      item.images?.[0]?.original_image_url ?? item.image_url ?? item.creative_url ?? null,
    titleFromItem: (item) =>
      item.ad_archive_id ?? item.ad_id ?? item.page_name ?? 'unknown',
  },
  'print-flyer': {
    actor: 'apify/google-search-scraper',
    defaultQuery: 'real estate listing flyer 8.5x11 design',
    description: 'Google Image SERP — top real estate listing flyer designs',
    inputBuilder: (q, count) => ({
      queries: q,
      maxPagesPerQuery: Math.max(1, Math.ceil(count / 10)),
      resultsPerPage: 10,
      searchType: 'image',
      countryCode: 'us',
      languageCode: 'en',
    }),
    imageFromItem: (item) =>
      item.imageUrl ?? item.image?.url ?? item.thumbnailUrl ?? null,
    titleFromItem: (item) => item.title ?? item.snippet ?? 'unknown',
  },
  'linkedin-doc-carousel': {
    actor: 'apify/website-content-crawler',
    defaultQuery: 'site:linkedin.com/posts "document" real estate market report',
    description: 'LinkedIn document carousels by top real-estate creators',
    inputBuilder: (q, count) => ({
      startUrls: [{ url: `https://www.google.com/search?q=${encodeURIComponent(q)}` }],
      maxCrawlPages: Math.max(5, Math.ceil(count / 4)),
      maxResults: count,
    }),
    imageFromItem: (item) => item.images?.[0] ?? null,
    titleFromItem: (item) => item.title ?? item.url ?? 'unknown',
  },
  'ig-carousel': {
    actor: 'apify/instagram-scraper',
    defaultQuery: 'realestate',
    description: 'Instagram top-engagement real estate carousels',
    inputBuilder: (q, count) => ({
      search: q,
      searchType: 'hashtag',
      resultsType: 'posts',
      resultsLimit: count,
      onlyPostsNewerThan: '90 days',
    }),
    imageFromItem: (item) =>
      item.displayUrl ?? item.images?.[0] ?? item.thumbnailUrl ?? null,
    titleFromItem: (item) => item.shortCode ?? item.id ?? 'unknown',
  },
  'map-static-card': {
    actor: 'apify/google-search-scraper',
    defaultQuery: 'real estate listing map location card zillow compass sothebys',
    description: 'Real estate listing location-cards via image SERP',
    inputBuilder: (q, count) => ({
      queries: q,
      maxPagesPerQuery: Math.max(1, Math.ceil(count / 10)),
      resultsPerPage: 10,
      searchType: 'image',
      countryCode: 'us',
    }),
    imageFromItem: (item) =>
      item.imageUrl ?? item.image?.url ?? item.thumbnailUrl ?? null,
    titleFromItem: (item) => item.title ?? 'unknown',
  },
  'google-ads-serp': {
    actor: 'apify/google-search-scraper',
    defaultQuery: 'sell my house bend oregon',
    description: 'Google Ads SERP cards for real estate queries',
    inputBuilder: (q, count) => ({
      queries: q,
      maxPagesPerQuery: 1,
      resultsPerPage: 10,
      searchType: 'web',
      countryCode: 'us',
      includePaidResults: true,
    }),
    imageFromItem: () => null, // SERP cards are text+layout; no image to download
    titleFromItem: (item) => item.title ?? item.url ?? 'unknown',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI arg parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { format: null, count: 40, query: null }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--format') args.format = argv[++i]
    else if (a === '--count') args.count = parseInt(argv[++i], 10)
    else if (a === '--query') args.query = argv[++i]
    else if (a === '--help' || a === '-h') {
      printUsageAndExit(0)
    } else {
      console.error(`Unknown arg: ${a}`)
      printUsageAndExit(1)
    }
  }
  return args
}

function printUsageAndExit(code) {
  const formats = Object.keys(FORMAT_REGISTRY).join(' | ')
  console.error(
    `Usage: node scripts/recon-design.mjs --format <key> [--count N] [--query "..."]\n\n` +
      `Format keys: ${formats}\n\n` +
      `See marketing_brain_skills/competitor-design-recon/SKILL.md for the workflow.`,
  )
  process.exit(code)
}

// ─────────────────────────────────────────────────────────────────────────────
// Apify client
// ─────────────────────────────────────────────────────────────────────────────

function getApifyToken() {
  const token = process.env.APIFY_API_TOKEN
  if (!token) {
    console.error(
      'ERROR: APIFY_API_TOKEN not set. Add to .env.local from apify.com/account/integrations.',
    )
    process.exit(2)
  }
  return token
}

/** Start an Apify actor run, poll until done, return the dataset items. */
async function runActor(actorId, input, { pollIntervalMs = 5000, timeoutMs = 10 * 60 * 1000 } = {}) {
  const token = getApifyToken()
  console.log(`→ Starting Apify actor: ${actorId}`)
  const startRes = await fetch(`${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })
  if (!startRes.ok) {
    const body = await startRes.text()
    throw new Error(`Apify start failed (${startRes.status}): ${body}`)
  }
  const startJson = await startRes.json()
  const runId = startJson.data.id
  const datasetId = startJson.data.defaultDatasetId
  console.log(`  run id: ${runId}, dataset id: ${datasetId}`)

  // Poll for completion
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!statusRes.ok) {
      throw new Error(`Apify status fetch failed (${statusRes.status})`)
    }
    const statusJson = await statusRes.json()
    const status = statusJson.data.status
    if (status === 'SUCCEEDED') {
      console.log(`  ✓ actor finished`)
      break
    }
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify run ended with status ${status}`)
    }
    process.stdout.write(`  ⏳ ${status} (${Math.round((Date.now() - startedAt) / 1000)}s)\r`)
    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }

  // Pull dataset items
  const itemsRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?format=json&clean=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!itemsRes.ok) {
    const body = await itemsRes.text()
    throw new Error(`Apify dataset fetch failed (${itemsRes.status}): ${body}`)
  }
  const items = await itemsRes.json()
  console.log(`  → ${items.length} items returned`)
  return { items, runId, datasetId }
}

// ─────────────────────────────────────────────────────────────────────────────
// Image downloader
// ─────────────────────────────────────────────────────────────────────────────

async function downloadImage(url, destPath) {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`  ⚠ skip ${url}: HTTP ${res.status}`)
      return false
    }
    const body = Readable.fromWeb(res.body)
    await pipeline(body, createWriteStream(destPath))
    return true
  } catch (err) {
    console.error(`  ⚠ download error ${url}: ${err.message}`)
    return false
  }
}

function safeSlug(s, maxLen = 40) {
  return (s || 'item')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv)
  if (!args.format) {
    console.error('ERROR: --format is required.')
    printUsageAndExit(1)
  }
  const spec = FORMAT_REGISTRY[args.format]
  if (!spec) {
    console.error(`ERROR: unknown format '${args.format}'.`)
    printUsageAndExit(1)
  }

  const query = args.query ?? spec.defaultQuery
  const count = Math.max(1, Math.min(200, args.count))
  console.log(`Format     : ${args.format}`)
  console.log(`Actor      : ${spec.actor}`)
  console.log(`Query      : ${JSON.stringify(query)}`)
  console.log(`Sample size: ${count}`)

  const outDir = path.join(REPO_ROOT, 'out', 'design-recon', args.format)
  const examplesDir = path.join(outDir, 'examples')
  await mkdir(examplesDir, { recursive: true })

  // Run Apify
  const input = spec.inputBuilder(query, count)
  const { items, runId, datasetId } = await runActor(spec.actor, input)

  // Save raw
  await writeFile(path.join(outDir, 'raw.json'), JSON.stringify(items, null, 2))
  console.log(`  → raw.json (${items.length} items)`)

  // Download images
  let downloaded = 0
  for (let i = 0; i < Math.min(items.length, count); i++) {
    const item = items[i]
    const imageUrl = spec.imageFromItem(item)
    if (!imageUrl) continue
    const title = safeSlug(spec.titleFromItem(item))
    const ext = (imageUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)?.[1] ?? 'jpg').toLowerCase()
    const dest = path.join(examplesDir, `${String(i + 1).padStart(3, '0')}-${title}.${ext}`)
    const ok = await downloadImage(imageUrl, dest)
    if (ok) downloaded++
  }
  console.log(`  → examples/ (${downloaded} images downloaded)`)

  // Save manifest
  const manifest = {
    format: args.format,
    source_actor: spec.actor,
    source_query: query,
    apify_run_id: runId,
    apify_dataset_id: datasetId,
    run_at: new Date().toISOString(),
    item_count: items.length,
    images_downloaded: downloaded,
    next_step: `Author out/design-recon/${args.format}/recon.md documenting the top 5 layout patterns.`,
  }
  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`\n✓ Done. Output: ${outDir}`)
  console.log(`  Next: review examples/ and author recon.md per SKILL.md template.`)
}

main().catch((err) => {
  console.error(`\n✗ FAILED: ${err.message}`)
  process.exit(1)
})
