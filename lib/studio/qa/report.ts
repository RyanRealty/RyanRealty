/**
 * lib/studio/qa/report.ts - the command line surface of `npm run video:check`,
 * kept pure so it is tested: argument parsing and the pass/fail table.
 */
import type { CheckReport, CheckValue } from './check'
import type { ContactResult } from './contact'

export interface CliArgs {
  mp4Path: string
  manifestPath?: string
  briefPath?: string
  golden?: string
  reviewPath?: string
  ledgerPath?: string
  registryPath?: string
  final: boolean
  contact: boolean
}

export const USAGE =
  'Usage: npm run video:check -- <final.mp4> [--manifest p] [--brief p] [--final] [--golden p] [--review p] [--ledger p] [--registry p] [--no-contact]'

/** Parse argv (without node and the script). Throws a message string on bad usage. */
export function parseArgs(argv: readonly string[]): CliArgs {
  const out: CliArgs = { mp4Path: '', final: false, contact: true }
  const takesValue = new Set(['--manifest', '--brief', '--golden', '--review', '--ledger', '--registry'])
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--final') out.final = true
    else if (a === '--no-contact') out.contact = false
    else if (takesValue.has(a)) {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a path`)
      if (a === '--manifest') out.manifestPath = v
      else if (a === '--brief') out.briefPath = v
      else if (a === '--golden') out.golden = v
      else if (a === '--review') out.reviewPath = v
      else if (a === '--registry') out.registryPath = v
      else out.ledgerPath = v
    } else if (a.startsWith('--')) throw new Error(`unknown option ${a}`)
    else if (out.mp4Path === '') out.mp4Path = a
    else throw new Error(`unexpected argument ${a}`)
  }
  if (out.mp4Path === '') throw new Error('the path to the MP4 is required')
  return out
}

/** A short one-line form of a measured or expected value. */
export function formatValue(v: CheckValue, max = 70): string {
  let s: string
  if (v === null) s = '-'
  else if (typeof v === 'string') s = v
  else if (typeof v === 'number' || typeof v === 'boolean') s = String(v)
  else if (Array.isArray(v)) s = v.map((x) => formatValue(x, max)).join(',')
  else s = Object.entries(v).map(([k, x]) => `${k}=${formatValue(x, max)}`).join(' ')
  return s.length > max ? `${s.slice(0, max - 3)}...` : s
}

/** The table `video:check` prints: one row per check, then the reason for each failure. */
export function formatReport(report: CheckReport, contact?: ContactResult | { error: string } | null): string {
  const lines: string[] = []
  lines.push(`video:check ${report.mp4}${report.final ? ' (final)' : ''}`)
  lines.push('')
  const idW = 2
  const nameW = Math.max(...report.checks.map((c) => c.name.length), 5)
  lines.push(`${'#'.padStart(idW)}  ${'Check'.padEnd(nameW)}  Result  Measured`)
  for (const c of report.checks) {
    lines.push(`${String(c.id).padStart(idW)}  ${c.name.padEnd(nameW)}  ${c.pass ? 'PASS  ' : 'FAIL  '}  ${formatValue(c.measured)}`)
  }
  const failed = report.checks.filter((c) => !c.pass)
  if (failed.length > 0) {
    lines.push('')
    lines.push('Why it failed')
    for (const c of failed) {
      lines.push(`  ${c.id} ${c.name}: ${c.detail}`)
      lines.push(`     expected: ${formatValue(c.expected, 110)}`)
    }
  }
  lines.push('')
  if (contact && 'error' in contact) lines.push(`contact sheet: not written (${contact.error})`)
  else if (contact) lines.push(`contact sheet: ${contact.path}${contact.labelled ? '' : ` (${contact.note ?? 'no labels'})`}`)
  if (report.ledger) lines.push(`ledger: ${report.ledger.appended ? 'added this film to' : 'this film was already in'} ${report.ledger.path}`)
  const total = report.checks.length
  const passed = report.checks.filter((c) => c.pass).length
  lines.push(report.pass ? `PASS: ${passed} of ${total} checks passed${report.final ? ', review included. This film may go to Matt.' : '. Run with --final after a separate reviewer signs it off.'}` : `FAIL: ${total - passed} of ${total} checks failed. Do not send this film.`)
  return lines.join('\n')
}
