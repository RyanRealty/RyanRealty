#!/usr/bin/env node
/**
 * Quick check: list any listing in Supabase that has a video URL in details.Videos (or details.videos).
 * Usage: node scripts/check-video-urls.mjs
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  try {
    const raw = readFileSync(path, 'utf8')
    const env = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1)
      env[key] = val
    }
    return env
  } catch (e) {
    console.error('Could not read .env.local:', e.message)
    return {}
  }
}

const env = loadEnvLocal()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url?.trim() || !key?.trim()) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  // Fetch listings that have details; we'll filter in JS for non-empty Videos
  const { data: rows, error } = await supabase
    .from('listings')
    .select('ListNumber, details')
    .limit(10000)

  if (error) {
    console.error('Supabase error:', error.message)
    process.exit(1)
  }

  const withVideos = []
  for (const row of rows ?? []) {
    const d = row.details
    if (!d || typeof d !== 'object') continue
    const videos = d.Videos ?? d.videos
    if (!Array.isArray(videos) || videos.length === 0) continue
    const uris = videos
      .map((v) => (v && typeof v === 'object' && (v.Uri ?? v.uri)) ? (v.Uri ?? v.uri) : null)
      .filter(Boolean)
    if (uris.length > 0) {
      withVideos.push({ ListNumber: row.ListNumber, uris })
    }
  }

  console.log('Listings with at least one video URL in details:', withVideos.length)
  if (withVideos.length === 0) {
    console.log('No video URLs found in Supabase listings.details.')
    return
  }
  console.log('')
  for (const { ListNumber, uris } of withVideos.slice(0, 20)) {
    console.log('ListNumber:', ListNumber)
    for (const u of uris) console.log('  ', u)
    console.log('')
  }
  if (withVideos.length > 20) {
    console.log('... and', withVideos.length - 20, 'more listing(s) with video URLs.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
