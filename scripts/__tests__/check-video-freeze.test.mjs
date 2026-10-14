/**
 * Break-tests for ci:video-freeze (scripts/check-video-freeze.mjs, G83).
 *
 * Every rule is broken once against the real sources (read from this tree,
 * mutated in memory), and the live tree must stay green. The gate takes a
 * reader, so no sandbox copy is needed: what it inspects is exactly what the
 * mutation produced.
 */
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
  CHOKE_POINTS,
  FREEZE_MESSAGE,
  GUARD_MODULE,
  RETIRED_SCRIPTS,
  checkVideoFreeze,
  listRepoFiles,
} from '../check-video-freeze.mjs'

const ROOT = process.cwd()
const cache = new Map()
const real = (rel) => {
  if (!cache.has(rel)) {
    const p = join(ROOT, rel)
    cache.set(rel, existsSync(p) ? readFileSync(p, 'utf8') : null)
  }
  return cache.get(rel)
}
const FILES = listRepoFiles(ROOT)

/** Run the gate with one file replaced by `mutate(source)`. */
function runWith(rel, mutate) {
  const original = real(rel)
  if (original == null) throw new Error(`${rel} is missing from the tree`)
  const mutated = mutate(original)
  if (mutated === original) throw new Error(`mutation of ${rel} changed nothing; the test is stale`)
  return checkVideoFreeze((path) => (path === rel ? mutated : real(path)), FILES)
}

/** Run the gate with a new file added to the tree. */
function runWithAdded(rel, content) {
  if (real(rel) != null) throw new Error(`${rel} already exists; pick a new path`)
  return checkVideoFreeze((path) => (path === rel ? content : real(path)), [...FILES, rel])
}

/** Replace the nth (1-based) occurrence of `find`. */
function replaceNth(src, find, replacement, n = 1) {
  let at = -1
  for (let i = 0; i < n; i += 1) {
    at = src.indexOf(find, at + 1)
    if (at < 0) return src
  }
  return src.slice(0, at) + replacement + src.slice(at + find.length)
}

const fileOf = (fragment) => CHOKE_POINTS.find((p) => p.file.includes(fragment)).file

describe('ci:video-freeze on the live tree', () => {
  it('passes', () => {
    expect(checkVideoFreeze(real, FILES)).toEqual([])
  })

  it('covers every choke point the freeze was ordered for', () => {
    expect(CHOKE_POINTS.map((p) => p.file)).toEqual([
      'lib/studio/produce.ts',
      'lib/social/imagine-produce.ts',
      'lib/data/studio/drafts.ts',
      'lib/data/agent/actions.ts',
      'app/api/admin/approval-queue/[id]/action/route.ts',
      'app/api/admin/approval-queue/bulk-action/route.ts',
      'app/api/cron/publisher-sweep/route.ts',
      'app/api/social/publish/route.ts',
      'scripts/upload-youtube.mjs',
      'scripts/create-fb-ad.mjs',
      'lib/meta-marketing-api.mjs',
      'lib/meta-marketing-api.mjs',
    ])
  })
})

