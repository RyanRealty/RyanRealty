'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button, SelectField } from '@/components/admin/v2'
import { setDealBroker, setDealStage } from '@/app/actions/tc'

const BROKERS = ['Matt Ryan', 'Paul Stevenson', 'Rebecca Peterson'] as const

export function DealStageControls({
  propertyKey,
  stage,
  brokerName,
  canAssign,
}: {
  propertyKey: string
  stage: string
  brokerName: string | null
  canAssign: boolean
}) {
  const [pending, start] = useTransition()
  const showStage = stage === 'active_listing' || stage === 'dead' || stage === 'pending'
  if (!showStage && !canAssign) return null

  function run(next: 'active_listing' | 'dead' | 'closed', detail: string, ok: string) {
    start(async () => {
      const res = await setDealStage({ propertyKey, stage: next, detail })
      if (res.error) toast.error(res.error)
      else toast.success(ok)
    })
  }

  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
      {stage === 'active_listing' ? (
        <Button
          variant="quiet"
          disabled={pending}
          onClick={() => run('dead', 'Listing withdrawn', 'Listing withdrawn.')}
        >
          Withdraw listing
        </Button>
      ) : stage === 'dead' ? (
        <Button
          variant="quiet"
          disabled={pending}
          onClick={() => run('active_listing', 'Listing restored', 'Listing restored.')}
        >
          Restore listing
        </Button>
      ) : stage === 'pending' ? (
        <Button
          variant="quiet"
          disabled={pending}
          onClick={() => {
            if (!window.confirm('Close this file? Title documents are not required to mark it closed.')) return
            run('closed', 'Closed', 'File closed.')
          }}
        >
          Close file
        </Button>
      ) : null}
      {canAssign ? (
        <SelectField
          label="Assign to"
          value={brokerName && BROKERS.includes(brokerName as (typeof BROKERS)[number]) ? brokerName : ''}
          disabled={pending}
          onChange={(e) => {
            const to = e.target.value
            if (!to || to === brokerName) return
            start(async () => {
              const res = await setDealBroker({ propertyKey, brokerName: to })
              if (res.error) toast.error(res.error)
              else toast.success(`Assigned to ${to}.`)
            })
          }}
        >
          <option value="">Broker…</option>
          {BROKERS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </SelectField>
      ) : null}
    </span>
  )
}
