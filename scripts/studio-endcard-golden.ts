/**
 * Regenerate the locked end card's golden still, and optionally its QA render.
 *
 *   npm run studio:endcard-golden                     # writes lib/studio/motion/endcard.golden.png
 *   npm run studio:endcard-golden -- --qa out/motion-qa/endcard
 *                                                     # also: endcard.mp4, the QA stills, a 40-frame strip
 *   npm run studio:endcard-golden -- --check          # re-render and print SSIM against the committed golden
 *
 * The card is rendered alone (cream page, the real fonts and logo) through
 * the Studio's own renderer, and the golden is the frame at Call now + 0.5 s
 * (lib/studio/motion/endcard-render.ts). Rewrite the golden only when the card
 * changes on purpose; endcard.int.test.ts holds every re-render to SSIM 0.98.
 *
 * Chromium: PUPPETEER_EXECUTABLE_PATH or CHROME_PATH, else the platform's
 * Chrome, else Playwright's bundled Chromium. ffmpeg: FFMPEG_PATH, else the
 * Studio's own resolver.
 */
import Module from 'node:module'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// server-only is a Next bundler marker that throws under plain Node; the
// Studio modules below are imported after it is stubbed.
const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  return resolveFilename.call(this, request === 'server-only' || request === 'client-only' ? STUB : request, ...args)
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}

async function main() {
  const { resolveFfmpeg } = await import('../lib/video/ffmpeg')
  const { spawnSync } = await import('node:child_process')
  const render = await import('../lib/studio/motion/endcard-render')
  const { ENDCARD } = await import('../lib/studio/motion/endcard')

  const ffmpeg = await resolveFfmpeg()
  if (!ffmpeg) throw new Error('ffmpeg is not available')
  const fps = ENDCARD.fps
  const result = await render.renderEndcardAlone({ ffmpeg, fps })
  const T = result.times
  console.log(`Rendered ${result.frames} frames with ${render.motionChromePath()} and ${ffmpeg}`)
  console.log(`Fonts: ${result.fonts.join(', ')}`)
  console.log(`Times: quality ${T.quality}, local ${T.local}, service ${T.service}, call ${T.call}, out ${T.out}`)

  const work = mkdtempSync(path.join(tmpdir(), 'endcard-golden-'))
  try {
    const mp4 = path.join(work, 'endcard.mp4')
    writeFileSync(mp4, result.body)
    const goldenFrame = render.frameAt(render.goldenTime(T), fps)

    if (process.argv.includes('--check')) {
      const fresh = path.join(work, 'fresh.png')
      render.extractFramePng(ffmpeg, mp4, goldenFrame, fresh)
      const score = render.ssim(ffmpeg, fresh, path.resolve(render.ENDCARD_GOLDEN_PATH))
      console.log(`SSIM vs ${render.ENDCARD_GOLDEN_PATH}: ${score} (floor ${render.ENDCARD_GOLDEN_MIN_SSIM})`)
      if (score < render.ENDCARD_GOLDEN_MIN_SSIM) process.exitCode = 1
      return
    }

    render.extractFramePng(ffmpeg, mp4, goldenFrame, path.resolve(render.ENDCARD_GOLDEN_PATH))
    console.log(`Golden: ${render.ENDCARD_GOLDEN_PATH} (frame ${goldenFrame}, t ${render.goldenTime(T)}s)`)

    const qa = arg('--qa')
    if (qa) {
      const dir = path.resolve(qa)
      mkdirSync(dir, { recursive: true })
      writeFileSync(path.join(dir, 'endcard.mp4'), result.body)
      const W = ENDCARD.words.service
      const moments: Array<[string, number]> = [
        ['1-quality-hit', render.frameAt(T.quality, fps) + 3],
        ['2-local', render.frameAt(T.local, fps) + 3],
        ['3-service-centre', render.frameAt(T.service, fps) + 2],
        ['4-service-slid', render.frameAt(T.service + W.holdSeconds + W.slideSeconds, fps)],
        ['5-call-now', goldenFrame],
        ['6-last-frame', result.frames - 1],
      ]
      for (const [name, frame] of moments) {
        render.extractFramePng(ffmpeg, mp4, frame, path.join(dir, `${name}.png`))
        console.log(`QA still ${name}: frame ${frame} (t ${(frame / fps).toFixed(3)}s)`)
      }
      // Every frame from the Quality hit to Service + 0.5 s, 40 frames, as one strip.
      const from = render.frameAt(T.quality, fps)
      const tile = spawnSync(
        ffmpeg,
        [
          '-y', '-hide_banner', '-loglevel', 'error', '-i', mp4,
          '-vf', `select=between(n\\,${from}\\,${from + 39}),scale=in_range=tv:in_color_matrix=bt709:out_range=pc:w=270:h=480,format=rgb24,tile=10x4`,
          '-frames:v', '1', path.join(dir, 'every-frame-strip.png'),
        ],
        { encoding: 'utf8' },
      )
      if (tile.status !== 0) throw new Error(`strip failed: ${tile.stderr.slice(-400)}`)
      const sheet = spawnSync(
        ffmpeg,
        [
          '-y', '-hide_banner', '-loglevel', 'error',
          ...moments.flatMap(([name]) => ['-i', path.join(dir, `${name}.png`)]),
          '-filter_complex', `${moments.map((_, i) => `[${i}:v]scale=360:640[s${i}]`).join(';')};${moments.map((_, i) => `[s${i}]`).join('')}hstack=inputs=${moments.length}`,
          path.join(dir, 'sheet.png'),
        ],
        { encoding: 'utf8' },
      )
      if (sheet.status !== 0) throw new Error(`sheet failed: ${sheet.stderr.slice(-400)}`)
      console.log(`QA render: ${dir}`)
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
