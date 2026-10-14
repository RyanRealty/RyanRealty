/**
 * npm run studio:render -- <brief.json> <timeline.json> [--slug s] [--out dir] [--no-check]
 *
 * The one factory's renderer (docs/plans/STUDIO_ONE_FACTORY.md). Every Studio
 * video renders here, on Matt's Mac mini or in a cloud session, through the
 * same lib/studio code:
 *
 *   1. video_gate.mjs on the paperwork (the ryan-studio backup check).
 *   2. lib/studio/timeline renders final.mp4 and final.manifest.json into
 *      out/studio/<slug>/ (gitignored), with final.brief.json beside them.
 *   3. video:check measures the file (not final: the separate reviewer and
 *      --final come after), writes final.check.json and final.contact.png,
 *      and prints its table.
 *
 * Exit 0 when the film renders and every check passes; 1 when a check fails or
 * the render is refused; 2 for bad usage. Never publishes; never writes under
 * public/. The voice is ElevenLabs v3 (ELEVENLABS_API_KEY and the named voice's
 * ELEVENLABS_VOICE_ID_* from the environment); syntheses are cached under
 * out/studio/.cache so a re-render pays nothing.
 */
import 'dotenv/config'
import Module from 'node:module'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

// server-only and next/cache are Next bundler markers; under plain Node the
// Studio modules load once they are stubbed (test/*-stub.ts).
const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  const req = request === 'server-only' || request === 'client-only' ? STUB : request === 'next/cache' ? CACHE_STUB : request
  return resolveFilename.call(this, req, ...args)
}

const USAGE = 'Usage: npm run studio:render -- <brief.json> <timeline.json> [--slug s] [--out dir] [--no-check] (the builder is STUDIO_BUILDER, default claude)'

type Args = { brief: string; timeline: string; slug?: string; out?: string; check: boolean }

function parseArgs(argv: string[]): Args {
  const positional: string[] = []
  const out: Partial<Args> = { check: true }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--no-check') out.check = false
    else if (a === '--slug' || a === '--out') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) throw new Error(`${a} needs a value`)
      if (a === '--slug') out.slug = v
      else out.out = v
    } else if (a.startsWith('--')) throw new Error(`unknown option ${a}`)
    else positional.push(a)
  }
  if (positional.length !== 2) throw new Error('a brief.json and a timeline.json are required')
  return { brief: positional[0], timeline: positional[1], ...out } as Args
}

