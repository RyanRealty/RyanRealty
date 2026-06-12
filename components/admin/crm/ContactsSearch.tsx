'use client'

/**
 * Search-as-you-type for the contacts list. Debounced URL replace inside a
 * transition — the table filters live (server-queried against the full book)
 * without the page skeleton flashing per keystroke.
 */
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

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
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search name, email, or phone"
        className="pl-9"
        aria-label="Search contacts"
      />
      {isPending ? (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
      ) : null}
    </div>
  )
}
