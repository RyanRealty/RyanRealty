/**
 * npx tsx scripts/studio-showcase-spring.ts [--out dir]
 *
 * The F1 showcase (lib/studio/motion/spring-showcase.ts), rendered and measured:
 *
 *   out/studio/reel/spring/showcase.mp4        6 s, 1080x1920, 30 fps, silent
 *   out/studio/reel/spring/stills/*.png        each retarget at -2, 0 and +2 frames, plus the first and last frame
 *   out/studio/reel/spring/contact.png         every still on one sheet
 *   out/studio/reel/spring/showcase.json       the criteria, what each still measured against them, the hashes
 *
 * The film is drawn twice in separate Chromium launches and the two MP4s are
 * compared byte for byte. Every still is measured from its pixels (dot centroid,
 * target ring, trace line column by column, the trace's head) against the same
 * function that drew it, so "the trace is the dot's own y(t)" is a measurement,
 * not a claim. Exit 1 when a criterion fails. Never writes under public/.
 *
 * Chromium: PUPPETEER_EXECUTABLE_PATH or CHROME_PATH, else the platform's Chrome,
 * else Playwright's bundled Chromium. ffmpeg: FFMPEG_PATH, else the Studio's own.
 */
import Module from 'node:module'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// server-only is a Next bundler marker that throws under plain Node; the Studio
// modules below are imported after it is stubbed.
const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  return resolveFilename.call(this, request === 'server-only' || request === 'client-only' ? STUB : request, ...args)
}

const W = 1080
const H = 1920
const NAVY = [16, 39, 66] as const
const CREAM = [250, 248, 244] as const

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}

type Rgb = { data: Buffer }
const px = (img: Rgb, x: number, y: number): [number, number, number] => {
  const o = (y * W + x) * 3
  return [img.data[o], img.data[o + 1], img.data[o + 2]]
}
const near = (p: readonly number[], c: readonly number[], tol: number) => Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]) + Math.abs(p[2] - c[2]) <= tol

