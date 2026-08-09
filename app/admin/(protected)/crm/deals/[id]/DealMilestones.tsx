'use client'

/**
 * Milestone dates for /admin/crm/deals/[id]. 11F: taken off shadcn onto the
 * locked admin v2 language (ADMIN_UI.md pattern 6 — label above, inline
 * validation).
 *
 * Presentation only. The MILESTONES list, its five keys and five labels, the
 * per-field `pendingKey` (D7) rather than a shared boolean, the save-on-blur
 * call and the per-key error map are all carried over unchanged.
 *
 * Two slots move into the primitive rather than being hand-drawn beside it:
 *   - "saving…" is now the field's `hint`, so it sits under the label and is
 *     wired into aria-describedby instead of being a decorative span inside
 *     the <label>. Same word, announced instead of silent.
 *   - the per-key error is now the field's `error`, which also sets
 *     aria-invalid and aria-describedby. Same string, same position.
 * The `ms-<key>` ids are gone because TextField owns the label→input
 * association through its own useId; a repo-wide grep finds no test, script or
 * sibling component referencing them.
 */

import { useTransition, useState } from 'react'
import { TextField } from '@/components/admin/v2'
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
          <TextField
            key={m.key}
            label={m.label}
            hint={isSaving ? 'saving…' : undefined}
            error={errors[m.key]}
            type="date"
            value={values[m.key]}
            disabled={isSaving}
            onChange={(e) => setValues((v) => ({ ...v, [m.key]: e.target.value }))}
            onBlur={() => handleBlur(m.key)}
          />
        )
      })}
    </div>
  )
}
