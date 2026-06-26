'use client'

import { useTransition, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { updateCrmDeal } from '@/app/actions/crm-deals'

type MilestoneKey =
  | 'mutual_acceptance'
  | 'earnest_money_due'
  | 'due_diligence'
  | 'final_walkthrough'
  | 'possession'

const MILESTONES: Array<{ key: MilestoneKey; label: string }> = [
  { key: 'mutual_acceptance', label: 'Mutual acceptance' },
  { key: 'earnest_money_due', label: 'Earnest money due' },
  { key: 'due_diligence', label: 'Due diligence' },
  { key: 'final_walkthrough', label: 'Final walkthrough' },
  { key: 'possession', label: 'Possession' },
]

type Props = {
  dealId: number
  initial: Partial<Record<MilestoneKey, string | null>>
}

export function DealMilestones({ dealId, initial }: Props) {
  const [values, setValues] = useState<Record<MilestoneKey, string>>({
    mutual_acceptance: initial.mutual_acceptance ?? '',
    earnest_money_due: initial.earnest_money_due ?? '',
    due_diligence: initial.due_diligence ?? '',
    final_walkthrough: initial.final_walkthrough ?? '',
    possession: initial.possession ?? '',
  })
  const [errors, setErrors] = useState<Partial<Record<MilestoneKey, string>>>({})
  // Per-field pending key instead of a shared boolean — D7
  const [pendingKey, setPendingKey] = useState<MilestoneKey | null>(null)
  const [, startTransition] = useTransition()

  function handleBlur(key: MilestoneKey) {
    const val = values[key]
    setPendingKey(key)
    startTransition(async () => {
      const res = await updateCrmDeal(dealId, { [key]: val || null })
      setPendingKey(null)
      if (!res.ok) {
        setErrors((e) => ({ ...e, [key]: res.error }))
      } else {
        setErrors((e) => {
          const n = { ...e }
          delete n[key]
          return n
        })
      }
    })
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {MILESTONES.map((m) => {
        const isSaving = pendingKey === m.key
        return (
          <div key={m.key} className="flex flex-col gap-1">
            <Label htmlFor={`ms-${m.key}`} className="text-xs text-muted-foreground">
              {m.label}
              {isSaving && (
                <span className="ml-1.5 text-xs text-muted-foreground/60">saving…</span>
              )}
            </Label>
            <Input
              id={`ms-${m.key}`}
              type="date"
              value={values[m.key]}
              disabled={isSaving}
              onChange={(e) =>
                setValues((v) => ({ ...v, [m.key]: e.target.value }))
              }
              onBlur={() => handleBlur(m.key)}
              className="h-8 text-sm"
            />
            {errors[m.key] ? (
              <p className="text-xs text-destructive">{errors[m.key]}</p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
