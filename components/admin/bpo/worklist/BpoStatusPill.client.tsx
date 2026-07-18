'use client'

/**
 * BpoStatusPill — the single "what state is this opinion in" indicator,
 * shared by the worklist card and the detail panel so they can never
 * disagree (same discipline as ProspectDocPill).
 */

import { Badge } from '@/components/ui/badge'

export function BpoStatusPill({ status, buildError }: { status: string; buildError?: string | null }) {
  if (buildError) {
    return (
      <Badge variant="destructive" title={buildError}>
        Build error
      </Badge>
    )
  }
  if (status === 'final') return <Badge variant="default">Final</Badge>
  return <Badge variant="outline">Draft</Badge>
}