describe('R0: the guard module', () => {
  it('fails when the freeze is switched off', () => {
    const problems = runWith(GUARD_MODULE, (s) =>
      s.replace('export const VIDEO_PUBLISH_FROZEN: boolean = true', 'export const VIDEO_PUBLISH_FROZEN: boolean = false'),
    )
    expect(problems.join('\n')).toMatch(/VIDEO_PUBLISH_FROZEN must be/)
  })

  it('fails when Matt’s message is reworded', () => {
    const problems = runWith(GUARD_MODULE, (s) => s.replace('need a server-signed certificate.', 'need review.'))
    expect(problems.join('\n')).toMatch(/not Matt's wording/)
  })

  it('fails when the module is deleted', () => {
    const problems = checkVideoFreeze((path) => (path === GUARD_MODULE ? null : real(path)))
    expect(problems.join('\n')).toMatch(/lib\/content\/video-freeze\.ts: missing/)
  })

  it('fails when a guard export is dropped', () => {
    const problems = runWith(GUARD_MODULE, (s) =>
      s.replace('export function splitVideoFrozen', 'function splitVideoFrozen'),
    )
    expect(problems.join('\n')).toMatch(/does not export `splitVideoFrozen`/)
  })
})

describe('R1: every choke point imports the real guard', () => {
  for (const point of CHOKE_POINTS) {
    it(`fails when ${point.file} (${point.scope ?? 'module'}) imports the guard from somewhere else`, () => {
      // Every spelling of the import: the alias, and a relative path from scripts/ or lib/.
      const problems = runWith(point.file, (s) =>
        s
          .replaceAll("'@/lib/content/video-freeze'", "'@/lib/content/video-freeze-lookalike'")
          .replaceAll("'../lib/content/video-freeze.ts'", "'../lib/content/video-freeze-lookalike.ts'")
          .replaceAll("'./content/video-freeze.ts'", "'./content/video-freeze-lookalike.ts'"),
      )
      expect(problems.some((p) => p.startsWith(point.file) && p.includes('(R1'))).toBe(true)
    })
  }

  it('fails when a file shadows the guard with its own no-op', () => {
    const rel = fileOf('lib/studio/produce.ts')
    const problems = runWith(rel, (s) => `${s}\nfunction videoFreezeRefusal(_: unknown): string | null { return null }\n`)
    expect(problems.join('\n')).toMatch(/declares its own `videoFreezeRefusal`/)
  })
})

describe('R2: the refusal runs before every write', () => {
  it('fails when produceStudioDraft stops refusing', () => {
    const rel = fileOf('lib/studio/produce.ts')
    const problems = runWith(rel, (s) => s.replace('  if (frozen) return { ok: false, error: frozen }\n', ''))
    expect(problems.join('\n')).toMatch(/produce\.ts: `produceStudioDraft` never refuses/)
  })

  it('fails when produceStudioDraft refuses only after the row is opened', () => {
    const rel = fileOf('lib/studio/produce.ts')
    const problems = runWith(rel, (s) =>
      s
        .replace('  if (frozen) return { ok: false, error: frozen }\n', '')
        .replace(
          '    if (!pending.ok) return { ok: false, error: pending.error }\n',
          '    if (!pending.ok) return { ok: false, error: pending.error }\n    if (frozen) return { ok: false, error: frozen }\n',
        ),
    )
    expect(problems.join('\n')).toMatch(/produce\.ts:\d+: `adapters\.insertPending\(\.\.\.\)` can run without/)
  })

  it('fails when the refusal is short-circuited', () => {
    const rel = fileOf('lib/studio/produce.ts')
    const problems = runWith(rel, (s) =>
      s.replace('  if (frozen) return { ok: false, error: frozen }\n', '  if (false && frozen) return { ok: false, error: frozen }\n'),
    )
    expect(problems.join('\n')).toMatch(/never refuses/)
  })

  it('fails when the guard answer is neutered at its source', () => {
    const rel = fileOf('lib/studio/produce.ts')
    const problems = runWith(rel, (s) =>
      s.replace('const frozen = videoFreezeRefusal(', 'const frozen = null && videoFreezeRefusal('),
    )
    expect(problems.join('\n')).toMatch(/never refuses/)
  })

  it('fails when the Imagine listing clip stops refusing', () => {
    const rel = fileOf('lib/social/imagine-produce.ts')
    const problems = runWith(rel, (s) => s.replace('  if (frozen) return { ok: false, error: frozen }\n', ''))
    expect(problems.join('\n')).toMatch(/imagine-produce\.ts: `produceListing` never refuses/)
  })

  it('fails when approveStudioDraft stops refusing', () => {
    const rel = fileOf('lib/data/studio/drafts.ts')
    const problems = runWith(rel, (s) => s.replace('    if (frozen) return { ok: false, error: frozen }\n', ''))
    expect(problems.join('\n')).toMatch(/drafts\.ts: `approveStudioDraft` never refuses/)
  })

  it('fails when approveAction stops refusing', () => {
    const rel = fileOf('lib/data/agent/actions.ts')
    const problems = runWith(rel, (s) =>
      s.replace("    if (frozen) return { ok: false, error: frozen, reason: 'video_frozen' }\n", ''),
    )
    expect(problems.join('\n')).toMatch(/actions\.ts: `approveAction` never refuses/)
  })

  it('fails when only approve_schedule loses its refusal in the approval-queue route', () => {
    const rel = fileOf('[id]/action/route.ts')
    const problems = runWith(rel, (s) =>
      replaceNth(s, '        if (frozen) return NextResponse.json({ error: frozen }, { status: 423 })\n', '', 2),
    )
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/\[id\]\/action\/route\.ts:\d+: .*can run without the `rowVideoFreezeRefusal` refusal/)
  })

  it('fails when publisher-sweep holds a video row but keeps going', () => {
    const rel = fileOf('publisher-sweep')
    const problems = runWith(rel, (s) =>
      s.replace(
        '      videoFrozen.push({ action_id: row.id, action_type: row.action_type, reason: frozenReason })\n      continue\n',
        '      videoFrozen.push({ action_id: row.id, action_type: row.action_type, reason: frozenReason })\n',
      ),
    )
    expect(problems.join('\n')).toMatch(/publisher-sweep\/route\.ts: `GET` never refuses/)
  })

  it('fails when the publish route checks after the fan-out', () => {
    const rel = fileOf('social/publish')
    const problems = runWith(rel, (s) => s.replace('    if (frozen) {\n', '    if (false && frozen) {\n'))
    expect(problems.join('\n')).toMatch(/social\/publish\/route\.ts: `POST` never refuses/)
  })
})

