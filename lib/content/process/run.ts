/**
 * lib/content/process/run.ts - the runner behind `npm run studio -- run`.
 *
 * Takes a brief and a timeline through the steps in order. A step runs only
 * when the step before it has a stamp that still holds (stamp.ts); the run
 * resumes at the first step whose own stamp does not, stops at the first
 * refusal, and spends the job's caps (caps.ts). Before anything it refuses a
 * checkout that is behind origin/main (freshness.ts).
 *
 * It calls the factory's own functions (render.ts, check.ts, preflight.ts); it
 * never shells out to npm, and it has no copy of any rule. certify and approve
 * are not built: the run reaches them and says so.
 */
import { hostname } from 'node:os'
import { join, resolve } from 'node:path'
import { REPO_ROOT } from '../../studio/qa/thresholds'
import { safeSlug } from '../../studio/qa/manifest'
import { RenderError, assertNotPublic, builderOf, readJson } from '../../studio/timeline/render'
import { hashJson } from './canonical'
import { FileClaimStore, capRefusal, type ClaimStore } from './caps'
import { classify } from './classify'
import type { RunContext, StepDeps, StepStamps } from './context'
import { checkFreshness, type Freshness } from './freshness'
import { rulesVersion as currentRulesVersion } from './rules-version'
import type { StepId } from './rules'
import { checkStamp, readStamp, writeStamp, type Stamp, type StampProblem } from './stamp'
import { NOT_BUILT_YET, stepsFor } from './steps'
import { STEP_DEFS } from './steps/index'

export type RunOptions = {
  briefPath: string
  timelinePath: string
  /** The repository root (default: this checkout). */
  root?: string
  /** Stamps, boards and films land under <outRoot>/studio/<slug>/ (default <root>/out). */
  outRoot?: string
  /** Stop after this step. */
  to?: StepId
  /** Unbuilt steps to go past (--allow-unbuilt-step); each is written into its stamp. */
  allowUnbuilt?: readonly StepId[]
  deps: StepDeps
  /**
   * Is this checkout level with origin/main? REQUIRED: there is no default, so a
   * test can never reach for the checkout it runs in. The CLI passes the fetching check.
   */
  freshness: () => Freshness | Promise<Freshness>
  claims?: ClaimStore
  ledgerPath?: string
  builder?: string
  machine?: string
  gitHead?: () => string | null
  /**
   * The checkout roots a render must stay out of the public/ folder of. Default: this root
   * alone (no git is run); the CLI passes renderer's checkoutRoots(), which also names a worktree's main checkout.
   */
  publicRoots?: readonly string[]
  now?: () => Date
  log?: (line: string) => void
  /** Rules version override (tests); default: the rules and thresholds as they are now. */
  rulesVersion?: string
}

export type StepOutcome = {
  step: StepId
  /** 'valid': its stamp still held, nothing ran. 'ran': it ran and passed. 'refused': it did not pass, or could not run. */
  action: 'valid' | 'ran' | 'refused'
  stamp?: Stamp
  problems: StampProblem[]
}

export type RunResult = {
  ok: boolean
  slug: string
  /** The step that refused, when one did. */
  refusedAt?: StepId
  outcomes: StepOutcome[]
  /** Why the run stopped, when it did not pass. */
  problems: StampProblem[]
}

const refused = (slug: string, step: StepId, found: StampProblem[], outcomes: StepOutcome[]): RunResult => {
  const problems = found.map((p) => classify(p.problem, p.check))
  return { ok: false, slug, refusedAt: step, outcomes: [...outcomes, { step, action: 'refused', problems }], problems }
}

type Prepared = { ctx: RunContext; steps: StepId[] } | { result: RunResult }

