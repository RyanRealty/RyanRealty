/**
 * npm run studio -- <command>
 *
 * The one command for the content process (docs/plans/CONTENT_PROCESS.md). A
 * bot's job is to fill in a brief; this runs the steps and refuses to move past
 * any that fails.
 *
 *   rules <deliverable-or-video-type> [--json]
 *       Every rule that applies, grouped by step, with ID, title, source,
 *       status and the number it holds today. Read this instead of the docs.
 *   run <brief.json> <timeline.json> [--to <step>] [--allow-unbuilt-step <step>]...
 *       Runs the steps from the first one without a valid stamp, stops at the
 *       first refusal, spends the job's caps (3 boards, 2 animatics, 2 masters,
 *       90 minutes). Refuses on a checkout that is behind origin/main, and
 *       refuses when it cannot tell. Calls the factory's functions; it does not
 *       shell out to npm. Never publishes, never writes under public/.
 *   status <slug>
 *       Prints the stamps and the caps spent for a film in out/studio/<slug>/.
 *
 * Exit 0 on success, 1 when a step refuses, 2 for bad usage. `studio:render`
 * and `video:check` are unchanged; this is the path that runs the steps.
 */
import path from 'node:path'

const USAGE = `Usage:
  npm run studio -- rules <deliverable-or-video-type> [--json]
  npm run studio -- run <brief.json> <timeline.json> [--to <step>] [--allow-unbuilt-step <step>]...
  npm run studio -- status <slug>`

const root = path.resolve(__dirname, '..')

function usage(message: string): number {
  console.error(`${message}\n${USAGE}`)
  return 2
}

async function rules(args: string[]): Promise<number> {
  const json = args.includes('--json')
  const rest = args.filter((a) => a !== '--json')
  if (rest.length !== 1 || rest[0].startsWith('--')) return usage('rules takes one deliverable or video type')
  const { formatRules, resolveTarget, rulesJson } = await import('../lib/content/process/print')
  const target = resolveTarget(rest[0])
  if ('error' in target) return usage(target.error)
  console.log(json ? JSON.stringify(rulesJson(target), null, 2) : formatRules(target))
  return 0
}

async function status(args: string[]): Promise<number> {
  if (args.length !== 1 || !/^[a-z0-9-]+$/.test(args[0])) return usage('status takes one slug ([a-z0-9-])')
  const slug = args[0]
  const outRoot = path.join(root, 'out')
  const { ALL_STEPS } = await import('../lib/content/process/steps')
  const { readStamp } = await import('../lib/content/process/stamp')
  const { FileClaimStore } = await import('../lib/content/process/caps')
  const { formatStatus } = await import('../lib/content/process/report')
  const claims = new FileClaimStore(outRoot)
  const reads = ALL_STEPS.map((step) => ({ step, read: readStamp(outRoot, slug, step) }))
  if (reads.every((r) => !r.read.ok && r.read.reason === 'missing')) {
    console.error(`no stamps for "${slug}" in ${path.relative(root, path.join(outRoot, 'studio', slug, 'stamps'))}`)
    return 1
  }
  console.log(formatStatus(slug, reads, claims.attempts(slug), claims.startedAt(slug), new Date()))
  return 0
}

type RunArgs = { brief: string; timeline: string; to?: string; allowUnbuilt: string[] }

function parseRun(argv: string[]): RunArgs | string {
  const positional: string[] = []
  const out: RunArgs = { brief: '', timeline: '', allowUnbuilt: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--to' || a === '--allow-unbuilt-step') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) return `${a} needs a step name`
      if (a === '--to') out.to = v
      else out.allowUnbuilt.push(v)
    } else if (a.startsWith('--')) return `unknown option ${a}`
    else positional.push(a)
  }
  if (positional.length !== 2) return 'run takes a brief.json and a timeline.json'
  return { ...out, brief: positional[0], timeline: positional[1] }
}

async function run(argv: string[]): Promise<number> {
  const parsed = parseRun(argv)
  if (typeof parsed === 'string') return usage(parsed)
  const { existsSync } = await import('node:fs')
  for (const p of [parsed.brief, parsed.timeline]) if (!existsSync(p)) return usage(`${p} does not exist`)
  const { ALL_STEPS, PASSABLE_UNBUILT_STEPS } = await import('../lib/content/process/steps')
  for (const s of [...(parsed.to ? [parsed.to] : []), ...parsed.allowUnbuilt]) if (!(ALL_STEPS as readonly string[]).includes(s)) return usage(`there is no step "${s}" (${ALL_STEPS.join(', ')})`)
  for (const s of parsed.allowUnbuilt) if (!(PASSABLE_UNBUILT_STEPS as readonly string[]).includes(s)) return usage(`--allow-unbuilt-step takes ${PASSABLE_UNBUILT_STEPS.join(' or ')}; ${s} is not a step that can be passed unbuilt`)

  // The factory's modules load under plain Node once the Next bundler markers are stubbed (as studio:render does).
  await import('dotenv/config')
  const Module = (await import('node:module')).default
  const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
  const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
  const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
  ;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
    const req = request === 'server-only' || request === 'client-only' ? STUB : request === 'next/cache' ? CACHE_STUB : request
    return resolveFilename.call(this, req, ...args)
  }

  const { runSteps } = await import('../lib/content/process/run')
  const { fetchAndCheckFreshness, gitRunner } = await import('../lib/content/process/freshness')
  const { formatRun } = await import('../lib/content/process/report')
  const { elevenLabsProvider } = await import('../lib/studio/timeline/voice')
  const { studioFfmpeg } = await import('../lib/studio/timeline/ffmpeg')
  const { launchMotionChrome } = await import('../lib/studio/motion/endcard-render')
  const { checkoutRoots } = await import('../lib/studio/timeline/render')

  const outRoot = path.join(root, 'out')
  const ffmpeg = await studioFfmpeg()
  const result = await runSteps({
    briefPath: parsed.brief,
    timelinePath: parsed.timeline,
    root,
    outRoot,
    to: parsed.to as never,
    allowUnbuilt: parsed.allowUnbuilt as never,
    // The checkout must be level with origin/main, and the CLI fetches to find out; a failed fetch refuses.
    freshness: () => fetchAndCheckFreshness(root),
    publicRoots: checkoutRoots(root),
    gitHead: () => gitRunner({ cwd: root })(['rev-parse', 'HEAD']).stdout.trim() || null,
    log: (line) => console.log(`  ${line}`),
    deps: {
      render: {
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
    },
  })
  console.log(formatRun(result, { root, outRoot }))
  return result.ok ? 0 : 1
}

async function main(): Promise<number> {
  const [cmd, ...args] = process.argv.slice(2)
  if (cmd === 'rules') return rules(args)
  if (cmd === 'run') return run(args)
  if (cmd === 'status') return status(args)
  return usage(cmd ? `unknown command "${cmd}"` : 'a command is required')
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e instanceof Error ? e.stack ?? e.message : String(e))
    process.exit(1)
  },
)
