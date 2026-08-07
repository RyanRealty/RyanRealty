'use client'

// Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only: the seedResortCommunitiesFromDefaultList() call, the
// ok-only router.refresh(), the disabled-while-pending rule and both labels
// are unchanged. The shadcn outline Button became the v2 quiet Button — same
// secondary weight it already carried.

import { useTransition } from 'react'
import { seedResortCommunitiesFromDefaultList } from '@/app/actions/subdivision-flags'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/admin/v2'

export default function SeedResortButton() {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    startTransition(async () => {
      const result = await seedResortCommunitiesFromDefaultList()
      if (result.ok) {
        router.refresh()
      }
    })
  }

  return (
    <Button type="button" variant="quiet" touch onClick={handleClick} disabled={pending}>
      {pending ? 'Seeding…' : 'Seed from default list'}
    </Button>
  )
}
