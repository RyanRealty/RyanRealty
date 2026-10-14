/**
 * lib/content/process/report.ts - what `npm run studio -- run` and `-- status`
 * print: the steps, what each did, and for a refusal every problem with its
 * rule ID, so a bot knows which rule to read and which step to run again.
 */
import { join, relative } from 'node:path'
import { CAPS, type Attempt } from './caps'
import type { RunResult } from './run'
import { stampPath, type StampRead } from './stamp'
import type { StepId } from './rules'

const pad = (s: string, n: number) => s.padEnd(n)

/** The result of a run, as the lines the CLI prints. */
export function formatRun(result: RunResult, opts: { root: string; outRoot: string }): string {
  const out: string[] = [`studio run${result.slug ? ` ${result.slug}` : ''}`]
  for (const o of result.outcomes) {
    const verb = o.action === 'valid' ? 'holds (its stamp still holds, nothing ran)' : o.action === 'ran' ? 'passed' : 'REFUSED'
    const stamp = o.stamp ? ` ${relative(opts.root, stampPath(opts.outRoot, result.slug, o.step))}` : ''
    const note = o.stamp?.status === 'not built' ? ' (not built; allowed past with --allow-unbuilt-step, logged in the stamp)' : o.stamp?.status === 'not needed' ? ' (nothing to do for this brief)' : ''
    out.push(`  ${pad(o.step, 9)} ${verb}${note}${stamp}`)
    const sheet = o.step === 'board' && o.action !== 'refused' ? (o.stamp?.outputs.sheet as { file?: string } | undefined)?.file : undefined
    if (sheet) out.push(`      board sheet: ${relative(opts.root, join(opts.outRoot, 'studio', result.slug, sheet))} (the stills are beside it; Matt looks at this before anything is animated)`)
    if (o.action === 'refused') {
      for (const p of o.problems) out.push(`      - ${p.rule ? `[${p.rule}] ` : ''}${p.problem.split('\n').join('\n        ')}`)
    }
  }
  if (result.ok) {
    const last = result.outcomes[result.outcomes.length - 1]?.step
    out.push(`Passed through step ${last}.`)
  } else if (result.refusedAt) {
    out.push(`Stopped at step ${result.refusedAt}. Nothing after it ran. Fix what it names, then run it again: it resumes at the first step whose stamp no longer holds. Read the rule by ID: npm run studio -- rules <your type>.`)
  }
  return out.join('\n')
}

/** The stamps a slug has, and how much of its caps it has spent. */
export function formatStatus(slug: string, reads: ReadonlyArray<{ step: StepId; read: StampRead }>, attempts: readonly Attempt[], startedAt: string | null, now: Date): string {
  const out: string[] = [`studio status ${slug}`]
  for (const { step, read } of reads) {
    if (!read.ok) {
      out.push(`  ${pad(step, 9)} ${read.reason === 'missing' ? 'no stamp' : `DAMAGED (${read.detail})`}`)
      continue
    }
    const s = read.stamp
    const extra = [s.status !== 'built' ? s.status : null, s.allowUnbuilt ? 'allowed past with --allow-unbuilt-step' : null, `attempt ${s.attempt ?? '?'}`, `by ${s.builder} on ${s.machine}`, s.gitHead ? `at ${s.gitHead.slice(0, 9)}` : null, `rules ${s.rulesVersion.slice(0, 12)}`, ...Object.entries(s.report ?? {}).map(([k, v]) => `${k} ${String(v)}`)].filter(Boolean)
    out.push(`  ${pad(step, 9)} ${s.verdict.toUpperCase()}  ${s.at}  ${extra.join(', ')}`)
    for (const p of s.problems.slice(0, 20)) out.push(`      - ${p.rule ? `[${p.rule}] ` : ''}${p.problem.split('\n')[0]}`)
    if (s.problems.length > 20) out.push(`      ... and ${s.problems.length - 20} more`)
  }
  const used = (step: StepId) => attempts.filter((a) => a.step === step).length
  out.push(`Job limits: boards ${used('board')} of ${CAPS.boards}, animatics ${used('animatic')} of ${CAPS.animatics}, masters ${used('master')} of ${CAPS.masters}, minutes ${startedAt ? `${Math.round((now.getTime() - Date.parse(startedAt)) / 60000)} of ${CAPS.minutes}` : `0 of ${CAPS.minutes} (the clock starts at the first brief attempt)`}.`)
  return out.join('\n')
}
