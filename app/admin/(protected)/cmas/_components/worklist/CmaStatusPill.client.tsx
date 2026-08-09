'use client'

/**
 * CmaStatusPill — the single "what state is this CMA in" indicator, shared
 * by CmaCard and CmaDetailPanel so the worklist card and the detail drawer
 * can never disagree about what "finalized" or "delivered" means.
 *
 * 11F: on the LOCKED admin v2 language. Badge -> StateWord (status is text +
 * color, never color alone). Wording is unchanged: "Draft", "Finalized",
 * "Delivered", "Archived", "Needs review", "Live on listing".
 */

import { StateWord, type AdminState } from '@/components/admin/v2'
import type { CmaWorklistStatus } from './types'

const STATUS_LABEL: Record<CmaWorklistStatus, string> = {
  draft: 'Draft',
  finalized: 'Finalized',
  delivered: 'Delivered',
  archived: 'Archived',
}

function statusTone(status: CmaWorklistStatus): AdminState {
  switch (status) {
    case 'finalized':
      return 'accent'
    case 'delivered':
      return 'ok'
    case 'archived':
    case 'draft':
    default:
      return 'waiting'
  }
}

export function CmaStatusPill({
  status,
  needsReview,
  published,
}: {
  status: CmaWorklistStatus
  needsReview?: boolean
  /** published_to_listing — the value range is on a public listing page right now. */
  published?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <StateWord state={statusTone(status)}>{STATUS_LABEL[status]}</StateWord>
      {needsReview ? <StateWord state="down">Needs review</StateWord> : null}
      {published ? <StateWord state="ok">Live on listing</StateWord> : null}
    </div>
  )
}
