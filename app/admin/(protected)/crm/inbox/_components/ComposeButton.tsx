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
import { Button, SearchField } from '@/components/admin/v2'
import { searchCrmContactsAction } from '@/app/actions/crm-tasks'

type Hit = { id: number; name: string }

export default function ComposeButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [searching, setSearching] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

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

  // The old components/ui/popover closed on outside click / Esc for free —
  // this plain av2 panel re-implements both so dropping it isn't a behavior
  // regression.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  return (
    <div
      ref={rootRef}
      className="relative w-full"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false)
      }}
    >
      <Button className="w-full" onClick={() => setOpen((v) => !v)} aria-haspopup="dialog" aria-expanded={open}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        Compose
      </Button>
      {open ? (
        <div
          role="dialog"
          aria-label="Search contacts to message"
          className="av2-pane absolute left-0 w-72"
          style={{ top: 'calc(100% + var(--a-s2))', zIndex: 30, boxShadow: 'var(--a-shadow-overlay)' }}
        >
          <SearchField
            autoFocus
            type="text"
            placeholder="Search contacts to message"
            aria-label="Search contacts to message"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full"
            style={{ maxWidth: 'none' }}
          />
          <div className="max-h-56 overflow-y-auto">
            {searching ? (
              <p style={{ padding: '6px 8px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                Searching…
              </p>
            ) : hits.length === 0 && q.trim().length >= 2 ? (
              <p style={{ padding: '6px 8px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                No contacts match.
              </p>
            ) : (
              hits.map((h) => (
                <Button
                  key={h.id}
                  variant="quiet"
                  onClick={() => {
                    setOpen(false)
                    setQ('')
                    router.push(`/admin/crm/inbox?scope=me&folder=inbox&c=${h.id}&compose=1`)
                  }}
                  className="w-full"
                  style={{
                    justifyContent: 'flex-start',
                    minHeight: 0,
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    borderRadius: 'var(--a-r-md)',
                    padding: 'var(--a-s2)',
                    fontFamily: 'var(--a-font)',
                    fontSize: 'var(--a-text-sm)',
                    fontWeight: 400,
                    color: 'var(--a-text)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--a-inset)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none'
                  }}
                >
                  {h.name}
                </Button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
