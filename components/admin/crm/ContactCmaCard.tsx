'use client'

/**
 * ContactCmaCard — the contact's CMAs from public.cmas (the in-house CMA
 * engine), right-rail card. Each row: address, status, value range, review,
 * and Review & send when a PDF exists. Primary path is CMA Review
 * EmailBodyEditor — never People Blank compose.
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Card -> av2-pane, Badge -> StateWord (build + delivery states are system
 * words), and the Review / Send anchors carry av2-btn so hover/pressed/focus
 * come from the stylesheet.
 *
 * Gate note (ci:admin-ui rule C): "Review & send" is an anchor, not a
 * primary Button, so this card stays at zero extra primaries.
 */
import { FileText } from 'lucide-react'
import { formatDate } from '@/lib/format/date'
import type { ContactCma } from '@/lib/data/crm/getContactCmas'
import { StateWord, type AdminState } from '@/components/admin/v2'

function fmtDate(iso: string): string {
  return formatDate(iso, { month: 'short', day: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  building: 'Building',
  finalized: 'Ready',
  delivered: 'Sent',
}

const BUILD_LABEL: Record<string, string> = {
  queued: 'Queued',
  building: 'Building',
  ready: 'Ready',
  failed: 'Build failed',
}

function statusTone(status: string, building: boolean): AdminState {
  if (building) return 'waiting'
  if (status === 'delivered') return 'ok'
  if (status === 'finalized') return 'accent'
  return 'waiting'
}

export function ContactCmaCard(props: {
  personId: number
  cmas: ContactCma[]
}) {
  void props.personId // callers still pass personId; Review path does not need it
  if (props.cmas.length === 0) return null

  return (
    <div className="av2-pane">
      <div className="flex items-center gap-1.5" style={{ fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}>
        <FileText className="h-4 w-4" style={{ color: 'var(--a-accent)' }} aria-hidden />
        CMAs
      </div>
      <div className="space-y-2.5">
        {props.cmas.map((c) => {
          const building = c.buildState === 'queued' || c.buildState === 'building'
          const attachable = c.hasDocument && !building && c.status !== 'archived'
          const badgeLabel = building
            ? (BUILD_LABEL[c.buildState] ?? c.buildState)
            : (STATUS_LABEL[c.status] ?? c.status)
          return (
            <div key={c.slug} className="rounded-lg p-2.5" style={{ border: '1px solid var(--a-border)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className="truncate"
                    style={{ fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}
                    title={c.subjectAddress}
                  >
                    {c.subjectAddress}
                  </p>
                  <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                    {c.valueLine ? `${c.valueLine} · ` : ''}{fmtDate(c.createdAt)}
                  </p>
                </div>
                <span className="shrink-0">
                  <StateWord state={statusTone(c.status, building)}>{badgeLabel}</StateWord>
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {!building ? (
                  <a
                    href={c.reviewUrl}
                    className={attachable ? 'av2-btn' : 'av2-btn av2-btn--quiet'}
                    style={{ textDecoration: 'none' }}
                  >
                    {attachable ? 'Review & send' : 'Review'}
                  </a>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
