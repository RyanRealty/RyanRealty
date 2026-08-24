'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/admin/v2'
import { addMissingAnticipatedChecklist } from '@/app/actions/tc-required-docs'

export function AddMissingChecklist({ cycleId, missingCount }: { cycleId: string; missingCount: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  if (missingCount <= 0) return null
  return (
    <Button
      variant="quiet"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const res = await addMissingAnticipatedChecklist(cycleId)
          if (!res.ok) {
            toast.error(res.error ?? 'Could not add checklist rows.')
            return
          }
          toast.success(res.added ? `Added ${res.added} to the checklist.` : 'Checklist already had every applicable row.')
          router.refresh()
        })
      }}
    >
      {pending ? 'Adding…' : `Add ${missingCount} missing to checklist`}
    </Button>
  )
}
