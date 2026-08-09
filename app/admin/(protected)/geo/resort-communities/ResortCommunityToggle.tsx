'use client'

// Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only: the setSubdivisionResort(entityKey, next) call, the
// optimistic setChecked + revert-on-failure, the useEffect resync on
// initialResort, the router.refresh() on ok, the disabled-while-pending rule
// and all four user-visible strings (both aria-labels, "Saving…", "Resort &
// master plan", "Off") are unchanged.
//
// The shadcn Switch + Label pair became the v2 Switch, which IS a native
// checkbox carrying role="switch" with its own <label> wrapper — so the
// accessible name still comes from the same aria-label string, and the visible
// caption still shows the same word. `min-h-11` is carried over so the 44px
// touch target (WCAG 2.5.8) survives; it is a size utility, not a colour one.

import { useEffect, useState, useTransition } from 'react'
import { setSubdivisionResort } from '@/app/actions/subdivision-flags'
import { useRouter } from 'next/navigation'
import { Switch } from '@/components/admin/v2'

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
    <Switch
      className="min-h-11"
      checked={checked}
      disabled={pending}
      onChange={(e) => handleChange(e.target.checked)}
      label={checked ? 'Remove resort & master plan' : 'Mark as resort & master plan community'}
      labelHidden
      stateText={pending ? 'Saving…' : checked ? 'Resort & master plan' : 'Off'}
    />
  )
}
