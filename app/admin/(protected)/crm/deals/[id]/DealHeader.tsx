'use client'

/**
 * Deal identity editor for /admin/crm/deals/[id] (ADMIN_UI.md pattern 5 header,
 * pattern 6 fields). 11F: taken off shadcn onto the locked admin v2 language.
 *
 * Presentation only. Every state hook, every `save()` call, every patch key
 * (`name`, `property_address`, `value`, `close_date`, `description`), the
 * save-on-blur timing and every visible string are carried over unchanged.
 *
 * Two notes on the field swap:
 *   - The literal ids (`deal-name`, `deal-address`, `deal-value`, `deal-close`,
 *     `deal-desc`) are gone because TextField owns the label→input association
 *     through its own useId. They were pinned by nothing: a repo-wide grep for
 *     each id returns only this file's own Label/Input pair.
 *   - The stage is DATA (a configured pipeline stage name), so it renders as
 *     `.av2-chip`, never StateWord — `.av2-state` uppercases, and "Under
 *     contract" must not become "UNDER CONTRACT". Same call as
 *     ProspectDocPill.client.tsx.
 */

import { useTransition, useState } from 'react'
import { TextAreaField, TextField } from '@/components/admin/v2'
import { updateCrmDeal } from '@/app/actions/crm-deals'

type Props = {
  dealId: number
  initialName: string | null
  initialAddress: string | null
  initialValue: number | null
  initialCloseDate: string | null
  initialDescription: string | null
  stage: string | null
  pipeline: string | null
}

export function DealHeader({
  dealId,
  initialName,
  initialAddress,
  initialValue,
  initialCloseDate,
  initialDescription,
  stage,
  pipeline,
}: Props) {
  const [name, setName] = useState(initialName ?? '')
  const [address, setAddress] = useState(initialAddress ?? '')
  const [value, setValue] = useState(initialValue != null ? String(initialValue) : '')
  const [closeDate, setCloseDate] = useState(initialCloseDate ?? '')
  const [description, setDescription] = useState(initialDescription ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save(patch: Parameters<typeof updateCrmDeal>[1]) {
    setError(null)
    startTransition(async () => {
      const res = await updateCrmDeal(dealId, patch)
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <div className="space-y-4">
      {/* pipeline breadcrumb + stage chip */}
      <div
        className="flex flex-wrap items-center gap-2"
        style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
      >
        {pipeline ? (
          <span className="font-medium" style={{ color: 'var(--a-text)' }}>
            {pipeline}
          </span>
        ) : null}
        {pipeline && stage ? <span>›</span> : null}
        {stage ? <span className="av2-chip">{stage}</span> : null}
      </div>

      {error ? (
        <p
          className="rounded-md px-3 py-2 text-xs"
          style={{ background: 'var(--a-danger-wash)', color: 'var(--a-danger)' }}
        >
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Deal name"
          value={name}
          disabled={isPending}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => save({ name: name || null })}
        />
        <TextField
          label="Property address"
          value={address}
          disabled={isPending}
          onChange={(e) => setAddress(e.target.value)}
          onBlur={() => save({ property_address: address || null })}
          placeholder="123 Main St, Bend OR"
        />
        <TextField
          label="Price ($)"
          type="number"
          min="0"
          step="1000"
          value={value}
          disabled={isPending}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => save({ value: value ? Number(value) : null })}
          placeholder="e.g. 650000"
        />
        <TextField
          label="Close date"
          type="date"
          value={closeDate}
          disabled={isPending}
          onChange={(e) => setCloseDate(e.target.value)}
          onBlur={() => save({ close_date: closeDate || null })}
        />
      </div>

      <TextAreaField
        label="Description"
        rows={3}
        value={description}
        disabled={isPending}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => save({ description: description || null })}
        placeholder="Notes about this deal..."
      />
    </div>
  )
}
