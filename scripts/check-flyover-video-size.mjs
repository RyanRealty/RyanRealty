#!/usr/bin/env node
/**
 * check-flyover-video-size.mjs — site hero flyover videos stay lean.
 *
 * Lock for the 2026-06-10 LCP class: the Tetherow hero shipped at 39 MB
 * (20.8 Mbps + a dead audio track on a muted loop) and RUM showed users
 * hitting a 60s LCP on the page. The FlyoverHero component now paints the
 * poster first, but an oversized hero.mp4 still burns mobile data and
 * delays the video fade-in. crf 28 / no-audio re-encode proved visually
 * identical at 11 MB.
 *
 * Fails if any public/videos/flyovers/<slug>/hero.mp4 exceeds MAX_MB, or
 * any poster.jpg exceeds MAX_POSTER_KB.
 *
 * Usage: node scripts/check-flyover-video-size.mjs   (wired into ci:gates)
 */
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'public/videos/flyovers'
const MAX_MB = 12
const MAX_POSTER_KB = 1024

const fails = []
if (existsSync(ROOT)) {
  for (const slug of readdirSync(ROOT)) {
    const dir = join(ROOT, slug)
    try {
      if (!statSync(dir).isDirectory()) continue
    } catch {
      continue
    }
    const hero = join(dir, 'hero.mp4')
    if (existsSync(hero)) {
      const mb = statSync(hero).size / (1024 * 1024)
      if (mb > MAX_MB) {
        fails.push(`${hero}: ${mb.toFixed(1)} MB > ${MAX_MB} MB — re-encode (ffmpeg -crf 28 -preset slow -an -movflags +faststart)`)
      }
    }
    const poster = join(dir, 'poster.jpg')
    if (existsSync(poster)) {
      const kb = statSync(poster).size / 1024
      if (kb > MAX_POSTER_KB) {
        fails.push(`${poster}: ${kb.toFixed(0)} KB > ${MAX_POSTER_KB} KB — recompress the poster`)
      }
    }
  }
}

console.log('Flyover video size gate')
console.log('=======================')
if (fails.length) {
  for (const f of fails) console.error(`FAIL: ${f}`)
  process.exit(1)
}
console.log(`All flyover heroes <= ${MAX_MB} MB and posters <= ${MAX_POSTER_KB} KB.`)
