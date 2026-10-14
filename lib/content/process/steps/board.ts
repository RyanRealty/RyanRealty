/**
 * Step board: the plan and the layout, then one still per beat.
 *
 * Maps the factory's preflight steps c and d onto this step (lib/studio/timeline/preflight.ts):
 *  - c, the plan: planFilm with the real voice words and the measured footage,
 *    then the planned manifest through planPreflight (checks 3, 4, 5, 7, 8, 9,
 *    10, 12, 13, 15, 16). The planner's own refusals (beats edge to edge, the
 *    locked end card, a hook that opens on its figure) are listed with them.
 *  - d, the layout probe: the page read back at each card's still, with no
 *    frame encoded (checks 9 and 11).
 * Only when both are clear are the stills drawn: one PNG per beat and a contact
 * sheet, in out/studio/<slug>/board/<attempt>/. No MP4 is encoded.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadMotionAssets } from '../../../studio/motion/assets'
import { figureLeaks, stillTimes } from '../../../studio/motion/cues'
import { buildMotionPage } from '../../../studio/motion/page'
import { probeMotionLayout } from '../../../studio/motion/render'
import { checkName } from '../../../studio/qa/phases'
import { PlanError, planFilm, type FilmPlan, type ResolvedFootage } from '../../../studio/timeline/plan'
import { layoutPreflight, planPreflight, plannedManifest } from '../../../studio/timeline/preflight'
import { FILM_HEIGHT, FILM_WIDTH, footageFilePath, resolveOutlines, textsFromProbes } from '../../../studio/timeline/render'
import type { StudioBrief, Timeline } from '../../../studio/timeline/types'
import { parseBrief, parseTimeline } from '../../../studio/timeline/validate'
import { hashJson, sha256Hex } from '../canonical'
import { captureBoard } from '../board'
import { classify } from '../classify'
import type { RunContext, StepDef } from '../context'
import type { StampProblem } from '../stamp'
import { commonFileParts, preflightContextFor } from './brief'
import { clipParts } from './stills'
import { filmVoice } from './voice'

/** The measured clips the stills step recorded, read back as the planner takes them. */
export function footageFromStills(ctx: RunContext, clips: unknown): Record<string, ResolvedFootage> {
  if (ctx.state.footage) return ctx.state.footage
  const out: Record<string, ResolvedFootage> = {}
  for (const [src, c] of Object.entries((clips ?? {}) as Record<string, { width: number; height: number; duration: number }>)) {
    out[src] = { path: footageFilePath(src, ctx), width: c.width, height: c.height, duration: c.duration }
  }
  return out
}

/** Everything the board and the master both need from a brief, a timeline, the voice and the clips: the plan and its planned manifest. */
export async function planTheFilm(ctx: RunContext, clips: unknown, paidVoice: boolean) {
  const b = parseBrief(ctx.brief)
  const t = parseTimeline(ctx.timeline)
  if (!b.ok || !t.ok) throw new Error('the brief or the timeline is not valid')
  const brief: StudioBrief = b.value
  const timeline: Timeline = t.value
  const voice = await filmVoice(ctx, paidVoice)
  const outlines = await resolveOutlines(brief, timeline, ctx.deps.render.resolveOutline)
  const film: FilmPlan = planFilm({ brief, timeline, voice, footage: footageFromStills(ctx, clips), scored: Boolean(timeline.score), outlines })
  const leaks = figureLeaks(film.plan, film.subject)
  return { brief, timeline, voice, film, leaks, draft: plannedManifest(film, brief, voice) }
}

export const boardStep: StepDef = {
  id: 'board',
  async parts(ctx) {
    return { ...commonFileParts(ctx.deps.render.registryPath, ctx.ledgerPath), ...(await clipParts(ctx)) }
  },
  async run(ctx, stamps) {
    const problems: StampProblem[] = []
    let planned
    try {
      planned = await planTheFilm(ctx, stamps.stills?.outputs.clips, false)
    } catch (e) {
      if (e instanceof PlanError) return { problems: e.problems.map((p) => classify(`planFilm: ${p}`)), outputs: {} }
      return { problems: [classify((e as Error).message)], outputs: {} }
    }
    const { brief, timeline, film, draft, leaks } = planned
    if (leaks.length) return { problems: [classify(`unverified number on screen (no brief.numbers row): ${leaks.join(', ')}`)], outputs: {} }

    // c: the planned manifest, before any frame.
    const built = await preflightContextFor(brief, { registryPath: ctx.deps.render.registryPath, ledgerPath: ctx.ledgerPath })
    if ('problem' in built) return { problems: [classify(built.problem)], outputs: {} }
    for (const p of planPreflight(draft, brief, built.ctx)) problems.push(classify(`check ${p.check} ${checkName(p.check)}: ${p.problem}`, p.check))
    if (problems.length) return { problems, outputs: {} }

    // d: the layout probe, the same page read back at each card's still, no frames encoded.
    const assets = await (ctx.deps.render.loadAssets ?? (() => loadMotionAssets()))()
    const html = buildMotionPage({ plan: film.plan, width: FILM_WIDTH, height: FILM_HEIGHT, assets })
    const layout = await (ctx.deps.render.layoutProbe ?? probeMotionLayout)({
      plan: film.plan,
      html,
      width: FILM_WIDTH,
      height: FILM_HEIGHT,
      times: [...new Set(stillTimes(film.plan).map((x) => x.t))].sort((a, c) => a - c),
      launchBrowser: ctx.deps.render.launchBrowser,
    })
    for (const p of layoutPreflight(draft, film, layout, textsFromProbes)) problems.push(classify(`check ${p.check} ${checkName(p.check)}: ${p.problem}`, p.check))
    if (problems.length) return { problems, outputs: {} }

    // The stills: one per beat at its key moment, and the sheet.
    const capture = await (ctx.deps.board ?? captureBoard)({ film, html, width: FILM_WIDTH, height: FILM_HEIGHT, ffmpeg: ctx.deps.render.ffmpeg, footage: footageFromStills(ctx, stamps.stills?.outputs.clips) }, ctx.deps.render)
    const dir = join(ctx.filmDir, 'board', String(ctx.attempt))
    mkdirSync(dir, { recursive: true })
    const stills = capture.shots.map((s, i) => {
      const file = join(dir, `${String(i + 1).padStart(2, '0')}-${s.beat}.png`)
      writeFileSync(file, s.png)
      return { beat: s.beat, role: s.role, t: s.t, file: `board/${ctx.attempt}/${String(i + 1).padStart(2, '0')}-${s.beat}.png`, sha256: sha256Hex(s.png) }
    })
    writeFileSync(join(dir, 'board.png'), capture.sheet)
    ctx.log(`board: ${stills.length} stills and a contact sheet in ${dir}`)
    return {
      problems,
      outputs: {
        stills,
        sheet: { file: `board/${ctx.attempt}/board.png`, sha256: sha256Hex(capture.sheet) },
        plannedManifestSha256: hashJson(draft),
        duration: film.duration,
        frames: film.frames,
        techniques: film.techniques.map((t) => t.name),
        timelineBeats: timeline.beats.length,
      },
    }
  },
}
