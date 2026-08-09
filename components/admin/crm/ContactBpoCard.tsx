'use client'

/**
 * ContactBpoCard — the contact's Broker Price Opinions (public.broker_price_
 * opinions), right-rail card. Lists each opinion (address, opinion of value,
 * confidence, status) with a Review link, and a "New price opinion" button that
 * runs the deterministic builder against the contact's home on file.
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Card -> av2-pane, Badge -> StateWord (the three labels are system states,
 * never broker-typed text), Button -> the v2 Button, and the `asChild` anchor ->
 * a real <a> carrying av2-btn so the stylesheet's hover/pressed/focus states
 * come with it instead of being hand-rolled.
 */
import { useTransition } from 'react'
import { Gauge } from 'lucide-react'
import { formatDate } from '@/lib/format/date'
import type { ContactBpo } from '@/lib/data/crm/getContactBpos'
import { Button, StateWord, type AdminState } from '@/components/admin/v2'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  final: 'Final',
  archived: 'Archived',
}

/** final reads as the settled/healthy state; draft + archived stay neutral. */
function statusTone(status: string): AdminState {
  return status === 'final' ? 'ok' : 'waiting'
}

export function ContactBpoCard(props: {
  bpos: ContactBpo[]
  /** Bound startBpoForm(personId) — builds a BPO for the contact's home. */
  generateAction: () => Promise<void>
}) {
  const [pending, startTransition] = useTransition()

  function generate() {
    startTransition(async () => {
      await props.generateAction()
    })
  }

  return (
    <div className="av2-pane">
      <div className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-1.5" style={{ fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}>
          <Gauge className="h-4 w-4" style={{ color: 'var(--a-accent)' }} aria-hidden />
          Broker price opinions
        </div>
        <Button type="button" variant="quiet" disabled={pending} onClick={generate}>
          {pending ? 'Building…' : 'New opinion'}
        </Button>
      </div>
      <div className="space-y-2.5">
        {props.bpos.length === 0 ? (
          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            No price opinion yet. Build one from the home on file.
          </p>
        ) : (
          props.bpos.map((b) => (
            <div key={b.slug} className="rounded-lg p-2.5" style={{ border: '1px solid var(--a-border)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className="truncate"
                    style={{ fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}
                    title={b.subjectAddress}
                  >
                    {b.subjectAddress}
                  </p>
                  <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                    {b.opinionLine ? `${b.opinionLine} · ` : ''}
                    {b.confidence ? `${b.confidence} · ` : ''}
                    {formatDate(b.createdAt, { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                {/* shrink-0 lived on the shadcn Badge base class; StateWord takes
                    no className, so the guard moves to the flex item itself. */}
                <span className="shrink-0">
                  <StateWord state={statusTone(b.status)}>{STATUS_LABEL[b.status] ?? b.status}</StateWord>
                </span>
              </div>
              <div className="mt-2">
                <a
                  href={b.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="av2-btn av2-btn--quiet"
                  style={{ textDecoration: 'none' }}
                >
                  Review
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
