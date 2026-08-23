/**
 * /api/cron/tc-envelope-reminders — 48h chase for unsigned envelope recipients.
 *
 * Live Forms Create-envelope checkbox "Enable automatic reminders on this
 * envelope" (checked by default, 2026-08-23). Reuses sendSigningInvite
 * (reminder: true). Ordered routing: only people whose turn has started
 * (token or viewed). Fail-open per recipient.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} (requireCronAuth).
 * Schedule: vercel.json daily.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { generateSigningToken } from '@/lib/tc/signing'
import { sendSigningInvite } from '@/lib/tc/signing-emails'
import { pickEnvelopeReminders, type EnvelopeReminderCandidate } from '@/lib/tc/envelope-reminders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://ryan-realty.com').replace(/\/$/, '')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbRow = Record<string, any>

export async function GET(request: Request) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const startMs = Date.now()
  const sb = createServiceClient()
  const { data: envs, error: envErr } = await sb
    .from('tc_envelopes')
    .select('id, name, status, reminders_enabled, cycle_id, created_by, sent_at, invite_subject, invite_body, tc_cycles(id, deal_id, tc_deals(address))')
    .in('status', ['sent', 'partially_signed'])
  if (envErr) {
    console.error('[tc-envelope-reminders]', envErr.message)
    return NextResponse.json({ ok: false, error: envErr.message }, { status: 500 })
  }
  if (!envs?.length) {
    return NextResponse.json({ ok: true, reminded: 0, ms: Date.now() - startMs })
  }

  const envIds = (envs as DbRow[]).map((e) => e.id)
  const { data: recips, error: recErr } = await sb
    .from('tc_envelope_recipients')
    .select('id, envelope_id, role, action_required, name, email, completed_at, declined_at, last_reminded_at, auth_token_hash, viewed_at')
    .in('envelope_id', envIds)
  if (recErr) {
    console.error('[tc-envelope-reminders]', recErr.message)
    return NextResponse.json({ ok: false, error: recErr.message }, { status: 500 })
  }

  const envById = new Map((envs as DbRow[]).map((e) => [e.id as string, e]))
  const candidates: EnvelopeReminderCandidate[] = ((recips ?? []) as DbRow[]).map((r) => {
    const env = envById.get(r.envelope_id) as DbRow | undefined
    const cycle = env?.tc_cycles
    return {
      recipientId: String(r.id),
      envelopeId: String(r.envelope_id),
      envelopeName: String(env?.name ?? 'documents'),
      envelopeStatus: String(env?.status ?? ''),
      remindersEnabled: env?.reminders_enabled !== false,
      cycleId: String(env?.cycle_id ?? cycle?.id ?? ''),
      createdBy: (env?.created_by as string | null) ?? null,
      propertyAddress: String(cycle?.tc_deals?.address ?? 'your transaction'),
      email: String(r.email ?? ''),
      name: String(r.name ?? ''),
      role: String(r.role ?? ''),
      actionRequired: r.action_required ?? null,
      completedAt: r.completed_at ?? null,
      declinedAt: r.declined_at ?? null,
      sentAt: (env?.sent_at as string | null) ?? null,
      lastRemindedAt: r.last_reminded_at ?? null,
      authTokenHash: r.auth_token_hash ?? null,
      viewedAt: r.viewed_at ?? null,
    }
  })

  const due = pickEnvelopeReminders(candidates, Date.now())
  let reminded = 0
  for (const c of due) {
    try {
      const { token, hash } = generateSigningToken()
      await sb.from('tc_envelope_recipients').update({ auth_token_hash: hash }).eq('id', c.recipientId)
      const envRow = envById.get(c.envelopeId)
      const sent = await sendSigningInvite({
        to: c.email,
        recipientName: c.name || 'there',
        envelopeName: c.envelopeName,
        propertyAddress: c.propertyAddress,
        signUrl: `${siteUrl()}/sign/${token}`,
        replyTo: c.createdBy?.includes('@') ? c.createdBy : undefined,
        reminder: true,
        customSubject: (envRow?.invite_subject as string | null) ?? null,
        customBody: (envRow?.invite_body as string | null) ?? null,
      })
      if (sent.error) {
        console.warn('[tc-envelope-reminders] send', sent.error)
        continue
      }
      const now = new Date().toISOString()
      await sb.from('tc_envelope_recipients').update({ last_reminded_at: now }).eq('id', c.recipientId)
      await sb.from('tc_events').insert({
        cycle_id: c.cycleId || null,
        actor: 'system',
        action: 'envelope_reminder_sent',
        detail: { envelope: c.envelopeName, recipient: c.name || c.email, automatic: true },
      })
      reminded++
    } catch (err) {
      console.warn('[tc-envelope-reminders] recipient', c.recipientId, err)
    }
  }

  return NextResponse.json({ ok: true, scanned: candidates.length, reminded, ms: Date.now() - startMs })
}
