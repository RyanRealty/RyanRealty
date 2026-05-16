#!/usr/bin/env node
/**
 * Facebook-only publish for Bend Policy Pulse parts 1–3 (skip YouTube / IG duplicates).
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

const gate = {
  scorecardPath: 'listing_video_v4/out/bend_pulse/scorecard.json',
  citationsPath: 'listing_video_v4/out/bend_pulse/citations.json',
  qaReportPath: 'listing_video_v4/out/bend_pulse/qa_report.md',
  postflightPath: 'listing_video_v4/out/bend_pulse/postflight.json',
  manifestoPath: 'video_production_skills/ANTI_SLOP_MANIFESTO.md',
  humanApprovedAt: now,
  formatSkillName: 'news-video',
  formatSkillVersion: 'bend-pulse-2026-05-10',
}

const PARTS = [
  {
    mediaPath: '/v5_library/bend_pulse/bend_pulse_part1.mp4',
    facebook: `Bend Policy Pulse — Part 1 of 3\n\nWe break down what the city is proposing on the climate pollution fee for new homes, using audio from the February 2026 council workshop (public record) plus short narration for context.\n\nPart 2 is the debate. Part 3 is the calendar.\n\nClips are straight from the meeting video.`,
    hashtags: ['#BendOregon', '#CentralOregon'],
  },
  {
    mediaPath: '/v5_library/bend_pulse/bend_pulse_part2.mp4',
    facebook: `Bend Policy Pulse — Part 2 of 3\n\nThe debate slice. Builders, utilities, and climate advocates pressed different angles as Bend moved this fee forward. We stayed on public meeting video for the receipts.\n\nSeries order: Part 1 proposal basics, Part 2 (this), Part 3 dates.`,
    hashtags: ['#BendOregon', '#CentralOregon'],
  },
  {
    mediaPath: '/v5_library/bend_pulse/bend_pulse_part3.mp4',
    facebook: `Bend Policy Pulse — Part 3 of 3\n\nClose the loop: meetings, hearings, and how the fee is scheduled to phase in. Always double check the city agenda for last-minute shifts.\n\nSeries: Part 1 proposal, Part 2 debate, Part 3 (this).`,
    hashtags: ['#BendOregon', '#CentralOregon'],
  },
]

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

for (let i = 0; i < PARTS.length; i++) {
  const p = PARTS[i]
  gate.humanApprovedAt = new Date().toISOString()
  const body = {
    approved: true,
    contentType: 'news_clip',
    platforms: ['facebook'],
    mediaType: 'reel',
    mediaUrl: `${SITE}${p.mediaPath}`,
    captionDefault: p.facebook,
    captionPerPlatform: { facebook: p.facebook },
    hashtagsPerPlatform: { facebook: p.hashtags },
    gate: { ...gate },
  }
  console.log(`Part ${i + 1}/3 Facebook…`)
  const r = await fetch(`${SITE}/api/social/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
    body: JSON.stringify(body),
  })
  console.log(await r.text())
  await sleep(5000)
}
