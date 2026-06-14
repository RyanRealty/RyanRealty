'use client'

import { useState } from 'react'
import { updateExpiredListingContact } from '@/app/actions/expired-listings'
import type { ExpiredListingRow as Row } from '@/app/actions/expired-listings'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { TableCell, TableRow } from '@/components/ui/table'

type Props = { row: Row }

function formatPrice(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatDate(s: string | null | undefined): string {
  if (!s) return '—'
  try {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString()
  } catch {
    return s
  }
}

/** Build search query: owner or list agent + address for contact lookup. */
function searchQuery(row: Row): string {
  const name = (row.owner_name ?? row.list_agent_name ?? '').trim()
  const addr = (row.full_address ?? '').trim()
  return [name, addr].filter(Boolean).join(' ')
}

function hasContact(row: Row): boolean {
  return Boolean(row.contact_phone || row.contact_email || row.contact_source)
}

/** Shared contact-edit state + persistence for both the mobile card and the desktop row. */
function useContactEditor(row: Row) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ownerName, setOwnerName] = useState(row.owner_name ?? '')
  const [contactPhone, setContactPhone] = useState(row.contact_phone ?? '')
  const [contactEmail, setContactEmail] = useState(row.contact_email ?? '')
  const [contactSource, setContactSource] = useState(row.contact_source ?? '')
  const [enrichmentNotes, setEnrichmentNotes] = useState(row.enrichment_notes ?? '')

  async function handleSave() {
    setSaving(true)
    try {
      const res = await updateExpiredListingContact(row.id, {
        owner_name: ownerName || null,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        contact_source: contactSource || null,
        enrichment_notes: enrichmentNotes || null,
      })
      if (res.ok) {
        setEditing(false)
        window.location.reload()
      }
    } finally {
      setSaving(false)
    }
  }

  return {
    editing,
    setEditing,
    saving,
    handleSave,
    ownerName,
    setOwnerName,
    contactPhone,
    setContactPhone,
    contactEmail,
    setContactEmail,
    contactSource,
    setContactSource,
    enrichmentNotes,
    setEnrichmentNotes,
  }
}

