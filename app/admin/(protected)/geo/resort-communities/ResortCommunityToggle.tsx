'use client'

import { useEffect, useState, useTransition } from 'react'
import { setSubdivisionResort } from '@/app/actions/subdivision-flags'
import { useRouter } from 'next/navigation'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

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
    <Label className="min-h-11 cursor-pointer gap-3">
      <Switch
        checked={checked}
        disabled={pending}
        onCheckedChange={handleChange}
        aria-label={
          checked ? 'Remove resort & master plan' : 'Mark as resort & master plan community'
        }
      />
      <span className="font-normal text-muted-foreground">
        {pending ? 'Saving…' : checked ? 'Resort & master plan' : 'Off'}
      </span>
    </Label>
  )
}
