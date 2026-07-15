// @no-parity — internal admin tool (FSBO Dashboard), no public mockup contract.
/**
 * FSBO Dashboard — every detected FSBO in one table: source + days listed,
 * owner + skip-trace contact, the prepared CMA, the intro SMS, and the
 * engagement trail (opens, clicks, document views, link taps). Mirrors
 * /admin/expireds; detection runs daily via /api/cron/detect-fsbo-listings.
 */

import Link from 'next/link'
import { listFsboDashboardRows } from '@/lib/data/fsbo/dashboard'
import { formatPriceExact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FsboActions } from '@/components/admin/fsbo/FsboActions.client'

export const dynamic = 'force-dynamic'

function Engagement({ n, label }: { n: number; label: string }) {
  return (
    <span className={`tabular-nums ${n > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
      {n} {label}
    </span>
  )
}

export default async function FsboDashboardPage() {
  const rows = await listFsboDashboardRows()
  const withCma = rows.filter((r) => r.cma_slug).length
  const contacted = rows.filter((r) => r.sms_sent_at || r.cma_delivered_at).length
  const engaged = rows.filter((r) => r.email_opens + r.email_clicks + r.sms_clicks + r.doc_views > 0).length

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-foreground">FSBOs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} detected · {withCma} CMAs prepared · {contacted} contacted · {engaged} engaged
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline" className="h-9">
            <Link href="/admin/expireds">Expireds</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-9">
            <Link href="/admin/cmas">All documents</Link>
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No FSBOs detected yet. Detection runs daily against Zillow for the service area (Bend, Redmond,
            Sisters, Sunriver, Tumalo, La Pine) at the $500K+ price floor. New detections land here with the
            owner skip-traced, a CRM record created, and a CMA queued.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Property</th>
                  <th className="px-3 py-2.5 font-medium">Owner</th>
                  <th className="px-3 py-2.5 text-right font-medium">Asking</th>
                  <th className="px-3 py-2.5 font-medium">CMA</th>
                  <th className="px-3 py-2.5 font-medium">Contacted</th>
                  <th className="px-3 py-2.5 font-medium">Engagement</th>
                  <th className="px-3 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const anyEngagement = r.email_opens + r.email_clicks + r.sms_clicks + r.doc_views > 0
                  return (
                    <tr key={r.fsbo_url} className="align-top">
                      <td className="px-3 py-2.5">
                        <a href={r.fsbo_url} target="_blank" rel="noreferrer" className="font-medium text-foreground underline-offset-2 hover:underline">
                          {r.street_address ?? r.full_address ?? r.fsbo_url}
                        </a>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {r.city ?? ''} · {r.fsbo_source ?? 'zillow'}
                          {r.days_listed != null ? ` · ${r.days_listed} days listed` : ''}
                          {r.status === 'gone' ? <Badge variant="outline" className="ml-1.5 px-1 py-0 text-[10px]">off market</Badge> : null}
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
                        {r.cma_slug ? (
                          <>
                            <Link href={`/admin/cmas/${r.cma_slug}`} className="font-medium text-foreground underline-offset-2 hover:underline">
                              {r.cma_needs_review ? 'needs review' : (r.cma_status ?? 'draft')}
                            </Link>
                            {r.cma_recommended ? (
                              <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">rec {formatPriceExact(r.cma_recommended)}</div>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">none</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {r.cma_delivered_at ? <div>email {formatDate(r.cma_delivered_at)}</div> : null}
                        {r.sms_sent_at ? <div>text {formatDate(r.sms_sent_at)}</div> : null}
                        {!r.cma_delivered_at && !r.sms_sent_at ? 'not yet' : null}
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
                        <FsboActions
                          fsboUrl={r.fsbo_url}
                          hasCma={!!r.cma_slug}
                          needsReview={r.cma_needs_review}
                          hasEmail={!!r.contact_email}
                          hasPhone={!!r.contact_phone}
                          hardStop={r.hard_stop}
                          smsSentAt={r.sms_sent_at}
                          emailSentAt={r.cma_delivered_at}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
