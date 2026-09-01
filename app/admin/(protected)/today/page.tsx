// @no-parity — internal admin surface, no public mockup contract
// Today: inbound, looking-at (A1), parked sequence steps, ready approvals,
// CMA drafts to review, due tasks. Looking-at is the same sentence as the
// D3 wake SMS so a missed text is not a missed person. Ask (A5) opens the
// person composer with the D1 lead ask prefilled. Inbound Yes sends one
// governed SMS. Never auto-send.
import Link from 'next/link'
import { formatTriageAge, getInboundTriage, type TriageItem } from '@/lib/data/crm/getInboundTriage'
import { getLookingAtNow } from '@/lib/data/crm/getLookingAtNow'
import { getTaskQueue } from '@/lib/data/crm/getTaskQueue'
import { getBrokerActionQueue } from '@/lib/data/crm/getBrokerActionQueue'
import { listCmasForAdmin } from '@/lib/data'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { scopeBroker } from '@/lib/crm/scope'
import { getDayOneChecklist } from '@/lib/data/brokers/getDayOneChecklist'
import { getJoinConversionStats } from '@/lib/data/loop/join-conversion'
import { dayOneComplete, dayOneRemaining } from '@/lib/crm/day-one'
import { createServiceClient } from '@/lib/supabase/service'
import { todayInboundYesEnabled } from '@/lib/crm/today-inbound-draft'
import { Button, QueueRow, SectionHead, VerdictLine } from '@/components/admin/v2'
import { getClosingsBoard, incompleteInFlight } from '@/lib/data/tc/closings'
import { dealVisibleToBroker } from '@/lib/tc/deal-scope'
import { getPrincipalSignOffQueue } from '@/lib/data'
import {
  confirmParkedStepToday,
  skipParkedStepToday,
  dismissTriageToday,
  completeTaskToday,
} from './actions'
import { ProduceDraftForm } from './ProduceDraftForm'
import { TodayInboundYesForm } from './TodayInboundYesForm'
import { TodayApproveDraftForm } from './TodayApproveDraftForm'

export const dynamic = 'force-dynamic'

async function readyApprovals() {
  // Same read the approval queue page performs (service client precedent
  // there). Yes on the row stamps via approveNowAction — the same approve
  // as /admin/approval-queue. After Yes, status is no longer ready.
  const sb = createServiceClient()
  const { data } = await sb
    .from('marketing_brain_actions')
    .select('id, action_type, target, created_at, payload')
    .eq('status', 'ready')
    .order('created_at', { ascending: true })
    .limit(8)
  return data ?? []
}

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

function draftHeadline(row: {
  action_type: string
  target: string | null
  payload: unknown
}): string {
  const payload =
    row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : {}
  const headline = typeof payload.headline === 'string' ? payload.headline.trim() : ''
  return headline || row.target || row.action_type
}

