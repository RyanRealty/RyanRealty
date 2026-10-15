/**
 * Messages list hygiene: hide unnamed listing-alert / automation threads from
 * the Needs attention default, and match a thread search against name + snippet.
 */

export type MessageThreadLike = {
  name: string | null
  lastKindLabel: string
  snippet: string | null
}

const ALERT_RE =
  /\blisting alert|\bsaved search|\bnew listing|\balert digest|\bunsubscribe\b|\bprice (drop|watch)\b/i

export function isUnnamedContact(name: string | null | undefined): boolean {
  const n = String(name ?? '').trim()
  return n.length === 0 || n === 'Unknown contact'
}

export function isAutomationOrUnnamedAlert(row: MessageThreadLike): boolean {
  const blob = `${row.lastKindLabel} ${row.snippet ?? ''}`
  const alertish = ALERT_RE.test(blob)
  if (alertish && isUnnamedContact(row.name)) return true
  if (isUnnamedContact(row.name) && row.lastKindLabel === 'Email sent') return true
  return false
}

export function threadMatchesQuery(row: MessageThreadLike, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  const hay = `${row.name ?? ''} ${row.lastKindLabel} ${row.snippet ?? ''}`.toLowerCase()
  return hay.includes(needle)
}

export function filterMessageThreads<T extends MessageThreadLike>(
  rows: readonly T[],
  opts: { q?: string | null; showAutomation?: boolean } = {},
): T[] {
  const q = opts.q ?? ''
  return rows.filter((row) => {
    if (!opts.showAutomation && isAutomationOrUnnamedAlert(row)) return false
    return threadMatchesQuery(row, q)
  })
}
