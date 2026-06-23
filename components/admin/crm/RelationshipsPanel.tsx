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
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { linkContacts, unlinkContacts } from '@/app/actions/crm-relationships'
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
  const [relatedId, setRelatedId] = useState('')
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<Note>(null)

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
    const toPersonId = Number(relatedId.trim())
    if (!Number.isInteger(toPersonId) || toPersonId <= 0) {
      setNote({ tone: 'err', text: 'Enter the related contact id (a positive whole number).' })
      return
    }
    if (toPersonId === personId) {
      setNote({ tone: 'err', text: 'A contact cannot be linked to itself.' })
      return
    }
    // Temporary client row reflects the new link until the next server load
    // (the action writes the real reciprocal + snapshot name server-side).
    const optimistic: ContactRelationship = {
      id: -toPersonId,
      relatedPersonId: toPersonId,
      name: `Contact #${toPersonId}`,
      type,
      label: RELATIONSHIP_LABELS[type],
    }
    dispatch(
      () => {
        setRows((rs) => [...rs, optimistic])
        setRelatedId('')
      },
      () => setRows((rs) => rs.filter((r) => r.id !== optimistic.id)),
      () => linkContacts({ fromPersonId: personId, toPersonId, type }),
      `Linked Contact #${toPersonId} as ${RELATIONSHIP_LABELS[type]}`,
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
            <Label htmlFor="rel-id" className="text-xs text-muted-foreground">Related contact id</Label>
            <Input
              id="rel-id"
              type="number"
              inputMode="numeric"
              value={relatedId}
              onChange={(e) => setRelatedId(e.target.value)}
              placeholder="e.g. 4821"
              className="h-10 tabular-nums"
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={onAdd}
            className="min-h-11 shrink-0 sm:min-h-10"
          >
            Link
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Use the related contact&apos;s id (the number in their profile url). The reverse link is created on both records automatically.
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
