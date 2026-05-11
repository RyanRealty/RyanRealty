#!/usr/bin/env node
/**
 * Sequential publish: Bend Policy Pulse parts 1 → 2 → 3.
 *
 * Prerequisites: MP4 + cover JPG already deployed at NEXT_PUBLIC_SITE_URL
 *   /v5_library/bend_pulse/bend_pulse_partN.mp4
 *   /v5_library/bend_pulse/cover_partN.jpg
 *
 * Run from repo root:
 *   node scripts/publish-bend-policy-pulse.mjs
 *   node scripts/publish-bend-policy-pulse.mjs --exclude-platforms=facebook,youtube --parts=2
 *
 * Loads CRON_SECRET + NEXT_PUBLIC_SITE_URL from .env.local
 */

import fs from 'node:fs'

const env = {}
try {
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z_0-9]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch {
  /* optional file */
}

const CRON_SECRET = env.CRON_SECRET || process.env.CRON_SECRET
if (!CRON_SECRET) {
  console.error('CRON_SECRET not set')
  process.exit(1)
}

const SITE = (env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://ryanrealty.vercel.app').replace(
  /\/$/,
  ''
)

const APPROVED_AT = new Date().toISOString()

const DEFAULT_PLATFORMS = [
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'linkedin',
  'google_business_profile',
  'x',
  'pinterest',
  'threads',
  'nextdoor',
]

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const eq = a.indexOf('=')
    if (eq >= 0) {
      out[a.slice(2, eq)] = a.slice(eq + 1)
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      out[a.slice(2)] = argv[++i]
    } else {
      out[a.slice(2)] = true
    }
  }
  return out
}

