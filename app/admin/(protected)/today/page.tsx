// @no-parity — internal admin surface, no public mockup contract
// Today: a short right-now strip — overdue sign-off, true inbound replies,
// looking-at. CMA opens and sequence steps live on their own screens.
import Link from 'next/link'
import { formatTriageAge, getInboundTriage, type TriageItem } from '@/lib/data/crm/getInboundTriage'
import { getLookingAtNow } from '@/lib/data/crm/getLookingAtNow'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { scopeBroker } from '@/lib/crm/scope'
import { getDayOneChecklist } from '@/lib/data/brokers/getDayOneChecklist'
import { dayOneComplete, dayOneRemaining } from '@/lib/crm/day-one'
import { todayInboundYesEnabled } from '@/lib/crm/today-inbound-draft'
import { Button, QueueRow, SectionHead, VerdictLine } from '@/components/admin/v2'
import { getPrincipalSignOffQueue } from '@/lib/data'
import {
  capRightNow,
  dedupeInboundReplies,
  lookingAtWithoutReplies,
  overdueSignOffDeals,
} from '@/lib/admin/today-right-now'
import { dismissTriageToday } from './actions'
import { ProduceDraftForm } from './ProduceDraftForm'
import { TodayInboundYesForm } from './TodayInboundYesForm'

export const dynamic = 'force-dynamic'

function inboundQuote(body: string): string {
  const trimmed = body.trim()
  if (!trimmed) return ''
  const max = 180
  const clipped = trimmed.length > max ? `${trimmed.slice(0, max).trim()}...` : trimmed
  return `"${clipped}"`
}

function inboundReplyContext(t: TriageItem) {
  const quote = inboundQuote(t.inboundBody)
  return (
    <>
      {quote ? <div>{quote}</div> : <div>{t.signal}</div>}
      {t.nextStep ? <div>{t.nextStep}</div> : null}
      {t.draftSms ? <div>Draft: {t.draftSms}</div> : null}
    </>
  )
}

function inboundReplyTitle(t: TriageItem) {
  const who = t.whoLabels.length > 0 ? ` · ${t.whoLabels.join(' · ')}` : ''
  return (
    <>
      <Link href={t.deepLink} style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
        {t.personName ?? 'Unknown contact'}
      </Link>
      {who}
    </>
  )
}

export default async function TodayPage() {
  const ctx = await requireAdminPage('today.view')
  const brokerScope = scopeBroker(ctx)
  const nowMs = Date.now()

  const [triage, lookingAt, dayOne, signOff] = await Promise.all([
    getInboundTriage(brokerScope),
    getLookingAtNow(brokerScope),
    getDayOneChecklist(ctx),
    getPrincipalSignOffQueue(),
  ])

  const replies = capRightNow(dedupeInboundReplies(triage))
  const replyIds = new Set(replies.map((row) => row.personId))
  const looking = capRightNow(lookingAtWithoutReplies(lookingAt, replyIds))
  const overdueDeals =
    signOff.authorized ? capRightNow(overdueSignOffDeals(signOff.deals), 6) : []

  const total = overdueDeals.length + replies.length + looking.length

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={total > 0 ? 'attention' : 'ok'}>
          {total > 0 ? (
            <>
              <b>
                {total} right now
              </b>
              {' — '}
              overdue sign-off, replies, looking-at.
            </>
          ) : (
            <>
              <b>Nothing needs you right now.</b>
            </>
          )}
        </VerdictLine>
      </div>

      {dayOne.applies && !dayOneComplete(dayOne.items) ? (
        <section aria-label="Day one">
          <SectionHead>Day one</SectionHead>
          <ul className="av2-quietlist">
            {dayOneRemaining(dayOne.items).map((item) => (
              <li key={item.id} className="av2-quiet">
                <Link href={item.href} className="av2-quiet__name" style={{ textDecoration: 'none', color: 'var(--a-text)' }}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {overdueDeals.length > 0 ? (
        <section aria-label="Overdue sign-off">
          <SectionHead>Overdue sign-off</SectionHead>
          <ul className="av2-queue">
            {overdueDeals.map((d) => (
              <QueueRow
                key={d.propertyKey}
                kind="Overdue"
                kindTone="down"
                title={
                  <Link
                    href={`/admin/deals/${encodeURIComponent(d.propertyKey)}`}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    {d.address}
                  </Link>
                }
                context={`${d.items.length} item${d.items.length === 1 ? '' : 's'} · ${d.broker ?? '—'}`}
                action={
                  <Link href="/admin/sign-off" className="av2-btn" style={{ textDecoration: 'none' }}>
                    Review
                  </Link>
                }
              />
            ))}
          </ul>
        </section>
      ) : null}

      {looking.length > 0 && (
        <section aria-label="Looking at a home">
          <SectionHead>Looking at a home</SectionHead>
          <ul className="av2-queue">
            {looking.map((row) => (
              <QueueRow
                key={`looking:${row.personId}:${row.listingKey}`}
                kind="Looking"
                kindTone="accent"
                title={
                  <>
                    <Link href={row.deepLink} style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
                      {row.personName}
                    </Link>
                    {` is looking at ${row.address}.`}
                  </>
                }
                age={formatTriageAge(row.occurredAt, nowMs)}
                action={
                  <Link href={row.askHref}>
                    <Button variant="quiet">Ask</Button>
                  </Link>
                }
              />
            ))}
          </ul>
        </section>
      )}

      {replies.length > 0 && (
        <section aria-label="Inbound replies">
          <SectionHead>Inbound replies</SectionHead>
          <ul className="av2-queue">
            {replies.map((t) => {
              const yesEnabled = todayInboundYesEnabled({
                kind: t.kind,
                inboundChannel: t.inboundChannel,
                draftSms: t.draftSms,
              })
              return (
                <QueueRow
                  key={t.id}
                  kind="Reply"
                  kindTone="accent"
                  title={inboundReplyTitle(t)}
                  context={inboundReplyContext(t)}
                  age={formatTriageAge(t.occurredAt, nowMs)}
                  action={
                    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <form action={dismissTriageToday}>
                        <input type="hidden" name="personId" value={t.personId} />
                        <input type="hidden" name="kind" value={t.kind} />
                        {t.taskId ? <input type="hidden" name="taskId" value={t.taskId} /> : null}
                        <Button variant="quiet" type="submit">
                          Dismiss
                        </Button>
                      </form>
                      {yesEnabled ? <TodayInboundYesForm personId={t.personId} body={t.draftSms} /> : null}
                      <Link href={t.deepLink}>
                        <Button variant={yesEnabled ? 'quiet' : undefined}>Open</Button>
                      </Link>
                    </span>
                  }
                />
              )
            })}
          </ul>
        </section>
      )}

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '16px 0' }}>
        CMA opens and sequence steps live on{' '}
        <Link href="/admin/valuations" style={{ color: 'var(--a-accent)' }}>
          Valuations
        </Link>
        {' · '}
        <Link href="/admin/crm/approvals" style={{ color: 'var(--a-accent)' }}>
          Approvals
        </Link>
        {' · '}
        <Link href="/admin/crm/tasks" style={{ color: 'var(--a-accent)' }}>
          Tasks
        </Link>
        {' · '}
        <Link href="/admin/crm/sequences" style={{ color: 'var(--a-accent)' }}>
          Sequences
        </Link>
        .
      </p>

      <section aria-label="Produce a draft">
        <SectionHead>Produce a draft</SectionHead>
        <ProduceDraftForm />
      </section>
    </div>
  )
}
