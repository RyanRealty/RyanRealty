// @no-parity — internal admin tool (expired-outreach send queue), no public mockup contract.
/**
 * Expired-listing outreach queue — manual approve-and-send (Matt directive
 * 2026-07-11: nothing texts an expired owner without a broker's click).
 *
 * Sections:
 *  1. Sendable — non-DNC phone, no hard-stop, not re-listed, not yet sent.
 *     Each row shows the owner, property, CMA state, and a guarded Send.
 *  2. Sent — intro delivered, awaiting reply (CMA goes out on a "yes").
 *  3. Excluded — hard-stops (never contact) and re-listed (never solicit),
 *     shown so exclusions are visible, not silent.
 */

import Link from 'next/link'
import { listExpiredOutreachQueue, type ExpiredOutreachRow } from '@/lib/data'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExpiredOutreachSendButton } from '@/components/admin/expired/ExpiredOutreachRow.client'

export const dynamic = 'force-dynamic'

const SELL_URL = 'ryan-realty.com/sell'

function maskPhone(p: string | null): string {
  if (!p) return '—'
  const digits = p.replace(/\D/g, '').slice(-10)
  return digits.length === 10 ? `(${digits.slice(0, 3)}) •••-${digits.slice(6)}` : '•••'
}

function fmtPrice(n: number | null): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

/** The exact template body (kept in crm_templates; duplicated here only for the
 *  row preview string — the send path reads the template from the DB). */
function previewBody(address: string): string {
  return `Hi, Matt with Ryan Realty. I saw ${address} came off the market without selling. If you ever decide to try again, we would love to earn your business. Would it be ok if I sent over a market analysis I put together for ${address}? A little about us: ${SELL_URL}`
}

function cmaChip(row: ExpiredOutreachRow) {
  if (!row.cma_slug) return <Badge variant="outline">no CMA</Badge>
  if (row.cma_needs_review)
    return (
      <Badge variant="destructive" title="Comp set flagged by the accuracy pipeline — review before sending the CMA.">
        CMA needs review
      </Badge>
    )
  return (
    <Badge variant="secondary" className="capitalize">
      CMA {row.cma_status ?? 'draft'} · {fmtPrice(row.cma_recommended)}
    </Badge>
  )
}

export default async function ExpiredOutreachPage() {
  const rows = await listExpiredOutreachQueue()
  const sendable = rows.filter((r) => r.contact_phone && !r.hard_stop && !r.relisted && !r.outreach_sms_sent_at)
  const sent = rows.filter((r) => r.outreach_sms_sent_at)
  const excluded = rows.filter((r) => r.hard_stop || r.relisted)
  const noContact = rows.filter((r) => !r.contact_phone && !r.hard_stop && !r.relisted && !r.outreach_sms_sent_at)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-display text-3xl text-foreground">Expired outreach</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One intro text per owner, sent by you. Guards re-run at send time: re-listed properties and
          hard-stop contacts never send, quiet hours are enforced, and the CMA only goes out after a reply.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums">{sendable.length}</div>
            <div className="text-xs text-muted-foreground">Ready to send</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums">{sent.length}</div>
            <div className="text-xs text-muted-foreground">Sent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums">{excluded.length}</div>
            <div className="text-xs text-muted-foreground">Excluded (hard-stop / re-listed)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums">{noContact.length}</div>
            <div className="text-xs text-muted-foreground">No phone on file</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ready to send ({sendable.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sendable.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing sendable right now.</p>
          ) : (
            sendable.map((r) => (
              <div key={r.listing_key} className="flex flex-col gap-3 rounded-xl border border-border p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {r.street_address}, {r.city}
                    </span>
                    <Badge variant="outline" className="capitalize">
                      {r.standard_status?.toLowerCase() ?? 'off market'} · was {fmtPrice(r.list_price)}
                    </Badge>
                    {cmaChip(r)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {r.owner_name ?? 'Owner on file'} · {maskPhone(r.contact_phone)}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{previewBody(r.street_address)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button asChild size="sm" variant="ghost" className="h-11">
                    <Link href={`/admin/expired-listings/${encodeURIComponent(r.listing_key)}`}>Listing</Link>
                  </Button>
                  {r.cma_slug ? (
                    <Button asChild size="sm" variant="outline" className="h-11">
                      <Link href={`/admin/cmas/${r.cma_slug}`}>CMA</Link>
                    </Button>
                  ) : null}
                  <ExpiredOutreachSendButton
                    listingKey={r.listing_key}
                    address={`${r.street_address}, ${r.city}`}
                    phoneMasked={maskPhone(r.contact_phone)}
                    previewBody={previewBody(r.street_address)}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sent ({sent.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No intros sent yet.</p>
          ) : (
            sent.map((r) => (
              <div key={r.listing_key} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-foreground">
                    {r.street_address}, {r.city}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    sent {r.outreach_sms_sent_at?.slice(0, 10)} · {r.owner_name ?? '—'}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {cmaChip(r)}
                  {r.outreach_crm_person_id ? (
                    <Button asChild size="sm" variant="outline" className="h-11">
                      <Link href={`/admin/crm/${r.outreach_crm_person_id}`}>Contact</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Excluded ({excluded.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {excluded.map((r) => (
            <div key={r.listing_key} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
              <span className="min-w-0 truncate text-foreground">
                {r.street_address}, {r.city}
              </span>
              <div className="flex shrink-0 gap-2">
                {r.relisted ? <Badge variant="destructive">re-listed</Badge> : null}
                {r.hard_stop ? <Badge variant="destructive">hard stop</Badge> : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