const cli = parseArgs(process.argv.slice(2))
const excludeRaw = cli['exclude-platforms'] || process.env.BEND_PULSE_EXCLUDE_PLATFORMS || ''
const exclude = new Set(
  excludeRaw
    .split(/[, ]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
)
const PLATFORMS = DEFAULT_PLATFORMS.filter((p) => !exclude.has(p))

if (PLATFORMS.length === 0) {
  console.error('No platforms left after exclude list. Check --exclude-platforms')
  process.exit(1)
}

const partsRaw = cli.parts || process.env.BEND_PULSE_PARTS || ''
const partNums = partsRaw
  .split(/[, ]+/)
  .map((s) => Number.parseInt(s.trim(), 10))
  .filter((n) => Number.isInteger(n) && n >= 1 && n <= 3)

const gateBase = {
  scorecardPath: 'listing_video_v4/out/bend_pulse/scorecard.json',
  citationsPath: 'listing_video_v4/out/bend_pulse/citations.json',
  qaReportPath: 'listing_video_v4/out/bend_pulse/qa_report.md',
  postflightPath: 'listing_video_v4/out/bend_pulse/postflight.json',
  manifestoPath: 'video_production_skills/ANTI_SLOP_MANIFESTO.md',
  humanApprovedAt: APPROVED_AT,
  formatSkillName: 'news-video',
  formatSkillVersion: 'bend-pulse-2026-05-10',
}

const ALL_PARTS = [
  {
    n: 1,
    mediaPath: '/v5_library/bend_pulse/bend_pulse_part1.mp4',
    coverPath: '/v5_library/bend_pulse/cover_part1.jpg',
    tiktokTitle: 'Bend Policy Pulse 1/3: what the city is proposing',
    youtubeTitle: 'Bend Policy Pulse 1 of 3 | What Bend Is Proposing',
    pinterestTitle: 'Bend Policy Pulse Part 1 — What Bend Is Proposing',
    /** Threads: no hashtags */
    threads: `Bend Policy Pulse, part 1 of 3. This one walks through what the city is actually proposing on the new home climate pollution fee. Public meeting clips plus narration.\n\nWhat would you want clarified in part 2?`,
    instagram: `Bend Policy Pulse — Part 1 of 3\n\nWhat Bend is proposing on the new home climate pollution fee. Council workshop clips from the public record, with narration.\n\nWatch part 2 for the back and forth. Part 3 for dates and how to weigh in.\n\nClips are from the public meeting record.`,
    facebook: `Bend Policy Pulse — Part 1 of 3\n\nWe break down what the city is proposing on the climate pollution fee for new homes, using audio from the February 2026 council workshop (public record) plus short narration for context.\n\nPart 2 is the debate. Part 3 is the calendar.\n\nClips are straight from the meeting video.`,
    tiktok: `Part 1 of 3. What Bend is proposing on the new home climate pollution fee. Real council workshop audio plus narration.`,
    youtubeDesc: `Bend Policy Pulse — Part 1 of 3: What Bend Is Proposing (climate pollution fee, new homes)\n\nEditorial explainer with clips from the February 11, 2026 Bend City Council work session (public Granicus record).\n\nPart 2 covers what people are arguing at council and BEDAB. Part 3 covers hearing dates and next steps.\n\nSources summarized in our project citations file and the City of Bend electrification policy materials.\n\n#shorts #RyanRealtyBend #BendOregon #CityCouncil #CentralOregon #LocalNews #Housing #Electrification`,
    linkedin: `Bend Policy Pulse, part 1 of 3 — what the city is proposing on the new home climate pollution fee.\n\nThis edit uses public meeting video so you hear the workshop directly, with short narration for framing. Part 2 will focus on the debate. Part 3 on key dates.\n\nClips are public record.`,
    x: `Bend Policy Pulse 1/3: what the city is proposing on the new home climate pollution fee. Public council workshop clips + narration. Parts 2–3 cover debate + dates.`,
    gbp: `Bend Policy Pulse (1 of 3): a quick explainer on what the city is proposing for the new home climate pollution fee, using February 2026 council workshop audio from the public record.`,
    nextdoor: `If you are tracking Bend housing rules, this is part 1 of a three part breakdown on the proposed climate pollution fee for new homes. It uses audio from the recent council workshop so you hear the discussion directly, with short narration for context. I will link parts 2 and 3 in follow up posts so the sequence stays in order.`,
    pinterest: `Part 1 of 3. Plain-language breakdown of Bend's proposed climate pollution fee on new homes. City council workshop context, Central Oregon local news.`,
  },
  {
    n: 2,
    mediaPath: '/v5_library/bend_pulse/bend_pulse_part2.mp4',
    coverPath: '/v5_library/bend_pulse/cover_part2.jpg',
    tiktokTitle: 'Bend Policy Pulse 2/3: what people are arguing',
    youtubeTitle: 'Bend Policy Pulse 2 of 3 | What People Are Arguing',
    pinterestTitle: 'Bend Policy Pulse Part 2 — Council Debate',
    threads: `Part 2 of 3. This is the disagreement lane. Builders, utilities, and climate advocates all showed up. What landed at council?\n\nDid anything here surprise you?`,
    instagram: `Bend Policy Pulse — Part 2 of 3\n\nWhat people are arguing as Bend tightens the math on new home electrification and the climate pollution fee. Workshop and council context from public video.\n\nStart with part 1 if you need the proposal basics. Part 3 is the calendar.`,
    facebook: `Bend Policy Pulse — Part 2 of 3\n\nThe debate slice. Builders, utilities, and climate advocates pressed different angles as Bend moved this fee forward. We stayed on public meeting video for the receipts.\n\nSeries order: Part 1 proposal basics, Part 2 (this), Part 3 dates.`,
    tiktok: `Part 2 of 3. The Bend council debate. Builders, utilities, climate advocates. Public meeting clips.`,
    youtubeDesc: `Bend Policy Pulse — Part 2 of 3: What People Are Arguing\n\nClips from public Bend council and advisory discussions.\n\nWatch part 1 first for the proposal sketch. Part 3 for hearings.\n\n#shorts #RyanRealtyBend #BendOregon #CityCouncil #CentralOregon #LocalNews #Housing #Electrification`,
    linkedin: `Bend Policy Pulse, part 2 of 3 — the debate on the proposed new home climate pollution fee.\n\nSame format as part 1: public meeting clips with concise narration. If you are advising clients on entitlement risk in Bend, the advocacy map here matters.`,
    x: `Bend Policy Pulse 2/3: the council-side debate on Bend's new home climate pollution fee. Public workshop and council clips + narration.`,
    gbp: `Bend Policy Pulse (2 of 3): who pushed back and what arguments showed up as Bend advanced the new home climate pollution fee.`,
    nextdoor: `Part 2 of 3 on the Bend climate pollution fee conversation. This one focuses on what different groups argued at the public meetings so you can hear the tradeoffs in their own words, with narration tying it together. If you missed part 1, look for the first post in this series.`,
    pinterest: `Part 2 of 3. Bend City Council debate on the new home climate pollution fee. Builder, utility, and climate perspectives from public meetings.`,
  },
  {
    n: 3,
    mediaPath: '/v5_library/bend_pulse/bend_pulse_part3.mp4',
    coverPath: '/v5_library/bend_pulse/cover_part3.jpg',
    tiktokTitle: 'Bend Policy Pulse 3/3: dates that decide it',
    youtubeTitle: 'Bend Policy Pulse 3 of 3 | What Happens Next',
    pinterestTitle: 'Bend Policy Pulse Part 3 — Key Dates',
    threads: `Part 3 of 3. The dates that decide it. If you want to show up or send comment, this is the cheat sheet.\n\nWhich date is most likely to affect your plans?`,
    instagram: `Bend Policy Pulse — Part 3 of 3\n\nHearings, readings, and effective dates. The “what happens next” episode.\n\nParts 1–2 cover the proposal and the debate.\n\nConfirm dates on the official City of Bend agenda when you calendar it.`,
    facebook: `Bend Policy Pulse — Part 3 of 3\n\nClose the loop: meetings, hearings, and how the fee is scheduled to phase in. Always double check the city agenda for last-minute shifts.\n\nSeries: Part 1 proposal, Part 2 debate, Part 3 (this).`,
    tiktok: `Part 3 of 3. The Bend dates that decide the climate pollution fee. Hearings and next steps.`,
    youtubeDesc: `Bend Policy Pulse — Part 3 of 3: What Happens Next (key dates)\n\nVerify hearing times on the official Bend City Council agenda before you go.\n\n#shorts #RyanRealtyBend #BendOregon #CityCouncil #CentralOregon #LocalNews #Housing #Electrification`,
    linkedin: `Bend Policy Pulse, part 3 of 3 — calendar and next steps for Bend's proposed new home climate pollution fee.\n\nUse this as a briefing memo opener, then confirm dates on the city docket.`,
    x: `Bend Policy Pulse 3/3: key council dates and next steps on the new home climate pollution fee. Verify on the official agenda.`,
    gbp: `Bend Policy Pulse (3 of 3): hearing timeline and next steps residents should calendar for the proposed new home climate pollution fee.`,
    nextdoor: `Final part of the three part Bend fee series. This is the calendar episode so you know which meetings matter and how the process is supposed to move. Agendas can change, so treat this as a heads up and confirm on the city site.`,
    pinterest: `Part 3 of 3. Bend climate pollution fee timeline. Council dates, hearings, Central Oregon.`,
  },
]

const PARTS = partNums.length > 0 ? ALL_PARTS.filter((p) => partNums.includes(p.n)) : ALL_PARTS
if (PARTS.length === 0) {
  console.error('No parts to publish. Use --parts=1,2,3 with valid numbers.')
  process.exit(1)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function buildPayload(part) {
  const mediaUrl = `${SITE}${part.mediaPath}`
  const coverUrl = `${SITE}${part.coverPath}`

  return {
    approved: true,
    contentType: 'news_clip',
    platforms: PLATFORMS,
    mediaType: 'reel',
    mediaUrl,
    coverUrl,
    captionDefault: part.instagram,
    captionPerPlatform: {
      instagram: part.instagram,
      facebook: part.facebook,
      tiktok: part.tiktok,
      youtube: part.youtubeDesc,
      linkedin: part.linkedin,
      x: part.x,
      google_business_profile: part.gbp,
      pinterest: part.pinterest,
      threads: part.threads,
      nextdoor: part.nextdoor,
    },
    hashtagsPerPlatform: {
      instagram: [
        '#RyanRealtyBend',
        '#BendOregon',
        '#CityCouncil',
        '#CentralOregon',
        '#LocalNews',
        '#Housing',
        '#Electrification',
        '#ClimatePolicy',
        '#Bend',
      ],
      facebook: [
        '#RyanRealtyBend',
        '#BendOregon',
        '#CentralOregon',
        '#LocalNews',
        '#Housing',
        '#CityCouncil',
        '#Electrification',
      ],
      tiktok: [
        '#RyanRealtyBend',
        '#BendOregon',
        '#CityCouncil',
        '#LocalNews',
        '#Housing',
        '#Electrification',
        '#CentralOregon',
      ],
      youtube: [],
      linkedin: [],
      x: ['#RyanRealtyBend', '#BendOregon', '#CentralOregon', '#LocalNews', '#Housing', '#CityCouncil'],
      google_business_profile: [],
      pinterest: [
        'Ryan Realty Bend',
        'Bend Oregon',
        'city council',
        'Central Oregon',
        'housing policy',
        'electrification',
        'climate policy',
        'local news',
      ],
      threads: [],
      nextdoor: [],
    },
    metadata: {
      tiktok: { title: part.tiktokTitle },
      youtube: {
        title: part.youtubeTitle,
        description: part.youtubeDesc,
        tags: [
          'bend oregon',
          'ryan realty bend',
          'city council',
          'local news',
          'housing',
          'central oregon',
          'electrification',
          'shorts',
        ],
        privacyStatus: 'public',
      },
      linkedin: { visibility: 'PUBLIC' },
      google_business_profile: {
        summary: part.gbp,
        callToActionUrl: 'https://www.bendoregon.gov/',
      },
      pinterest: { title: part.pinterestTitle },
      nextdoor: {
        ctaText: 'City of Bend',
        ctaUrl: 'https://www.bendoregon.gov/',
      },
    },
    gate: { ...gateBase, humanApprovedAt: APPROVED_AT },
  }
}

async function publishPart(part) {
  const body = buildPayload(part)
  console.log(`\n========== Publishing PART ${part.n}/3 ==========`)
  console.log('mediaUrl:', body.mediaUrl)
  console.log('coverUrl:', body.coverUrl)

  const r = await fetch(`${SITE}/api/social/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': CRON_SECRET,
    },
    body: JSON.stringify(body),
  })

  const out = await r.json()
  console.log('HTTP', r.status)
  if (out.results) {
    for (const [platform, res] of Object.entries(out.results)) {
      const icon = res.success ? '✓' : '✗'
      console.log(`  ${icon} ${platform}: ${res.status}${res.error ? ` — ${res.error}` : ''}${res.url ? ` ${res.url}` : ''}`)
    }
  } else {
    console.log(JSON.stringify(out, null, 2))
  }
  return out
}

console.log(`Site: ${SITE}`)
console.log(`humanApprovedAt: ${APPROVED_AT}`)
console.log(
  'Parts:',
  PARTS.map((p) => p.n).join(', '),
  partNums.length ? '(filtered)' : '(all)'
)
console.log('Platforms per part:', PLATFORMS.join(', '))

for (const part of PARTS) {
  await publishPart(part)
  await sleep(8000)
}

console.log('\nDone (sequential publish).')
