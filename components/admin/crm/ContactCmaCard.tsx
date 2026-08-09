'use client'

/**
 * ContactCmaCard — the contact's CMAs from public.cmas (the in-house CMA
 * engine), right-rail card. Each row: address, status, value range, and the
 * action that matches its state — review a draft, send a finalized one, or
 * re-send a delivered one (all through sendCmaForContactAction via the bound
 * form action, which guards status + suppression server-side).
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Card -> av2-pane, Badge -> StateWord (build + delivery states are system
 * words), Button -> the v2 Button, and the `asChild` Review anchor -> a real
 * <a> carrying av2-btn so hover/pressed/focus come from the stylesheet.
 *
 * Gate note (ci:admin-ui rule C): "Send to contact" is this card's one primary
 * action. "Re-send" on an already-delivered CMA is deliberately quiet — it was
 * variant="outline" before — so a row that has already gone out never competes
 * with a row that still needs sending.
 */
import { useState, useTransition } from 'react'
import { FileText } from 'lucide-react'
import { formatDate } from '@/lib/format/date'
import type { ContactCma } from '@/lib/data/crm/getContactCmas'
import { Button, StateWord, type AdminState } from '@/components/admin/v2'

function fmtDate(iso: string): string {
  return formatDate(iso, { month: 'short', day: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  building: 'Building',
  finalized: 'Ready to send',
  delivered: 'Sent',
}

const BUILD_LABEL: Record<string, string> = {
  queued: 'Queued',
  building: 'Building',
  ready: 'Ready',
  failed: 'Build failed',
}

/** delivered = done; finalized (and not still building) = ready to act on. */
function statusTone(status: string, building: boolean): AdminState {
  if (building) return 'waiting'
  if (status === 'delivered') return 'ok'
  if (status === 'finalized') return 'accent'
  return 'waiting'
}

export function ContactCmaCard(props: {
  cmas: ContactCma[]
  /** Bound sendCmaForm(personId, fd) — posts deliveryId=slug. */
  sendAction: (formData: FormData) => Promise<void>
}) {
  const [pending, startTransition] = useTransition()
  const [sendingSlug, setSendingSlug] = useState<string | null>(null)
  if (props.cmas.length === 0) return null

  function send(slug: string) {
    const fd = new FormData()
    fd.set('deliveryId', slug)
    setSendingSlug(slug)
    startTransition(async () => {
      await props.sendAction(fd)
      setSendingSlug(null)
    })
  }

  return (
    <div className="av2-pane">
      <div className="flex items-center gap-1.5" style={{ fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}>
        <FileText className="h-4 w-4" style={{ color: 'var(--a-accent)' }} aria-hidden />
        CMAs
      </div>
      <div className="space-y-2.5">
        {props.cmas.map((c) => {
          const sendable = c.status === 'finalized' || c.status === 'delivered'
          const building = c.buildState === 'queued' || c.buildState === 'building'
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
                {/* shrink-0 lived on the shadcn Badge base class; StateWord takes
                    no className, so the guard moves to the flex item itself. */}
                <span className="shrink-0">
                  <StateWord state={statusTone(c.status, building)}>{badgeLabel}</StateWord>
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {!building ? (
                  <a href={c.reviewUrl} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
                    Review
                  </a>
                ) : null}
                {sendable && !building ? (
                  <Button
                    type="button"
                    variant={c.status === 'delivered' ? 'quiet' : 'primary'}
                    disabled={pending}
                    onClick={() => send(c.slug)}
                  >
                    {sendingSlug === c.slug ? 'Sending…' : c.status === 'delivered' ? 'Re-send' : 'Send to contact'}
                  </Button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
