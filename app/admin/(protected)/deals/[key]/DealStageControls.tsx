'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/admin/v2'
import { setDealStage } from '@/app/actions/tc'

export function DealStageControls({
  propertyKey,
  stage,
}: {
  propertyKey: string
  stage: string
}) {
  const [pending, start] = useTransition()
  if (stage !== 'active_listing' && stage !== 'dead') return null

  function run(next: 'active_listing' | 'dead', detail: string, ok: string) {
    start(async () => {
      const res = await setDealStage({ propertyKey, stage: next, detail })
      if (res.error) toast.error(res.error)
      else toast.success(ok)
    })
  }

  return (
    <span style={{ display: 'inline-flex', gap: 8 }}>
      {stage === 'active_listing' ? (
        <Button
          variant="quiet"
          disabled={pending}
          onClick={() => run('dead', 'Listing withdrawn', 'Listing withdrawn.')}
        >
          Withdraw listing
        </Button>
      ) : (
        <Button
          variant="quiet"
          disabled={pending}
          onClick={() => run('active_listing', 'Listing restored', 'Listing restored.')}
        >
          Restore listing
        </Button>
      )}
    </span>
  )
}
