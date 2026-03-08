'use client'

import { useTransition } from 'react'
import { setSubdivisionResort } from '../../actions/subdivision-flags'
import { useRouter } from 'next/navigation'

type Props = { entityKey: string; initialResort: boolean }

export default function ResortCommunityToggle({ entityKey, initialResort }: Props) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleChange(checked: boolean) {
    startTransition(async () => {
      const result = await setSubdivisionResort(entityKey, checked)
      if (result.ok) router.refresh()
    })
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={initialResort}
        disabled={pending}
        onChange={(e) => handleChange(e.target.checked)}
        className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
      />
      {pending && <span className="text-xs text-zinc-400">Saving…</span>}
    </label>
  )
}
