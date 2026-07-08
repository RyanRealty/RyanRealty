'use client'

import { useTransition } from 'react'
import { seedResortCommunitiesFromDefaultList } from '@/app/actions/subdivision-flags'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"

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
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={pending}
      className="h-11 shrink-0"
    >
      {pending ? 'Seeding…' : 'Seed from default list'}
    </Button>
  )
}
