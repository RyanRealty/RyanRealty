/**
 * lib/content/process/stamp.ts - the stamp a step leaves, and the check that a
 * later step may rely on it (docs/plans/CONTENT_PROCESS.md, "The steps").
 *
 * A stamp is out/studio/<slug>/stamps/<step>.json. It binds three things: what
 * the step read (inputsSha256, with each named part kept so a refusal can say
 * which one changed), the rules it was held to (rulesVersion), and what it
 * found (verdict and problems). A step runs only when the step before it has a
 * stamp that passed AND whose inputs and rules, recomputed now, are the same.
 * Change one word of the script after the brief step and every later step
 * refuses: "the brief changed since step brief passed: run step brief again".
 *
 * Phase 1 stamps are plain files. They show what ran and stop a bot that
 * forgets to re-run a step; the server certifier (build order step 3) is what
 * signs, so a stamp is not proof against someone who writes one by hand.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { hashJson } from './canonical'
import type { StepId } from './rules'
import { ALL_STEPS } from './steps'

export type StampProblem = { rule?: string; check?: number; problem: string }

export type Stamp = {
  step: StepId
  slug: string
  /** sha256 of canonical JSON of `inputs`: everything the step read. */
  inputsSha256: string
  /** sha256 of the canonical rules plus their resolved thresholds. */
  rulesVersion: string
  verdict: 'pass' | 'fail'
  problems: StampProblem[]
  at: string
  builder: string
  machine: string
  gitHead: string | null
  /** The named parts behind inputsSha256: 'brief', 'timeline', 'step:<id>', 'file:<name>'. */
  inputs: Record<string, string>
  /** What the step produced, for the steps after it to read. */
  outputs: Record<string, unknown>
  outputsSha256: string
  /** 'not built' when the step exists but phase 1 builds nothing for it; 'not needed' when the brief has nothing for it to do. */
  status: 'built' | 'not built' | 'not needed'
  /** True when the run passed an unbuilt step with --allow-unbuilt-step (logged here, so a reader can see it). */
  allowUnbuilt?: boolean
  /** Which attempt at this step this was (caps.ts). */
  attempt?: number
}

export function stampsDir(outRoot: string, slug: string): string {
  return join(outRoot, 'studio', slug, 'stamps')
}

export function stampPath(outRoot: string, slug: string, step: StepId): string {
  return join(stampsDir(outRoot, slug), `${step}.json`)
}

export type StampRead = { ok: true; stamp: Stamp } | { ok: false; reason: 'missing' | 'damaged'; detail: string }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Read and check a stamp file: its shape, and that its two hashes are the hashes of what it holds. */
export function readStamp(outRoot: string, slug: string, step: StepId): StampRead {
  const path = stampPath(outRoot, slug, step)
  if (!existsSync(path)) return { ok: false, reason: 'missing', detail: `${path} does not exist` }
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    return { ok: false, reason: 'damaged', detail: `${path} is not JSON (${(e as Error).message})` }
  }
  if (!isObj(raw)) return { ok: false, reason: 'damaged', detail: `${path} is not a JSON object` }
  const str = (k: string) => typeof raw[k] === 'string'
  if (
    !ALL_STEPS.includes(raw.step as StepId) || raw.step !== step || raw.slug !== slug || !str('inputsSha256') || !str('rulesVersion') ||
    (raw.verdict !== 'pass' && raw.verdict !== 'fail') || !Array.isArray(raw.problems) || !str('at') || !str('builder') || !str('machine') ||
    !(raw.gitHead === null || typeof raw.gitHead === 'string') || !isObj(raw.inputs) || !isObj(raw.outputs) || !str('outputsSha256') ||
    !(raw.status === 'built' || raw.status === 'not built' || raw.status === 'not needed')
  ) {
    return { ok: false, reason: 'damaged', detail: `${path} is not a stamp for step ${step} of ${slug}` }
  }
  const stamp = raw as unknown as Stamp
  if (hashJson(stamp.inputs) !== stamp.inputsSha256) return { ok: false, reason: 'damaged', detail: `${path}: inputsSha256 is not the hash of its inputs` }
  if (hashJson(stamp.outputs) !== stamp.outputsSha256) return { ok: false, reason: 'damaged', detail: `${path}: outputsSha256 is not the hash of its outputs` }
  return { ok: true, stamp }
}

/** Write a stamp (to a temp file, then rename, so a reader never sees half of one). */
export function writeStamp(outRoot: string, stamp: Stamp): string {
  const path = stampPath(outRoot, stamp.slug, stamp.step)
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, `${JSON.stringify(stamp, null, 2)}\n`)
  renameSync(tmp, path)
  return path
}

/** The part names a stamp's inputs may carry. */
export function partLabel(part: string): string {
  if (part === 'brief' || part === 'timeline') return part
  if (part.startsWith('step:')) return `output of step ${part.slice(5)}`
  if (part.startsWith('file:')) return `file ${part.slice(5)}`
  return part
}

export type StampCheck = { ok: true } | { ok: false; problem: string }

/**
 * May a later step rely on this step's stamp? It must exist, have passed, and
 * its recomputed inputs and rules version must equal what it recorded.
 */
export function checkStamp(read: StampRead, step: StepId, recomputed: { inputs: Record<string, string>; rulesVersion: string }): StampCheck {
  if (!read.ok) {
    return read.reason === 'missing'
      ? { ok: false, problem: `step ${step} has not run: run step ${step} first` }
      : { ok: false, problem: `the stamp for step ${step} is damaged (${read.detail}): run step ${step} again` }
  }
  const s = read.stamp
  if (s.verdict !== 'pass') {
    const why = s.problems[0]?.problem
    return { ok: false, problem: `step ${step} did not pass${why ? ` (${why})` : ''}: fix it and run step ${step} again` }
  }
  const changed: string[] = []
  for (const part of new Set([...Object.keys(s.inputs), ...Object.keys(recomputed.inputs)])) {
    if (s.inputs[part] !== recomputed.inputs[part]) changed.push(part)
  }
  if (changed.length) {
    const first = changed[0]
    const more = changed.length > 1 ? ` (also changed: ${changed.slice(1).map(partLabel).join(', ')})` : ''
    return { ok: false, problem: `the ${partLabel(first)} changed since step ${step} passed: run step ${step} again${more}` }
  }
  if (s.rulesVersion !== recomputed.rulesVersion) {
    return { ok: false, problem: `the rules changed since step ${step} passed (rules version ${s.rulesVersion.slice(0, 12)} is now ${recomputed.rulesVersion.slice(0, 12)}): run step ${step} again` }
  }
  return { ok: true }
}
