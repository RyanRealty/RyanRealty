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
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md). Badge
 * → the tenure chip recipe, Separator → a hairline div, AlertDialog → the base
 * v2 <Dialog> (not <ConfirmDialog>: enrolling is not a destructive act and the
 * language reserves red for danger), and "Review audit"/"Open in CRM" are real
 * <Link>s carrying the av2-btn classes because the v2 Button has no `asChild` —
 * the same call recorded in the sibling BpoDetailPanel.
 *
 * ONE primary Button per file (the locked "exactly one primary action per
 * view"), and it is the drip confirm: every button in the action row is a
 * TRIGGER — Send opens the compose dialog, Enroll opens this confirm, Build
 * queues a background build — while the confirm is the only place this file
 * commits an act. Same resolution already recorded in NewsletterDraftActions.
 * Quiet buttons still carry accent text, a border, hover and press, so no
 * affordance was deleted; only the fill moved.
 *
 * Everything else is byte-for-byte: the same server action, the same
 * display-only gating, the same strings, the same disabled/title logic.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Dialog, TextField } from '@/components/admin/v2'
import {
  attachProspectPersonAction,
  enrollProspectInDripAction,
  searchProspectPersonAction,
} from '@/app/actions/prospecting'
import {
  canOpenProspectSend,
  prospectDripBlockedReason,
  shouldHideProspectEnroll,
} from '@/lib/data/prospecting/enroll-ui'
import { PROSPECT_CHANNELS, type ProspectDetail } from '@/lib/data/prospecting/types'
import { ProspectComplianceRibbon } from './ProspectComplianceRibbon.client'
import { ProspectDocPill } from './ProspectDocPill.client'
import { ProspectMap } from './ProspectMap.client'
import { ProspectPriceHistory } from './ProspectPriceHistory.client'
import { formatDate, formatInt, formatPrice } from './format'

