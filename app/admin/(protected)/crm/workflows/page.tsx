// @no-parity — internal admin surface, no public mockup contract
//
// /admin/crm/workflows — the enrollment board. P11D: migrated to the LOCKED
// admin v2 language (design_system/admin/ADMIN_UI.md). PRESENTATION ONLY.
//
// This screen drives automated outreach, so NOTHING that decides who is enrolled
// or when a touch fires was touched. Carried over verbatim: the getCrmAccess() →
// /admin/access-denied guard, the `?boardError=` decode, getWorkflowBoard() and
// its scoping, all five 'use server' adapters character for character — approve ·
// pause · resume · advance · dismiss, each with the same FormData key
// 'enrollmentId', the same action call, and the same
// redirect(`/admin/crm/workflows?boardError=…`) on failure — fmtRelative, the
// awaiting/running/paused count math (paused still folds paused_reply in), the
// per-status choice of which action is primary and which are secondary, the
// stepLabels the DAL builds, `dynamic = 'force-dynamic'`, the metadata title,
// and both hrefs (/admin/crm and /admin/crm/sequences).
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), the <h1>/<h2>/ConsoleSection/Alert/Card stack with it, and the
// two duplicate renderings of every enrollment — a phone stack and a desktop
// kanban, each with its own copy of the five action forms — collapsed into ONE
// queue-row list per step (ADMIN_UI pattern 1, phone-first, single line at
// 1024px). No horizontal board to scroll, no `compact` fork.
//
// ONE PERSON CAN NO LONGER GO MISSING. Both old branches rendered enrollments by
// walking stepLabels, so an enrollment whose step_index sat past the sequence's
// last step drew nothing at all — on the board by status, invisible on screen.
// Those now fall into a named group. Checked against live data 2026-08-07: all
// 15 board enrollments are within range, so this changes no pixel today.
//
// NO RULE-PRECEDENCE CLAIM IS MADE HERE. The sibling automations page had to cut
// "first matching rule wins" because it holds for autoEnrollPerson and not for
// fireTrigger. This page never claimed it and still does not: it says only what
// its own rows show.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  getCrmAccess,
  getWorkflowBoard,
  approveEnrollmentAction,
  pauseEnrollmentAction,
  resumeEnrollmentAction,
  advanceEnrollmentNowAction,
  dismissEnrollmentAction,
} from '@/app/actions/crm'
import {
  Button,
  QueueRow,
  SectionHead,
  VerdictLine,
  type AdminState,
} from '@/components/admin/v2'

export const metadata = { title: 'Workflows | CRM | Admin' }
export const dynamic = 'force-dynamic'

async function approveForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const r = await approveEnrollmentAction(enrollmentId)
  if (!r.ok) redirect(`/admin/crm/workflows?boardError=${encodeURIComponent(r.error ?? 'Approve failed')}`)
}

async function pauseForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const r = await pauseEnrollmentAction(enrollmentId)
  if (!r.ok) redirect(`/admin/crm/workflows?boardError=${encodeURIComponent(r.error ?? 'Pause failed')}`)
}

async function resumeForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const r = await resumeEnrollmentAction(enrollmentId)
  if (!r.ok) redirect(`/admin/crm/workflows?boardError=${encodeURIComponent(r.error ?? 'Resume failed')}`)
}

async function advanceForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const r = await advanceEnrollmentNowAction(enrollmentId)
  if (!r.ok) redirect(`/admin/crm/workflows?boardError=${encodeURIComponent(r.error ?? 'Advance failed')}`)
}

async function dismissForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const r = await dismissEnrollmentAction(enrollmentId)
  if (!r.ok) redirect(`/admin/crm/workflows?boardError=${encodeURIComponent(r.error ?? 'Stop failed')}`)
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) {
    const future = -ms
    if (future < 3_600_000) return `in ${Math.ceil(future / 60_000)}m`
    if (future < 86_400_000) return `in ${Math.ceil(future / 3_600_000)}h`
    return `in ${Math.ceil(future / 86_400_000)}d`
  }
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

/** Status as a plain word plus its tone — status is text + color, never color alone. */
function stateOf(status: string): { word: string; tone: AdminState } {
  if (status === 'awaiting_broker') return { word: 'Waiting on you', tone: 'waiting' }
  if (status === 'running') return { word: 'Running', tone: 'ok' }
  if (status === 'paused') return { word: 'Paused', tone: 'slow' }
  if (status === 'paused_reply') return { word: 'Paused on reply', tone: 'slow' }
  return { word: status.replace(/_/g, ' '), tone: 'waiting' }
}

type Enrollment = {
  enrollmentId: number
  personId: number
  personName: string | null
  assignedBroker: string | null
  status: string
  stepIndex: number
  nextRunAt: string | null
}

/**
 * One enrollment's actions. The per-status choice of primary and secondaries is
 * carried over unchanged; only the button skins changed.
 */
function EnrollmentActions({ en }: { en: Enrollment }) {
  const primary =
    en.status === 'awaiting_broker' ? { action: approveForm, label: 'Approve' }
    : en.status === 'running' ? { action: pauseForm, label: 'Pause' }
    : (en.status === 'paused' || en.status === 'paused_reply') ? { action: resumeForm, label: 'Resume' }
    : null
  const secondary = [
    en.status === 'running' ? { action: advanceForm, label: 'Run next now' } : null,
    { action: dismissForm, label: 'Stop' },
  ].filter((s): s is { action: typeof dismissForm; label: string } => s !== null)

  return (
    <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
      {primary ? (
        <form action={primary.action}>
          <input type="hidden" name="enrollmentId" value={en.enrollmentId} />
          <Button type="submit">{primary.label}</Button>
        </form>
      ) : null}
      {secondary.map((s) => (
        <form key={s.label} action={s.action}>
          <input type="hidden" name="enrollmentId" value={en.enrollmentId} />
          <Button type="submit" variant="quiet">
            {s.label}
          </Button>
        </form>
      ))}
    </span>
  )
}

