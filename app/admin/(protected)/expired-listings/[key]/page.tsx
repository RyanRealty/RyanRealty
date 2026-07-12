// @no-parity — internal admin tool (expired-listing detail), no public mockup contract.
/**
 * Expired-listing detail — everything a broker needs to review one expired
 * owner before outreach: the listing history (original vs last ask, DOM, prior
 * agent/office), the owner + skip-trace contact with compliance flags, and
 * jump links to the CMA and the CRM contact record. Reached from the CMA list
 * and the outreach queue.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getExpiredListingDetail } from '@/lib/data'
import { formatPriceExact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

function fmtPrice(n: number | null): string {
  return formatPriceExact(n)
}
function fmtDate(iso: string | null): string {
  return formatDate(iso)
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

export default async function ExpiredListingDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const r = await getExpiredListingDetail(decodeURIComponent(key))
  if (!r) notFound()

  const drop =
    r.original_list_price && r.list_price && r.original_list_price > r.list_price
      ? r.original_list_price - r.list_price
      : null

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <Button asChild size="sm" variant="outline" className="mb-3 h-9">
          <Link href="/admin/expired-outreach">← Outreach queue</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-3xl text-foreground">{r.full_address}</h1>
          <Badge variant="outline" className="capitalize">
            {r.standard_status?.toLowerCase() ?? 'off market'}
          </Badge>
          {r.relisted ? <Badge variant="destructive">re-listed</Badge> : null}
          {r.hard_stop ? <Badge variant="destructive">hard stop</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {r.subdivision ? `${r.subdivision} · ` : ''}
          {r.bedrooms ?? '—'} bd · {r.bathrooms ?? '—'} ba · {r.sqft ? `${r.sqft.toLocaleString()} sqft` : '— sqft'}
          {r.list_number ? ` · MLS ${r.list_number}` : ''}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {r.cma_slug ? (
          <Button asChild size="sm" className="h-11">
            <Link href={`/admin/cmas/${r.cma_slug}`}>Open CMA</Link>
          </Button>
        ) : (
          <Badge variant="outline" className="self-center">no CMA yet</Badge>
        )}
        {r.crm_person_id ? (
          <Button asChild size="sm" variant="outline" className="h-11">
            <Link href={`/admin/crm/${r.crm_person_id}`}>Client record</Link>
          </Button>
        ) : (
          <Badge variant="outline" className="self-center">no CRM contact yet (created on first text)</Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Listing history</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <Row label="Last list price" value={fmtPrice(r.list_price)} />
            <Row label="Original list price" value={fmtPrice(r.original_list_price)} />
            <Row
              label="Price cut"
              value={
                drop != null
                  ? `${fmtPrice(drop)} (${Math.round((drop / (r.original_list_price ?? 1)) * 100)}%)`
                  : 'none'
              }
            />
            <Row label="Days on market" value={r.days_on_market != null ? `${r.days_on_market} days` : '—'} />
            <Row
              label="Cumulative DOM"
              value={r.cumulative_days_on_market != null ? `${r.cumulative_days_on_market} days` : '—'}
            />
            <Row label="Came off market" value={fmtDate(r.status_change_timestamp ?? r.expired_at)} />
            <Row label="Detected" value={fmtDate(r.detected_at)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prior listing</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <Row label="Listing agent" value={r.list_agent_name ?? '—'} />
            <Row label="Agent email" value={r.list_agent_email ?? '—'} />
            <Row label="Office" value={r.list_office_name ?? '—'} />
            <Row label="Property type" value={r.property_type ?? '—'} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Owner & contact</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <Row label="Owner (county record)" value={r.owner_name ?? '—'} />
          <Row label="Phone" value={r.contact_phone ?? '—'} />
          <Row label="Email" value={r.contact_email ?? '—'} />
          <Row label="Contact source" value={r.contact_source ?? '—'} />
          <Row label="Skip-trace status" value={r.owner_lookup_status ?? '—'} />
          <Row label="Intro text sent" value={r.outreach_sms_sent_at ? fmtDate(r.outreach_sms_sent_at) : 'not yet'} />
          {r.hard_stop ? (
            <div className="pt-2 text-sm text-destructive">
              Hard-stop contact (litigator / TCPA / deceased flag). Do not text or call.
            </div>
          ) : null}
          {r.enrichment_notes ? (
            <div className="pt-2 text-xs text-muted-foreground">{r.enrichment_notes}</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
