'use client'

/**
 * ProspectDocPill — the single "what state is the document in" indicator
 * (spec 07 §9 "every state"). Renders straight off ProspectDocState so the
 * worklist card and the detail panel can never disagree about what "built"
 * means (that disagreement was Defect 4 in the audit this spec fixes).
 *
 * 11F: on the LOCKED admin v2 language.
 *
 * StateWord ONLY where the content is a status WORD. `.av2-state` applies
 * text-transform:uppercase, which is right for "BUILD FAILED" and wrong for
 * anything carrying data — the two pills that interpolate a price or a date use
 * `.av2-chip`, so "Sent Aug 5" does not render as "SENT AUG 5".
 */

import { Loader2 } from 'lucide-react'
import { StateWord } from '@/components/admin/v2'
import type { ProspectDocState } from '@/lib/data/prospecting/types'
import { formatPrice, formatShortDate } from './format'

export function ProspectDocPill({ doc }: { doc: ProspectDocState }) {
  switch (doc.state) {
    case 'none':
      return <StateWord state="waiting">No audit yet</StateWord>
    case 'building':
      return (
        <span className="av2-chip inline-flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Building…
        </span>
      )
    case 'failed':
      return (
        <span title={doc.reason ?? undefined}>
          <StateWord state="down">Build failed</StateWord>
        </span>
      )
    case 'ready':
      return (
        <span
          className="av2-chip inline-flex items-center gap-1 tabular-nums"
          style={{ background: 'var(--a-accent-wash)', color: 'var(--a-accent)' }}
        >
          Audit ready
          {doc.recommendedList != null ? <span>· {formatPrice(doc.recommendedList)}</span> : null}
        </span>
      )
    case 'sent':
      return (
        <span
          className="av2-chip inline-flex items-center gap-1 tabular-nums"
          style={{ background: 'var(--a-ok-wash)', color: 'var(--a-ok)' }}
        >
          Sent {formatShortDate(doc.sentAt)}
        </span>
      )
    default:
      return null
  }
}