export default async function TodayPage() {
  const ctx = await requireAdminPage('today.view')
  const brokerScope = scopeBroker(ctx)
  const nowMs = Date.now()

  const [triage, lookingAt, parked, tasks, cmas, approvals, dayOne, join, closings, signOff] = await Promise.all([
    getInboundTriage(brokerScope),
    getLookingAtNow(brokerScope),
    getBrokerActionQueue({ brokerSlug: brokerScope }),
    getTaskQueue({ brokerScope, view: 'today' }),
    listCmasForAdmin({ limit: 50, offset: 0, brokerSlug: brokerScope }),
    readyApprovals(),
    getDayOneChecklist(ctx),
    getJoinConversionStats(),
    getClosingsBoard(),
    getPrincipalSignOffQueue(),
  ])
  const tcIncomplete = incompleteInFlight(
    closings.deals.filter((d) =>
      dealVisibleToBroker({ role: ctx.role, brokerSlug: ctx.brokerSlug, dealBrokerName: d.brokerName }),
    ),
  ).slice(0, 8)

  type CmaRow = {
    slug: string
    status: string
    built_at: string | null
    build_error: string | null
    subject_address: string | null
    client_name: string | null
  }
  const cmaDrafts = (cmas.rows as CmaRow[]).filter(
    (r) => r.status === 'draft' && r.built_at && !r.build_error,
  )
  const dueTasks = tasks.rows.slice(0, 8)
  const total =
    lookingAt.length +
    triage.length +
    parked.length +
    cmaDrafts.length +
    approvals.length +
    dueTasks.length +
    tcIncomplete.length +
    (signOff.authorized ? signOff.totalItems : 0)

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={total > 0 ? 'attention' : 'ok'}>
          {total > 0 ? (
            <>
              <b>
                {total} item{total === 1 ? '' : 's'} need{total === 1 ? 's' : ''} you.
              </b>{' '}
              Work top to bottom.
            </>
          ) : (
            <>
              <b>Nothing needs you right now.</b> Enjoy it.
            </>
          )}
        </VerdictLine>
      </div>

      {signOff.authorized && signOff.totalItems > 0 ? (
        <section aria-label="Sign-off">
          <SectionHead>Sign-off</SectionHead>
          <ul className="av2-queue">
            {signOff.deals.slice(0, 6).map((d) => (
              <QueueRow
                key={d.propertyKey}
                kind={signOff.overdueItems > 0 && d.items.some((i) => i.deadline?.overdue) ? 'Overdue' : 'Sign-off'}
                kindTone={d.items.some((i) => i.deadline?.overdue) ? 'down' : 'slow'}
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

      {tcIncomplete.length > 0 ? (
        <section aria-label="Incomplete checklists">
          <SectionHead>Incomplete checklists</SectionHead>
          <ul className="av2-queue">
            {tcIncomplete.map((d) => (
              <QueueRow
                key={d.id}
                kind="Incomplete"
                kindTone="slow"
                title={
                  <Link
                    href={`/admin/deals/${encodeURIComponent(d.propertyKey)}`}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    {d.address}
                  </Link>
                }
                context={`${d.itemsRequired} required · ${d.brokerName ?? '—'}`}
                action={
                  <Link
                    href={`/admin/deals/${encodeURIComponent(d.propertyKey)}`}
                    className="av2-btn"
                    style={{ textDecoration: 'none' }}
                  >
                    Open deal
                  </Link>
                }
              />
            ))}
          </ul>
        </section>
      ) : null}

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

      {dayOne.applies && dayOneComplete(dayOne.items) && brokerScope ? (
        <div style={{ margin: '0 0 14px' }}>
          <VerdictLine tone="ok">
            Day one is done. This queue is scoped to {brokerScope}.
          </VerdictLine>
        </div>
      ) : null}

      {lookingAt.length > 0 && (
        <section aria-label="Looking at a home">
          <SectionHead>Looking at a home</SectionHead>
          <ul className="av2-queue">
            {lookingAt.map((row) => (
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

      {triage.length > 0 && (
        <section aria-label="Inbound">
          <SectionHead>Inbound</SectionHead>
          <ul className="av2-queue">
            {triage.map((t) => {
              const isReply = t.kind === 'reply'
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
                  title={isReply ? inboundReplyTitle(t) : (t.personName ?? 'Unknown contact')}
                  context={isReply ? inboundReplyContext(t) : t.signal}
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

      {parked.length > 0 && (
        <section aria-label="Waiting on you">
          <SectionHead>Sequence steps waiting on you</SectionHead>
          <ul className="av2-queue">
            {parked.map((p) => (
              <QueueRow
                key={p.enrollmentId}
                kind="Parked"
                kindTone="waiting"
                title={
                  <>
                    <Link
                      href={`/admin/people/${p.personId}`}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      {p.personName}
                    </Link>
                    {` — ${p.sequenceName}`}
                  </>
                }
                context={p.holdReason ?? p.preview}
                action={
                  p.unresolved.length > 0 ? (
                    <Link href={`/admin/people/${p.personId}`}>
                      <Button variant="quiet">Fix message</Button>
                    </Link>
                  ) : (
                    <span style={{ display: 'inline-flex', gap: 8 }}>
                      <form action={skipParkedStepToday}>
                        <input type="hidden" name="enrollmentId" value={p.enrollmentId} />
                        <Button variant="quiet" type="submit">
                          Skip
                        </Button>
                      </form>
                      <form action={confirmParkedStepToday}>
                        <input type="hidden" name="enrollmentId" value={p.enrollmentId} />
                        <Button type="submit">Send it</Button>
                      </form>
                    </span>
                  )
                }
              />
            ))}
          </ul>
        </section>
      )}

      {approvals.length > 0 && (
        <section aria-label="Approvals">
          <SectionHead>Drafts ready for approval</SectionHead>
          <ul className="av2-queue">
            {approvals.map((a) => (
              <QueueRow
                key={a.id}
                kind="Approve"
                kindTone="slow"
                title={draftHeadline(a)}
                context={a.target ?? undefined}
                action={
                  <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    <TodayApproveDraftForm actionId={a.id} />
                    <Link href="/admin/approval-queue">
                      <Button variant="quiet">Open</Button>
                    </Link>
                  </span>
                }
              />
            ))}
          </ul>
        </section>
      )}

      {cmaDrafts.length > 0 && (
        <section aria-label="Valuations to review">
          <SectionHead>CMA drafts to review</SectionHead>
          <ul className="av2-queue">
            {cmaDrafts.map((c) => (
              <QueueRow
                key={c.slug}
                kind="CMA ready"
                kindTone="ok"
                title={c.subject_address ?? c.slug}
                context={c.client_name ? `For ${c.client_name}` : undefined}
                action={
                  <Link href={`/admin/cmas/${c.slug}`}>
                    <Button>Review draft</Button>
                  </Link>
                }
              />
            ))}
          </ul>
        </section>
      )}

      {dueTasks.length > 0 && (
        <section aria-label="Tasks due">
          <SectionHead>Due today</SectionHead>
          <ul className="av2-queue">
            {dueTasks.map((t) => (
              <QueueRow
                key={t.id}
                kind="Task"
                kindTone="waiting"
                title={t.name}
                context={
                  t.personName && t.personId ? (
                    <Link
                      href={`/admin/people/${t.personId}`}
                      style={{ color: 'inherit' }}
                    >
                      {t.personName}
                    </Link>
                  ) : (
                    t.personName ?? undefined
                  )
                }
                action={
                  <form action={completeTaskToday}>
                    <input type="hidden" name="taskId" value={t.id} />
                    <Button variant="quiet" type="submit">
                      Done
                    </Button>
                  </form>
                }
              />
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Produce a draft">
        <SectionHead>Produce a draft</SectionHead>
        <ProduceDraftForm />
      </section>

      {join.status === 'ok' ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '14px 0 0' }}>
          /join this week: {join.visits7d} visit{join.visits7d === 1 ? '' : 's'} ·{' '}
          {join.conversions7d} conversation{join.conversions7d === 1 ? '' : 's'} · {join.visitsAll}{' '}
          visits all-time. Same figure as the company packet.
        </p>
      ) : null}
    </div>
  )
}
