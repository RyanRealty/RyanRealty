'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, SelectField, TextField } from '@/components/admin/v2'
import { saveCyclePropertyFacts } from '@/app/actions/tc-required-docs'
import type { PropertyFacts } from '@/lib/tc/required-documents'

const BOOLS: Array<{ key: keyof PropertyFacts; label: string }> = [
  { key: 'hasWell', label: 'Well' },
  { key: 'hasSeptic', label: 'Septic' },
  { key: 'hasHOA', label: 'HOA' },
  { key: 'isCondo', label: 'Condo' },
  { key: 'isManufactured', label: 'Manufactured' },
  { key: 'isVacantLand', label: 'Vacant land' },
  { key: 'hasSolar', label: 'Solar' },
  { key: 'isTenantOccupied', label: 'Tenant occupied' },
  { key: 'isShortSale', label: 'Short sale' },
  { key: 'isSellerCarried', label: 'Seller-carried' },
]

function boolValue(v: boolean | null | undefined): string {
  if (v === true) return 'yes'
  if (v === false) return 'no'
  return ''
}

export function DealPropertyFacts({ cycleId, facts }: { cycleId: string; facts: PropertyFacts }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [yearBuilt, setYearBuilt] = useState(facts.yearBuilt == null ? '' : String(facts.yearBuilt))
  const [financing, setFinancing] = useState(facts.financing ?? '')
  const [bools, setBools] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const row of BOOLS) init[row.key] = boolValue(facts[row.key] as boolean | null)
    return init
  })

  return (
    <form
      style={{ display: 'grid', gap: 8, marginTop: 8 }}
      onSubmit={(e) => {
        e.preventDefault()
        const patch: Partial<PropertyFacts> = {}
        const yb = Number(yearBuilt)
        if (yearBuilt.trim() && Number.isFinite(yb)) patch.yearBuilt = yb
        if (financing === 'va' || financing === 'fha' || financing === 'conventional' || financing === 'cash') {
          patch.financing = financing
        }
        for (const row of BOOLS) {
          const v = bools[row.key]
          if (v === 'yes') (patch as Record<string, unknown>)[row.key] = true
          else if (v === 'no') (patch as Record<string, unknown>)[row.key] = false
        }
        start(async () => {
          const res = await saveCyclePropertyFacts(cycleId, patch)
          if (!res.ok) {
            toast.error(res.error ?? 'Could not save facts.')
            return
          }
          toast.success(
            res.added ? `Facts saved. Added ${res.added} checklist row${res.added === 1 ? '' : 's'}.` : 'Facts saved.',
          )
          router.refresh()
        })
      }}
    >
      <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        Confirm what the listing feed does not know. Yes/no here drives the Oregon
        checklist. Unknown stays off the file until you answer.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 8,
        }}
      >
        <TextField
          label="Year built"
          inputMode="numeric"
          value={yearBuilt}
          onChange={(e) => setYearBuilt(e.target.value)}
        />
        <SelectField label="Financing" value={financing} onChange={(e) => setFinancing(e.target.value)}>
          <option value="">Unknown</option>
          <option value="conventional">Conventional</option>
          <option value="fha">FHA</option>
          <option value="va">VA</option>
          <option value="cash">Cash</option>
        </SelectField>
        {BOOLS.map((row) => (
          <SelectField
            key={row.key}
            label={row.label}
            value={bools[row.key] ?? ''}
            onChange={(e) => setBools((cur) => ({ ...cur, [row.key]: e.target.value }))}
          >
            <option value="">Unknown</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </SelectField>
        ))}
      </div>
      <Button type="submit" variant="quiet" disabled={pending}>
        {pending ? 'Saving…' : 'Save facts'}
      </Button>
    </form>
  )
}
