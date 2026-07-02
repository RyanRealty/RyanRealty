'use client'

/**
 * ComposeButton — the full-width Compose control at the top of the inbox folder
 * rail (spec §08 §3.1). Opens a contact search popover; picking a contact opens
 * their conversation with the inline composer expanded (?compose=1). The send
 * itself still routes through the existing suppression-gated composers — this is
 * navigation only, never a send path.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { searchCrmContactsAction } from '@/app/actions/crm-tasks'

type Hit = { id: number; name: string }

export default function ComposeButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [searching, setSearching] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2) {
      setHits([])
      return
    }
    timer.current = setTimeout(async () => {
      setSearching(true)
      const res = await searchCrmContactsAction(q)
      setSearching(false)
      if (res.ok) setHits(res.results)
    }, 250)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [q])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button className="w-full" size="sm">
          <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Compose
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <Input
          autoFocus
          placeholder="Search contacts to message"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="mt-2 max-h-56 overflow-y-auto">
          {searching ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Searching…</p>
          ) : hits.length === 0 && q.trim().length >= 2 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No contacts match.</p>
          ) : (
            hits.map((h) => (
              <Button
                key={h.id}
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start font-normal"
                onClick={() => {
                  setOpen(false)
                  setQ('')
                  router.push(`/admin/crm/inbox?scope=me&folder=inbox&c=${h.id}&compose=1`)
                }}
              >
                {h.name}
              </Button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
