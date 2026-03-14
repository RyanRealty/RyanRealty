'use client'

import { useState } from 'react'
import { updateExpiredListingContact } from '@/app/actions/expired-listings'
import type { ExpiredListingRow as Row } from '@/app/actions/expired-listings'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { TableCell, TableRow } from "@/components/ui/table"

type Props = { row: Row }

function formatPrice(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
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

export function ExpiredListingRow({ row }: Props) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ownerName, setOwnerName] = useState(row.owner_name ?? '')
  const [contactPhone, setContactPhone] = useState(row.contact_phone ?? '')
  const [contactEmail, setContactEmail] = useState(row.contact_email ?? '')
  const [contactSource, setContactSource] = useState(row.contact_source ?? '')
  const [enrichmentNotes, setEnrichmentNotes] = useState(row.enrichment_notes ?? '')

  const query = searchQuery(row)
  const googleUrl = query ? `https://www.google.com/search?q=${encodeURIComponent(query)}` : null
  const facebookUrl = query ? `https://www.facebook.com/search/top?q=${encodeURIComponent(query)}` : null

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

  return (
    <TableRow className="hover:bg-muted">
      <TableCell className="text-foreground">{row.full_address}</TableCell>
      <TableCell className="text-muted-foreground">{row.city ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground">
        {editing ? (
          <Input
            type="text"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Owner (from tax/search)"
            className="w-full max-w-[140px]"
          />
        ) : (
          row.owner_name ?? '—'
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{row.list_agent_name ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground">{row.list_office_name ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground">{formatPrice(row.list_price)}</TableCell>
      <TableCell className="text-muted-foreground">{row.days_on_market ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground">{formatDate(row.expired_at)}</TableCell>
      <TableCell className="text-muted-foreground">{row.standard_status ?? '—'}</TableCell>
      <TableCell>
        {editing ? (
          <div className="flex flex-col gap-1 text-sm">
            <Input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="Phone"
            />
            <Input
              type="text"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Email"
            />
            <Input
              type="text"
              value={contactSource}
              onChange={(e) => setContactSource(e.target.value)}
              placeholder="Source (e.g. Facebook, White pages)"
            />
            <Textarea
              value={enrichmentNotes}
              onChange={(e) => setEnrichmentNotes(e.target.value)}
              placeholder="Notes"
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                size="sm"
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button
                type="button"
                onClick={() => setEditing(false)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 text-sm">
            {row.contact_phone && <span>{row.contact_phone}</span>}
            {row.contact_email && <span className="text-muted-foreground">{row.contact_email}</span>}
            {row.contact_source && <span className="text-muted-foreground">{row.contact_source}</span>}
            {!row.contact_phone && !row.contact_email && !row.contact_source && <span className="text-muted-foreground">—</span>}
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {googleUrl && (
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-border"
            >
              Google
            </a>
          )}
          {facebookUrl && (
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-border"
            >
              Facebook
            </a>
          )}
          {!editing && (
            <Button
              type="button"
              onClick={() => setEditing(true)}
              variant="ghost"
              size="sm"
            >
              Edit
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
