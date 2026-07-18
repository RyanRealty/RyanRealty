'use client'

/**
 * CmaStatusPill — the single "what state is this CMA in" indicator, shared
 * by CmaCard and CmaDetailPanel so the worklist card and the detail drawer
 * can never disagree about what "finalized" or "delivered" means.
 */

import { Badge } from '@/components/ui/badge'
import type { CmaWorklistStatus } from './types'

function statusVariant(status: CmaWorklistStatus) {
  switch (status) {
    case 'finalized':
      return 'default' as const
    case 'delivered':
      return 'secondary' as const
    case 'archived':
    case 'draft':
    default:
      return 'outline' as const
  }
}

export function CmaStatusPill({
  status,
  needsReview,
}: {
  status: CmaWorklistStatus
  needsReview?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge variant={statusVariant(status)} className="capitalize">
        {status}
      </Badge>
      {needsReview ? <Badge variant="destructive">Needs review</Badge> : null}
    </div>
  )
}
