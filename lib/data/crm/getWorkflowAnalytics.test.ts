import { describe, it, expect } from 'vitest'
import {
  groupEnrollmentStatus,
  buildWorkflowAnalytics,
  stepEmailKey,
  tallyStepEmailSends,
  tallyCurrentStep,
  buildStepAnalytics,
  type RawSequenceRow,
  type RawEnrollmentRow,
  type WorkflowStepShape,
} from './getWorkflowAnalytics'

// ── groupEnrollmentStatus — the runtime statuses bucket into four groups ───────

describe('groupEnrollmentStatus', () => {
  it('maps running to active', () => {
    expect(groupEnrollmentStatus('running')).toBe('active')
  })

  it('maps both awaiting_broker variants to awaitingBroker', () => {
    expect(groupEnrollmentStatus('awaiting_broker')).toBe('awaitingBroker')
    expect(groupEnrollmentStatus('awaiting_broker_next')).toBe('awaitingBroker')
  })

  it('maps completed to completed', () => {
    expect(groupEnrollmentStatus('completed')).toBe('completed')
  })

  it('rolls every terminal/halted/paused status into stopped', () => {
    expect(groupEnrollmentStatus('stopped')).toBe('stopped')
    expect(groupEnrollmentStatus('suppressed')).toBe('stopped')
    expect(groupEnrollmentStatus('paused')).toBe('stopped')
    expect(groupEnrollmentStatus('paused_reply')).toBe('stopped')
  })

  it('buckets an unknown future status into stopped (never inflates active)', () => {
    expect(groupEnrollmentStatus('some_new_status')).toBe('stopped')
  })
})

// ── buildWorkflowAnalytics — per-sequence grouping ────────────────────────────

describe('buildWorkflowAnalytics', () => {
  const sequences: RawSequenceRow[] = [
    { id: 1, name: 'Seller Nurture', status: 'active' },
    { id: 2, name: 'Buyer Welcome', status: 'paused' },
    { id: 3, name: 'Empty Workflow', status: 'paused' },
  ]

  it('counts enrolled (total) and each status group per sequence', () => {
    const enrollments: RawEnrollmentRow[] = [
      { sequence_id: 1, status: 'running' },
      { sequence_id: 1, status: 'running' },
      { sequence_id: 1, status: 'completed' },
      { sequence_id: 1, status: 'stopped' },
      { sequence_id: 1, status: 'suppressed' },
      { sequence_id: 1, status: 'awaiting_broker' },
      { sequence_id: 1, status: 'awaiting_broker_next' },
      { sequence_id: 2, status: 'paused_reply' },
    ]
    const rows = buildWorkflowAnalytics(sequences, enrollments)
    const seller = rows.find((r) => r.id === 1)!
    expect(seller.enrolled).toBe(7)
    expect(seller.active).toBe(2)
    expect(seller.completed).toBe(1)
    expect(seller.stopped).toBe(2) // stopped + suppressed
    expect(seller.awaitingBroker).toBe(2) // awaiting_broker + awaiting_broker_next

    const buyer = rows.find((r) => r.id === 2)!
    expect(buyer.enrolled).toBe(1)
    expect(buyer.stopped).toBe(1) // paused_reply rolls into stopped
    expect(buyer.active).toBe(0)
  })

  it('includes a zero-enrollment workflow with all counts 0 (honest, not omitted)', () => {
    const rows = buildWorkflowAnalytics(sequences, [])
    const empty = rows.find((r) => r.id === 3)!
    expect(empty.enrolled).toBe(0)
    expect(empty.active).toBe(0)
    expect(empty.completed).toBe(0)
    expect(empty.stopped).toBe(0)
    expect(empty.awaitingBroker).toBe(0)
    expect(rows).toHaveLength(3)
  })

  it('ignores an enrollment whose sequence is not in the displayed set', () => {
    const enrollments: RawEnrollmentRow[] = [
      { sequence_id: 999, status: 'running' },
      { sequence_id: 1, status: 'running' },
    ]
    const rows = buildWorkflowAnalytics(sequences, enrollments)
    const seller = rows.find((r) => r.id === 1)!
    expect(seller.enrolled).toBe(1)
    // No phantom row for sequence 999.
    expect(rows.find((r) => r.id === 999)).toBeUndefined()
  })

  it('sorts most-enrolled first, then by name', () => {
    const enrollments: RawEnrollmentRow[] = [
      { sequence_id: 2, status: 'running' },
      { sequence_id: 2, status: 'running' },
      { sequence_id: 1, status: 'running' },
    ]
    const rows = buildWorkflowAnalytics(sequences, enrollments)
    expect(rows.map((r) => r.id)).toEqual([2, 1, 3])
  })

  it('carries the workflow status through unchanged', () => {
    const rows = buildWorkflowAnalytics(sequences, [])
    expect(rows.find((r) => r.id === 1)!.status).toBe('active')
    expect(rows.find((r) => r.id === 2)!.status).toBe('paused')
  })
})

// ── stepEmailKey — must match the engine's track.emailKey exactly ─────────────

describe('stepEmailKey', () => {
  it('builds seq:<name>:<index>', () => {
    expect(stepEmailKey('Seller Nurture', 0)).toBe('seq:Seller Nurture:0')
    expect(stepEmailKey('Buyer Welcome', 3)).toBe('seq:Buyer Welcome:3')
  })
})

// ── tallyStepEmailSends — count sends per step from email_key ──────────────────

