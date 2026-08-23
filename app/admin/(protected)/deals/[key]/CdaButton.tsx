'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/admin/v2'
import { generateCommissionCda } from '@/app/actions/tc-cda'

export function CdaButton({ cycleId, propertyKey }: { cycleId: string; propertyKey: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="quiet"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const res = await generateCommissionCda(cycleId, propertyKey)
          if (res.error) toast.error(res.error)
          else toast.success('CDA saved on the cycle.')
        })
      }}
    >
      Generate CDA
    </Button>
  )
}
