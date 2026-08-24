'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button, TextField } from '@/components/admin/v2'
import { saveCycleContingencyDays } from '@/app/actions/tc-cycle-dates'

export function DealContingencyDays({
  cycleId,
  dealId,
  propertyKey,
  inspectionDays,
  financingDays,
}: {
  cycleId: string
  dealId: string
  propertyKey: string
  inspectionDays: number | null
  financingDays: number | null
}) {
  const [pending, start] = useTransition()
  const [inspect, setInspect] = useState(inspectionDays == null ? '' : String(inspectionDays))
  const [fin, setFin] = useState(financingDays == null ? '' : String(financingDays))
  return (
    <form
      style={{ display: 'grid', gap: 8, margin: '8px 0 16px' }}
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const res = await saveCycleContingencyDays({
            cycleId,
            dealId,
            propertyKey,
            inspectionDays: inspect,
            financingDays: fin,
          })
          if (res.error) toast.error(res.error)
          else toast.success('Contingency days saved. Calendar updated.')
        })
      }}
    >
      <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        Days from acceptance, from the sale agreement. Leave blank if the file does not state them.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
        <TextField
          label="Inspection (banking days)"
          value={inspect}
          onChange={(e) => setInspect(e.target.value)}
          inputMode="numeric"
        />
        <TextField
          label="Financing (banking days)"
          value={fin}
          onChange={(e) => setFin(e.target.value)}
          inputMode="numeric"
        />
        <Button type="submit" variant="quiet" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
