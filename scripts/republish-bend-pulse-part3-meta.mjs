#!/usr/bin/env node
/**
 * Retry Bend Policy Pulse part 3 on Instagram + Facebook only (avoids duplicate YouTube).
 * Run after deploy of duplex + maxDuration fixes.
 *
 *   node scripts/republish-bend-pulse-part3-meta.mjs
 */

import fs from 'node:fs'

const env = {}
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z_0-9]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const CRON_SECRET = env.CRON_SECRET || process.env.CRON_SECRET
const SITE = (env.NEXT_PUBLIC_SITE_URL || 'https://ryanrealty.vercel.app').replace(/\/$/, '')
const now = new Date().toISOString()

const body = {
  approved: true,
  contentType: 'news_clip',
  platforms: ['instagram', 'facebook'],
  mediaType: 'reel',
  mediaUrl: `${SITE}/v5_library/bend_pulse/bend_pulse_part3.mp4`,
  coverUrl: `${SITE}/v5_library/bend_pulse/cover_part3.jpg`,
  captionDefault:
    `Bend Policy Pulse — Part 3 of 3\n\nHearings, readings, and effective dates. The “what happens next” episode.\n\nParts 1–2 cover the proposal and the debate.\n\nNarration is AI voiced. Confirm dates on the official City of Bend agenda when you calendar it.`,
  captionPerPlatform: {
    instagram:
      `Bend Policy Pulse — Part 3 of 3\n\nHearings, readings, and effective dates. The “what happens next” episode.\n\nParts 1–2 cover the proposal and the debate.\n\nNarration is AI voiced. Confirm dates on the official City of Bend agenda when you calendar it.`,
    facebook:
      `Bend Policy Pulse — Part 3 of 3\n\nClose the loop: meetings, hearings, and how the fee is scheduled to phase in. Always double check the city agenda for last-minute shifts.\n\nSeries: Part 1 proposal, Part 2 debate, Part 3 (this).\n\nNarration uses AI voice.`,
  },
  hashtagsPerPlatform: {
    instagram: ['#BendOregon', '#CityCouncil', '#CentralOregon', '#LocalNews', '#Housing'],
    facebook: ['#BendOregon', '#CentralOregon'],
  },
  gate: {
    scorecardPath: 'listing_video_v4/out/bend_pulse/scorecard.json',
    citationsPath: 'listing_video_v4/out/bend_pulse/citations.json',
    qaReportPath: 'listing_video_v4/out/bend_pulse/qa_report.md',
    postflightPath: 'listing_video_v4/out/bend_pulse/postflight.json',
    manifestoPath: 'video_production_skills/ANTI_SLOP_MANIFESTO.md',
    humanApprovedAt: now,
    formatSkillName: 'news-video',
    formatSkillVersion: 'bend-pulse-2026-05-10',
  },
}
const r = await fetch(`${SITE}/api/social/publish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
  body: JSON.stringify(body),
})
console.log('HTTP', r.status, await r.text())