async function prepare(opts: RunOptions): Promise<Prepared> {
  const stop = (problem: string, slug = ''): Prepared => ({ result: refused(slug, 'brief', [{ problem }], []) })

  const fresh = await opts.freshness()
  if (!fresh.ok) return stop(fresh.problem)

  let brief: unknown
  let timeline: unknown
  try {
    brief = readJson(opts.briefPath)
    timeline = readJson(opts.timelinePath)
  } catch (e) {
    return stop((e as Error).message)
  }
  const b = brief as { video_type?: unknown; slug?: unknown; title?: unknown } | null
  if (!b || typeof b !== 'object' || typeof b.video_type !== 'string') {
    return stop('the brief names no video_type: only a video has a factory today; stills, carousels, post copy and paid ads are not built yet (CONTENT_PROCESS.md build order)')
  }
  const slug = safeSlug(typeof b.slug === 'string' ? b.slug : String(b.title ?? 'film'))
  const root = resolve(opts.root ?? REPO_ROOT)
  const outRoot = resolve(opts.outRoot ?? join(root, 'out'))
  const filmDir = join(outRoot, 'studio', slug)
  try {
    assertNotPublic(filmDir, opts.publicRoots ?? [root])
  } catch (e) {
    return stop((e as Error).message, slug)
  }
  const steps = stepsFor('video')
  if (opts.to && !steps.includes(opts.to)) return stop(`there is no step "${opts.to}" (${steps.join(', ')})`, slug)
  const log = opts.log ?? (() => undefined)
  const ctx: RunContext = {
    root,
    outRoot,
    briefPath: resolve(opts.briefPath),
    timelinePath: resolve(opts.timelinePath),
    brief,
    timeline,
    slug,
    baseDir: resolve(opts.timelinePath, '..'),
    cacheDir: join(outRoot, 'studio', '.cache'),
    filmDir,
    ledgerPath: opts.ledgerPath,
    deps: opts.deps,
    claims: opts.claims ?? new FileClaimStore(outRoot),
    builder: opts.builder ?? builderOf(opts.deps.render.env ?? process.env),
    machine: opts.machine ?? hostname(),
    gitHead: opts.gitHead ? opts.gitHead() : null,
    rulesVersion: opts.rulesVersion ?? currentRulesVersion(),
    now: opts.now ?? (() => new Date()),
    attempt: 0,
    allowUnbuilt: opts.allowUnbuilt ?? [],
    log,
    state: {},
  }
  return { ctx, steps }
}

/** Every part a step's stamp binds: the brief, the timeline, each earlier step's output, and the files the step reads. */
async function partsFor(ctx: RunContext, step: StepId, steps: readonly StepId[], stamps: StepStamps): Promise<Record<string, string>> {
  const parts: Record<string, string> = { brief: hashJson(ctx.brief), timeline: hashJson(ctx.timeline) }
  for (const prior of steps.slice(0, steps.indexOf(step))) {
    const s = stamps[prior]
    if (s) parts[`step:${prior}`] = s.outputsSha256
  }
  return { ...parts, ...(await STEP_DEFS[step]!.parts(ctx)) }
}

type Chain = { ok: true; stamps: StepStamps } | { ok: false; step: StepId; problem: string }

/**
 * Do the stamps of every step before `upTo` still hold? Stops at the first that
 * does not and says why ("the brief changed since step brief passed: run step
 * brief again"). A step with no definition (not built) fails with that.
 */
export async function validateChain(ctx: RunContext, steps: readonly StepId[], upTo: StepId): Promise<Chain> {
  const stamps: StepStamps = {}
  for (const step of steps.slice(0, steps.indexOf(upTo))) {
    if (!STEP_DEFS[step]) return { ok: false, step, problem: `step ${step} is ${NOT_BUILT_YET}` }
    const read = readStamp(ctx.outRoot, ctx.slug, step)
    const parts = read.ok ? await partsFor(ctx, step, steps, stamps) : {}
    const check = checkStamp(read, step, { inputs: parts, rulesVersion: ctx.rulesVersion })
    if (!check.ok) return { ok: false, step, problem: check.problem }
    if (read.ok) stamps[step] = read.stamp
  }
  return { ok: true, stamps }
}