async function main() {
  const { resolveFfmpeg } = await import('../lib/video/ffmpeg')
  const { launchMotionChrome, extractFramePng } = await import('../lib/studio/motion/endcard-render')
  const { MOTION_ENCODE_ARGS, paperGraph } = await import('../lib/studio/motion/render')
  const show = await import('../lib/studio/motion/spring-showcase')
  const { step } = await import('../lib/studio/motion/spring')
  const { buildContactFilter, findFont } = await import('../lib/studio/qa/contact')

  const ffmpeg = await resolveFfmpeg()
  if (!ffmpeg) throw new Error('ffmpeg is not available')
  const S = show.SPRING_SHOWCASE
  if (S.width !== W || S.height !== H) throw new Error(`the showcase is ${S.width}x${S.height}, this script reads ${W}x${H}`)
  const out = path.resolve(arg('--out') ?? 'out/studio/reel/spring')
  mkdirSync(path.join(out, 'stills'), { recursive: true })
  const frames = Math.round(S.seconds * S.fps)

  /** Draw the film: Chromium applies each frame's state, ffmpeg encodes it as every Studio film is. */
  async function renderFilm(file: string): Promise<void> {
    const browser = await launchMotionChrome({ width: W, height: H })
    try {
      const page = await browser.newPage()
      await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
      await page.setContent(show.springShowcaseHtml(), { waitUntil: 'load', timeout: 30_000 })
      const cdp = await page.createCDPSession()
      const ff = spawn(
        ffmpeg as string,
        [
          '-y', '-hide_banner', '-loglevel', 'error',
          '-f', 'image2pipe', '-framerate', String(S.fps), '-c:v', 'png', '-i', '-',
          '-filter_complex', paperGraph(), '-map', '[v]', '-an',
          ...MOTION_ENCODE_ARGS,
          '-t', (frames / S.fps).toFixed(3),
          file,
        ],
        { stdio: ['pipe', 'ignore', 'pipe'] },
      )
      let err = ''
      let dead = false
      ff.stderr?.on('data', (c) => (err = (err + String(c)).slice(-2000)))
      // A dead ffmpeg (bad graph, missing encoder) breaks the pipe: stop feeding it and report its own stderr.
      ff.stdin?.on('error', () => (dead = true))
      const done = new Promise<number>((res) => {
        ff.on('close', (code) => {
          dead = true
          res(code ?? 1)
        })
        ff.on('error', () => {
          dead = true
          res(1)
        })
      })
      for (let i = 0; i < frames && !dead; i++) {
        await page.evaluate((s) => (window as unknown as { __rrShow: (x: unknown) => void }).__rrShow(s), show.springShowcaseState(i / S.fps))
        const shot = (await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, captureBeyondViewport: false })) as { data: string }
        if (dead) break
        await new Promise<void>((res) => ff.stdin?.write(Buffer.from(shot.data, 'base64'), () => res()))
      }
      ff.stdin?.end()
      if ((await done) !== 0) throw new Error(`ffmpeg failed: ${err}`)
    } finally {
      await browser.close().catch(() => undefined)
    }
  }

  const mp4 = path.join(out, 'showcase.mp4')
  await renderFilm(mp4)
  const work = mkdtempSync(path.join(tmpdir(), 'spring-showcase-'))
  let second: Buffer
  try {
    const again = path.join(work, 'again.mp4')
    await renderFilm(again)
    second = readFileSync(again)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
  const first = readFileSync(mp4)
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
  const byteIdentical = Buffer.compare(first, second) === 0
  console.log(`showcase.mp4 ${first.length} bytes sha256 ${sha(first)}`)
  console.log(`re-render (separate Chromium launch) ${byteIdentical ? 'BYTE-IDENTICAL' : 'DIFFERENT'} sha256 ${sha(second)}`)

  // The stills: each retarget at -2, 0 and +2 frames, plus the first and last frame.
  type Still = { name: string; frame: number; retarget: number | null; offset: number | null }
  const stills: Still[] = [{ name: 'first', frame: 0, retarget: null, offset: null }]
  show.retargetFrames().forEach((f, i) => {
    for (const offset of [-2, 0, 2]) {
      stills.push({ name: `retarget${i + 1}${offset < 0 ? 'minus2' : offset > 0 ? 'plus2' : 'at'}`, frame: f + offset, retarget: i, offset })
    }
  })
  stills.push({ name: 'last', frame: frames - 1, retarget: null, offset: null })
  for (const s of stills) extractFramePng(ffmpeg, mp4, s.frame, path.join(out, 'stills', `${s.name}.png`))

  // The contact sheet reuses the QA sheet's own tiling and labels.
  const font = findFont()
  const sheet = (withFont: string | null) =>
    spawnSync(
      ffmpeg as string,
      [
        '-hide_banner', '-loglevel', 'error', '-y',
        ...stills.flatMap((s) => ['-i', path.join(out, 'stills', `${s.name}.png`)]),
        '-filter_complex',
        buildContactFilter(stills.map((s) => ({ t: s.frame / S.fps, tag: s.name })), withFont),
        '-map', '[o]', '-frames:v', '1', path.join(out, 'contact.png'),
      ],
      { encoding: 'utf8' },
    )
  let tiled = font ? sheet(font) : sheet(null)
  if (tiled.status !== 0 && font) tiled = sheet(null)
  if (tiled.status !== 0) throw new Error(`contact sheet failed: ${tiled.stderr.slice(-400)}`)

  /** One frame as raw RGB, decoded the way it was encoded (bt709, limited range). */
  const rgbFrame = (frame: number): Rgb => {
    const run = (flags: string[]) =>
      spawnSync(
        ffmpeg as string,
        [
          '-hide_banner', '-loglevel', 'error', '-i', mp4,
          '-vf', `select=eq(n\\,${frame}),scale=in_range=tv:in_color_matrix=bt709:out_range=pc,format=rgb24`,
          '-frames:v', '1', ...flags, '-f', 'rawvideo', '-',
        ],
        { maxBuffer: W * H * 3 + 1024 },
      )
    // ffmpeg before 5.1 has no -fps_mode; -vsync 0 is the same thing there.
    let r = run(['-fps_mode', 'passthrough'])
    if (r.status !== 0) r = run(['-vsync', '0'])
    if (r.status !== 0 || r.stdout.length !== W * H * 3) throw new Error(`could not decode frame ${frame}: ${String(r.stderr).slice(-300)}`)
    return { data: r.stdout }
  }

  // ---- Measurements -------------------------------------------------------
  // The lane: the ring's width plus room for the anti-aliased edge.
  const laneX0 = S.stage.x - S.stage.ringR - 24
  const laneX1 = S.stage.x + S.stage.ringR + 24
  // Ink coverage from luma (BT.709), not chroma: x264 smears chroma over a 5 px line at 4:2:0, luma it keeps.
  const luma = (p: readonly number[]) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]
  const alpha = (p: readonly number[]) => Math.min(1, Math.max(0, (luma(CREAM) - luma(p)) / (luma(CREAM) - luma(NAVY))))
  const solid = (p: readonly number[]) => alpha(p) >= 0.8
  const ringTone = [0.5 * NAVY[0] + 0.5 * CREAM[0], 0.5 * NAVY[1] + 0.5 * CREAM[1], 0.5 * NAVY[2] + 0.5 * CREAM[2]]

  // The function's own centreline in plot space, sampled every 1/4800 s (under a pixel along the steepest stretch),
  // and a 4 px grid over it so the nearest-point query is cheap.
  const centreline: Array<[number, number]> = []
  for (let i = 0; i <= S.seconds * 4800; i++) {
    const t = i / 4800
    centreline.push([show.plotX(t), show.plotY(show.springShowcaseY(t))])
  }
  const cells = new Map<string, Array<[number, number]>>()
  for (const [x, y] of centreline) {
    const k = `${Math.floor(x / 4)},${Math.floor(y / 4)}`
    const list = cells.get(k)
    if (list) list.push([x, y])
    else cells.set(k, [[x, y]])
  }
  const nearestCentreline = (x: number, y: number): number => {
    let best = Infinity
    for (let gy = Math.floor(y / 4) - 1; gy <= Math.floor(y / 4) + 1; gy++) {
      for (let gx = Math.floor(x / 4) - 1; gx <= Math.floor(x / 4) + 1; gx++) {
        for (const [cx, cy] of cells.get(`${gx},${gy}`) ?? []) best = Math.min(best, Math.hypot(cx - x, cy - y))
      }
    }
    return best
  }

  function measure(img: Rgb, frame: number) {
    const t = frame / S.fps
    const want = show.springShowcaseState(t)

    // The dot: the only solid navy in the lane.
    let n = 0
    let sy = 0
    let sx = 0
    for (let y = S.stage.top - 80; y < S.stage.bottom + 80; y++) {
      for (let x = laneX0; x < laneX1; x++) {
        if (solid(px(img, x, y))) {
          n++
          sy += y + 0.5
          sx += x + 0.5
        }
      }
    }
    const dotY = n ? sy / n : NaN
    const dotX = n ? sx / n : NaN

    // The target ring: pixels in the ring's tone, away from the dot's own anti-aliased edge, fitted to a circle.
    const ring: Array<[number, number]> = []
    for (let y = S.stage.top - 80; y < S.stage.bottom + 80; y++) {
      for (let x = laneX0; x < laneX1; x++) {
        if (Math.hypot(x + 0.5 - dotX, y + 0.5 - dotY) < S.stage.dotR + 4) continue
        if (near(px(img, x, y), ringTone, 40)) ring.push([x + 0.5, y + 0.5])
      }
    }
    // The best-fitting centres tie over a plateau a pixel wide; the middle of it is the ring's centre.
    const fit: Array<[number, number]> = []
    for (let cy = S.stage.top - 60; cy <= S.stage.bottom + 60; cy += 0.5) {
      let hits = 0
      for (const [x, y] of ring) if (Math.abs(Math.hypot(x - S.stage.x, y - cy) - S.stage.ringR) <= 2.5) hits++
      fit.push([cy, hits])
    }
    const most = Math.max(...fit.map(([, h]) => h))
    const top = fit.filter(([, h]) => h === most).map(([cy]) => cy)
    const ringY = top.reduce((a, b) => a + b, 0) / (top.length || 1)

    // The trace is the same function, both ways. Every inked pixel must lie within the 5 px stroke of
    // plotY(track(t)) (a stroke is the union of discs of radius 2.5 around its centreline, so no inked pixel
    // can be farther than that plus half a pixel); and the centreline must be inked end to end.
    const headX = want.headX
    const reach = headX - 18
    let worstInk = 0
    let inked = 0
    for (let y = S.plot.top - 70; y < S.plot.bottom + 70; y++) {
      for (let x = S.plot.left - 6; x < reach; x++) {
        if (!solid(px(img, x, y))) continue
        inked++
        worstInk = Math.max(worstInk, nearestCentreline(x + 0.5, y + 0.5))
      }
    }
    let covered = 0
    let sampled = 0
    for (const [cx, cyy] of centreline) {
      if (cx > reach || cx < S.plot.left) continue
      sampled++
      if (solid(px(img, Math.floor(cx), Math.floor(cyy)))) covered++
    }
    const coverage = sampled ? covered / sampled : 1

    // The head: the radius-14 disc that fits the ink best, to a quarter pixel. (A mask of exactly the head's radius,
    // so sliding it along the line through the head loses more than it gains.)
    let measuredHead: { x: number; y: number } | null = null
    if (frame > 0) {
      let bestScore = -Infinity
      for (let cy = want.headY - 4; cy <= want.headY + 4; cy += 0.25) {
        for (let cx = headX - 4; cx <= headX + 4; cx += 0.25) {
          let score = 0
          for (let y = Math.floor(cy - 15); y <= Math.ceil(cy + 15); y++) {
            for (let x = Math.floor(cx - 15); x <= Math.ceil(cx + 15); x++) {
              if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= 14) score += 2 * alpha(px(img, x, y)) - 1
            }
          }
          if (score > bestScore) {
            bestScore = score
            measuredHead = { x: cx, y: cy }
          }
        }
      }
    }

    // Brand colour: the dot's centre pixel and a clear patch of paper.
    const dotPixel = Number.isFinite(dotY) ? px(img, Math.round(dotX), Math.round(dotY)) : [0, 0, 0]
    const paper = px(img, 40, 600)
    // Nothing drawn outside the safe band (a change from cream beyond the rows the film uses).
    let outside = 0
    for (let y = 0; y < H; y++) {
      if (y >= S.safe.top && y < S.safe.bottom) continue
      for (let x = 0; x < W; x += 3) if (!near(px(img, x, y), CREAM, 12)) outside++
    }
    return {
      t,
      want,
      dotY,
      ringY,
      ringPixels: ring.length,
      worstInk,
      inked,
      coverage,
      measuredHead,
      dotPixel,
      paper,
      outside,
    }
  }

  const rows = stills.map((s) => ({ ...s, ...measure(rgbFrame(s.frame), s.frame) }))
  const byKey = new Map(rows.map((r) => [`${r.retarget}:${r.offset}`, r]))

  type Verdict = { id: string; criterion: string; pass: boolean; detail: string }
  const verdicts: Verdict[] = []
  const f1 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : 'n/a')
  const add = (id: string, criterion: string, pass: boolean, detail: string) => verdicts.push({ id, criterion, pass, detail })

  const dotErr = Math.max(...rows.map((r) => Math.abs(r.dotY - r.want.dotY)))
  add('K1', 'the dot sits where spring.ts track puts it, in every still (centroid error <= 0.75 px)', dotErr <= 0.75, `worst ${f1(dotErr)} px over ${rows.length} stills`)
  const inkWorst = Math.max(...rows.map((r) => r.worstInk))
  const coverageWorst = Math.min(...rows.map((r) => r.coverage))
  add(
    'K2',
    'the trace is the same function: every inked pixel lies within the 5 px stroke of plotY(track(t)) (<= 3.3 px from its centreline) and the centreline is inked end to end (>= 99.5%)',
    inkWorst <= 3.3 && coverageWorst >= 0.995,
    `farthest inked pixel ${f1(inkWorst)} px from the function; least coverage ${(coverageWorst * 100).toFixed(2)}% over ${rows.reduce((a, r) => a + r.inked, 0)} inked pixels`,
  )
  const headRows = rows.filter((r) => r.frame > 0)
  const headErr = Math.max(...headRows.map((r) => (r.measuredHead ? Math.hypot(r.measuredHead.x - r.want.headX, r.measuredHead.y - r.want.headY) : 99)))
  const oneValue = Math.max(...headRows.map((r) => (r.measuredHead ? Math.abs(r.measuredHead.y - show.plotY(r.dotY)) : 99)))
  add('K3', 'one value, read twice: the trace head sits where the function puts it (<= 0.75 px) and at plotY of the dot measured beside it (<= 1 px)', oneValue <= 1 && headErr <= 0.75, `head vs state ${f1(headErr)} px, head vs dot ${f1(oneValue)} px`)
  let ringWorst = 0
  const ringNotes: string[] = []
  S.retargets.forEach((r, i) => {
    const before = i === 0 ? S.rest : S.retargets[i - 1].y
    const e0 = Math.abs(byKey.get(`${i}:-2`)!.ringY - before)
    const e1 = Math.abs(byKey.get(`${i}:0`)!.ringY - r.y)
    const e2 = Math.abs(byKey.get(`${i}:2`)!.ringY - r.y)
    ringWorst = Math.max(ringWorst, e0, e1, e2)
    ringNotes.push(`${i + 1}: ${f1(e0)}/${f1(e1)}/${f1(e2)}`)
  })
  add('K4', 'the retarget is legible on its own frame: the ring is on the old target at -2, on the new one at 0 and +2 (<= 3 px)', ringWorst <= 3, `ring error at -2/0/+2 per retarget ${ringNotes.join('; ')}`)

  const motion = S.retargets.map((r, i) => {
    const a = byKey.get(`${i}:-2`)!
    const b = byKey.get(`${i}:0`)!
    const c = byKey.get(`${i}:2`)!
    return { target: r.y, a: a.dotY, b: b.dotY, c: c.dotY }
  })
  // What the dot would do two frames on if the retarget restarted it from rest where it stands.
  const restart = (m: (typeof motion)[number]) => m.b + (m.target - m.b) * step(2 / S.fps, S.spring.omega, S.spring.zeta)
  // From rest (retargets 1 and 4): 1% of the largest move plus a pixel of measurement.
  const targets = [S.rest, ...S.retargets.map((r) => r.y)]
  const largestMove = Math.max(...targets.slice(1).map((y, i) => Math.abs(y - targets[i])))
  const REST_TOL = 0.01 * largestMove + 1
  const prevTarget = (i: number) => (i === 0 ? S.rest : S.retargets[i - 1].y)
  const fromRest = [0, 3].map((i) => {
    const m = motion[i]
    const settled = Math.abs(m.a - prevTarget(i)) <= REST_TOL && Math.abs(m.b - prevTarget(i)) <= REST_TOL
    const leaves = Math.abs(m.c - m.b) >= 0.02 * Math.abs(m.target - m.b) && Math.abs(m.c - restart(m)) <= 1.5
    return { i, settled, leaves, m }
  })
  add(
    'K5',
    'a retarget from rest leaves smoothly: the dot is on its old target at -2 and 0 (within 1% of its largest move), has moved off it by +2, and is where a spring started from rest puts it (<= 1.5 px)',
    fromRest.every((r) => r.settled && r.leaves),
    fromRest.map((r) => `${r.i + 1}: ${f1(r.m.a)} -> ${f1(r.m.b)} -> ${f1(r.m.c)} (rest model ${f1(restart(r.m))}, target ${r.m.target})`).join('; '),
  )
  // In flight (retarget 3): the dot is still travelling when the target moves, and keeps its velocity.
  const m3 = motion[2]
  const carried = Math.abs(m3.c - byKey.get('2:2')!.want.dotY) <= 1.5
  add(
    'K6',
    'a retarget in flight carries momentum: the dot was moving at -2 -> 0, and at +2 it is where the carried spring puts it (<= 1.5 px) and not where a restart from rest would (> 10 px away): no kink, no restart',
    m3.b - m3.a > 1 && carried && Math.abs(m3.c - restart(m3)) > 10,
    `retarget 3 (old target ${S.retargets[1].y}, new ${S.retargets[2].y}): ${f1(m3.a)} -> ${f1(m3.b)} -> ${f1(m3.c)}; restart model ${f1(restart(m3))}`,
  )
  add('K7', 'a re-render in a separate Chromium launch is byte-identical', byteIdentical, `sha256 ${sha(first)}`)
  const within = (p: readonly number[], c: readonly number[], tol: number) => p.every((v, i) => Math.abs(v - c[i]) <= tol)
  const colourOk = rows.every((r) => within(r.dotPixel, NAVY, 3) && within(r.paper, CREAM, 3))
  add('K8', 'brand colour on its code values: dot navy (16,39,66) and paper cream (250,248,244) within 3 levels a channel', colourOk, `dot ${JSON.stringify(rows[1].dotPixel)}, paper ${JSON.stringify(rows[1].paper)}`)
  const outside = Math.max(...rows.map((r) => r.outside))
  add('K9', `nothing is drawn above y ${S.safe.top} or below y ${S.safe.bottom} (the platform safe band)`, outside === 0, `${outside} off-cream samples outside the band`)

  const report = {
    file: 'out/studio/reel/spring/showcase.mp4',
    spec: { width: W, height: H, fps: S.fps, seconds: S.seconds, spring: S.spring, retargets: S.retargets, retargetFrames: show.retargetFrames() },
    sha256: sha(first),
    reRenderSha256: sha(second),
    byteIdentical,
    verdicts,
    stills: rows.map((r) => ({
      name: r.name,
      frame: r.frame,
      t: r.t,
      dotY: { measured: Number(f1(r.dotY)), function: r.want.dotY },
      ringY: { measured: Number(f1(r.ringY)), target: r.want.targetY },
      head: r.measuredHead ? { measured: [Number(f1(r.measuredHead.x)), Number(f1(r.measuredHead.y))], function: [r.want.headX, r.want.headY] } : null,
      worstInkDistance: Number(f1(r.worstInk)),
      centrelineCoverage: Number(r.coverage.toFixed(4)),
    })),
  }
  writeFileSync(path.join(out, 'showcase.json'), JSON.stringify(report, null, 2))
  for (const v of verdicts) console.log(`${v.pass ? 'PASS' : 'FAIL'} ${v.id}  ${v.criterion}\n       ${v.detail}`)
  console.log(`contact sheet ${path.join(out, 'contact.png')}${font ? '' : ' (unlabelled: no font file found)'}`)
  if (verdicts.some((v) => !v.pass)) process.exitCode = 1
  if (!existsSync(path.join(out, 'contact.png'))) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
