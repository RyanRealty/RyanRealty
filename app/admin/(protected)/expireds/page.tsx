// @no-parity — internal admin tool (Expireds Dashboard), no public mockup contract.
/**
 * Expireds Dashboard — every expired listing in one table: skip-trace status,
 * the expired audit (built / needs review / sent), the intro SMS, and the
 * engagement trail (email opens + clicks, SMS link clicks, audit-document
 * views). Build + approve-and-send per row. Companion surfaces: the SMS queue
 * at /admin/expired-outreach and the per-listing review page.
 */

import Link from 'next/link'
import { listExpiredDashboardRows } from '@/lib/data/expired/dashboard'
import { formatPriceExact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ExpiredAuditActions } from '@/components/admin/expired/ExpiredAuditActions.client'

export const dynamic = 'force-dynamic'

function Engagement({ n, label }: { n: number; label: string }) {
  return (
    <span className={`tabular-nums ${n > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
      {n} {label}
    </span>
  )
}

export default async function ExpiredsDashboardPage() {
  const rows = await listExpiredDashboardRows()
  const withAudit = rows.filter((r) => r.audit_slug && r.audit_doc_type === 'expired-audit').length
  const sent = rows.filter((r) => r.email_sent_at || r.sms_sent_at).length
  const engaged = rows.filter((r) => r.email_opens + r.email_clicks + r.sms_clicks + r.doc_views > 0).length

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-foreground">Expireds</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} expired listings · {withAudit} audits built · {sent} contacted · {engaged} engaged
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline" className="h-9">
            <Link href="/admin/expired-outreach">SMS queue</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-9">
            <Link href="/admin/cmas">All documents</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Property</th>
                <th className="px-3 py-2.5 font-medium">Owner</th>
                <th className="px-3 py-2.5 text-right font-medium">Was asking</th>
                <th className="px-3 py-2.5 font-medium">Audit</th>
                <th className="px-3 py-2.5 font-medium">Contacted</th>
                <th className="px-3 py-2.5 font-medium">Engagement</th>
                <th className="px-3 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const isAuditDoc = r.audit_doc_type === 'expired-audit'
                const anyEngagement = r.email_opens + r.email_clicks + r.sms_clicks + r.doc_views > 0
                return (
                  <tr key={r.listing_key} className="align-top">
                    <td className="px-3 py-2.5">
                      <Link href={`/admin/expired-listings/${encodeURIComponent(r.listing_key)}`} className="font-medium text-foreground underline-offset-2 hover:underline">
                        {r.street_address ?? r.full_address}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {r.city ?? ''} · off market {formatDate(r.expired_at)}
                        {r.hard_stop ? <Badge variant="destructive" className="ml-1.5 px-1 py-0 text-[10px]">hard stop</Badge> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-foreground">{r.owner_name ?? 'unknown'}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {r.contact_phone ? 'phone' : null}
                        {r.contact_phone && r.contact_email ? ' · ' : null}
                        {r.contact_email ? 'email' : null}
                        {!r.contact_phone && !r.contact_email ? 'no contact found' : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatPriceExact(r.list_price)}</td>
                    <td className="px-3 py-2.5">
                      {r.audit_slug && isAuditDoc ? (
                        <>
                          <Link href={`/admin/cmas/${r.audit_slug}`} className="font-medium text-foreground underline-offset-2 hover:underline">
                            {r.audit_needs_review ? 'needs review' : (r.audit_status ?? 'draft')}
                          </Link>
                          {r.audit_recommended ? (
                            <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">rec {formatPriceExact(r.audit_recommended)}</div>
                          ) : null}
                        </>
                      ) : r.audit_slug ? (
                        <span className="text-xs text-muted-foreground">plain CMA</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">none</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {r.email_sent_at ? <div>email {formatDate(r.email_sent_at)}</div> : null}
                      {r.sms_sent_at ? <div>text {formatDate(r.sms_sent_at)}</div> : null}
                      {!r.email_sent_at && !r.sms_sent_at ? 'not yet' : null}
                    </td>
                    <td className={`px-3 py-2.5 text-xs ${anyEngagement ? '' : 'text-muted-foreground'}`}>
                      <div className="flex flex-wrap gap-x-2">
                        <Engagement n={r.email_opens} label="opens" />
                        <Engagement n={r.email_clicks} label="clicks" />
                        <Engagement n={r.doc_views} label="views" />
                        <Engagement n={r.sms_clicks} label="taps" />
                      </div>
                      {r.last_engagement_at ? (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">last {formatDate(r.last_engagement_at)}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <ExpiredAuditActions
                        listingKey={r.listing_key}
                        hasAudit={!!r.audit_slug}
                        isAuditDoc={isAuditDoc}
                        needsReview={r.audit_needs_review}
                        hasEmail={!!r.contact_email}
                        hardStop={r.hard_stop}
                        emailSentAt={r.email_sent_at}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