/** Run one step (its predecessors' stamps already hold), spend its attempt, write its stamp. */
async function execute(ctx: RunContext, steps: readonly StepId[], step: StepId, stamps: StepStamps): Promise<StepOutcome> {
  const def = STEP_DEFS[step]!
  const cap = capRefusal(ctx.claims, ctx.slug, step, ctx.now())
  if (cap) return { step, action: 'refused', problems: [classify(`cap ${cap.cap}: ${cap.problem}`)] }
  const attempt = ctx.claims.attempts(ctx.slug).filter((a) => a.step === step).length + 1
  ctx.attempt = attempt
  ctx.claims.recordStart(ctx.slug, { kind: 'start', step, attempt, at: ctx.now().toISOString(), builder: ctx.builder, machine: ctx.machine })
  // What the step is about to read, hashed BEFORE it runs: a file that changes during a long step
  // is then recorded with the hash its verdict was reached on, and the next check refuses the stamp.
  const before = await partsFor(ctx, step, steps, stamps)
  let result
  try {
    result = await def.run(ctx, stamps)
  } catch (e) {
    result = { problems: [classify(`step ${step} crashed: ${(e as Error).message}`)], outputs: {} }
  }
  const verdict = result.problems.length === 0 ? 'pass' : 'fail'
  // The parts the step brings into being itself (stills fetches the clips) are hashed after it: only those.
  const made = def.produces ?? []
  const inputs = made.length ? { ...before, ...Object.fromEntries(Object.entries(await partsFor(ctx, step, steps, stamps)).filter(([part]) => made.some((prefix) => part.startsWith(prefix)))) } : before
  const stamp: Stamp = {
    step,
    slug: ctx.slug,
    inputsSha256: hashJson(inputs),
    rulesVersion: ctx.rulesVersion,
    verdict,
    problems: result.problems,
    at: ctx.now().toISOString(),
    builder: ctx.builder,
    machine: ctx.machine,
    gitHead: ctx.gitHead,
    inputs,
    outputs: result.outputs,
    outputsSha256: hashJson(result.outputs),
    ...(result.report ? { report: result.report } : {}),
    status: result.status ?? 'built',
    ...(result.allowUnbuilt ? { allowUnbuilt: true } : {}),
    attempt,
  }
  writeStamp(ctx.outRoot, stamp)
  ctx.claims.recordEnd(ctx.slug, { kind: 'end', step, attempt, at: ctx.now().toISOString(), verdict, problems: result.problems.map((p) => p.problem) })
  return { step, action: verdict === 'pass' ? 'ran' : 'refused', stamp, problems: result.problems }
}

/**
 * Run the steps in order from the first one without a valid stamp, up to `to`
 * (default: all of them). Stops at the first refusal.
 */
export async function runSteps(opts: RunOptions): Promise<RunResult> {
  const prepared = await prepare(opts)
  if ('result' in prepared) return prepared.result
  const { ctx, steps } = prepared
  const last = opts.to ? steps.indexOf(opts.to) : steps.length - 1
  const outcomes: StepOutcome[] = []
  const stamps: StepStamps = {}
  for (const step of steps.slice(0, last + 1)) {
    if (!STEP_DEFS[step]) return refused(ctx.slug, step, [{ problem: `step ${step} is ${NOT_BUILT_YET}` }], outcomes)
    const read = readStamp(ctx.outRoot, ctx.slug, step)
    const held = read.ok && checkStamp(read, step, { inputs: await partsFor(ctx, step, steps, stamps), rulesVersion: ctx.rulesVersion }).ok
    if (read.ok && held) {
      stamps[step] = read.stamp
      outcomes.push({ step, action: 'valid', stamp: read.stamp, problems: [] })
      continue
    }
    const outcome = await execute(ctx, steps, step, stamps)
    outcomes.push(outcome)
    if (outcome.action === 'refused' || !outcome.stamp) return { ok: false, slug: ctx.slug, refusedAt: step, outcomes, problems: outcome.problems }
    stamps[step] = outcome.stamp
  }
  return { ok: true, slug: ctx.slug, outcomes, problems: [] }
}

/**
 * Run exactly one step. Every step before it must have a stamp that passed and
 * still holds, or this refuses and says which changed and what to run again.
 */
export async function runStep(opts: RunOptions, step: StepId): Promise<RunResult> {
  const prepared = await prepare({ ...opts, to: step })
  if ('result' in prepared) return prepared.result
  const { ctx, steps } = prepared
  if (!STEP_DEFS[step]) return refused(ctx.slug, step, [{ problem: `step ${step} is ${NOT_BUILT_YET}` }], [])
  const chain = await validateChain(ctx, steps, step)
  if (!chain.ok) return refused(ctx.slug, step, [{ problem: chain.problem }], [])
  const outcome = await execute(ctx, steps, step, chain.stamps)
  return { ok: outcome.action === 'ran', slug: ctx.slug, ...(outcome.action === 'ran' ? {} : { refusedAt: step }), outcomes: [outcome], problems: outcome.problems }
}

/** The CLI's default freshness: the local check (no fetch); the CLI wraps it with a fetch. */
export { checkFreshness }
export { RenderError }
