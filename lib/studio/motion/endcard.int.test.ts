/**
 * The locked end card against real Chromium and real ffmpeg.
 *
 *  1. The word metrics in ENDCARD are what Chromium measures with the real
 *     Amboqia and its capital-I patch: the pure layout stands on them.
 *  2. Every frame at 30 fps, seeked in the real page: no two visible words
 *     (opacity > 0.01) closer than 8 px, none outside x 120..950, nothing
 *     drawn in the top 220 or the bottom 380 px. Boxes are Chromium's own
 *     (layout box, widened to the glyph ink), and they agree with the model.
 *  3. A fresh render of the card alone holds SSIM 0.98 against the committed
 *     golden still (scripts/studio-endcard-golden.ts writes it).
 *
 * Needs a local Chromium and ffmpeg. Skips loudly without Chromium, like
 * compose.int.test.ts; `test:int` is where it must pass.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { resolveFfmpeg } from '@/lib/video/ffmpeg'
import { loadMotionAssets } from './assets'
import { frameState, planEndcardOnly } from './cues'
import { ENDCARD, endcardLayout, endcardState, endcardWordBoxes } from './endcard'
import {
  ENDCARD_GOLDEN_MIN_SSIM,
  ENDCARD_GOLDEN_PATH,
  extractFramePng,
  frameAt,
  goldenTime,
  launchMotionChrome,
  motionChromePath,
  renderEndcardAlone,
  ssim,
} from './endcard-render'
import { buildMotionPage } from './page'

const hasChrome = existsSync(motionChromePath())
const FPS = 30

type DomFrame = {
  words: Array<{ word: string; left: number; right: number; top: number; bottom: number; opacity: number }>
  logoTop: number
  call: Array<{ id: string; bottom: number; visibleBottom: number; opacity: number }>
}

describe.skipIf(!hasChrome)('the locked end card in real Chromium', () => {
  it('measures the words the layout was built on, then holds every frame apart and inside the band', async () => {
    const plan = planEndcardOnly()
    const assets = await loadMotionAssets()
    const html = buildMotionPage({ plan, width: 1080, height: 1920, assets })
    const browser = await launchMotionChrome({ width: 1080, height: 1920 })
    try {
      const page = await browser.newPage()
      await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 })
      await page.setContent(html, { waitUntil: 'load' })
      const fonts = (await page.evaluate(async () => {
        const faces = Array.from(document.fonts)
        await Promise.all(faces.map((f) => f.load().catch(() => f)))
        await document.fonts.ready
        await Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => undefined)))
        return faces.map((f) => f.status)
      })) as string[]
      expect(fonts.length).toBeGreaterThan(0)
      expect(fonts.every((s) => s === 'loaded')).toBe(true)

      // 1. The metrics, re-measured at 1000 px in the page's own faces.
      const measured = (await page.evaluate((words: string[]) => {
        const out: Record<string, { advance: number; inkLeft: number; inkRight: number }> = {}
        const ctx = document.createElement('canvas').getContext('2d')!
        ctx.font = "400 1000px 'RR Amboqia I','RR Amboqia'"
        for (const word of words) {
          const m = ctx.measureText(word)
          out[word] = { advance: m.width / 1000, inkLeft: -m.actualBoundingBoxLeft / 1000, inkRight: m.actualBoundingBoxRight / 1000 }
        }
        return out
      }, [...ENDCARD.copy.words])) as Record<string, { advance: number; inkLeft: number; inkRight: number }>
      for (const word of ENDCARD.copy.words) {
        const want = ENDCARD.words.metrics[word]
        expect(measured[word].advance, `${word} advance`).toBeCloseTo(want.advance, 2)
        expect(Math.abs(measured[word].inkLeft - want.inkLeft), `${word} ink left`).toBeLessThan(0.003)
        expect(Math.abs(measured[word].inkRight - want.inkRight), `${word} ink right`).toBeLessThan(0.003)
      }

      // 2. Every frame, seeked and measured in the page.
      const layout = endcardLayout()
      const total = Math.round(plan.duration * FPS)
      let minGap = Number.POSITIVE_INFINITY
      let minX = Number.POSITIVE_INFINITY
      let maxX = Number.NEGATIVE_INFINITY
      for (let f = 0; f < total; f++) {
        const t = f / FPS
        const states = frameState(plan, t)
        const dom = (await page.evaluate(
          (s: unknown, metrics: Record<string, { advance: number; inkLeft: number; inkRight: number }>, fs: number) => {
            ;(window as unknown as { __rrApply: (x: unknown) => void }).__rrApply(s)
            const opacityOf = (el: Element | null) => {
              let o = 1
              for (let n = el as HTMLElement | null; n && n !== document.body; n = n.parentElement) o *= Number(getComputedStyle(n).opacity)
              return o
            }
            const words = ['quality', 'local', 'service'].map((part) => {
              const span = document.querySelector(`#endcard-${part} span`) as HTMLElement
              const r = span.getBoundingClientRect()
              const m = metrics[span.textContent ?? '']
              // The layout box, widened to the ink, at the transformed scale.
              const k = r.width / (m.advance * fs)
              return {
                word: span.textContent ?? '',
                left: r.left + k * fs * Math.min(0, m.inkLeft),
                right: r.left + k * fs * Math.max(m.advance, m.inkRight),
                top: r.top,
                bottom: r.bottom,
                opacity: opacityOf(span),
              }
            })
            const box = document.querySelector('.ec-callbox')!.getBoundingClientRect()
            const call = ['endcard-pill', 'endcard-phone'].map((id) => {
              const el = document.getElementById(id)!
              const r = el.getBoundingClientRect()
              return { id, bottom: r.bottom, visibleBottom: Math.min(r.bottom, box.bottom), opacity: opacityOf(el) }
            })
            const logo = document.getElementById('endcard-logo')!
            return { words, logoTop: logo.getBoundingClientRect().top, call }
          },
          states,
          ENDCARD.words.metrics,
          layout.fs,
        )) as DomFrame

        const visible = dom.words.filter((w) => w.opacity > 0.01).sort((a, b) => a.left - b.left)
        for (const w of visible) {
          minX = Math.min(minX, w.left)
          maxX = Math.max(maxX, w.right)
          expect(w.left, `${w.word} left at frame ${f}`).toBeGreaterThanOrEqual(ENDCARD.words.xMin - 0.5)
          expect(w.right, `${w.word} right at frame ${f}`).toBeLessThanOrEqual(ENDCARD.words.xMax + 0.5)
          // Not clipped vertically either.
          expect(w.top).toBeGreaterThan(ENDCARD.safe.top)
          expect(w.bottom).toBeLessThan(ENDCARD.safe.bottom)
        }
        for (let i = 1; i < visible.length; i++) {
          const gap = visible[i].left - visible[i - 1].right
          minGap = Math.min(minGap, gap)
          expect(gap, `${visible[i - 1].word} / ${visible[i].word} at frame ${f}`).toBeGreaterThanOrEqual(ENDCARD.words.minGapPx)
        }
        // The page draws what the model says, to a pixel and a half.
        const model = endcardWordBoxes(endcardState(t), layout)
        for (const [i, w] of dom.words.entries()) {
          expect(w.opacity > 0.01).toBe(model[i].opacity > 0.01)
          if (model[i].opacity > 0.01) {
            expect(Math.abs(w.left - model[i].left), `${w.word} model left at frame ${f}`).toBeLessThan(1.5)
            expect(Math.abs(w.right - model[i].right), `${w.word} model right at frame ${f}`).toBeLessThan(1.5)
          }
        }
        // Nothing in the top 220 or the bottom 380 px.
        if (f > 0) expect(dom.logoTop).toBeGreaterThanOrEqual(ENDCARD.safe.top)
        for (const c of dom.call) if (c.opacity > 0.01) expect(c.visibleBottom, `${c.id} at frame ${f}`).toBeLessThanOrEqual(ENDCARD.safe.bottom)
      }
      console.log(`[endcard] ${total} frames: min word gap ${minGap.toFixed(1)} px, words inside x ${minX.toFixed(1)}..${maxX.toFixed(1)}`)
      expect(minGap).toBeGreaterThanOrEqual(ENDCARD.words.minGapPx)

      // The golden frame shows every word of the card, and only its own copy.
      await page.evaluate(
        (s: unknown) => (window as unknown as { __rrApply: (x: unknown) => void }).__rrApply(s),
        frameState(plan, goldenTime(plan.cues[0].kind === 'endcard' ? plan.cues[0].times : { call: 1.25 })),
      )
      const text = (await page.evaluate(() => (window as unknown as { __rrVisibleText: () => string[] }).__rrVisibleText())) as string[]
      expect(text).toEqual(['Quality', 'Local', 'Service', 'Call now', '541.703.3095'])
    } finally {
      await browser.close()
    }
  }, 120_000)

  it('a fresh render holds the committed golden still (SSIM >= 0.98)', async () => {
    const ffmpeg = await resolveFfmpeg()
    expect(ffmpeg, 'ffmpeg must resolve on a machine with Chromium').toBeTruthy()
    const golden = resolve(ENDCARD_GOLDEN_PATH)
    expect(existsSync(golden), `${ENDCARD_GOLDEN_PATH} is committed`).toBe(true)
    // A 1080 x 1920 PNG: width and height sit at bytes 16..24 of the IHDR.
    const head = readFileSync(golden)
    expect([head.readUInt32BE(16), head.readUInt32BE(20)]).toEqual([1080, 1920])

    const dir = mkdtempSync(join(tmpdir(), 'endcard-golden-int-'))
    try {
      const result = await renderEndcardAlone({ ffmpeg: ffmpeg!, fps: FPS })
      expect(result.frames).toBe(92)
      expect(result.fonts.every((f) => f.endsWith('loaded'))).toBe(true)
      const mp4 = join(dir, 'endcard.mp4')
      writeFileSync(mp4, result.body)
      const fresh = join(dir, 'fresh.png')
      extractFramePng(ffmpeg!, mp4, frameAt(goldenTime(result.times), FPS), fresh)
      // System ffmpeg when present (the task's measuring tool), else the resolved one.
      const meter = existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : ffmpeg!
      const score = ssim(meter, fresh, golden)
      console.log(`[endcard] SSIM vs golden: ${score}`)
      expect(score).toBeGreaterThanOrEqual(ENDCARD_GOLDEN_MIN_SSIM)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 180_000)
})
