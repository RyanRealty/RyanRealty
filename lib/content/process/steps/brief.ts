/**
 * Step brief: the paperwork and the words, before anything is paid for.
 *
 * Runs what the factory already runs first, mapped onto the step
 * (docs/plans/STUDIO_ONE_FACTORY.md, "Rules refuse before render"):
 *  - a. the strict brief and timeline readers (validate.ts) and video_gate.mjs;
 *  - b. textPreflight: the script and every authored string, checks 7, 8, 9,
 *    10, 15 and 16, before a download and before ElevenLabs is paid;
 *  - c. step 0 of docs/plans/CONTENT_PROCESS.md (Matt 2026-10-14): the
 *    ad-strategist's whiteboard.json in the brief's own folder, and the
 *    plain-English rules over its script and every word the brief ships
 *    (plain-english.ts, R-186 to R-191).
 * Every problem is listed at once. Nothing here is a second copy of a rule:
 * the evaluators are the ones video:check runs.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { APPROVER, TEST_APPROVER, checkReels } from '../../../../.claude/skills/ryan-studio/tools/technique-approval.mjs'
import { gate } from '../../../../.claude/skills/ryan-studio/tools/video_gate.mjs'
import { readLedger } from '../../../studio/qa/ledger'
import { checkName } from '../../../studio/qa/phases'
import { loadCheckedTechniqueRegistry } from '../../../studio/qa/techniques'
import { FILM_LEDGER_PATH, REPO_ROOT, TECHNIQUE_REGISTRY_PATH, VIDEO_TYPES_PATH, loadVideoTypes, typeRulesFor } from '../../../studio/qa/thresholds'
import { drawnStrings, textPreflight, type PreflightContext } from '../../../studio/timeline/preflight'
import { safeSlug } from '../../../studio/qa/manifest'
import type { StudioBrief, Timeline } from '../../../studio/timeline/types'
import { formatIssues, parseBrief, parseTimeline } from '../../../studio/timeline/validate'
import { hashFile } from '../canonical'
import { classify } from '../classify'
import type { StepDef } from '../context'
import { WHITEBOARD_FILE, briefCopyProblems, checkWhiteboard, isAd, type BriefCopy, type FigureRow, type WhiteboardRead } from '../plain-english'
import type { StampProblem } from '../stamp'

const RIGHTS_PATH = join(REPO_ROOT, '.claude', 'skills', 'ryan-studio', 'rights', 'footage_rights.json')

/** The files the brief step reads, by the name a stamp gives them. Missing is a value too: it changes when the file appears. */
export function commonFileParts(registryPath: string | undefined, ledgerPath: string | undefined): Record<string, string> {
  return {
    'file:video_types': hashFile(VIDEO_TYPES_PATH) ?? 'missing',
    'file:registry': hashFile(registryPath ?? TECHNIQUE_REGISTRY_PATH) ?? 'missing',
    'file:ledger': hashFile(ledgerPath ?? FILM_LEDGER_PATH) ?? 'missing',
    'file:footage_rights': hashFile(RIGHTS_PATH) ?? 'missing',
  }
}

/** The whiteboard the ad-strategist wrote: whiteboard.json in the brief's own folder (CONTENT_PROCESS.md step 0). */
export function whiteboardPath(briefPath: string): string {
  return join(dirname(briefPath), WHITEBOARD_FILE)
}

/** Read the whiteboard beside a brief: missing, unreadable, or its raw JSON. `shown` is the path a refusal prints. */
export function readWhiteboard(briefPath: string, shown: (p: string) => string = (p) => p): WhiteboardRead {
  const path = whiteboardPath(briefPath)
  if (!existsSync(path)) return { path: shown(path), missing: true }
  try {
    return { path: shown(path), raw: JSON.parse(readFileSync(path, 'utf8')) }
  } catch (e) {
    return { path: shown(path), error: (e as Error).message }
  }
}

/** Every word the brief ships, as the plain-English rules read it: the voiceover, each beat's drawn strings, the call to action, the hook and the post caption. */
export function briefCopy(brief: StudioBrief, timeline: Timeline): BriefCopy {
  const screen = timeline.beats
    .filter((beat) => beat.role !== 'endcard')
    .map((beat) => ({ where: `beat "${beat.id}" on screen`, texts: drawnStrings(brief, { ...timeline, beats: [beat], cta: undefined }).map((t) => t.text) }))
  if (timeline.cta?.text?.trim()) screen.push({ where: 'the call to action card', texts: [timeline.cta.text] })
  return {
    voiceover: brief.spec_rules?.voiceover?.script ?? timeline.voice?.script ?? null,
    screen,
    hook: typeof brief.hook?.text === 'string' ? brief.hook.text : null,
    caption: typeof brief.caption === 'string' ? brief.caption : null,
  }
}