/** One enrollment as a queue row: state word, the person (a door), where it is next. */
function EnrollmentRow({ en }: { en: Enrollment }) {
  const state = stateOf(en.status)
  const next =
    en.status === 'awaiting_broker'
      ? 'waiting on approval'
      : en.nextRunAt
        ? `next touch ${fmtRelative(en.nextRunAt)}`
        : null
  const broker = en.assignedBroker ?? 'unassigned'
  return (
    <QueueRow
      kind={state.word}
      kindTone={state.tone}
      title={
        <Link
          href={`/admin/crm/${en.personId}`}
          style={{ color: 'var(--a-text)', textDecoration: 'none' }}
        >
          {en.personName ?? `#${en.personId}`}
        </Link>
      }
      context={next ? `${broker} · ${next}` : broker}
      action={<EnrollmentActions en={en} />}
    />
  )
}

export default async function CrmWorkflowsPage({
  searchParams,
}: {
  searchParams: Promise<{ boardError?: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const boardError = sp.boardError ? decodeURIComponent(sp.boardError) : null

  const sequences = await getWorkflowBoard()

  // Summary counts across all sequences
  const allEnrollments = sequences.flatMap((s) => s.enrollments)
  const counts = {
    awaiting_broker: allEnrollments.filter((e) => e.status === 'awaiting_broker').length,
    running: allEnrollments.filter((e) => e.status === 'running').length,
    paused: allEnrollments.filter((e) => e.status === 'paused' || e.status === 'paused_reply').length,
  }

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={counts.awaiting_broker > 0 ? 'attention' : 'ok'}>
          {counts.awaiting_broker > 0 ? (
            <>
              <b>
                {counts.awaiting_broker.toLocaleString('en-US')}{' '}
                {counts.awaiting_broker === 1 ? 'step is' : 'steps are'} waiting on your approval.
              </b>{' '}
              {counts.running.toLocaleString('en-US')} running, {counts.paused.toLocaleString('en-US')}{' '}
              paused.
            </>
          ) : (
            <>
              <b>
                {counts.running.toLocaleString('en-US')} running,{' '}
                {counts.paused.toLocaleString('en-US')} paused across{' '}
                {sequences.length.toLocaleString('en-US')} active{' '}
                {sequences.length === 1 ? 'sequence' : 'sequences'}.
              </b>{' '}
              Nothing is waiting on your approval.
            </>
          )}
        </VerdictLine>
      </div>

      {boardError ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)', margin: '0 0 16px' }}>
          {boardError}
        </p>
      ) : null}

      <div className="av2-wordrow" style={{ margin: '0 0 18px' }}>
        <Link href="/admin/crm" style={{ color: 'var(--a-accent)' }}>
          Back to CRM
        </Link>
        <Link
          href="/admin/crm/sequences"
          className="av2-btn av2-btn--quiet"
          style={{ textDecoration: 'none', marginLeft: 'auto' }}
        >
          Build workflows
        </Link>
      </div>

      {sequences.length === 0 ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          No sequence is active. Activate one on the automations page and the people it enrolls show
          up here.
        </p>
      ) : (
        sequences.map((seq) => {
          const offBoard = seq.enrollments.filter(
            (e) => e.stepIndex < 0 || e.stepIndex >= seq.stepLabels.length,
          )
          return (
            <section key={seq.sequenceId} aria-label={seq.sequenceName}>
              <SectionHead>
                {seq.sequenceName} — {seq.enrollments.length.toLocaleString('en-US')}{' '}
                {seq.enrollments.length === 1 ? 'person' : 'people'} active
              </SectionHead>

              {seq.enrollments.length === 0 ? (
                <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                  No one is in this workflow yet.
                </p>
              ) : (
                <>
                  {seq.stepLabels.map((label, stepIdx) => {
                    const stepEnrollments = seq.enrollments.filter((e) => e.stepIndex === stepIdx)
                    if (stepEnrollments.length === 0) return null
                    return (
                      <div key={stepIdx} role="group" aria-label={label}>
                        <div
                          style={{
                            fontSize: 'var(--a-text-xs)',
                            fontWeight: 600,
                            letterSpacing: '.05em',
                            textTransform: 'uppercase',
                            color: 'var(--a-text-2)',
                            margin: '12px 0 6px',
                          }}
                        >
                          {label}
                        </div>
                        <ul className="av2-queue">
                          {stepEnrollments.map((en) => (
                            <EnrollmentRow key={en.enrollmentId} en={en} />
                          ))}
                        </ul>
                      </div>
                    )
                  })}

                  {offBoard.length > 0 ? (
                    <div role="group" aria-label="Past the last step">
                      <div
                        style={{
                          fontSize: 'var(--a-text-xs)',
                          fontWeight: 600,
                          letterSpacing: '.05em',
                          textTransform: 'uppercase',
                          color: 'var(--a-warn)',
                          margin: '12px 0 6px',
                        }}
                      >
                        Past the last step
                      </div>
                      <ul className="av2-queue">
                        {offBoard.map((en) => (
                          <EnrollmentRow key={en.enrollmentId} en={en} />
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
