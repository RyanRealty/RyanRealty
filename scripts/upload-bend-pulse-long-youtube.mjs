#!/usr/bin/env node
/**
 * Upload merged Bend Policy Pulse (3 parts → one file) to YouTube as standard video (vertical).
 *
 *   node --env-file=.env.local scripts/upload-bend-pulse-long-youtube.mjs [--publish]
 *
 * MP4 default: listing_video_v4/out/bend_pulse/bend_pulse_full.mp4
 * Omit --publish → uploads PRIVATE (draft-first). This script defaults to --publish when
 * called from automation after explicit Matt approval.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const ENV_PATH = path.join(ROOT, '.env.local')
const EXPECTED_CHANNEL_ID = 'UCpxIXnNVeG25oeDjfE3b4lw'

function parseEnv(text) {
  const out = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const k = line.slice(0, eq).trim()
    let v = line.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[k] = v
  }
  return out
}

function loadEnv() {
  let file = {}
  try {
    file = parseEnv(fs.readFileSync(ENV_PATH, 'utf8'))
  } catch {
    /* optional */
  }
  return { ...file, ...process.env }
}

const args = new Set(process.argv.slice(2))
const isPublish = args.has('--publish')
const mp4Arg = process.argv.find((a) => a.startsWith('--mp4='))
const mp4Path = mp4Arg
  ? mp4Arg.slice('--mp4='.length)
  : path.join(ROOT, 'listing_video_v4/out/bend_pulse/bend_pulse_full.mp4')

const outDir = path.join(ROOT, 'listing_video_v4/out/bend_pulse')
const resultPath = path.join(outDir, 'youtube_long_result.json')

if (!fs.existsSync(mp4Path)) {
  console.error('MP4 not found:', mp4Path)
  console.error('Run: ./scripts/merge-bend-pulse-longform.sh')
  process.exit(1)
}

async function getRefreshToken(env) {
  const direct = env.YOUTUBE_REFRESH_TOKEN || env.YT_REFRESH_TOKEN
  if (direct) return direct
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(url, key)
  const { data, error } = await sb.from('youtube_auth').select('refresh_token').eq('id', 'default').maybeSingle()
  if (error || !data?.refresh_token) return null
  return data.refresh_token
}

const env = loadEnv()

const refreshTokenEarly = await getRefreshToken(env)
if (!refreshTokenEarly) {
  console.error('No YouTube refresh token: set YOUTUBE_REFRESH_TOKEN in .env.local or store in youtube_auth (id=default)')
  process.exit(1)
}

const title =
  'Bend Policy Pulse Full | Electrification Fee on New Homes (3 Parts) | Ryan Realty'.slice(0, 100)

const description = `Full cut of the Bend Policy Pulse series (parts 1 to 3 in one watch). Climate pollution fee on new construction, council debate, and key dates. Clips from public Bend City Council work sessions (Granicus).

CHAPTERS
0:00 Part 1, what Bend is proposing
1:28 Part 2, what people are arguing
2:58 Part 3, dates and next steps

Written breakdown and sources: https://ryan-realty.com/bend-electrification-fee-new-homes-2026/

City of Bend electrification overview: https://bendoregon.gov/top-priorities/environment-and-climate/electrification-policy-options/

#RyanRealtyBend #BendOregon #CityCouncil #CentralOregon #LocalNews #Housing #Electrification`

const tags = [
  'bend oregon',
  'ryan realty bend',
  'city council',
  'bend electrification',
  'climate pollution fee',
  'central oregon housing',
  'bend policy',
  'local news',
]

console.log('MP4:', mp4Path)
console.log('Privacy:', isPublish ? 'PUBLIC' : 'PRIVATE')

let youtube = null
try {
  const { google } = await import('googleapis')
  const oauth2 = new google.auth.OAuth2(
    env.GOOGLE_OAUTH_CLIENT_ID || env.YT_CLIENT_ID,
    env.GOOGLE_OAUTH_CLIENT_SECRET || env.YT_CLIENT_SECRET,
    'http://127.0.0.1:8765/oauth2callback'
  )
  oauth2.setCredentials({ refresh_token: refreshTokenEarly })
  await oauth2.getAccessToken()
  youtube = google.youtube({ version: 'v3', auth: oauth2 })
} catch (e) {
  console.error('YouTube auth failed:', e.message)
  process.exit(1)
}

try {
  const me = await youtube.channels.list({ part: ['snippet'], mine: true })
  const ch = me.data.items?.[0]
  if (ch?.id && ch.id !== EXPECTED_CHANNEL_ID) {
    console.warn('Channel', ch.id, '!= expected', EXPECTED_CHANNEL_ID)
  }
} catch (e) {
  console.warn('Channel verify:', e.message)
}

const fileSize = fs.statSync(mp4Path).size
console.log(`Uploading ${(fileSize / 1024 / 1024).toFixed(1)} MB...`)

let videoId = null
try {
  const insertRes = await youtube.videos.insert(
    {
      part: ['snippet', 'status'],
      notifySubscribers: true,
      requestBody: {
        snippet: {
          title,
          description,
          tags,
          categoryId: '25',
          defaultLanguage: 'en',
          defaultAudioLanguage: 'en',
        },
        status: {
          privacyStatus: isPublish ? 'public' : 'private',
          selfDeclaredMadeForKids: false,
          embeddable: true,
          publicStatsViewable: true,
          containsSyntheticMedia: true,
        },
      },
      media: { body: fs.createReadStream(mp4Path) },
    },
    {
      onUploadProgress: (evt) => {
        const pct = ((evt.bytesRead / fileSize) * 100).toFixed(1)
        process.stdout.write(`\r  ${pct}%   `)
      },
    }
  )
  process.stdout.write('\n')
  videoId = insertRes.data.id
  if (!videoId) throw new Error('No video id')
} catch (e) {
  console.error('Upload failed:', e.message)
  process.exit(1)
}

const url = `https://www.youtube.com/watch?v=${videoId}`
const result = { videoId, url, title, privacy: isPublish ? 'public' : 'private', uploadedAt: new Date().toISOString() }
fs.writeFileSync(resultPath, JSON.stringify(result, null, 2))
console.log('Done:', url)
console.log('Wrote', resultPath)