describe('R2: the scripts that post video refuse before they write', () => {
  it('fails when upload-youtube.mjs logs the freeze but still uploads', () => {
    const rel = 'scripts/upload-youtube.mjs'
    const problems = runWith(rel, (s) =>
      s.replace("  console.error('Nothing was uploaded, private or public.')\n  process.exit(1)\n", ''),
    )
    expect(problems.join('\n')).toMatch(/upload-youtube\.mjs: `the module` never refuses/)
  })

  it('fails when upload-youtube.mjs checks only after the upload', () => {
    const rel = 'scripts/upload-youtube.mjs'
    const problems = runWith(rel, (s) => {
      const block = s.slice(s.indexOf('const frozen = isDryRun'), s.indexOf("  process.exit(1)\n}\n", s.indexOf('const frozen = isDryRun')) + "  process.exit(1)\n}\n".length)
      return `${s.replace(block, '')}\n${block}`
    })
    expect(problems.join('\n')).toMatch(/upload-youtube\.mjs:\d+: `youtube\.videos\.insert\(\.\.\.\)` can run without/)
  })

  it('fails when create-fb-ad.mjs flags the freeze but carries on', () => {
    const rel = 'scripts/create-fb-ad.mjs'
    const problems = runWith(rel, (s) =>
      s.replace("    process.exitCode = 1\n    return\n  }\n", '    process.exitCode = 1\n  }\n'),
    )
    expect(problems.join('\n')).toMatch(/create-fb-ad\.mjs: `main` never refuses/)
  })

  it('fails when uploadVideo stops refusing', () => {
    const rel = 'lib/meta-marketing-api.mjs'
    const problems = runWith(rel, (s) => replaceNth(s, '  if (frozen) throw new MetaMarketingError(frozen)\n', '', 1))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/meta-marketing-api\.mjs: `uploadVideo` never refuses/)
  })

  it('fails when createAdCreative stops refusing', () => {
    const rel = 'lib/meta-marketing-api.mjs'
    const problems = runWith(rel, (s) => replaceNth(s, '  if (frozen) throw new MetaMarketingError(frozen)\n', '', 2))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/meta-marketing-api\.mjs: `createAdCreative` never refuses/)
  })
})

