'use client'

/**
 * AddPersonForm — the Inbox unknown-caller "Add Person" affordance (spec §9,
 * AC-19/AC-20/AC-35). Rendered inline in the reading pane's contact panel (NOT a
 * Dialog/Sheet) when the open conversation is still an unidentified caller.
 *
 * Submitting names the existing placeholder contact (first/last + optional email)
 * via the bound server action; on success the page refreshes and the thread shows
 * the real name. "Search Google" opens a lookup for the number in a new tab. No
 * message is ever sent from here.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ExistingHit = { id: number; name: string | null; email: string | null; phone: string | null }

export default function AddPersonForm({
  phone,
  addAction,
  searchAction,
  linkAction,
}: {
  phone: string | null
  addAction: (firstName: string, lastName: string, email: string) => Promise<{ ok: boolean; error?: string }>
  /** "or update an existing person" search (AC-19) — finds link candidates. */
  searchAction?: (query: string) => Promise<ExistingHit[]>
  /** Links (merges) this unknown-caller thread into the chosen existing contact. */
  linkAction?: (existingId: number) => Promise<{ ok: boolean; error?: string }>
}) {
  const router = useRouter()
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ExistingHit[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!searchOpen || !searchAction) return
    if (timer.current) clearTimeout(timer.current)
    if (query.trim().length < 2) {
      setHits([])
      return
    }
    timer.current = setTimeout(async () => {
      setHits(await searchAction(query))
    }, 250)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query, searchOpen, searchAction])

  function link(existingId: number) {
    if (!linkAction) return
    setError(null)
    startTransition(async () => {
      const res = await linkAction(existingId)
      if (!res.ok) {
        setError(res.error ?? 'Could not link the contact')
        return
      }
      router.push(`/admin/crm/inbox?scope=company&folder=inbox&c=${existingId}`)
      router.refresh()
    })
  }

  const googleHref = phone
    ? `https://www.google.com/search?q=${encodeURIComponent(phone)}`
    : null

  function submit() {
    if (!first.trim() && !last.trim()) {
      setError('Enter a first or last name')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await addAction(first, last, email)
      if (!res.ok) {
        setError(res.error ?? 'Could not add the contact')
        return
      }
      setFirst('')
      setLast('')
      setEmail('')
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add person</div>
      <p className="text-xs text-muted-foreground">
        This conversation is from an unrecognized {phone ? 'number' : 'contact'}. Name it to add a contact record.
      </p>

      <div className="space-y-1">
        <Label htmlFor="ap-first" className="text-xs">First name</Label>
        <Input id="ap-first" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="off" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ap-last" className="text-xs">Last name</Label>
        <Input id="ap-last" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="off" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ap-email" className="text-xs">Email</Label>
        <Input id="ap-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="Optional" />
      </div>

      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button type="button" size="sm" onClick={submit} disabled={pending}>
          {pending ? 'Adding…' : 'Add person'}
        </Button>
        {googleHref ? (
          <a href={googleHref} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
            Search Google
          </a>
        ) : null}
      </div>

      {/* "or update an existing person" (spec §9.2, AC-19) */}
      {searchAction && linkAction ? (
        <div className="pt-1">
          {searchOpen ? (
            <div className="space-y-1.5">
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search existing contacts"
                className="h-8 text-sm"
              />
              <div className="max-h-40 overflow-y-auto">
                {hits.map((h) => (
                  <Button
                    key={h.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    className="w-full justify-start font-normal"
                    onClick={() => link(h.id)}
                  >
                    <span className="truncate font-medium">{h.name ?? `Contact #${h.id}`}</span>
                    {h.email || h.phone ? (
                      <span className="ml-1.5 truncate text-xs text-muted-foreground">{h.email ?? h.phone}</span>
                    ) : null}
                  </Button>
                ))}
                {query.trim().length >= 2 && hits.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-muted-foreground">No matches.</p>
                ) : null}
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => setSearchOpen(true)}
            >
              or update an existing person
            </Button>
          )}
        </div>
      ) : null}
      </CardContent>
    </Card>
  )
}
