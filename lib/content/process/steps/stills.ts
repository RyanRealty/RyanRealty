/**
 * Step stills: the footage frames the film will sit on, checked before anything
 * is drawn over them.
 *
 * Phase 1 builds the half the factory already has a seam for: every footage
 * clip the timeline names is fetched once into the cache, measured with
 * ffprobe, and scanned for hidden cuts with the same scene-cut score video:check
 * check 5 uses. A cut inside the part of a clip a beat plays is a second shot
 * under a beat that is meant to hold one. Inspecting generated stills by eye
 * (CLAUDE.md §4) is the judge's work (rules.ts, planned).
 */
import { QA_THRESHOLDS } from '../../../studio/qa/thresholds'
import { createMeasure, sha256File, type Measure } from '../../../studio/qa/measure'
import { defaultDownload, footageFilePath, footageSources, resolveFootage } from '../../../studio/timeline/render'
import { parseTimeline } from '../../../studio/timeline/validate'
import type { Timeline } from '../../../studio/timeline/types'
import { classify } from '../classify'
import type { RunContext, StepDef } from '../context'
import type { StampProblem } from '../stamp'

/** The prefix of the part name a stamp gives a footage clip. */
export const CLIP_PART = 'file:clip:'

/** The footage files the timeline names, by the name a stamp gives them (a missing file is a value: it changes when it appears). */
export async function clipParts(ctx: RunContext): Promise<Record<string, string>> {
  const t = parseTimeline(ctx.timeline)
  if (!t.ok) return {}
  const out: Record<string, string> = {}
  for (const f of footageSources(t.value)) {
    const part = `${CLIP_PART}${f.src}`
    if (out[part]) continue
    try {
      out[part] = await sha256File(footageFilePath(f.src, ctx))
    } catch {
      out[part] = 'missing'
    }
  }
  return out
}

/** Each use of a clip: the beat, and the stretch of the clip it plays. */
function usesOf(timeline: Timeline): Array<{ src: string; label: string; from: number; to: number }> {
  const uses: Array<{ src: string; label: string; from: number; to: number }> = []
  for (const b of timeline.beats) if (b.footage) uses.push({ src: b.footage.src, label: `beat "${b.id}"`, from: b.footage.in ?? 0, to: (b.footage.in ?? 0) + (b.end - b.start) })
  if (timeline.cta?.footage) {
    const f = timeline.cta.footage
    uses.push({ src: f.src, label: 'the cta', from: f.in ?? 0, to: (f.in ?? 0) + (timeline.cta.end - timeline.cta.start) })
  }
  return uses
}

const r3 = (n: number) => Math.round(n * 1000) / 1000

export const stillsStep: StepDef = {
  id: 'stills',
  async parts(ctx) {
    return clipParts(ctx)
  },
  // The step fetches the clips into the cache: they are 'missing' before it runs and hashed after.
  produces: [CLIP_PART],
  async run(ctx) {
    const t = parseTimeline(ctx.timeline)
    if (!t.ok) return { problems: [classify('the timeline is not valid, so its footage cannot be read')], outputs: {} }
    const timeline = t.value
    const measure: Measure = ctx.deps.render.measure ?? createMeasure()
    const problems: StampProblem[] = []
    let footage
    try {
      footage = await resolveFootage(timeline, { baseDir: ctx.baseDir, cacheDir: ctx.cacheDir }, measure, ctx.deps.render.download ?? defaultDownload, ctx.log)
    } catch (e) {
      return { problems: [classify((e as Error).message)], outputs: {} }
    }
    ctx.state.footage = footage

    // Hidden cuts: the scene cuts inside the part of each clip a beat plays.
    const cutsBySrc = new Map<string, number[]>()
    for (const [src, clip] of Object.entries(footage)) cutsBySrc.set(src, await measure.sceneCuts(clip.path, QA_THRESHOLDS.sceneCutScore))
    for (const use of usesOf(timeline)) {
      const hidden = (cutsBySrc.get(use.src) ?? []).filter((c) => c > use.from + QA_THRESHOLDS.epsilon && c < use.to - QA_THRESHOLDS.epsilon)
      for (const c of hidden) {
        problems.push(classify(`footage "${use.src}" has a hidden cut at ${r3(c)}s, inside the ${r3(use.from)}s to ${r3(use.to)}s that ${use.label} plays: it would show as a second shot under one beat`))
      }
    }

    const clips: Record<string, unknown> = {}
    for (const [src, clip] of Object.entries(footage)) {
      clips[src] = { width: clip.width, height: clip.height, duration: r3(clip.duration), sha256: await sha256File(clip.path), cuts: (cutsBySrc.get(src) ?? []).map(r3) }
    }
    return { problems, outputs: { clips } }
  },
}
