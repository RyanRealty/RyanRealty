/**
 * lib/content/process/print.ts - `npm run studio -- rules <deliverable-or-video-type>`.
 *
 * What a bot reads instead of hundreds of pages: every rule that applies to its
 * deliverable, grouped by the step that first enforces it, with the ID, the
 * title, where it comes from, whether anything enforces it yet, and the number
 * it holds as it stands today (read from where the number lives, never copied).
 * The rules come from rules.ts and nothing else, so this cannot drift from the
 * checks.
 */
import { loadVideoTypes, type VideoTypesFile } from '../../studio/qa/thresholds'
import type { DeliverableType, Rule, StepId } from './rules'
import { RULES } from './rules'
import { resolveAll, rulesVersion, thresholdData, thresholdsOf } from './rules-version'
import { ALL_STEPS, STEP_LABELS } from './steps'
import { effectiveFor, type ResolvedThreshold, type ThresholdValue } from './threshold-path'

export const DELIVERABLES: readonly DeliverableType[] = ['video', 'still', 'carousel', 'post_copy', 'paid_ad']

export type PrintTarget = {
  /** What the person asked for: a deliverable ("video") or a video type ("buyer_ad"). */
  asked: string
  deliverables: DeliverableType[]
  videoType: string | null
}

/** A deliverable, or a video type. A buyer ad is a video and a paid ad, so both sets of rules apply to it. */
export function resolveTarget(asked: string, types: VideoTypesFile = loadVideoTypes()): PrintTarget | { error: string } {
  if ((DELIVERABLES as readonly string[]).includes(asked)) return { asked, deliverables: [asked as DeliverableType], videoType: null }
  if (Object.prototype.hasOwnProperty.call(types.types, asked)) {
    return { asked, deliverables: asked === 'buyer_ad' ? ['video', 'paid_ad'] : ['video'], videoType: asked }
  }
  return { error: `"${asked}" is neither a deliverable (${DELIVERABLES.join(', ')}) nor a video type (${Object.keys(types.types).join(', ')})` }
}

/** The rules that apply to a target, in file order. For a video type, a rule limited to other video types is left out. */
export function rulesForTarget(target: PrintTarget, rules: readonly Rule[] = RULES): Rule[] {
  return rules.filter((r) => {
    if (r.status === 'retired') return false
    if (!r.appliesTo.some((d) => target.deliverables.includes(d))) return false
    if (r.videoTypes && target.videoType && !r.videoTypes.includes(target.videoType)) return false
    return true
  })
}

const show = (v: ThresholdValue): string => (Array.isArray(v) ? `[${v.join(', ')}]` : String(v))

/** A threshold as a line: its path and its reading today, for the type when one was asked for. */
export function thresholdLine(rule: Rule, target: PrintTarget, resolved: Record<string, { spec: { path: string; tighterIs: string }; resolved: ResolvedThreshold }>): string[] {
  return thresholdsOf(rule).map((t, i) => {
    const r = resolved[i === 0 ? rule.id : `${rule.id}#${i + 1}`]?.resolved
    if (!r) return `${t.path} (unresolved)`
    const reading = target.videoType ? show(effectiveFor(r, target.videoType)) : show(r.value) + (r.perType ? ` (${Object.entries(r.perType).map(([k, v]) => `${k} ${show(v)}`).join(', ')})` : '')
    return `${t.path} = ${reading} (${t.tighterIs} is tighter)`
  })
}

export type PrintedRule = { rule: Rule; thresholds: string[] }

export function printable(target: PrintTarget, rules: readonly Rule[] = RULES): PrintedRule[] {
  const resolved = resolveAll(thresholdData(), rules)
  return rulesForTarget(target, rules).map((rule) => ({ rule, thresholds: thresholdLine(rule, target, resolved) }))
}

/** The rules as text, grouped by step. */
export function formatRules(target: PrintTarget, rules: readonly Rule[] = RULES, version: string = rulesVersion()): string {
  const rows = printable(target, rules)
  const enforced = rows.filter((r) => r.rule.status === 'enforced').length
  const out: string[] = []
  out.push(`Rules for ${target.asked}${target.deliverables.length > 1 || target.asked !== target.deliverables[0] ? ` (${target.deliverables.join(' and ')})` : ''}. Rules version ${version.slice(0, 12)}.`)
  out.push(`${rows.length} rules: ${enforced} are enforced by a step today, ${rows.length - enforced} are planned and no step checks them yet.`)
  out.push('Each step refuses to run until the one before it has a stamp that still holds. Read the rules of your steps before you build; a refusal names the rule by ID.')
  for (const step of ALL_STEPS) {
    const mine = rows.filter((r) => r.rule.step === step)
    if (mine.length === 0) continue
    out.push('', `== Step ${step} (${STEP_LABELS[step]}): ${mine.length} rule${mine.length === 1 ? '' : 's'} ==`)
    for (const { rule, thresholds } of [...mine.filter((m) => m.rule.status === 'enforced'), ...mine.filter((m) => m.rule.status !== 'enforced')]) {
      const state = rule.status === 'enforced' ? 'enforced' : `planned, ${rule.plannedIn}`
      out.push(`${rule.id} [${state}] ${rule.title}`)
      const facts = [`source: ${rule.source}`, ...(rule.check !== undefined ? [`video:check check ${rule.check}`] : []), ...(rule.videoTypes && !target.videoType ? [`only for: ${rule.videoTypes.join(', ')}`] : [])]
      out.push(`      ${facts.join(' | ')}`)
      for (const t of thresholds) out.push(`      number: ${t}`)
    }
  }
  return out.join('\n')
}

/** The same, for a program. */
export function rulesJson(target: PrintTarget, rules: readonly Rule[] = RULES, version: string = rulesVersion()): unknown {
  return {
    asked: target.asked,
    deliverables: target.deliverables,
    videoType: target.videoType,
    rulesVersion: version,
    rules: printable(target, rules).map(({ rule, thresholds }) => ({ id: rule.id, title: rule.title, source: rule.source, step: rule.step satisfies StepId, check: rule.check ?? null, status: rule.status, plannedIn: rule.plannedIn ?? null, numbers: thresholds })),
  }
}
