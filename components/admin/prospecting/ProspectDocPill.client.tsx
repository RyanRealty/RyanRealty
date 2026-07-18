'use client'

/**
 * ProspectDocPill — the single "what state is the document in" indicator
 * (spec 07 §9 "every state"). Renders straight off ProspectDocState so the
 * worklist card and the detail panel can never disagree about what "built"
 * means (that disagreement was Defect 4 in the audit this spec fixes).
 */

import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ProspectDocState } from '@/lib/data/prospecting/types'
import { formatPrice, formatShortDate } from './format'

export function ProspectDocPill({ doc }: { doc: ProspectDocState }) {
  switch (doc.state) {
    case 'none':
      return <Badge variant="outline">No audit yet</Badge>
    case 'building':
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Building…
        </Badge>
      )
    case 'failed':
      return (
        <Badge variant="destructive" title={doc.reason ?? undefined}>
          Build failed
        </Badge>
      )
    case 'ready':
      return (
        <Badge variant="default" className="gap-1 tabular-nums">
          Audit ready
          {doc.recommendedList != null ? <span>· {formatPrice(doc.recommendedList)}</span> : null}
        </Badge>
      )
    case 'sent':
      return (
        <Badge variant="success" className="gap-1 tabular-nums">
          Sent {formatShortDate(doc.sentAt)}
        </Badge>
      )
    default:
      return null
  }
}
