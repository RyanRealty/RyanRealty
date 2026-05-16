#!/usr/bin/env node
/**
 * Create an AgentFire WordPress DRAFT for the Bend Policy Pulse electrification series.
 *
 * Sources: out/blog/bend-policy-pulse-electrification-2026/post.md + metadata.json
 *
 *   node --env-file=.env.local scripts/publish-bend-policy-pulse-blog.mjs
 *   node --env-file=.env.local scripts/publish-bend-policy-pulse-blog.mjs --publish
 *
 * Default is draft only (CLAUDE.md draft first). Use --publish only after Matt approves.
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DRAFT_DIR = resolve(ROOT, 'out/blog/bend-policy-pulse-electrification-2026')

const {
  createDraft,
  publishDraft,
  uploadMedia,
  getCategoryId,
  getTagId,
  pingSitemap,
} = await import('../lib/wordpress-client.mjs')
const { markdownToHtml } = await import('../lib/markdown-to-html.mjs')

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        out[key] = next
        i++
      } else {
        out[key] = true
      }
    }
  }
  return out
}

function jsonLdToHtml(blocks) {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .map((b) => `<script type="application/ld+json">\n${JSON.stringify(b, null, 2)}\n</script>`)
    .join('\n\n')
}

function watchToEmbed(watchUrl) {
  const m = watchUrl.match(/[?&]v=([^&]+)/)
  if (m) return `https://www.youtube.com/embed/${m[1]}`
  const shortM = watchUrl.match(/youtu\.be\/([^?]+)/)
  if (shortM) return `https://www.youtube.com/embed/${shortM[1]}`
  return watchUrl
}

const FULL_VIDEO_MARKER = '<!-- ryanrealty:bend-pulse-full-video -->'

function fullVideoFigureHtml(watchUrl) {
  const embed = watchToEmbed(watchUrl)
  const title =
    'Bend Policy Pulse full walkthrough Bend electrification fee on new homes three parts in one watch'
  return `<figure class="wp-block-embed is-type-video">
  <iframe width="560" height="315" src="${embed}" title="${title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
</figure>`
}

function injectLongFormEmbed(html, watchUrl) {
  if (!html.includes(FULL_VIDEO_MARKER)) return html
  if (!watchUrl?.trim()) {
    console.warn(
      'youtube.longForm is empty. Set it in metadata.json after you upload bend_pulse_full.mp4 to YouTube. Placeholder paragraph inserted.'
    )
    return html.replace(
      FULL_VIDEO_MARKER,
      '<p><em>Full-length YouTube embed goes here after you merge parts and upload. Run <code>scripts/merge-bend-pulse-longform.sh</code>, then set <code>youtube.longForm</code> in metadata.json.</em></p>'
    )
  }
  return html.replace(FULL_VIDEO_MARKER, fullVideoFigureHtml(watchUrl.trim()))
}

function buildJsonLd({ meta, heroImageUrl, dateIso }) {
  const y = meta.youtube
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    description: meta.metaDescription,
    image: heroImageUrl,
    datePublished: dateIso,
    dateModified: dateIso,
    author: {
      '@type': 'Person',
      name: 'Matt Ryan',
      url: 'https://ryan-realty.com/',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Ryan Realty',
      url: 'https://ryan-realty.com/',
    },
  }

  const place = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: 'Bend, Oregon',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Bend',
      addressRegion: 'OR',
      addressCountry: 'US',
    },
  }

  const mkVideo = (name, desc, watchUrl, durIso, thumb) => ({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name,
    description: desc,
    thumbnailUrl: thumb,
    uploadDate: dateIso,
    duration: durIso,
    contentUrl: watchUrl,
    embedUrl: watchToEmbed(watchUrl),
  })

  const thumb = heroImageUrl
  const longFormUrl = y.longForm?.trim()

  if (longFormUrl) {
    const dur = y.longFormDurationIso8601 || 'PT4M8S'
    return [
      article,
      place,
      mkVideo(
        'Bend Policy Pulse Full Walkthrough Electrification Fee on New Homes',
        'Three-part Bend Policy Pulse series merged. Climate pollution fee levels for new homes, advisory board and council context, and how to verify council dates. Public meeting clips with AI narration.',
        longFormUrl,
        dur,
        thumb
      ),
    ]
  }

  return [
    article,
    place,
    mkVideo(
      'Bend Policy Pulse Part 1 of 3 What Bend Is Proposing',
      'Climate pollution fee basics for new homes in Bend, Oregon. Public meeting clips with narration.',
      y.part1,
      'PT1M28S',
      thumb
    ),
    mkVideo(
      'Bend Policy Pulse Part 2 of 3 What People Are Arguing',
      'Advisory board and council context on Bend electrification fee debate.',
      y.part2,
      'PT1M30S',
      thumb
    ),
    mkVideo(
      'Bend Policy Pulse Part 3 of 3 What Happens Next',
      'Council dates and next steps for Bend proposed new home climate pollution fee.',
      y.part3,
      'PT1M10S',
      thumb
    ),
  ]
}

const args = parseArgs(process.argv.slice(2))
const shouldPublish = !!args.publish
const dateIso = new Date().toISOString().slice(0, 19) + 'Z'

const postMdPath = resolve(DRAFT_DIR, 'post.md')
const metaPath = resolve(DRAFT_DIR, 'metadata.json')

if (!existsSync(postMdPath) || !existsSync(metaPath)) {
  console.error('Missing', DRAFT_DIR, 'post.md or metadata.json')
  process.exit(1)
}

const markdownContent = await readFile(postMdPath, 'utf8')
const meta = JSON.parse(await readFile(metaPath, 'utf8'))

let heroPath = resolve(DRAFT_DIR, 'hero.jpg')
if (!existsSync(heroPath)) {
  console.log('Downloading hero from', meta.heroRemoteUrl)
  await mkdir(DRAFT_DIR, { recursive: true })
  const r = await fetch(meta.heroRemoteUrl)
  if (!r.ok) throw new Error(`Hero fetch failed: ${r.status}`)
  const buf = Buffer.from(await r.arrayBuffer())
  await writeFile(heroPath, buf)
  console.log('  Wrote', heroPath)
}

let featuredMediaId = null
let heroWpUrl = meta.heroRemoteUrl

try {
  const media = await uploadMedia(heroPath, {
    title: 'Bend Policy Pulse part 1 title card still electrification fee explainer',
    alt_text:
      'Bend Policy Pulse title card reading What Bend Is Proposing and Climate Pollution Fee New Homes Part 1 of 3',
    caption: 'Still from Bend Policy Pulse part 1. Ryan Realty news explainer series.',
  })
  featuredMediaId = media.id
  heroWpUrl = media.source_url
  console.log('Featured media uploaded:', featuredMediaId, heroWpUrl)
} catch (e) {
  console.warn('Hero upload failed (continuing with remote URL for schema):', e.message)
}

let postHtml = markdownToHtml(markdownContent)
postHtml = injectLongFormEmbed(postHtml, meta.youtube?.longForm)

const jsonLdBlocks = buildJsonLd({ meta, heroImageUrl: heroWpUrl, dateIso })
postHtml += `\n\n<!-- Ryan Realty Schema Markup -->\n${jsonLdToHtml(jsonLdBlocks)}`

const categoryIds = []
for (const slug of meta.categories || ['news']) {
  categoryIds.push(await getCategoryId(slug))
}

const tagIds = []
for (const name of meta.tags || []) {
  tagIds.push(await getTagId(name))
}

const wpMeta = {
  _yoast_wpseo_title: meta.title,
  _yoast_wpseo_metadesc: meta.metaDescription,
  _yoast_wpseo_canonical: meta.canonical,
  _yoast_wpseo_opengraph_title: meta.openGraph?.['og:title'] || meta.title,
  _yoast_wpseo_opengraph_description: meta.openGraph?.['og:description'] || meta.metaDescription,
  rank_math_title: meta.title,
  rank_math_description: meta.metaDescription,
  rank_math_canonical_url: meta.canonical,
}

console.log('\nCreating WordPress draft...')
const draftResult = await createDraft({
  title: meta.wpPostTitle,
  content: postHtml,
  excerpt: meta.metaDescription,
  slug: meta.slug,
  categories: categoryIds,
  tags: tagIds,
  featured_media: featuredMediaId || undefined,
  meta: wpMeta,
})

console.log('\nDraft created')
console.log('  Post ID:    ', draftResult.id)
console.log('  Preview URL:', draftResult.preview_url)
console.log('  Edit link:  ', draftResult.link)

if (shouldPublish) {
  console.log('\nPublishing...')
  await publishDraft(draftResult.id)
  await pingSitemap()
  console.log('Live:', meta.canonical)
} else {
  console.log('\nDraft only. After you approve in WP, run with --publish or publish in Admin.')
  console.log('\nDrive traffic: pin this URL in IG bio, Link sticker in Stories, first comment on Reels,')
  console.log('and YouTube description links. Canonical for sharing:', meta.canonical)
}
