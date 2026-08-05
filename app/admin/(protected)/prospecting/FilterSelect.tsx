'use client'

/**
 * Prospecting filter — ONE compact dropdown over kind × bucket (Matt
 * 2026-08-05: the two chip rows ate the top of the page). Value format
 * "<kind>:<status>"; navigating preserves the search term.
 */
import { useRouter } from 'next/navigation'

const OPTIONS: Array<{ group: string; kind: 'expired' | 'fsbo' }> = [
  { group: 'Expired', kind: 'expired' },
  { group: 'FSBO', kind: 'fsbo' },
]

const BUCKETS: Array<{ status: string; label: string }> = [
  { status: 'all', label: 'all' },
  { status: 'sendable', label: 'ready to send' },
  { status: 'needs-audit', label: 'needs audit' },
  { status: 'no-phone', label: 'no contact info' },
  { status: 'sent', label: 'sent' },
  { status: 'excluded', label: 'blocked' },
]

export function ProspectFilterSelect({
  kind,
  status,
  q,
  counts,
}: {
  kind: 'expired' | 'fsbo'
  status: string
  q: string | null
  counts: Record<string, number> | null
}) {
  const router = useRouter()
  return (
    <select
      className="av2-input"
      style={{ minHeight: 36, padding: '4px 10px', maxWidth: 260 }}
      aria-label="Filter prospects"
      value={`${kind}:${status}`}
      onChange={(e) => {
        const [k, s] = e.target.value.split(':')
        const p = new URLSearchParams()
        if (k !== 'expired') p.set('kind', k)
        if (s !== 'all') p.set('status', s)
        if (q) p.set('q', q)
        const qs = p.toString()
        router.push(qs ? `/admin/prospecting?${qs}` : '/admin/prospecting')
      }}
    >
      {OPTIONS.map((o) => (
        <optgroup key={o.kind} label={o.group}>
          {BUCKETS.map((b) => (
            <option key={`${o.kind}:${b.status}`} value={`${o.kind}:${b.status}`}>
              {o.group} — {b.label}
              {o.kind === kind && counts?.[b.status] != null ? ` (${counts[b.status]})` : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
