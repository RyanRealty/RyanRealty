'use client'

/**
 * RelationshipsPanel — the Contact-360 relationships island (CONTACT360 Phase
 * 4.3, UI). Matt's ask: "assign relationships like two contacts are married."
 *
 * Lists every relationship a contact has (related name + a humanized type Badge
 * + an unlink Button), and an add form: a relationship-type Select (from
 * RELATIONSHIP_TYPES) plus the related contact's id, then an add Button. Every
 * mutation routes through the existing reciprocal-writing server actions
 * (linkContacts / unlinkContacts) — this island only renders state and
 * dispatches, the actions are the auth + reciprocal chokepoint.
 *
 * Optimistic + error surfacing mirror MembershipToggles: apply the change to the
 * UI, dispatch the action, revert + surface the reason on failure.
 *
 * No contact-search action exists yet, so the add form takes the related
 * contact's numeric id with a small helper note. When a contact-search picker
 * action lands, swap the id Input for it without touching the actions.
 */
import { useRef, useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { linkContacts, unlinkContacts } from '@/app/actions/crm-relationships'
import { searchCrmContactsAction, type ContactSearchHit } from '@/app/actions/crm-tasks'
import { RELATIONSHIP_TYPES, RELATIONSHIP_LABELS, type RelationshipType } from '@/lib/crm/relationships'
import type { ContactRelationship } from '@/lib/data/crm/getContactRelationships'

type Result = { ok: true } | { ok: false; error: string }
type Note = { tone: 'ok' | 'err'; text: string } | null

export function RelationshipsPanel({
  personId,
  relationships,
}: {
  personId: number
  relationships: ContactRelationship[]
}) {
  const [rows, setRows] = useState<ContactRelationship[]>(relationships)
  const [type, setType] = useState<RelationshipType>('spouse')
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<Note>(null)

  // Contact name search (replaces the old "enter the contact id" input).
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ContactSearchHit[]>([])
  const [selected, setSelected] = useState<ContactSearchHit | null>(null)
  const [searching, setSearching] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onSearch(value: string) {
    setQuery(value)
    if (debounce.current) clearTimeout(debounce.current)
    const q = value.trim()
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    debounce.current = setTimeout(async () => {
      const r = await searchCrmContactsAction(q)
      setResults(r.ok ? r.results.filter((hit) => hit.id !== personId) : [])
      setSearching(false)
    }, 250)
  }

  function pick(hit: ContactSearchHit) {
    setSelected(hit)
    setQuery('')
    setResults([])
  }

  /**
   * Optimistically apply a UI change, dispatch the action, and revert + surface
   * the reason on failure. Mirrors the MembershipToggles dispatch pattern.
   */
  function dispatch(apply: () => void, revert: () => void, action: () => Promise<Result>, okText: string) {
    apply()
    setNote(null)
    startTransition(async () => {
      const r = await action()
      if (r.ok) {
        setNote({ tone: 'ok', text: okText })
      } else {
        revert()
        setNote({ tone: 'err', text: r.error })
      }
    })
  }

  function onUnlink(row: ContactRelationship) {
    if (row.relatedPersonId === null) {
      setNote({ tone: 'err', text: 'This link has no contact id to unlink.' })
      return
    }
    const toPersonId = row.relatedPersonId
    dispatch(
      () => setRows((rs) => rs.filter((r) => r.id !== row.id)),
      () => setRows((rs) => (rs.some((r) => r.id === row.id) ? rs : [...rs, row])),
      () => unlinkContacts({ fromPersonId: personId, toPersonId }),
      `Unlinked ${row.name}`,
    )
  }

  function onAdd() {
    if (!selected) {
      setNote({ tone: 'err', text: 'Search for a contact by name and pick one to link.' })
      return
    }
    const toPersonId = selected.id
    if (toPersonId === personId) {
      setNote({ tone: 'err', text: 'A contact cannot be linked to itself.' })
      return
    }
    const picked = selected
    const optimistic: ContactRelationship = {
      id: -toPersonId,
      relatedPersonId: toPersonId,
      name: picked.name,
      type,
      label: RELATIONSHIP_LABELS[type],
    }
    dispatch(
      () => {
        setRows((rs) => [...rs, optimistic])
        setSelected(null)
      },
      () => setRows((rs) => rs.filter((r) => r.id !== optimistic.id)),
      () => linkContacts({ fromPersonId: personId, toPersonId, type }),
      `Linked ${picked.name} as ${RELATIONSHIP_LABELS[type]}`,
    )
  }

  return (
    <div className="space-y-4">
      {/* Existing relationships */}
      {rows.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          No linked contacts yet. Link a spouse, co-buyer, or referrer below.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 min-h-12">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{r.name}</span>
                <Badge variant="secondary" className="shrink-0 text-xs">{r.label}</Badge>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || r.relatedPersonId === null}
                onClick={() => onUnlink(r)}
                className="min-h-11 shrink-0 sm:min-h-9"
              >
                Unlink
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Add a relationship */}
      <div className="space-y-2 border-t border-border pt-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Link a contact</h4>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="rel-type" className="text-xs text-muted-foreground">Relationship</Label>
            <Select value={type} onValueChange={(v) => setType(v as RelationshipType)}>
              <SelectTrigger id="rel-type" className="h-10 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{RELATIONSHIP_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="rel-search" className="text-xs text-muted-foreground">Contact</Label>
            {selected ? (
              <div className="flex h-10 items-center justify-between gap-2 rounded-md border border-input bg-muted/40 px-3">
                <span className="truncate text-sm font-medium text-foreground">{selected.name}</span>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelected(null)} aria-label="Clear selected contact">
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  id="rel-search"
                  value={query}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="Search contacts by name…"
                  className="h-10"
                  autoComplete="off"
                />
                {query.trim().length >= 2 ? (
                  <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">
                    {searching ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
                    ) : results.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">No contacts found.</p>
                    ) : (
                      results.map((hit) => (
                        <Button
                          key={hit.id}
                          type="button"
                          variant="ghost"
                          onClick={() => pick(hit)}
                          className="h-auto w-full justify-start rounded-none px-3 py-2 text-sm font-normal"
                        >
                          {hit.name}
                        </Button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            disabled={pending || !selected}
            onClick={onAdd}
            className="min-h-11 shrink-0 sm:min-h-10"
          >
            Link
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Search by name and pick a contact. The reverse link is created on both records automatically.
        </p>
      </div>

      {note ? (
        <p className={cn('text-xs', note.tone === 'ok' ? 'text-success' : 'text-destructive')} role="status">
          {note.text}
        </p>
      ) : null}
    </div>
  )
}
