// @no-parity — internal admin surface, no public mockup contract
// Today (P9 roll:today, IA lock 2026-08-05): the ONE action queue answering
// "what am I supposed to do right now" — inbound triage, parked sequence
// steps, ready approvals, CMA drafts to review, due tasks. First admin
// destination on the locked v2 language (design_system/admin/ADMIN_UI.md).
// Absorbs the broker-dashboard's queue jobs; KPI/feed jobs land in Oversight
// (frozen cut-list). Legacy shell chrome remains until the shell family rolls.
import Link from 'next/link'
import { formatTriageAge, getInboundTriage } from '@/lib/data/crm/getInboundTriage'
import { getTaskQueue } from '@/lib/data/crm/getTaskQueue'
import { getBrokerActionQueue } from '@/lib/data/crm/getBrokerActionQueue'
import { listCmasForAdmin } from '@/lib/data'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { createServiceClient } from '@/lib/supabase/service'
import { Button, QueueRow, VerdictLine } from '@/components/admin/v2'
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

  const [triage, parked, tasks, cmas, approvals] = await Promise.all([
    getInboundTriage(brokerScope),
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
  const total = triage.length + parked.length + cmaDrafts.length + approvals.length + dueTasks.length

  return (
    <main className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
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

      {triage.length > 0 && (
        <section aria-label="Inbound">
          <h2 className="av2-lane-head">Inbound</h2>
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
          <h2 className="av2-lane-head">Sequence steps waiting on you</h2>
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
                    <Link href={`/admin/crm/${p.personId}`}>
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
          <h2 className="av2-lane-head">Drafts ready for approval</h2>
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
          <h2 className="av2-lane-head">CMA drafts to review</h2>
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
          <h2 className="av2-lane-head">Due today</h2>
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
    </main>
  )
}
