/**
 * The tag -> suppressed-channel mapping, on its own, with NO 'server-only'.
 *
 * It lives here rather than in lib/crm/suppressions.ts so a client component can
 * ask "is this a protected compliance tag?" without dragging the send-time
 * chokepoint (and its Supabase service client) into the browser bundle. The
 * bulk tag form needs exactly that: it lets an operator type a new tag, so it
 * has to refuse compliance:hard-stop before enqueueing a job the worker would
 * refuse anyway.
 *
 * ONE source. suppressions.ts re-exports both symbols, so every existing
 * importer is unchanged and there is still no second copy to drift.
 */

export type SendChannel = 'email' | 'sms' | 'call'

export const TAG_CHANNEL: ReadonlyArray<{ tag: string; channels: ReadonlyArray<'all' | SendChannel> }> = [
  { tag: 'compliance:hard-stop', channels: ['all'] },
  { tag: 'contact:do-not-text', channels: ['sms'] },
  // TCPA: a text message is legally a "call". A do-not-call contact must be
  // blocked from SMS as well as voice (incident 2026-06-16: do-not-call
  // homeowners were texted because this mapped to 'call' only).
  { tag: 'contact:do-not-call', channels: ['call', 'sms'] },
  { tag: 'do_not_email', channels: ['email'] },
  { tag: 'unsubscribed', channels: ['email'] },
  { tag: 'bounced', channels: ['email'] },
  { tag: 'complained', channels: ['email'] },
]
