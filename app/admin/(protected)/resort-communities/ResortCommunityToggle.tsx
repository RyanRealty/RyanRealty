'use client'

import { useEffect, useState } from 'react'
import { useTransition } from 'react'
import { setSubdivisionResort } from '@/app/actions/subdivision-flags'
import { useRouter } from 'next/navigation'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = { entityKey: string; initialResort: boolean }

export default function ResortCommunityToggle({ entityKey, initialResort }: Props) {
  const [checked, setChecked] = useState(initialResort)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    setChecked(initialResort)
  }, [initialResort])

  function handleChange(next: boolean) {
    setChecked(next)
    startTransition(async () => {
      const result = await setSubdivisionResort(entityKey, next)
      if (result.ok) {
        router.refresh()
      } else {
        setChecked((prev) => !prev)
      }
    })
  }

  return (
    <Label className="inline-flex cursor-pointer items-center gap-2">
      <Input
        type="checkbox"
        checked={checked}
        disabled={pending}
        onChange={(e) => handleChange(e.target.checked)}
        className="h-4 w-4 rounded border-border text-success focus:ring-accent"
        aria-label={checked ? 'Remove resort & master plan' : 'Mark as resort & master plan community'}
      />
      {checked && <span className="text-xs font-medium text-success">Resort & master plan</span>}
      {pending && <span className="text-xs text-muted-foreground">Saving…</span>}
    </Label>
  )
}