describe('R5: the retired May rollout scripts stay deleted', () => {
  for (const rel of RETIRED_SCRIPTS) {
    it(`fails when ${rel} comes back`, () => {
      const problems = runWithAdded(rel, "console.log('one-off')\n")
      expect(problems).toEqual([expect.stringMatching(new RegExp(`^${rel.replace(/[.]/g, '\\.')}: is back.*\\(R5\\)`))])
    })
  }
})

describe('R6: no direct video-post door outside a choke point', () => {
  it('fails on a new script that posts Reels to the Graph API', () => {
    const problems = runWithAdded(
      'scripts/publish-2026-11-01-reels.mjs',
      "await fetch(`https://graph.facebook.com/v25.0/${ig}/media`, { method: 'POST', body: JSON.stringify({ media_type: 'REELS', video_url: url }) })\n",
    )
    expect(problems).toEqual([expect.stringMatching(/^scripts\/publish-2026-11-01-reels\.mjs:1: posts video to a platform directly \(`REELS`\).*\(R6\)/)])
  })

  it('fails on a new ad-video upload, a TikTok post and a YouTube insert', () => {
    expect(runWithAdded('lib/ads/new-video-ad.ts', 'export const u = (a: string) => `https://graph.facebook.com/${a}/advideos`\n').join('\n')).toMatch(/advideos.*\(R6\)/)
    expect(runWithAdded('scripts/tt.mjs', "fetch(`${BASE}post/publish/inbox/video/init/`)\n").join('\n')).toMatch(/post\/publish\/.*\(R6\)/)
    expect(runWithAdded('scripts/yt.mjs', 'await youtube.videos\n  .insert({ part: [] })\n').join('\n')).toMatch(/videos\.insert\(\.\.\.\).*\(R6\)/)
  })

  it('fails on a Facebook page video upload, by Graph base name or by host', () => {
    expect(
      runWithAdded('scripts/fb-video.mjs', "await postJson(`${META_GRAPH_BASE}/${pageId}/videos`, { file_url: url })\n").join('\n'),
    ).toMatch(/^scripts\/fb-video\.mjs:1: .*\/videos.*\(R6\)/)
    expect(
      runWithAdded('scripts/fb-video2.mjs', "await fetch('https://graph-video.facebook.com/v21.0/123/videos', { method: 'POST' })\n").join('\n'),
    ).toMatch(/graph-video\.facebook\.com.*\(R6\)/)
    expect(
      runWithAdded('scripts/fb-video3.mjs', "await fetch('https://graph.facebook.com/v21.0/123/videos?access_token=x')\n").join('\n'),
    ).toMatch(/\(R6\)/)
  })

  it('does not fire on the site\'s own /videos page or a photographer\'s video link', () => {
    expect(runWithAdded('lib/site/videos-link.ts', 'export const href = (siteUrl: string) => `${siteUrl}/videos?view=feed`\n')).toEqual([])
    expect(
      runWithAdded('scripts/aryeo-probe.mjs', "const u = 'https://jackson-real-estate-photography.aryeo.com/videos/0190'\n"),
    ).toEqual([])
  })

  it('does not fire on a comment, or on a word that only contains a signature', () => {
    expect(runWithAdded('scripts/notes.mjs', "// we used to post 'REELS' here\nconst kind = 'REELS_ARCHIVE'\n")).toEqual([])
  })
})

