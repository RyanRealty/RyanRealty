'use server'

/**
 * Newsletter review-surface server actions (W2, Matt directives 2026-07-06):
 * Approve & Schedule (gated by R-1 voice + R-2 citations + R-3 links),
 * Unschedule, Pause/Resume (the circuit-breaker control), the on-demand
 * pre-send gate runner, and subscriber management (edit / reassign broker /
 * delete). Split out of app/actions/newsletter.ts to hold the 600-LOC budget.
 */

import { revalidatePath } from 'next/cache'
import { getCrmAccess } from '@/app/actions/crm'
import { checkNewsletterVoice } from '@/lib/email/voice-precheck'
import { runPreSendGates, type PreSendGateReport } from '@/lib/newsletter/pre-send-gates'
import { getNewsletter, setSubscriberStatus, type NewsletterSegment, type SubscriberStatus } from '@/lib/data'
import { scheduleNewsletter, unscheduleNewsletter } from '@/lib/data/newsletter/scheduled'
import { setNewsletterPaused, isNewsletterPaused } from '@/lib/data/newsletter/queue'
import {
  deleteSubscriber,
  getSubscriberById,
  reassignSubscriberBroker,
  updateSubscriberFields,
} from '@/lib/data/newsletter/subscribersAdmin'

async function requireSuperuser(): Promise<{ ok: true; email: string } | { ok: false }> {
  const access = await getCrmAccess()
  if (!access || access.role !== 'superuser') return { ok: false }
  return { ok: true, email: access.email }
}

async function requireAdmin(): Promise<{ ok: true; email: string } | { ok: false }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false }
  return { ok: true, email: access.email }
}

// ── Pre-send gates (R-2 citations + R-3 links) ────────────────────────────────

export type GateRunResult = { ok: boolean; report?: PreSendGateReport; voiceFailures?: string[]; error?: string }

/**
 * Run the pre-send checks on demand for the review page: R-1 brand voice,
 * R-2 every stat sentence cited, R-3 every internal link returns 200.
 */
export async function adminRunPreSendGatesAction(id: string): Promise<GateRunResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }
  const letter = await getNewsletter(id)
  if (!letter) return { ok: false, error: 'not_found' }
  if (!letter.body_html) return { ok: false, error: 'empty_body' }

  const voice = checkNewsletterVoice({ subject: letter.subject, bodyHtml: letter.body_html, bodyText: letter.body_text })
  const report = await runPreSendGates(letter)
  return { ok: voice.ok && report.ok, report, voiceFailures: voice.ok ? [] : voice.violations }
}

// ── Approve & Schedule / Unschedule ───────────────────────────────────────────

export type ScheduleResult = { ok: boolean; error?: string; report?: PreSendGateReport; voiceFailures?: string[] }

/**
 * Approve & Schedule: promotes draft → scheduled with a delivery start time.
 * The send cron enqueues it when scheduled_at arrives and the engagement-tiered
 * tranche machinery delivers it gradually over days. BLOCKED unless R-1 voice,
 * R-2 citations, and R-3 link checks all pass — the failure list comes back so
 * the review page can show exactly what to fix.
 */
export async function adminScheduleNewsletterAction(id: string, scheduledAtIso: string): Promise<ScheduleResult> {
  const gate = await requireSuperuser()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }

  const letter = await getNewsletter(id)
  if (!letter) return { ok: false, error: 'not_found' }
  if (letter.status !== 'draft') return { ok: false, error: 'not_a_draft' }
  if (!letter.body_html && !letter.body_text) return { ok: false, error: 'empty_body' }

  const when = new Date(scheduledAtIso)
  if (!Number.isFinite(when.getTime())) return { ok: false, error: 'invalid_date' }
  if (when.getTime() < Date.now() - 5 * 60 * 1000) return { ok: false, error: 'date_in_past' }

  // R-1 voice — same hard-fail bar as the immediate send.
  const voice = checkNewsletterVoice({ subject: letter.subject, bodyHtml: letter.body_html, bodyText: letter.body_text })
  // R-2 + R-3 — citations + internal links.
  const report = await runPreSendGates(letter)
  if (!voice.ok || !report.ok) {
    return { ok: false, error: 'gates_failed', report, voiceFailures: voice.ok ? [] : voice.violations }
  }

  const moved = await scheduleNewsletter(id, when.toISOString())
  if (!moved) return { ok: false, error: 'not_a_draft' }

  revalidatePath('/admin/newsletters')
  revalidatePath(`/admin/newsletters/${id}`)
  return { ok: true }
}

