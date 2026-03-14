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
      onClick={handleClick}
      disabled={pending}
      className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
    >
      {pending ? 'Seeding…' : 'Seed from default list'}
    </Button>
  )
}