describe('R7: platform video functions are imported only by the publish route', () => {
  it('fails on a script importing publishReel', () => {
    const problems = runWithAdded('scripts/post-reel.ts', "import { publishReel } from '../lib/meta-graph'\nawait publishReel('t', 'ig', 'u', 'c')\n")
    expect(problems).toEqual(['scripts/post-reel.ts: imports lib/meta-graph.publishReel, a platform video function only app/api/social/publish/route.ts may call (it refuses video) (R7).'])
  })

  it('fails on a namespace import or a re-export of a platform client', () => {
    expect(runWithAdded('lib/social/all-graph.ts', "import * as graph from '@/lib/meta-graph'\nexport { graph }\n").join('\n')).toMatch(/lib\/meta-graph\.\*.*\(R7\)/)
    expect(runWithAdded('lib/social/tt-reexport.ts', "export { directPostVideo } from '@/lib/tiktok'\n").join('\n')).toMatch(/lib\/tiktok\.directPostVideo.*\(R7\)/)
  })

  it('fails on a script importing publishNextdoorPost (it takes a videoUrl)', () => {
    const problems = runWithAdded('scripts/nextdoor-post.ts', "import { publishNextdoorPost } from '@/lib/nextdoor'\nexport const go = publishNextdoorPost\n")
    expect(problems).toEqual([
      'scripts/nextdoor-post.ts: imports lib/nextdoor.publishNextdoorPost, a platform video function only app/api/social/publish/route.ts may call (it refuses video) (R7).',
    ])
  })

  it('does not fire on an image function from the same client', () => {
    expect(runWithAdded('lib/social/post-image.ts', "import { publishImage } from '@/lib/meta-graph'\nexport const go = publishImage\n")).toEqual([])
  })
})

describe('the scripts refuse at runtime (credentials stripped, so a regression cannot reach an API)', () => {
  const cleanEnv = () =>
    Object.fromEntries(Object.entries(process.env).filter(([k]) => !/META|SUPABASE|YOUTUBE|YT_|GOOGLE|TOKEN|SECRET|KEY|VITEST/i.test(k)))
  const run = (script, args) =>
    spawnSync(process.execPath, [script, ...args], { cwd: ROOT, env: cleanEnv(), encoding: 'utf8', timeout: 60_000 })

  it('upload-youtube.mjs refuses a private upload and says so', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rr-video-freeze-'))
    try {
      const mp4 = join(dir, 'report.mp4')
      writeFileSync(mp4, 'not really an mp4')
      const r = run('scripts/upload-youtube.mjs', ['--city', 'bend', '--period', '2026-04', '--mp4', mp4])
      expect(r.status).toBe(1)
      expect(r.stderr).toContain(FREEZE_MESSAGE)
      expect(r.stderr).toContain('Nothing was uploaded, private or public.')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('create-fb-ad.mjs refuses before touching the ad account', () => {
    const r = run('scripts/create-fb-ad.mjs', ['--city', 'bend', '--period', '2026-04'])
    expect(r.status).toBe(1)
    expect(r.stderr).toContain(FREEZE_MESSAGE)
    expect(r.stdout).not.toContain('[1/8]')
  })
})

describe('R3: the publish route answers 423 Locked', () => {
  it('fails on any other status', () => {
    const rel = fileOf('social/publish')
    const problems = runWith(rel, (s) =>
      s.replace('return NextResponse.json({ error: frozen }, { status: 423 })', 'return NextResponse.json({ error: frozen }, { status: 400 })'),
    )
    expect(problems).toEqual([`${rel}: the video refusal does not answer 423 Locked (R3).`])
  })
})

describe('R4: bulk approve writes only ids that passed the freeze', () => {
  it('fails when bulk approve writes the raw selection', () => {
    const rel = fileOf('bulk-action')
    const problems = runWith(rel, (s) => s.replace(".in('id', approvableIds)", ".in('id', ids)"))
    expect(problems.join('\n')).toMatch(/bulk-action\/route\.ts:\d+: bulk approve writes ids that did not come out of splitVideoFrozen/)
  })
})

describe('a moved choke point is a failure, not a silent pass', () => {
  it('fails when a choke-point file disappears', () => {
    const rel = fileOf('publisher-sweep')
    const problems = checkVideoFreeze((path) => (path === rel ? null : real(path)))
    expect(problems.join('\n')).toMatch(/publisher-sweep\/route\.ts: missing/)
  })

  it('fails when the guarded function is renamed', () => {
    const rel = fileOf('lib/data/studio/drafts.ts')
    const problems = runWith(rel, (s) => s.replace('export async function approveStudioDraft(', 'export async function approveDraft('))
    expect(problems.join('\n')).toMatch(/no function `approveStudioDraft`/)
  })
})