/** The preflight context render.ts builds (kept in step with renderTimelineFilm: types, rules, registry, ledger, slug, one sentence). */
export async function preflightContextFor(
  brief: StudioBrief,
  opts: { registryPath?: string; ledgerPath?: string },
): Promise<{ ctx: PreflightContext } | { problem: string }> {
  const types = loadVideoTypes()
  const rules = typeRulesFor(brief.video_type, types)
  if (!rules) return { problem: `video_type "${brief.video_type}" is not in video_types.json` }
  const slug = safeSlug(typeof brief.slug === 'string' ? brief.slug : brief.title)
  const ledger = readLedger(opts.ledgerPath ?? FILM_LEDGER_PATH)
  if (ledger.errors.length) return { problem: `the film ledger is damaged: ${ledger.errors.slice(0, 3).join('; ')}` }
  // A registry handed in is a test's: it approves only with TEST_APPROVER (the same seam render.ts uses).
  const registry = await loadCheckedTechniqueRegistry(opts.registryPath, { testOnly: Boolean(opts.registryPath) })
  return { ctx: { types, rules, registry, ledger: ledger.entries, slug, oneSentence: brief.creative.one_sentence } }
}

export const briefStep: StepDef = {
  id: 'brief',
  async parts(ctx) {
    return { ...commonFileParts(ctx.deps.render.registryPath, ctx.ledgerPath), 'file:whiteboard': hashFile(whiteboardPath(ctx.briefPath)) ?? 'missing' }
  },
  async run(ctx) {
    const problems: StampProblem[] = []
    const warnings: string[] = []
    const registryPath = ctx.deps.render.registryPath

    // a. the strict readers.
    const b = parseBrief(ctx.brief)
    const t = parseTimeline(ctx.timeline)
    const issues = [...(b.ok ? [] : b.issues.map((i) => ({ ...i, path: `brief.${i.path}` }))), ...(t.ok ? [] : t.issues.map((i) => ({ ...i, path: `timeline.${i.path}` })))]
    if (issues.length) problems.push(...formatIssues(issues).split('\n').filter(Boolean).map((line) => classify(line.replace(/^\s*-\s*/, ''))))

    // a. video_gate.mjs, on the paperwork, with the registry this run is held to.
    const regFile = registryPath ?? TECHNIQUE_REGISTRY_PATH
    let registryRaw: Record<string, unknown> = {}
    try {
      registryRaw = (JSON.parse(readFileSync(regFile, 'utf8')) as { techniques?: Record<string, unknown> }).techniques ?? {}
    } catch (e) {
      problems.push(classify(`techniques/registry.json could not be read (${(e as Error).message})`))
    }
    const cfg = JSON.parse(readFileSync(VIDEO_TYPES_PATH, 'utf8'))
    const reels = await checkReels(registryRaw)
    const gated = gate(ctx.brief as Record<string, unknown>, ctx.timeline as Record<string, unknown>, cfg, registryRaw, { approver: registryPath ? TEST_APPROVER : APPROVER, reels }) as { fails: string[]; warns: string[] }
    problems.push(...gated.fails.map((f) => classify(f)))
    warnings.push(...gated.warns)

    // b. the script and every authored string.
    if (b.ok && t.ok) {
      const brief: StudioBrief = b.value
      const timeline: Timeline = t.value
      const briefScript = brief.spec_rules?.voiceover?.script
      if (timeline.voice && briefScript && briefScript.trim() !== timeline.voice.script.trim()) {
        problems.push(classify('the brief approved one voiceover script (spec_rules.voiceover.script) and the timeline speaks another; make them identical'))
      }
      const built = await preflightContextFor(brief, { registryPath, ledgerPath: ctx.ledgerPath })
      if ('problem' in built) problems.push(classify(built.problem))
      else problems.push(...textPreflight(brief, timeline, built.ctx).map((p) => classify(`check ${p.check} ${checkName(p.check)}: ${p.problem}`, p.check)))
    }

    // c. step 0: the whiteboard, then the plain-English rules over its script and the brief's words.
    const briefRaw = (ctx.brief ?? {}) as { numbers?: unknown }
    const rows: FigureRow[] = Array.isArray(briefRaw.numbers) ? (briefRaw.numbers as FigureRow[]) : []
    const ad = isAd(ctx.brief)
    const shown = (p: string) => (relative(ctx.root, p).startsWith('..') ? p : relative(ctx.root, p))
    const board = checkWhiteboard(readWhiteboard(ctx.briefPath, shown), rows, ad)
    problems.push(...board.problems.map((p) => classify(p)))
    if (b.ok && t.ok) problems.push(...briefCopyProblems(briefCopy(b.value, t.value), board.whiteboard, ad).map((p) => classify(p)))

    return {
      problems,
      outputs: { slug: ctx.slug, videoType: typeof (ctx.brief as { video_type?: unknown })?.video_type === 'string' ? (ctx.brief as { video_type: string }).video_type : null, warnings },
    }
  },
}