/** Pull a scheduled issue back to draft (before the send cron picks it up). */
export async function adminUnscheduleNewsletterAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireSuperuser()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }
  const moved = await unscheduleNewsletter(id)
  if (!moved) return { ok: false, error: 'not_scheduled' }
  revalidatePath('/admin/newsletters')
  revalidatePath(`/admin/newsletters/${id}`)
  return { ok: true }
}

// ── Pause / resume (circuit-breaker control) ──────────────────────────────────

/**
 * Manual pause/resume on a sending issue. The deliverability circuit-breaker
 * sets the same flag automatically (bounce >2% / complaint >0.1%); resume is
 * the explicit admin ok the breaker waits for.
 */
export async function adminSetNewsletterPauseAction(id: string, paused: boolean): Promise<{ ok: boolean; paused?: boolean; error?: string }> {
  const gate = await requireSuperuser()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }
  const letter = await getNewsletter(id)
  if (!letter) return { ok: false, error: 'not_found' }
  if (letter.status !== 'sending' && letter.status !== 'scheduled') return { ok: false, error: 'not_sending' }
  await setNewsletterPaused(id, paused)
  const now = await isNewsletterPaused(id)
  revalidatePath(`/admin/newsletters/${id}`)
  return { ok: true, paused: now }
}

// ── Subscriber management ─────────────────────────────────────────────────────

const SEGMENTS: NewsletterSegment[] = ['general', 'buyer', 'seller', 'past-client']

export type SubscriberEditInput = {
  name?: string | null
  segment?: string
  /** Reassign the linked CRM person's broker (matt | rebecca | paul). */
  broker?: string
  /** Status toggle (active / unsubscribed) — reuses the existing rail. */
  status?: SubscriberStatus
}

/** Edit a subscriber: name, segment, status, and broker reassignment. */
export async function adminEditSubscriberAction(id: string, input: SubscriberEditInput): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireSuperuser()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }
  const existing = await getSubscriberById(id)
  if (!existing) return { ok: false, error: 'not_found' }

  const fields: { name?: string | null; segment?: NewsletterSegment } = {}
  if (input.name !== undefined) fields.name = (input.name ?? '').trim() || null
  if (input.segment && (SEGMENTS as string[]).includes(input.segment)) fields.segment = input.segment as NewsletterSegment
  if (fields.name !== undefined || fields.segment) {
    const r = await updateSubscriberFields(id, fields)
    if (!r.ok) return { ok: false, error: 'persist_failed' }
  }

  if (input.status && input.status !== existing.status) {
    // Guard: an admin edit can re-add someone, but that is an explicit choice in
    // the dialog — the same rail as the existing Remove / Re-add toggle.
    const r = await setSubscriberStatus(id, input.status)
    if (!r.ok) return { ok: false, error: 'persist_failed' }
  }

  if (input.broker) {
    const r = await reassignSubscriberBroker(id, input.broker)
    if (!r.ok && r.error !== 'no_crm_person') return { ok: false, error: r.error }
    if (!r.ok && r.error === 'no_crm_person') {
      revalidatePath('/admin/newsletters/subscribers')
      return { ok: false, error: 'no_crm_person' }
    }
  }

  revalidatePath('/admin/newsletters/subscribers')
  return { ok: true }
}

/**
 * Delete a subscriber row. Deleting a NON-active row erases the opt-out record
 * (a plain unsubscribe lives only on this row), so that path requires the
 * explicit confirmOptOutRemoval acknowledgment from the dialog (S-10).
 */
export async function adminDeleteSubscriberAction(
  id: string,
  opts?: { confirmOptOutRemoval?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireSuperuser()
  if (!gate.ok) return { ok: false, error: 'unauthorized' }
  const existing = await getSubscriberById(id)
  if (!existing) return { ok: false, error: 'not_found' }
  if (existing.status !== 'active' && !opts?.confirmOptOutRemoval) {
    return { ok: false, error: 'opt_out_record' }
  }
  const r = await deleteSubscriber(id)
  if (!r.ok) return { ok: false, error: 'persist_failed' }
  revalidatePath('/admin/newsletters/subscribers')
  return { ok: true }
}