async function main(): Promise<number> {
  let args: Args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(`${(e as Error).message}\n${USAGE}`)
    return 2
  }
  for (const p of [args.brief, args.timeline]) {
    if (!existsSync(p)) {
      console.error(`${p} does not exist\n${USAGE}`)
      return 2
    }
  }
  const root = path.resolve(__dirname, '..')

  // 1. The paperwork gate runs first (ryan-studio SKILL step 4).
  const gate = spawnSync(process.execPath, [path.join(root, '.claude/skills/ryan-studio/tools/video_gate.mjs'), args.brief, args.timeline], { encoding: 'utf8' })
  process.stdout.write(gate.stdout)
  if (gate.status !== 0) {
    process.stderr.write(gate.stderr)
    console.error('video_gate refused the brief; nothing was rendered.')
    return 1
  }

  const { renderTimelineFilm, readJson, RenderError, assertNotPublic } = await import('../lib/studio/timeline/render')
  const { elevenLabsProvider } = await import('../lib/studio/timeline/voice')
  const { studioFfmpeg } = await import('../lib/studio/timeline/ffmpeg')
  const { launchMotionChrome } = await import('../lib/studio/motion/endcard-render')
  const { checkVideo } = await import('../lib/studio/qa/check')
  const { writeContactSheet } = await import('../lib/studio/qa/contact')
  const { formatReport } = await import('../lib/studio/qa/report')
  const { typeRulesFor } = await import('../lib/studio/qa/thresholds')
  const { safeSlug } = await import('../lib/studio/qa/manifest')

  const brief = readJson(args.brief) as { title?: string; slug?: string }
  const timeline = readJson(args.timeline)
  // [a-z0-9-] only, whatever the brief or the flag says: a slug is never a path.
  // --slug names the folder; the manifest's slug is always the brief's own (check 1).
  const slug = safeSlug(args.slug ?? (typeof brief.slug === 'string' ? brief.slug : String(brief.title ?? 'film')))
  const outDir = path.resolve(args.out ?? path.join(root, 'out', 'studio', slug))
  const cacheDir = path.join(root, 'out', 'studio', '.cache')
  try {
    assertNotPublic(outDir)
  } catch (e) {
    console.error((e as Error).message)
    return 2
  }
  mkdirSync(outDir, { recursive: true })

  const ffmpeg = await studioFfmpeg()
  console.log(`studio:render ${slug} -> ${path.relative(root, outDir)} (ffmpeg ${ffmpeg})`)

  let result
  try {
    result = await renderTimelineFilm(
      {
        brief,
        timeline,
        baseDir: path.dirname(path.resolve(args.timeline)),
        outDir,
        cacheDir,
      },
      {
        ffmpeg,
        voiceProvider: elevenLabsProvider(),
        launchBrowser: launchMotionChrome,
        log: (line) => console.log(`  ${line}`),
        // Outlines come from the boundaries table through the DAL, never drawn by hand.
        resolveOutline: async ({ geoType, geoSlug }) => {
          const { getBoundaryGeoJSON } = await import('../lib/data/geo/getBoundaryGeoJSON')
          const geometry = await getBoundaryGeoJSON({ geoType, geoSlug })
          if (!geometry) return null
          const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
          return polygons.flatMap((polygon) => polygon.map((ring) => ring.map(([lng, lat]) => [lng, lat] as [number, number])))
        },
      },
    )
  } catch (e) {
    // Every refusal says why in plain words; an unexpected failure also gets its stack.
    const known = e instanceof RenderError || ['PreflightError', 'PlanError', 'PlateError', 'HookError', 'CaptionRuleError', 'ElevenLabsError', 'ManifestWriteError'].includes((e as Error).name)
    console.error(`\nRender refused: ${(e as Error).message}`)
    if (!known && e instanceof Error && e.stack) console.error(e.stack)
    return 1
  }

  console.log(`\nrendered ${path.relative(root, result.mp4Path)} in ${(result.ms / 1000).toFixed(1)}s`)
  console.log(`  ${result.film.frames} frames, ${result.manifest.video.duration}s, ${result.manifest.texts.length} texts, ${result.manifest.captions.length} captions`)
  console.log(`  audio ${result.audio.lufs} LUFS, true peak ${result.audio.truePeakDb} dBTP${result.loopSsim !== null ? `; loop SSIM ${result.loopSsim}` : ''}`)
  for (const t of result.techniques) console.log(`  technique ${t.name}: ${t.ran ? 'ran' : `DID NOT RUN (${t.why})`}`)
  for (const n of result.notes) console.log(`  note: ${n}`)
  if (!args.check) return 0

  // 3. The measured check, on the file.
  const report = await checkVideo({ mp4Path: result.mp4Path, manifestPath: result.manifestPath, briefPath: result.briefPath })
  writeFileSync(path.join(outDir, 'final.check.json'), `${JSON.stringify(report, null, 2)}\n`)
  let contact: Awaited<ReturnType<typeof writeContactSheet>> | { error: string } | null = null
  try {
    const rules = typeRulesFor(result.manifest.videoType)
    if (!rules) throw new Error(`unknown video type ${result.manifest.videoType}`)
    contact = await writeContactSheet({ mp4Path: result.mp4Path, manifest: result.manifest, hookMaxS: rules.hook_max_s })
  } catch (e) {
    contact = { error: (e as Error).message }
  }
  console.log(`\n${formatReport(report, contact)}`)
  return report.pass ? 0 : 1
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e instanceof Error ? e.stack ?? e.message : String(e))
    process.exit(1)
  },
)
