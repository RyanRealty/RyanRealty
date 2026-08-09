'use client'

/**
 * Search-as-you-type for the contacts list. Debounced URL replace inside a
 * transition — the list filters live (server-queried against the full book)
 * without the page skeleton flashing per keystroke.
 *
 * 11F: migrated from components/admin/crm/ContactsSearch (shadcn Input +
 * text-muted-foreground) to the v2 SearchField, and relocated here because
 * /admin/crm is its only caller.
 *
 * IT SURVIVED THE HEADER IT LIVED IN. This was mounted inside MobileCrmHeader's
 * searchSlot, and that bar was deleted this unit (Matt 2026-08-08) as a
 * public-brand navy strip whose scope control duplicated TopBarScope. The
 * search did NOT duplicate anything: the ⌘K palette matches a lead by name and
 * navigates to them, while this filters the list in place on name, email OR
 * phone. Nothing else on any width sets `?q=`, so deleting it with its host
 * would have removed the people list's only text filter outright.
 */
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SearchField } from '@/components/admin/v2'

export default function ContactsSearch({ initial }: { initial: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [value, setValue] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const onChange = (q: string) => {
    setValue(q)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (q.trim()) next.set('q', q.trim())
      else next.delete('q')
      next.delete('page')
      startTransition(() => router.replace(`/admin/crm?${next.toString()}`, { scroll: false }))
    }, 250)
  }

  return (
    <div data-tour="crm-search" style={{ position: 'relative', width: '100%' }}>
      <SearchField
        aria-label="Search contacts"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search name, email, or phone"
      />
      {/* The spinner is a live region so a screen reader hears that the list is
          re-querying; the old build showed a silent spinning icon. */}
      <span
        role="status"
        aria-live="polite"
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 'var(--a-text-xs)',
          color: 'var(--a-text-2)',
          pointerEvents: 'none',
        }}
      >
        {isPending ? 'Searching…' : ''}
      </span>
    </div>
  )
}
