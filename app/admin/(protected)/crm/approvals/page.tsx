// @no-parity — internal admin surface, no public mockup contract
//
// First-touch approvals — 11E: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only. Every button here fires
// an outbound message to a real person (CLAUDE.md §1), so no action, field name
// or enrollment id handling was touched.
//
// Carried over verbatim: requireAdminPage('people.view'), getCrmAccess +
// the access-denied redirect, getAwaitingApprovals, all four server actions
// (approveForm / approveEditedForm / skipForm / dismissForm) with their
// `enrollmentId` and `body` form fields, the %cma_link% placeholder swap,
// fmtRelative, and every href.
//
// Shape changed, data did not: the page-title h1 is gone (the nav names the
// page), ConsoleSection cards became queue rows, the prepared message renders
// as the outbound thread bubble it is, the person's NAME is now the door to the
// contact (it carries the href the separate "View contact" link used to), and a
// thrown read renders as a failed read rather than as an empty queue.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { redirect } from 'next/navigation'
import {
  getCrmAccess,
  getAwaitingApprovals,
  approveEnrollmentAction,
  skipFirstTouchAction,
  dismissEnrollmentAction,
} from '@/app/actions/crm'
import {
  Button,
  QueueRow,
  ReportError,
  SectionHead,
  StateWord,
  TextAreaField,
  ThreadBubble,
  VerdictLine,
} from '@/components/admin/v2'

export const metadata = { title: 'First-touch approvals | CRM | Admin' }
export const dynamic = 'force-dynamic'

async function approveForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const r = await approveEnrollmentAction(enrollmentId)
  if (!r.ok) console.error('[crm] approveEnrollment failed:', r.error)
}

async function approveEditedForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const body = (formData.get('body') as string | null)?.trim() || null
  const r = await approveEnrollmentAction(enrollmentId, body)
  if (!r.ok) console.error('[crm] approveEnrollmentEdited failed:', r.error)
}

async function skipForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const r = await skipFirstTouchAction(enrollmentId)
  if (!r.ok) console.error('[crm] skipFirstTouch failed:', r.error)
}

async function dismissForm(formData: FormData): Promise<void> {
  'use server'
  const enrollmentId = Number(formData.get('enrollmentId'))
  const r = await dismissEnrollmentAction(enrollmentId)
  if (!r.ok) console.error('[crm] dismissEnrollment failed:', r.error)
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

const META: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }
const ACTS: React.CSSProperties = { display: 'inline-flex', flexWrap: 'wrap', gap: 8 }

export default async function CrmApprovalsPage() {
  await requireAdminPage('people.view')
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const items = await getAwaitingApprovals().catch(() => null)
  const rows = items ?? []

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={items === null || rows.length > 0 ? 'attention' : 'ok'}>
          {items === null ? (
            <b>The approval queue could not be read. Nothing below is the queue.</b>
          ) : rows.length === 0 ? (
            <b>No first touch is waiting on you.</b>
          ) : (
            <b>
              {rows.length} first touch{rows.length === 1 ? '' : 'es'} waiting on you.
            </b>
          )}
        </VerdictLine>
      </div>

      {items === null ? <ReportError what="First-touch approvals" href="/admin/crm/approvals" /> : null}

      <SectionHead>Held at the first touch</SectionHead>

      {rows.length === 0 ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          {items === null
            ? 'The read failed, so this queue is unknown — not empty.'
            : 'No sequence enrollment is waiting on a broker.'}{' '}
          <Link href="/admin/crm" style={{ color: 'var(--a-accent)' }}>
            Back to CRM
          </Link>
        </p>
      ) : (
        <ul className="av2-queue">
          {rows.map((item) => (
            <QueueRow
              key={item.enrollmentId}
              kind="Approve"
              kindTone="slow"
              age={fmtRelative(item.enrolledAt)}
              title={
                <Link href={`/admin/crm/${item.personId}`} style={{ color: 'var(--a-accent)' }}>
                  {item.personName ?? `Contact #${item.personId}`}
                </Link>
              }
              context={
                <>
                  <span style={META}>
                    <StateWord state="waiting">{item.sequenceName}</StateWord>
                    {item.source ? <span>{item.source}</span> : null}
                    {item.assignedBroker ? <span>{item.assignedBroker}</span> : null}
                  </span>

                  {item.preview ? (
                    <div style={{ display: 'flex', flexDirection: 'column', margin: '8px 0' }}>
                      <ThreadBubble
                        direction="out"
                        channel={item.preview.channel === 'email' ? 'Email' : 'SMS'}
                        stamp="not sent yet"
                      >
                        <span style={{ whiteSpace: 'pre-wrap' }}>{item.preview.body}</span>
                      </ThreadBubble>
                    </div>
                  ) : (
                    <p style={{ margin: '8px 0' }}>Step one is a task or an email, so there is no text to preview.</p>
                  )}

                  {item.cmaLink ? (
                    <a
                      href={item.cmaLink}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--a-accent)' }}
                    >
                      View CMA
                    </a>
                  ) : (
                    <span>The CMA builds before the text can send.</span>
                  )}

                  {item.preview ? (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ cursor: 'pointer', minHeight: 40, display: 'flex', alignItems: 'center' }}>
                        Edit text before sending
                      </summary>
                      <form action={approveEditedForm} style={{ display: 'grid', gap: 8, paddingTop: 8 }}>
                        <input type="hidden" name="enrollmentId" value={item.enrollmentId} />
                        <TextAreaField
                          label="Text to send"
                          name="body"
                          rows={5}
                          defaultValue={item.preview.body.replace('[CMA link attaches when built]', '%cma_link%')}
                        />
                        <span>
                          <Button variant="quiet" type="submit">
                            Send edited text
                          </Button>
                        </span>
                      </form>
                    </details>
                  ) : null}
                </>
              }
              action={
                <span style={ACTS}>
                  <form action={approveForm}>
                    <input type="hidden" name="enrollmentId" value={item.enrollmentId} />
                    <Button type="submit" touch>
                      Send and start
                    </Button>
                  </form>
                  <form action={skipForm}>
                    <input type="hidden" name="enrollmentId" value={item.enrollmentId} />
                    <Button type="submit" variant="quiet" touch>
                      Skip first text
                    </Button>
                  </form>
                  <form action={dismissForm}>
                    <input type="hidden" name="enrollmentId" value={item.enrollmentId} />
                    <Button type="submit" variant="quiet" touch>
                      Dismiss
                    </Button>
                  </form>
                </span>
              }
            />
          ))}
        </ul>
      )}
    </div>
  )
}
