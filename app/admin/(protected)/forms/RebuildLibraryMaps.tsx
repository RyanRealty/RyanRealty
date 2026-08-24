'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/admin/v2'
import { rebuildLibraryFieldMaps } from '@/app/actions/tc-library'
import { useRouter } from 'next/navigation'

export function RebuildLibraryMaps() {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      variant="quiet"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const res = await rebuildLibraryFieldMaps()
          if (res.error) toast.error(res.error)
          else {
            toast.success(`Mapped ${res.mapped ?? 0} of ${res.scanned ?? 0} forms`)
            router.refresh()
          }
        })
      }}
    >
      {pending ? 'Mapping library…' : 'Map entire library'}
    </Button>
  )
}