function ContactEditFields(e: ReturnType<typeof useContactEditor>) {
  return (
    <div className="flex flex-col gap-2">
      <Input
        type="text"
        value={e.ownerName}
        onChange={(ev) => e.setOwnerName(ev.target.value)}
        placeholder="Owner name (from tax / search)"
        className="h-11"
      />
      <Input
        type="text"
        value={e.contactPhone}
        onChange={(ev) => e.setContactPhone(ev.target.value)}
        placeholder="Phone"
        className="h-11"
      />
      <Input
        type="text"
        value={e.contactEmail}
        onChange={(ev) => e.setContactEmail(ev.target.value)}
        placeholder="Email"
        className="h-11"
      />
      <Input
        type="text"
        value={e.contactSource}
        onChange={(ev) => e.setContactSource(ev.target.value)}
        placeholder="Source (e.g. Facebook, White pages)"
        className="h-11"
      />
      <Textarea
        value={e.enrichmentNotes}
        onChange={(ev) => e.setEnrichmentNotes(ev.target.value)}
        placeholder="Notes"
        rows={2}
      />
      <div className="flex gap-2">
        <Button type="button" onClick={e.handleSave} disabled={e.saving} className="h-11 flex-1">
          {e.saving ? 'Saving…' : 'Save contact'}
        </Button>
        <Button
          type="button"
          onClick={() => e.setEditing(false)}
          variant="outline"
          className="h-11 flex-1"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

function SearchLinks({ row, compact }: { row: Row; compact?: boolean }) {
  const query = searchQuery(row)
  if (!query) return null
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
  const facebookUrl = `https://www.facebook.com/search/top?q=${encodeURIComponent(query)}`
  return (
    <>
      <Button asChild variant="outline" size={compact ? 'sm' : 'default'} className={compact ? '' : 'h-11 flex-1'}>
        <a href={googleUrl} target="_blank" rel="noopener noreferrer">
          Google
        </a>
      </Button>
      <Button asChild variant="outline" size={compact ? 'sm' : 'default'} className={compact ? '' : 'h-11 flex-1'}>
        <a href={facebookUrl} target="_blank" rel="noopener noreferrer">
          Facebook
        </a>
      </Button>
    </>
  )
}

/** Mobile card — one expired listing, scannable, thumb-first. */
export function ExpiredListingCard({ row }: Props) {
  const e = useContactEditor(row)

  return (
    <Card>
      <CardContent className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{row.full_address}</p>
          <p className="text-sm text-muted-foreground">{row.city ?? '—'}</p>
        </div>
        {row.standard_status ? (
          <Badge variant="destructive" className="shrink-0">
            {row.standard_status}
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">List price</p>
          <p className="font-medium tabular-nums text-foreground">{formatPrice(row.list_price)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Days on market</p>
          <p className="font-medium tabular-nums text-foreground">
            {row.days_on_market != null ? `${row.days_on_market} days` : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Expired</p>
          <p className="tabular-nums text-foreground">{formatDate(row.expired_at)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Owner</p>
          <p className="truncate text-foreground" title={row.owner_name ?? undefined}>
            {row.owner_name ?? '—'}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">List agent / office</p>
          <p className="truncate text-foreground">
            {row.list_agent_name ?? '—'}
            {row.list_office_name ? (
              <span className="text-muted-foreground"> · {row.list_office_name}</span>
            ) : null}
          </p>
        </div>
      </div>

      {e.editing ? (
        <div className="mt-4 border-t border-border pt-4">
          <ContactEditFields {...e} />
        </div>
      ) : (
        <>
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Contact</p>
            {hasContact(row) ? (
              <div className="mt-0.5 space-y-0.5 text-sm">
                {row.contact_phone ? <p className="text-foreground">{row.contact_phone}</p> : null}
                {row.contact_email ? <p className="text-muted-foreground">{row.contact_email}</p> : null}
                {row.contact_source ? (
                  <p className="text-muted-foreground">via {row.contact_source}</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">Not found yet</p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <SearchLinks row={row} />
            <Button
              type="button"
              onClick={() => e.setEditing(true)}
              variant="secondary"
              className="h-11 w-full"
            >
              {hasContact(row) ? 'Edit contact' : 'Add contact'}
            </Button>
          </div>
        </>
      )}
      </CardContent>
    </Card>
  )
}

/** Desktop table row — unchanged dense layout for md+ screens. */
export function ExpiredListingTableRow({ row }: Props) {
  const e = useContactEditor(row)

  return (
    <TableRow className="hover:bg-muted">
      <TableCell className="text-foreground">{row.full_address}</TableCell>
      <TableCell className="text-muted-foreground">{row.city ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground">
        {e.editing ? (
          <Input
            type="text"
            value={e.ownerName}
            onChange={(ev) => e.setOwnerName(ev.target.value)}
            placeholder="Owner (from tax/search)"
            className="w-full"
          />
        ) : (
          row.owner_name ?? '—'
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{row.list_agent_name ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground">{row.list_office_name ?? '—'}</TableCell>
      <TableCell className="tabular-nums text-muted-foreground">{formatPrice(row.list_price)}</TableCell>
      <TableCell className="tabular-nums text-muted-foreground">{row.days_on_market ?? '—'}</TableCell>
      <TableCell className="tabular-nums text-muted-foreground">{formatDate(row.expired_at)}</TableCell>
      <TableCell>
        {row.standard_status ? (
          <Badge variant="destructive">{row.standard_status}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {e.editing ? (
          <ContactEditFields {...e} />
        ) : (
          <div className="flex flex-col gap-0.5 text-sm">
            {row.contact_phone ? <span>{row.contact_phone}</span> : null}
            {row.contact_email ? <span className="text-muted-foreground">{row.contact_email}</span> : null}
            {row.contact_source ? <span className="text-muted-foreground">{row.contact_source}</span> : null}
            {!hasContact(row) ? <span className="text-muted-foreground">—</span> : null}
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          <SearchLinks row={row} compact />
          {!e.editing ? (
            <Button type="button" onClick={() => e.setEditing(true)} variant="ghost" size="sm">
              Edit
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  )
}
