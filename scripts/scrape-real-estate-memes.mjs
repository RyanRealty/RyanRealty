#!/usr/bin/env node
/**
 * scrape-real-estate-memes.mjs — populate data/meme-library.jsonl with
 * high-engagement real-estate memes from IG / TikTok / X / Reddit via
 * Apify actors.
 *
 * Companion to social_media_skills/meme-research/SKILL.md. See that skill
 * for the catalog schema, the 7-mechanism humor taxonomy, and the producer
 * consumption contract.
 *
 * Usage:
 *   node scripts/scrape-real-estate-memes.mjs --platform instagram [--count 50]
 *   node scripts/scrape-real-estate-memes.mjs --platform tiktok [--count 50]
 *   node scripts/scrape-real-estate-memes.mjs --platform x [--count 100]
 *   node scripts/scrape-real-estate-memes.mjs --platform reddit [--count 50]
 *   node scripts/scrape-real-estate-memes.mjs --all  # all 4 sequentially
 *
 * After scraping, the raw entries land in data/meme-library.jsonl with
 * `humor_mechanism` + `humor_explanation` + `ryan_realty_voice_check`
 * fields LEFT EMPTY. The cataloging pass (human or AI) fills these in
 * per the SKILL.md taxonomy.
 */

import { appendFile, readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const APIFY_BASE = 'https://api.apify.com/v2'
const LIBRARY_PATH = path.join(REPO_ROOT, 'data', 'meme-library.jsonl')

// ─────────────────────────────────────────────────────────────────────────────
// Platform spec — locked 2026-05-20 per SKILL.md "Sources"
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORMS = {
  instagram: {
    actor: 'apify/instagram-scraper',
    inputBuilder: (count) => ({
      directUrls: [
        'https://www.instagram.com/explore/tags/realestatememes/',
        'https://www.instagram.com/explore/tags/realtorlife/',
        'https://www.instagram.com/explore/tags/realestateagent/',
      ],
      resultsType: 'posts',
      resultsLimit: count,
      onlyPostsNewerThan: '180 days',
    }),
    mapToCatalog: (item) => ({
      source_platform: 'instagram',
      source_url: item.url ?? `https://instagram.com/p/${item.shortCode}`,
      format: item.type === 'Video' ? 'video' : 'image-with-caption',
      creator_handle: `@${item.ownerUsername ?? 'unknown'}`,
      engagement: {
        likes: item.likesCount ?? 0,
        comments: item.commentsCount ?? 0,
        shares: 0,
      },
      image_url: item.displayUrl ?? item.images?.[0] ?? null,
      caption: item.caption ?? '',
    }),
    minEngagement: { likes: 1000 },
  },
  tiktok: {
    actor: 'clockworks/free-tiktok-scraper',
    inputBuilder: (count) => ({
      hashtags: ['realestatehumor', 'realestatememes', 'realtorlife'],
      resultsPerPage: count,
    }),
    mapToCatalog: (item) => ({
      source_platform: 'tiktok',
      source_url: item.webVideoUrl ?? '',
      format: 'tiktok-text-overlay',
      creator_handle: `@${item.authorMeta?.name ?? 'unknown'}`,
      engagement: {
        likes: item.diggCount ?? 0,
        comments: item.commentCount ?? 0,
        shares: item.shareCount ?? 0,
      },
      image_url: item.videoMeta?.coverUrl ?? null,
      caption: item.text ?? '',
    }),
    minEngagement: { likes: 5000 },
  },
  x: {
    actor: 'apidojo/twitter-scraper',
    inputBuilder: (count) => ({
      searchTerms: ['"real estate" funny -filter:replies', '"real estate" meme', '"realtor" funny'],
      maxItems: count,
      onlyImage: false,
    }),
    mapToCatalog: (item) => ({
      source_platform: 'x',
      source_url: item.url ?? `https://x.com/${item.user?.username}/status/${item.id}`,
      format: 'tweet',
      creator_handle: `@${item.user?.username ?? 'unknown'}`,
      engagement: {
        likes: item.favoriteCount ?? item.likeCount ?? 0,
        comments: item.replyCount ?? 0,
        shares: item.retweetCount ?? 0,
      },
      image_url: item.media?.[0]?.url ?? null,
      caption: item.fullText ?? item.text ?? '',
    }),
    minEngagement: { likes: 500 },
  },
  reddit: {
    actor: 'trudax/reddit-scraper',
    inputBuilder: (count) => ({
      startUrls: [
        { url: 'https://www.reddit.com/r/RealEstate/top/?t=year' },
        { url: 'https://www.reddit.com/r/Realtors/top/?t=year' },
        { url: 'https://www.reddit.com/r/FirstTimeHomeBuyer/top/?t=year' },
      ],
      maxItems: count,
      type: 'posts',
      sort: 'top',
    }),
    mapToCatalog: (item) => ({
      source_platform: 'reddit',
      source_url: item.url ?? '',
      format: 'reddit-post',
      creator_handle: `u/${item.username ?? 'unknown'}`,
      engagement: {
        likes: item.upVotes ?? item.score ?? 0,
        comments: item.numberOfComments ?? 0,
        shares: 0,
      },
      image_url: item.thumbnailUrl ?? null,
      caption: item.title ?? '',
    }),
    minEngagement: { likes: 500 },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Apify client (inline, no SDK dep)
// ─────────────────────────────────────────────────────────────────────────────

function getApifyToken() {
  const token = process.env.APIFY_API_TOKEN
  if (!token) {
    console.error('ERROR: APIFY_API_TOKEN not set.')
    process.exit(2)
  }
  return token
}

async function runActor(actorId, input, { pollIntervalMs = 5000, timeoutMs = 10 * 60 * 1000 } = {}) {
  const token = getApifyToken()
  console.log(`→ Apify actor: ${actorId}`)
  const startRes = await fetch(`${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
  if (!startRes.ok) throw new Error(`actor start ${startRes.status}: ${await startRes.text()}`)
  const startJson = await startRes.json()
  const runId = startJson.data.id
  const datasetId = startJson.data.defaultDatasetId
  console.log(`  run ${runId}, dataset ${datasetId}`)

  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!statusRes.ok) throw new Error(`status ${statusRes.status}`)
    const statusJson = await statusRes.json()
    if (statusJson.data.status === 'SUCCEEDED') break
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(statusJson.data.status)) {
      throw new Error(`run ${statusJson.data.status}`)
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }

  const itemsRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?format=json&clean=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!itemsRes.ok) throw new Error(`dataset ${itemsRes.status}`)
  return await itemsRes.json()
}

// ─────────────────────────────────────────────────────────────────────────────
// Library writer — append-only JSONL, dedupe by source_url
// ─────────────────────────────────────────────────────────────────────────────

async function loadExistingUrls() {
  try {
    const txt = await readFile(LIBRARY_PATH, 'utf8')
    const urls = new Set()
    for (const line of txt.split('\n')) {
      if (!line.trim()) continue
      try {
        const o = JSON.parse(line)
        if (o.source_url) urls.add(o.source_url)
      } catch {}
    }
    return urls
  } catch {
    return new Set()
  }
}

async function appendEntries(entries) {
  await mkdir(path.dirname(LIBRARY_PATH), { recursive: true })
  const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n'
  await appendFile(LIBRARY_PATH, lines)
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { platform: null, count: 50, all: false }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--platform') args.platform = argv[++i]
    else if (a === '--count') args.count = parseInt(argv[++i], 10)
    else if (a === '--all') args.all = true
    else if (a === '--help' || a === '-h') {
      console.error(
        'Usage: node scripts/scrape-real-estate-memes.mjs --platform <ig|tiktok|x|reddit> [--count N]\n' +
          '       node scripts/scrape-real-estate-memes.mjs --all',
      )
      process.exit(0)
    }
  }
  return args
}

async function runPlatform(platformKey, count) {
  const spec = PLATFORMS[platformKey]
  if (!spec) throw new Error(`unknown platform: ${platformKey}`)
  const existing = await loadExistingUrls()
  console.log(`\n=== ${platformKey} ===`)
  console.log(`  existing entries from this platform that share URLs: dedup pool size ${existing.size}`)

  const items = await runActor(spec.actor, spec.inputBuilder(count))
  console.log(`  raw items: ${items.length}`)

  let kept = 0
  let skipped_dup = 0
  let skipped_engagement = 0
  const newEntries = []
  for (const item of items) {
    const cat = spec.mapToCatalog(item)
    if (!cat.source_url) continue
    if (existing.has(cat.source_url)) {
      skipped_dup++
      continue
    }
    if (
      spec.minEngagement?.likes &&
      (cat.engagement.likes ?? 0) < spec.minEngagement.likes
    ) {
      skipped_engagement++
      continue
    }
    newEntries.push({
      id: `${platformKey}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      scraped_at: new Date().toISOString(),
      ...cat,
      // Cataloging fields — LEFT EMPTY for the human/AI pass
      context_sentence: '',
      humor_mechanism: [],
      humor_explanation: '',
      ryan_realty_adaptation_idea: '',
      ryan_realty_voice_check: '',
      ryan_realty_voice_notes: '',
    })
    kept++
  }

  if (newEntries.length > 0) {
    await appendEntries(newEntries)
  }
  console.log(`  appended: ${kept}  · dup-skipped: ${skipped_dup} · engagement-skipped: ${skipped_engagement}`)
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.all) {
    for (const p of ['instagram', 'tiktok', 'x', 'reddit']) {
      try {
        await runPlatform(p, args.count)
      } catch (err) {
        console.error(`  ✗ ${p}: ${err.message}`)
      }
    }
  } else if (args.platform) {
    await runPlatform(args.platform, args.count)
  } else {
    console.error('Provide --platform <ig|tiktok|x|reddit> or --all.')
    process.exit(1)
  }
  console.log('\n✓ Done. Next: catalog new entries per social_media_skills/meme-research/SKILL.md taxonomy.')
}

main().catch((err) => {
  console.error(`\n✗ FAILED: ${err.message}`)
  process.exit(1)
})