describe('tallyStepEmailSends', () => {
  it('counts rows that match the sequence prefix and a numeric step suffix', () => {
    const rows = [
      { email_key: 'seq:Seller Nurture:0' },
      { email_key: 'seq:Seller Nurture:0' },
      { email_key: 'seq:Seller Nurture:2' },
    ]
    const counts = tallyStepEmailSends('Seller Nurture', rows)
    expect(counts.get(0)).toBe(2)
    expect(counts.get(2)).toBe(1)
    expect(counts.get(1)).toBeUndefined()
  })

  it('ignores rows for a different sequence name', () => {
    const rows = [
      { email_key: 'seq:Buyer Welcome:0' },
      { email_key: 'seq:Seller Nurture:0' },
    ]
    const counts = tallyStepEmailSends('Seller Nurture', rows)
    expect(counts.get(0)).toBe(1)
  })

  it('rejects a non-integer step suffix and null/blank keys', () => {
    const rows = [
      { email_key: 'seq:Seller Nurture:abc' },
      { email_key: 'seq:Seller Nurture:' },
      { email_key: null },
      { email_key: '   ' },
      { email_key: 'seq:Seller Nurture:1' },
    ]
    const counts = tallyStepEmailSends('Seller Nurture', rows)
    expect(counts.get(1)).toBe(1)
    expect(counts.size).toBe(1)
  })

  it('does not collide on a name that is a prefix of a longer name', () => {
    // "Seller" is a prefix of "Seller Nurture"; the colon separator prevents a
    // false match.
    const rows = [{ email_key: 'seq:Seller Nurture Extra:0' }]
    const counts = tallyStepEmailSends('Seller', rows)
    expect(counts.size).toBe(0)
  })
})

// ── tallyCurrentStep — live enrollments sitting at each step ───────────────────

describe('tallyCurrentStep', () => {
  it('counts only live statuses at their step_index', () => {
    const rows = [
      { step_index: 0, status: 'running' },
      { step_index: 0, status: 'awaiting_broker' },
      { step_index: 1, status: 'paused' },
      { step_index: 1, status: 'paused_reply' },
      { step_index: 2, status: 'awaiting_broker_next' },
    ]
    const counts = tallyCurrentStep(rows)
    expect(counts.get(0)).toBe(2)
    expect(counts.get(1)).toBe(2)
    expect(counts.get(2)).toBe(1)
  })

  it('excludes terminal statuses (completed / stopped / suppressed)', () => {
    const rows = [
      { step_index: 0, status: 'completed' },
      { step_index: 0, status: 'stopped' },
      { step_index: 0, status: 'suppressed' },
      { step_index: 0, status: 'running' },
    ]
    const counts = tallyCurrentStep(rows)
    expect(counts.get(0)).toBe(1)
  })

  it('ignores a negative or non-finite step_index', () => {
    const rows = [
      { step_index: -1, status: 'running' },
      { step_index: Number.NaN, status: 'running' },
      { step_index: 0, status: 'running' },
    ]
    const counts = tallyCurrentStep(rows)
    expect(counts.get(0)).toBe(1)
    expect(counts.size).toBe(1)
  })
})

// ── buildStepAnalytics — assemble the per-step rows with honest null-vs-0 ──────

describe('buildStepAnalytics', () => {
  const steps: WorkflowStepShape[] = [
    { channel: 'email' },
    { channel: 'sms' },
    { channel: 'task' },
    { channel: 'email' },
  ]

  it('emailsSent is the tallied count for an email step, null for non-email steps', () => {
    const current = new Map<number, number>([
      [0, 5],
      [1, 2],
    ])
    const sends = new Map<number, number>([
      [0, 4],
      [3, 0],
    ])
    const rows = buildStepAnalytics(steps, current, sends, true)
    expect(rows[0]).toEqual({ stepIndex: 0, channel: 'email', currentlyHere: 5, emailsSent: 4 })
    expect(rows[1]).toEqual({ stepIndex: 1, channel: 'sms', currentlyHere: 2, emailsSent: null })
    expect(rows[2]).toEqual({ stepIndex: 2, channel: 'task', currentlyHere: 0, emailsSent: null })
    // Email step with no recorded send is a TRUE 0 (provable), not null.
    expect(rows[3]).toEqual({ stepIndex: 3, channel: 'email', currentlyHere: 0, emailsSent: 0 })
  })

  it('leaves email steps null when the email_events read was unavailable (no fake 0)', () => {
    const rows = buildStepAnalytics(steps, new Map(), new Map(), false)
    expect(rows[0].emailsSent).toBeNull()
    expect(rows[3].emailsSent).toBeNull()
    // Non-email steps stay null regardless.
    expect(rows[1].emailsSent).toBeNull()
  })

  it('handles a malformed step (null channel) without crashing', () => {
    const malformed: WorkflowStepShape[] = [{ channel: null }, {}]
    const rows = buildStepAnalytics(malformed, new Map(), new Map(), true)
    expect(rows[0]).toEqual({ stepIndex: 0, channel: null, currentlyHere: 0, emailsSent: null })
    expect(rows[1].channel).toBeNull()
    expect(rows[1].emailsSent).toBeNull()
  })

  it('produces one row per step in order', () => {
    const rows = buildStepAnalytics(steps, new Map(), new Map(), true)
    expect(rows.map((r) => r.stepIndex)).toEqual([0, 1, 2, 3])
  })
})
