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
import { Button, SearchField, SectionHead, TextField } from '@/components/admin/v2'

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
    <div className="av2-pane">
      <SectionHead>Add person</SectionHead>
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        This conversation is from an unrecognized {phone ? 'number' : 'contact'}. Name it to add a contact record.
      </p>

      <TextField label="First name" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="off" />
      <TextField label="Last name" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="off" />
      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="off"
        placeholder="Optional"
      />

      {error ? (
        <p style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-danger)' }}>{error}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button onClick={submit} disabled={pending}>
          {pending ? 'Adding…' : 'Add person'}
        </Button>
        {googleHref ? (
          <a
            href={googleHref}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-accent)', textDecoration: 'underline' }}
          >
            Search Google
          </a>
        ) : null}
      </div>

      {/* "or update an existing person" (spec §9.2, AC-19) */}
      {searchAction && linkAction ? (
        <div className="pt-1">
          {searchOpen ? (
            <div className="space-y-1.5">
              <SearchField
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search existing contacts"
                aria-label="Search existing contacts"
                className="w-full"
                style={{ maxWidth: 'none', minHeight: 32, padding: '4px 8px', fontSize: 'var(--a-text-sm)' }}
              />
              <div className="max-h-40 overflow-y-auto">
                {hits.map((h) => (
                  <Button
                    key={h.id}
                    variant="quiet"
                    disabled={pending}
                    onClick={() => link(h.id)}
                    className="w-full"
                    style={{
                      justifyContent: 'flex-start',
                      minHeight: 0,
                      fontWeight: 400,
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      borderRadius: 'var(--a-r-md)',
                      padding: 'var(--a-s2)',
                      fontFamily: 'var(--a-font)',
                      cursor: pending ? 'not-allowed' : 'pointer',
                      opacity: pending ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--a-inset)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none'
                    }}
                  >
                    <span
                      className="truncate"
                      style={{ fontWeight: 600, fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}
                    >
                      {h.name ?? `Contact #${h.id}`}
                    </span>
                    {h.email || h.phone ? (
                      <span
                        className="ml-1.5 truncate"
                        style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
                      >
                        {h.email ?? h.phone}
                      </span>
                    ) : null}
                  </Button>
                ))}
                {query.trim().length >= 2 && hits.length === 0 ? (
                  <p style={{ padding: '4px 8px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                    No matches.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <Button
              variant="quiet"
              onClick={() => setSearchOpen(true)}
              style={{
                minHeight: 0,
                fontSize: 'var(--a-text-xs)',
                fontWeight: 400,
                color: 'var(--a-accent)',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                padding: 0,
                fontFamily: 'var(--a-font)',
              }}
            >
              or update an existing person
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}
