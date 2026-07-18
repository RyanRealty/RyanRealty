'use client'

/**
 * ProspectComplianceRibbon — the row of destructive/warning chips explaining
 * why a prospect is not sendable (spec 07 §5.2 "ready but blocked" row: "no
 * send button, the ribbon explains why"). Purely presentational: it reads the
 * fail-closed compliance snapshot the DAL already resolved
 * (lib/data/prospecting/types.ts ProspectComplianceState) and never makes its
 * own suppression/relist decision.
 */

import { Badge } from '@/components/ui/badge'
import type { ProspectComplianceState } from '@/lib/data/prospecting/types'

type Chip = { key: string; label: string; variant: 'destructive' | 'warning' }

export function ProspectComplianceRibbon({ compliance }: { compliance: ProspectComplianceState }) {
  const chips: Chip[] = []
  if (compliance.hardStop) chips.push({ key: 'hard-stop', label: 'Compliance hold', variant: 'destructive' })
  if (compliance.suppressedSms) chips.push({ key: 'suppressed', label: 'Suppressed', variant: 'destructive' })
  if (compliance.relisted) chips.push({ key: 'relisted', label: 'Relisted', variant: 'warning' })
  if (compliance.offMarket) chips.push({ key: 'off-market', label: 'Off market', variant: 'warning' })
  if (compliance.noPhone) chips.push({ key: 'no-phone', label: 'No phone', variant: 'warning' })

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="status">
      {chips.map((chip) => (
        <Badge key={chip.key} variant={chip.variant}>
          {chip.label}
        </Badge>
      ))}
      {compliance.reasons.length > 0 ? (
        <span className="text-xs text-muted-foreground">{compliance.reasons.join(' · ')}</span>
      ) : null}
    </div>
  )
}