const dividerStyle: CSSProperties = { borderTop: '1px solid var(--a-border)' }
const badgeStyle: CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-sm)',
  padding: '1px 6px',
}
const quietTextStyle: CSSProperties = { fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 'var(--a-text-xs)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '.05em',
        color: 'var(--a-text-2)',
      }}
    >
      {children}
    </h3>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>{label}</div>
      <div className="a-num" style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
        {value}
      </div>
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

  const router = useRouter()
  const [confirmEnroll, setConfirmEnroll] = useState(false)
  const [enrolling, startEnroll] = useTransition()
  const [personQuery, setPersonQuery] = useState('')
  const [personHits, setPersonHits] = useState<Array<{ id: number; name: string | null; email: string | null }>>([])
  const [linkingPerson, startLinkPerson] = useTransition()

  // Display-only gating — the server action re-runs every guard at click time.
  // Relisted / off-market hard-skip matches Send (Aberdeen class).
  const dripBlockedReason = prospectDripBlockedReason({
    compliance: detail.compliance,
    drip: detail.drip,
    personId: detail.personId,
  })
  const hideEnroll = shouldHideProspectEnroll({
    compliance: detail.compliance,
    drip: detail.drip,
    personId: detail.personId,
  })

  function runEnroll() {
    const personId = detail.personId
    if (personId == null) return
    startEnroll(async () => {
      const res = await enrollProspectInDripAction(personId, detail.kind, detail.id)
      if (res.ok) {
        toast.success(`Enrolled in ${res.sequence}.`)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  const showRibbon =
    detail.compliance.allChannelsBlocked ||
    detail.compliance.relisted ||
    detail.compliance.offMarket ||
    PROSPECT_CHANNELS.some((c) => detail.compliance.channels[c].blocked)

  const canOpenSend = canOpenProspectSend({
    compliance: detail.compliance,
    personId: detail.personId,
  })

  const hasEngagement =
    detail.engagement.reportViews > 0 ||
    detail.engagement.linkTaps > 0 ||
    detail.engagement.emailOpens > 0 ||
    detail.engagement.emailClicks > 0

  const dateLabel = detail.kind === 'expired' ? 'Expired' : 'Detected'
  const dateValue = detail.kind === 'expired' ? detail.expiredAt : detail.detectedAt
  const crmHref = detail.personId ? `/admin/people/${detail.personId}` : null

  return (
    <div className="space-y-5">
      {/* Hero photo + map */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div
          className="aspect-[4/3] overflow-hidden rounded-lg"
          style={{ minWidth: 0, background: 'var(--a-inset)' }}
        >
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
              <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>No photo</p>
            </div>
          )}
        </div>
        <div className="aspect-[4/3] overflow-hidden rounded-lg" style={{ minWidth: 0 }}>
          <ProspectMap lat={detail.latitude} lng={detail.longitude} address={detail.fullAddress} className="h-full" />
        </div>
      </div>

      {/* Identity — the owner name IS the door to their person page (Matt
          2026-08-05: "I should be able to click on that owner's name"). */}
      <div className="space-y-1">
        {detail.personId ? (
          <Link
            href={`/admin/people/${detail.personId}`}
            className="underline-offset-4 hover:underline"
            style={{ fontSize: 'var(--a-text-lg)', fontWeight: 600, color: 'var(--a-text)' }}
          >
            {detail.ownerName ?? 'Owner unknown'}
          </Link>
        ) : (
          <h2 style={{ fontSize: 'var(--a-text-lg)', fontWeight: 600, color: 'var(--a-text)' }}>
            {detail.ownerName ?? 'Owner unknown'}
          </h2>
        )}
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          {/* fullAddress already includes city + zip; only compose from parts when it is absent. */}
          {detail.fullAddress ??
            ([detail.streetAddress, detail.city, detail.postalCode].filter(Boolean).join(', ') || '—')}
        </p>
        <p className="a-num" style={quietTextStyle}>
          {detail.listPrice != null ? `Was ${formatPrice(detail.listPrice)}` : null}
          {dateValue ? ` · ${dateLabel} ${formatDate(dateValue)}` : ''}
        </p>
        {detail.personId == null ? (
          <div className="space-y-2" style={{ paddingTop: 8 }}>
            <p style={quietTextStyle}>
              No CRM contact linked. Attach one before send or drip — owner unknown blocks email
              compose (Nugget / Covina class).
            </p>
            <TextField
              label="Find person"
              value={personQuery}
              onChange={(e) => setPersonQuery(e.target.value)}
              hint="Name, at least two characters."
            />
            <Button
              type="button"
              variant="quiet"
              disabled={linkingPerson || personQuery.trim().length < 2}
              onClick={() => {
                startLinkPerson(async () => {
                  const { data, error } = await searchProspectPersonAction(personQuery)
                  if (error) toast.error(error)
                  else setPersonHits(data)
                })
              }}
            >
              Search people
            </Button>
            {personHits.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {personHits.map((hit) => (
                  <li key={hit.id} style={{ marginBottom: 6 }}>
                    <Button
                      type="button"
                      variant="quiet"
                      className="w-full"
                      disabled={linkingPerson}
                      onClick={() => {
                        startLinkPerson(async () => {
                          const { data, error } = await attachProspectPersonAction({
                            kind: detail.kind,
                            prospectId: detail.id,
                            personId: hit.id,
                          })
                          if (error || !data) {
                            toast.error(error ?? 'Could not link this person.')
                            return
                          }
                          setPersonHits([])
                          setPersonQuery('')
                          toast.success(`Linked to ${data.personName ?? hit.name ?? `people/${hit.id}`}.`)
                          router.refresh()
                        })
                      }}
                    >
                      {hit.name ?? `people/${hit.id}`}
                      {hit.email ? ` · ${hit.email}` : ''}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {showRibbon ? <ProspectComplianceRibbon compliance={detail.compliance} personId={detail.personId} /> : null}

      <div className="flex items-center gap-2">
        <ProspectDocPill doc={detail.doc} />
        {/* Direct door to the audit itself (Matt 2026-08-05: "no way for me to
            immediately see the audits") — admin review page for the built doc. */}
        {detail.doc.state === 'ready' || detail.doc.state === 'sent' ? (
          <Link
            href={`/admin/cmas/${detail.doc.slug}`}
            className="av2-btn av2-btn--quiet"
            style={{ textDecoration: 'none' }}
          >
            Review audit
          </Link>
        ) : null}
        {/* Tenure chip — shown only when a source proves the date (DAL
            deriveOwnershipSince). 0 = proven but under a year. */}
        {detail.ownershipYears != null ? (
          <span className="a-num" style={badgeStyle}>
            {detail.ownershipYears >= 1
              ? `Owned ${detail.ownershipYears} ${detail.ownershipYears === 1 ? 'year' : 'years'}`
              : 'Owned under a year'}
          </span>
        ) : null}
      </div>

      <div style={dividerStyle} />

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
        {detail.subdivision ? <p style={quietTextStyle}>{detail.subdivision}</p> : null}
        {detail.viewDescription ? (
          <p style={quietTextStyle}>View: {detail.viewDescription}</p>
        ) : null}
      </div>

      <div style={dividerStyle} />

      {/* Price history */}
      <div className="space-y-2">
        <SectionLabel>Price history</SectionLabel>
        <ProspectPriceHistory cycles={detail.priceHistory} />
      </div>

      {/* Engagement */}
      {hasEngagement ? (
        <>
          <div style={dividerStyle} />
          <div className="space-y-2">
            <SectionLabel>Engagement</SectionLabel>
            <p className="a-num" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>
              {detail.engagement.reportViews} report views · {detail.engagement.linkTaps} link taps ·{' '}
              {detail.engagement.emailOpens} email opens · {detail.engagement.emailClicks} email clicks
            </p>
            {detail.engagement.lastActivityAt ? (
              <p style={quietTextStyle}>
                Last activity {formatDate(detail.engagement.lastActivityAt)}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {/* Prior list agent/office */}
      {detail.priorListAgentName || detail.priorListOfficeName ? (
        <div className="space-y-1">
          <SectionLabel>Prior listing</SectionLabel>
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>
            {detail.priorListAgentName ?? '—'}
            {detail.priorListOfficeName ? ` · ${detail.priorListOfficeName}` : ''}
          </p>
        </div>
      ) : null}

      <div style={dividerStyle} />

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {detail.doc.state === 'none' ? (
          <Button variant="quiet" touch className="flex-1" onClick={() => onBuild(detail.id)}>
            Build audit
          </Button>
        ) : detail.doc.state === 'building' ? (
          <Button variant="quiet" touch className="flex-1" disabled aria-busy>
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Building…
            </span>
          </Button>
        ) : detail.doc.state === 'failed' ? (
          <Button variant="quiet" touch className="flex-1" onClick={() => onBuild(detail.id)}>
            Retry build
          </Button>
        ) : detail.doc.state === 'ready' && canOpenSend ? (
          <Button variant="quiet" touch className="flex-1" onClick={onOpenSend}>
            Send intro
          </Button>
        ) : detail.doc.state === 'ready' && detail.personId == null && !detail.compliance.relisted && !detail.compliance.offMarket ? (
          <Button variant="quiet" touch className="flex-1" disabled title="Link a CRM contact first">
            Link contact to send
          </Button>
        ) : null}
        {!hideEnroll ? (
          <Button
            variant="quiet"
            touch
            className="flex-1"
            disabled={Boolean(dripBlockedReason) || enrolling}
            title={dripBlockedReason ?? undefined}
            onClick={() => setConfirmEnroll(true)}
          >
            {enrolling ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Enrolling…
              </span>
            ) : detail.drip.enrolled ? (
              'In drip'
            ) : (
              'Enroll in drip'
            )}
          </Button>
        ) : null}
        {crmHref ? (
          <Link
            href={crmHref}
            className="av2-btn av2-btn--quiet av2-btn--touch"
            style={{ flex: 1, textDecoration: 'none' }}
          >
            Open in CRM
          </Link>
        ) : null}
      </div>
      {hideEnroll ? (
        <p style={quietTextStyle}>
          {detail.compliance.relisted
            ? 'Relisted or sold — enroll hidden (same hard-skip as send).'
            : 'Off market — enroll hidden (same hard-skip as send).'}
        </p>
      ) : dripBlockedReason ? (
        <p style={quietTextStyle}>{dripBlockedReason}</p>
      ) : null}

      <Dialog
        open={confirmEnroll}
        onClose={() => setConfirmEnroll(false)}
        title={`Enroll in the ${detail.kind === 'expired' ? 'expired-listing' : 'FSBO'} drip?`}
        description={
          <>
            Starts the {detail.drip.sequenceName ? `"${detail.drip.sequenceName}"` : 'drip'} workflow for{' '}
            {detail.ownerName ?? 'this owner'}. The first touch sends automatically and every step is
            suppression-gated at send time. The enrollment is noted on the contact timeline.
          </>
        }
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirmEnroll(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmEnroll(false)
                runEnroll()
              }}
            >
              Enroll
            </Button>
          </>
        }
      />
    </div>
  )
}
