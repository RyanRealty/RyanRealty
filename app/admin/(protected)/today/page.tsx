// @no-parity — internal admin surface, no public mockup contract
// Today: inbound, looking-at (A1), parked sequence steps, ready approvals,
// CMA drafts to review, due tasks. Looking-at is the same sentence as the
// D3 wake SMS so a missed text is not a missed person.
import Link from 'next/link'
import { formatTriageAge, getInboundTriage } from '@/lib/data/crm/getInboundTriage'
import { getLookingAtNow } from '@/lib/data/crm/getLookingAtNow'
import { getTaskQueue } from '@/lib/data/crm/getTaskQueue'
import { getBrokerActionQueue } from '@/lib/data/crm/getBrokerActionQueue'
import { listCmasForAdmin } from '@/lib/data'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { createServiceClient } from '@/lib/supabase/service'
import { Button, QueueRow, SectionHead, VerdictLine } from '@/components/admin/v2'
import {
  confirmParkedStepToday,
  skipParkedStepToday,
  dismissTriageToday,
  completeTaskToday,
} from './actions'

export const dynamic = 'force-dynamic'

async function readyApprovals() {
  // Same read the approval queue page performs (service client precedent
  // there); Today only SURFACES ready rows — the stamp itself happens on the
  // approval surface, one tap away, until that family folds in.
  const sb = createServiceClient()
  const { data } = await sb
    .from('marketing_brain_actions')
    .select('id, action_type, target, created_at')
    .eq('status', 'ready')
    .order('created_at', { ascending: true })
    .limit(8)
  return data ?? []
}

export default async function TodayPage() {
  const ctx = await requireAdminPage('today.view')
  // Own book for brokers; company-wide for the principal (scopeBroker semantics).
  const brokerScope = ctx.role === 'superuser' ? null : ctx.brokerSlug
  const nowMs = Date.now()

  const [triage, lookingAt, parked, tasks, cmas, approvals] = await Promise.all([
    getInboundTriage(brokerScope),
    getLookingAtNow(brokerScope),
    getBrokerActionQueue({ brokerSlug: brokerScope }),
    getTaskQueue({ brokerScope, view: 'today' }),
    listCmasForAdmin({ limit: 50, offset: 0 }),
    readyApprovals(),
  ])

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
    lookingAt.length + triage.length + parked.length + cmaDrafts.length + approvals.length + dueTasks.length

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
                  <Link href={row.deepLink}>
                    <Button variant="quiet">Open</Button>
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
            {triage.map((t) => (
              <QueueRow
                key={t.id}
                kind="Reply"
                kindTone="accent"
                title={t.personName ?? 'Unknown contact'}
                context={t.signal}
                age={formatTriageAge(t.occurredAt, nowMs)}
                action={
                  <span style={{ display: 'inline-flex', gap: 8 }}>
                    <form action={dismissTriageToday}>
                      <input type="hidden" name="personId" value={t.personId} />
                      <input type="hidden" name="kind" value={t.kind} />
                      {t.taskId ? <input type="hidden" name="taskId" value={t.taskId} /> : null}
                      <Button variant="quiet" type="submit">
                        Dismiss
                      </Button>
                    </form>
                    <Link href={t.deepLink}>
                      <Button>Open</Button>
                    </Link>
                  </span>
                }
              />
            ))}
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
                title={`${p.personName} — ${p.sequenceName}`}
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
                title={a.action_type}
                context={a.target ?? undefined}
                action={
                  <Link href="/admin/approval-queue">
                    <Button variant="quiet">See draft</Button>
                  </Link>
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
                context={t.personName ?? undefined}
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
    </div>
  )
}
