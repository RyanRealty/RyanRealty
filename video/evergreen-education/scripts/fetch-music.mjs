#!/usr/bin/env node
/**
 * fetch-music.mjs
 *
 * Downloads 2 candidate music tracks from royalty-free / Creative Commons sources.
 * Each track was hand-picked to match the spec (mid-tempo ambient instrumental,
 * no vocals, no recognizable melody, 90-110 BPM, license-clean for commercial use).
 *
 * Writes:
 *   out/4-pillars/music-candidates/<slug>.mp3
 *   out/4-pillars/music-candidates/CANDIDATES.md  — Matt picks one
 *
 * After Matt picks (--pick=<slug>):
 *   public/4-pillars/music.mp3                — promoted
 *   out/4-pillars/music-license.txt           — license + attribution string
 *
 * Run: node video/evergreen-education/scripts/fetch-music.mjs           # download both
 * Run: node video/evergreen-education/scripts/fetch-music.mjs --pick=long-stroll  # promote one
 */

import { mkdir, writeFile, copyFile, stat } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const CAND_DIR = resolve(ROOT, 'out/4-pillars/music-candidates')
const PUB_DIR = resolve(ROOT, 'public/4-pillars')
const OUT_DIR = resolve(ROOT, 'out/4-pillars')

/**
 * Hand-curated candidates. All Kevin MacLeod / Incompetech, CC-BY 4.0.
 * License: https://creativecommons.org/licenses/by/4.0/
 * Attribution required (added to caption-and-hashtags.md + music-license.txt).
 *
 * Picked for: mid-tempo, no vocals, instrumental only, no recognizable melodic hook,
 * confident "thoughtful publication explainer" mood.
 */
const CANDIDATES = [
  {
    slug: 'long-stroll',
    title: 'Long Stroll',
    artist: 'Kevin MacLeod',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Long%20Stroll.mp3',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    sourceUrl: 'https://incompetech.com/music/royalty-free/index.html?keywords=long+stroll',
    bpm: '~90',
    mood: 'reflective, conversational, gentle warmth — confident publication explainer feel',
    notes: 'Piano-led ambient instrumental, no vocals, no over-the-top melodic hook. Sub-mixes cleanly under VO.',
  },
  {
    slug: 'thinking-music',
    title: 'Thinking Music',
    artist: 'Kevin MacLeod',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Thinking%20Music.mp3',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    sourceUrl: 'https://incompetech.com/music/royalty-free/index.html?keywords=thinking+music',
    bpm: '~95',
    mood: 'thoughtful, modern minimal, slight pulse — explainer / data video staple',
    notes: 'Mid-tempo, ambient pads + subtle rhythmic motif. No vocals. Designed for narrated content.',
  },
]

async function exists(p) {
  try { await stat(p); return true } catch { return false }
}

async function download(url, outPath) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Ryan Realty Video Pipeline; matt@ryan-realty.com)',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(outPath, buf)
  return buf.length
}

async function probe(mp3Path) {
  try {
    const { stdout } = await exec('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration,bit_rate,size',
      '-of', 'json',
      mp3Path,
    ])
    return JSON.parse(stdout).format
  } catch (e) {
    return { error: e.message }
  }
}

async function fetchAll() {
  await mkdir(CAND_DIR, { recursive: true })
  console.log('Fetching music candidates...\n')

  for (const c of CANDIDATES) {
    const outPath = resolve(CAND_DIR, `${c.slug}.mp3`)
    if (await exists(outPath)) {
      console.log(`✓ ${c.slug} already exists`)
    } else {
      process.stdout.write(`  ${c.slug}: downloading... `)
      try {
        const bytes = await download(c.url, outPath)
        console.log(`OK (${(bytes / 1024 / 1024).toFixed(2)} MB)`)
      } catch (err) {
        console.log(`FAIL: ${err.message}`)
        continue
      }
    }
    const meta = await probe(outPath)
    console.log(`     duration: ${parseFloat(meta.duration ?? 0).toFixed(1)}s, ${Math.round((meta.bit_rate ?? 0) / 1000)} kbps`)
  }

  // Write the candidates manifest for Matt
  let md = `# Music candidates — 4-pillars build\n\n`
  md += `Pick one with \`node scripts/fetch-music.mjs --pick=<slug>\`. Default if no pick: \`long-stroll\`.\n\n`
  for (const c of CANDIDATES) {
    md += `## ${c.title} — ${c.artist}\n\n`
    md += `- **Slug:** \`${c.slug}\`\n`
    md += `- **License:** [${c.license}](${c.licenseUrl})\n`
    md += `- **BPM:** ${c.bpm}\n`
    md += `- **Mood:** ${c.mood}\n`
    md += `- **Notes:** ${c.notes}\n`
    md += `- **Source:** ${c.sourceUrl}\n`
    md += `- **Local file:** \`out/4-pillars/music-candidates/${c.slug}.mp3\`\n\n`
  }
  md += `## Attribution string (required for both)\n\n`
  md += `> Music: "<title>" by Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0 License. https://creativecommons.org/licenses/by/4.0/\n`
  await writeFile(resolve(CAND_DIR, 'CANDIDATES.md'), md)
  console.log(`\n✓ wrote ${resolve(CAND_DIR, 'CANDIDATES.md')}`)
  console.log(`To promote one: node scripts/fetch-music.mjs --pick=<slug>`)
}

async function pick(slug) {
  const c = CANDIDATES.find((x) => x.slug === slug)
  if (!c) {
    console.error(`Unknown slug: ${slug}. Options: ${CANDIDATES.map((x) => x.slug).join(', ')}`)
    process.exit(1)
  }
  const srcPath = resolve(CAND_DIR, `${c.slug}.mp3`)
  if (!(await exists(srcPath))) {
    console.error(`Candidate not yet downloaded: ${srcPath}. Run without --pick first.`)
    process.exit(1)
  }
  await mkdir(PUB_DIR, { recursive: true })
  await mkdir(OUT_DIR, { recursive: true })
  const dstPath = resolve(PUB_DIR, 'music.mp3')
  await copyFile(srcPath, dstPath)
  console.log(`✓ promoted: ${srcPath} → ${dstPath}`)

  const license = `Music: "${c.title}" by ${c.artist} (${c.sourceUrl})\n` +
    `License: ${c.license}\n${c.licenseUrl}\n\n` +
    `Required attribution string (use in IG/TikTok/FB caption + YouTube description):\n` +
    `"${c.title}" by Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0 License. ${c.licenseUrl}\n`
  await writeFile(resolve(OUT_DIR, 'music-license.txt'), license)
  console.log(`✓ wrote music-license.txt`)
}

async function main() {
  const pickArg = process.argv.find((a) => a.startsWith('--pick='))
  if (pickArg) {
    await pick(pickArg.split('=')[1])
  } else {
    await fetchAll()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
