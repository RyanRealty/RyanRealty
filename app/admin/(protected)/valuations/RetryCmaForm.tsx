'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/admin/v2'
import { rebuildCmaAction } from '@/app/actions/cma-rebuild'

export function RetryCmaForm({ slug }: { slug: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      type="button"
      variant="quiet"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const { error } = await rebuildCmaAction({ slug })
          if (error) toast.error(error)
          else toast.success('Rebuild started')
        })
      }}
    >
      {pending ? 'Retrying' : 'Retry'}
    </Button>
  )
}
