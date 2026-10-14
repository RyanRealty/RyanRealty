/**
 * Step master: the film, then the output check.
 *
 * `studio:render` and `video:check`, called as functions (never through npm):
 * renderTimelineFilm writes final.mp4 and its manifest into out/studio/<slug>/,
 * then checkVideo opens the file and holds it to every check. Anything that
 * changed since the board stops the run before this step starts: the stamp
 * chain (stamp.ts) compares the brief, the timeline and the board's output.
 * The paid voice is not available here: it comes out of the cache step voice
 * filled, or the render refuses.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkVideo } from '../../../studio/qa/check'
import { writeContactSheet } from '../../../studio/qa/contact'
import { checkName } from '../../../studio/qa/phases'
import { typeRulesFor } from '../../../studio/qa/thresholds'
import { PreflightError } from '../../../studio/timeline/preflight'
import { renderTimelineFilm } from '../../../studio/timeline/render'
import { hashFile } from '../canonical'
import { classify } from '../classify'
import type { RenderedFilm, RunContext, StepDef } from '../context'
import type { StampProblem } from '../stamp'
import { commonFileParts } from './brief'
import { clipParts } from './stills'
import { paidVoiceRefused } from './voice'

/** The real master: the factory's own renderer, with the paid voice shut. */
export async function renderMaster(ctx: RunContext): Promise<RenderedFilm> {
  const result = await renderTimelineFilm(
    { brief: ctx.brief, timeline: ctx.timeline, baseDir: ctx.baseDir, outDir: ctx.filmDir, cacheDir: ctx.cacheDir, ledgerPath: ctx.ledgerPath },
    { ...ctx.deps.render, voiceProvider: paidVoiceRefused },
  )
  return { mp4Path: result.mp4Path, manifestPath: result.manifestPath, briefPath: result.briefPath }
}

export const masterStep: StepDef = {
  id: 'master',
  async parts(ctx) {
    return { ...commonFileParts(ctx.deps.render.registryPath, ctx.ledgerPath), ...(await clipParts(ctx)) }
  },
  async run(ctx) {
    let film: RenderedFilm
    try {
      film = await (ctx.deps.master ?? renderMaster)(ctx)
    } catch (e) {
      if (e instanceof PreflightError) return { problems: e.problems.map((p) => classify(`check ${p.check} ${checkName(p.check)}: ${p.problem}`, p.check)), outputs: {} }
      return { problems: [classify((e as Error).message)], outputs: {} }
    }
    const report = await checkVideo({ mp4Path: film.mp4Path, manifestPath: film.manifestPath, briefPath: film.briefPath }, ctx.deps.check)
    writeFileSync(join(ctx.filmDir, 'final.check.json'), `${JSON.stringify(report, null, 2)}\n`)
    if (!ctx.deps.master) {
      // The contact sheet a reviewer looks at, as studio:render writes it. Best effort: the check above is what decides.
      try {
        const manifest = JSON.parse(readFileSync(film.manifestPath, 'utf8')) as { videoType: string } & Record<string, unknown>
        const rules = typeRulesFor(manifest.videoType)
        if (rules) await writeContactSheet({ mp4Path: film.mp4Path, manifest: manifest as never, hookMaxS: rules.hook_max_s })
      } catch (e) {
        ctx.log(`contact sheet skipped: ${(e as Error).message}`)
      }
    }
    const problems: StampProblem[] = []
    for (const c of report.checks.filter((k) => !k.pass)) {
      for (const part of c.detail.split('; ').filter(Boolean)) problems.push(classify(`check ${c.id} ${c.name}: ${part}`, c.id))
    }
    return {
      problems,
      outputs: {
        mp4: { file: 'final.mp4', sha256: report.sha256 },
        manifest: { file: 'final.manifest.json', sha256: hashFile(film.manifestPath) },
        checks: { ran: report.checks.length, failed: report.checks.filter((k) => !k.pass).map((k) => k.id) },
      },
    }
  },
}
