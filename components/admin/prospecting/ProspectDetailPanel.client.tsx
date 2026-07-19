'use client'

/**
 * ProspectDetailPanel — the shared review-detail CONTENT (spec 07 §2). This
 * single component renders inside both breakpoints of ProspectDetailDrawer
 * (mobile Sheet, desktop in-flow aside) so there is exactly one detail tree,
 * never a mobile/desktop fork.
 *
 * "Send" always opens the compose dialog (onOpenSend) rather than firing a
 * send directly — the dialog is where the broker reviews/edits the merged
 * body before a compliance-sensitive cold send goes out (spec §5.1/§5.3).
 */

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { ProspectDetail } from '@/lib/data/prospecting/types'
import { ProspectComplianceRibbon } from './ProspectComplianceRibbon.client'
import { ProspectDocPill } from './ProspectDocPill.client'
import { ProspectMap } from './ProspectMap.client'
import { ProspectPriceHistory } from './ProspectPriceHistory.client'
import { formatDate, formatInt, formatPrice } from './format'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium tabular-nums text-foreground">{value}</div>
    </div>
  )
}

export function ProspectDetailPanel({
  detail,
  onBuild,
  onSend,
  onOpenSend,
}: {
  detail: ProspectDetail
  onBuild: (id: string) => void
  onSend: (id: string) => void
  onOpenSend: () => void
}) {
  // Accepted for prop-shape parity with ProspectCard's state machine — this
  // panel routes every send through the compose dialog (onOpenSend), never a
  // direct fire-and-forget send, so onSend is not invoked here.
  void onSend

  const showRibbon =
    detail.compliance.hardStop ||
    detail.compliance.relisted ||
    detail.compliance.offMarket ||
    detail.compliance.noPhone ||
    detail.compliance.suppressedSms

  const hasEngagement =
    detail.engagement.reportViews > 0 ||
    detail.engagement.linkTaps > 0 ||
    detail.engagement.emailOpens > 0 ||
    detail.engagement.emailClicks > 0

  const dateLabel = detail.kind === 'expired' ? 'Expired' : 'Detected'
  const dateValue = detail.kind === 'expired' ? detail.expiredAt : detail.detectedAt
  const crmHref = detail.personId ? `/admin/crm/${detail.personId}` : null

  return (
    <div className="space-y-5">
      {/* Hero photo + map */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="aspect-[4/3] overflow-hidden rounded-lg bg-muted">
          {detail.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- MLS/CDN photo hosts vary per listing; plain <img> avoids next/image remote-domain allowlisting for this admin-only surface.
            <img
              src={detail.photoUrl}
              alt={detail.fullAddress ?? 'Property photo'}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">No photo</p>
            </div>
          )}
        </div>
        <div className="aspect-[4/3] overflow-hidden rounded-lg">
          <ProspectMap lat={detail.latitude} lng={detail.longitude} address={detail.fullAddress} className="h-full" />
        </div>
      </div>

      {/* Identity */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{detail.ownerName ?? 'Owner unknown'}</h2>
        <p className="text-sm text-muted-foreground">
          {/* fullAddress already includes city + zip; only compose from parts when it is absent. */}
          {detail.fullAddress ??
            ([detail.streetAddress, detail.city, detail.postalCode].filter(Boolean).join(', ') || '—')}
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {detail.listPrice != null ? `Was ${formatPrice(detail.listPrice)}` : null}
          {dateValue ? ` · ${dateLabel} ${formatDate(dateValue)}` : ''}
        </p>
      </div>

      {showRibbon ? <ProspectComplianceRibbon compliance={detail.compliance} /> : null}

      <div className="flex items-center gap-2">
        <ProspectDocPill doc={detail.doc} />
      </div>

      <Separator />

      {/* Specs */}
      <div className="space-y-2">
        <SectionLabel>Property</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Spec label="Beds" value={detail.bedrooms != null ? String(detail.bedrooms) : '—'} />
          <Spec label="Baths" value={detail.bathrooms != null ? String(detail.bathrooms) : '—'} />
          <Spec label="Sq ft" value={detail.sqft != null ? formatInt(detail.sqft) : '—'} />
          <Spec label="Year built" value={detail.yearBuilt != null ? String(detail.yearBuilt) : '—'} />
          <Spec label="Lot (acres)" value={detail.lotAcres != null ? detail.lotAcres.toFixed(2) : '—'} />
          <Spec label="Garage" value={detail.garageSpaces != null ? String(detail.garageSpaces) : '—'} />
        </div>
        {detail.subdivision ? <p className="text-xs text-muted-foreground">{detail.subdivision}</p> : null}
        {detail.viewDescription ? <p className="text-xs text-muted-foreground">View: {detail.viewDescription}</p> : null}
      </div>

      <Separator />

      {/* Price history */}
      <div className="space-y-2">
        <SectionLabel>Price history</SectionLabel>
        <ProspectPriceHistory cycles={detail.priceHistory} />
      </div>

      {/* Engagement */}
      {hasEngagement ? (
        <>
          <Separator />
          <div className="space-y-2">
            <SectionLabel>Engagement</SectionLabel>
            <p className="text-sm tabular-nums text-foreground">
              {detail.engagement.reportViews} report views · {detail.engagement.linkTaps} link taps ·{' '}
              {detail.engagement.emailOpens} email opens · {detail.engagement.emailClicks} email clicks
            </p>
            {detail.engagement.lastActivityAt ? (
              <p className="text-xs text-muted-foreground">Last activity {formatDate(detail.engagement.lastActivityAt)}</p>
            ) : null}
          </div>
        </>
      ) : null}

      {/* Prior list agent/office */}
      {detail.priorListAgentName || detail.priorListOfficeName ? (
        <div className="space-y-1">
          <SectionLabel>Prior listing</SectionLabel>
          <p className="text-sm text-foreground">
            {detail.priorListAgentName ?? '—'}
            {detail.priorListOfficeName ? ` · ${detail.priorListOfficeName}` : ''}
          </p>
        </div>
      ) : null}

      <Separator />

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {detail.doc.state === 'none' ? (
          <Button className="h-11 flex-1" onClick={() => onBuild(detail.id)}>
            Build audit
          </Button>
        ) : detail.doc.state === 'building' ? (
          <Button className="h-11 flex-1" disabled aria-busy>
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Building…
            </span>
          </Button>
        ) : detail.doc.state === 'failed' ? (
          <Button variant="outline" className="h-11 flex-1" onClick={() => onBuild(detail.id)}>
            Retry build
          </Button>
        ) : detail.doc.state === 'ready' && detail.sendable ? (
          <Button className="h-11 flex-1" onClick={onOpenSend}>
            Send intro
          </Button>
        ) : null}
        {crmHref ? (
          <Button variant="outline" className="h-11 flex-1" asChild>
            <Link href={crmHref}>Open in CRM</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
