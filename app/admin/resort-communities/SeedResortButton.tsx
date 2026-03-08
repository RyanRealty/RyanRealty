'use client'

import { useTransition } from 'react'
import { seedResortCommunitiesFromDefaultList } from '../../actions/subdivision-flags'
import { useRouter } from 'next/navigation'

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
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
    >
      {pending ? 'Seeding…' : 'Seed from default list'}
    </button>
  )
}
