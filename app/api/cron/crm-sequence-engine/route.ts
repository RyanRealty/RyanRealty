/**
 * CRM sequence engine — executes due enrollment steps for ACTIVE sequences
 * (blueprint §5.2). The FUB action-plan replacement.
 *
 * Safety model:
 *  - All imported sequences sit in status='paused'; the engine only processes
 *    enrollments whose sequence is 'active'. Activating a sequence is a
 *    deliberate human/agent action — nothing auto-fires after deploy.
 *  - Every email step passes the suppression chokepoint (fail-closed).
 *  - stop_on_reply: any inbound timeline entry after enrollment pauses the drip.
 *  - SMS steps are skipped-with-log until Twilio is upgraded + A2P approved.
 *  - Send window 07:00–19:00 America/Los_Angeles; outside it, steps reschedule.
 *
 * Step schema (native): { channel: 'email'|'sms'|'task'|'tag', delayDays?,
 *   delayMinutes?, templateKey?, subject?, body?, taskName?, taskType?,
 *   addTags?: string[], removeTags?: string[] }
 * FUB-imported sequences carry raw FUB steps; they normalize at activation
 * time. Unparseable steps stop the enrollment safely.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendCrmEmail } from '@/lib/crm/gmail'
import { isSuppressed } from '@/lib/crm/suppressions'
import { CRM_MAILBOXES } from '@/lib/crm/gmail'
import { addPersonTags, replacePersonTags } from '@/lib/followupboss'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BATCH = 50

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) return !isProd
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

function laHour(): number {
  return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Los_Angeles' }).format(new Date()))
}

function nextSendWindow(): Date {
  // next 07:05 LA time
  const now = new Date()
  const la = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const target = new Date(la)
  target.setHours(7, 5, 0, 0)
  if (la.getHours() >= 7) target.setDate(target.getDate() + 1)
  return new Date(now.getTime() + (target.getTime() - la.getTime()))
}

type Step = {
  channel?: string
  delayDays?: number
  delayMinutes?: number
  templateKey?: string
  subject?: string
  body?: string
  taskName?: string
  taskType?: string
  addTags?: string[]
  removeTags?: string[]
}

function renderMerge(text: string, person: { first_name?: string | null; name?: string | null; custom?: Record<string, unknown> }): string {
  const first = person.first_name || (person.name ?? '').split(' ')[0] || 'there'
  const address = String(person.custom?.customSellerPropertyAddress ?? person.custom?.customPropertyAddress ?? '')
  return text
    .replaceAll('%contact_first_name%', first)
    .replaceAll('%first%', first).replaceAll('{{first_name}}', first).replaceAll('{{firstName}}', first)
    .replaceAll('%address%', address).replaceAll('{{address}}', address)
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const startMs = Date.now()
  const sb = createServiceClient()

  const { data: due, error } = await sb
    .from('crm_sequence_enrollments')
    .select('id,person_id,sequence_id,step_index,created_at,crm_sequences!inner(id,name,status,stop_on_reply,steps)')
    .eq('status', 'running')
    .eq('crm_sequences.status', 'active')
    .or(`next_run_at.is.null,next_run_at.lte.${new Date().toISOString()}`)
    .limit(BATCH)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  let executed = 0, paused = 0, completed = 0, skippedSms = 0, skippedDupEmail = 0, suppressed = 0, errored = 0

  for (const en of due ?? []) {
    const seq = en.crm_sequences as unknown as { name: string; stop_on_reply: boolean; steps: Step[] }
    const finish = async (patch: Record<string, unknown>) =>
      sb.from('crm_sequence_enrollments').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', en.id)
    const log = async (title: string, body?: string) =>
      sb.from('crm_timeline').insert({ person_id: en.person_id, kind: 'system', title, body: body ?? null, source: 'sequence' })

    try {
      // stop-on-reply: any inbound since enrollment
      if (seq.stop_on_reply) {
        const { count } = await sb
          .from('crm_timeline')
          .select('id', { count: 'exact', head: true })
          .eq('person_id', en.person_id)
          .in('kind', ['email_in', 'sms_in', 'call', 'voicemail'])
          .gte('ts', en.created_at)
        if ((count ?? 0) > 0) {
          await finish({ status: 'paused_reply' })
          await log(`Sequence "${seq.name}" paused — contact replied`)
          paused++
          continue
        }
      }

      const step = (seq.steps ?? [])[en.step_index]
      if (!step || !step.channel) {
        await finish({ status: 'stopped' })
        await log(`Sequence "${seq.name}" stopped — step ${en.step_index} missing or not normalized`)
        errored++
        continue
      }

      const { data: person } = await sb
        .from('crm_people')
        .select('id,fub_legacy_id,first_name,name,emails,tags,custom,assigned_broker')
        .eq('id', en.person_id)
        .single()
      if (!person) { await finish({ status: 'stopped' }); errored++; continue }

      if (step.channel === 'email') {
        if (laHour() < 7 || laHour() >= 19) {
          await finish({ next_run_at: nextSendWindow().toISOString() })
          continue
        }
        const gate = await isSuppressed(person.id, 'email')
        if (gate.suppressed) {
          await finish({ status: 'suppressed' })
          await log(`Sequence "${seq.name}" halted — suppressed (${gate.reasons.join(', ')})`)
          suppressed++
          continue
        }
        const to = (person.emails as Array<{ value?: string }>)?.[0]?.value
        if (!to) { await finish({ status: 'stopped' }); await log(`Sequence "${seq.name}" stopped — no email on file`); errored++; continue }

        // Same-human guard (audit 2026-06-10): farm imports create one person
        // row PER PARCEL, so the same email address can sit on several people.
        // Never send the same template to an address that already got it via a
        // sibling person — advance the step without sending.
        if (step.templateKey) {
          const { data: siblings } = await sb
            .from('crm_contact_points')
            .select('person_id')
            .eq('kind', 'email')
            .ilike('value', to)
            .neq('person_id', person.id)
          if (siblings?.length) {
            const { count: alreadySent } = await sb
              .from('crm_timeline')
              .select('id', { count: 'exact', head: true })
              .in('person_id', siblings.map((s) => s.person_id))
              .eq('kind', 'email_out')
              .eq('source', 'sequence')
              .filter('payload->>templateKey', 'eq', step.templateKey)
            if ((alreadySent ?? 0) > 0) {
              await log(`Sequence "${seq.name}" step ${en.step_index} skipped — ${to} already received ${step.templateKey} via a sibling person row`)
              skippedDupEmail++
              const nextIdx = en.step_index + 1
              const nxt = (seq.steps ?? [])[nextIdx] as Step | undefined
              if (!nxt) { await finish({ status: 'completed', step_index: nextIdx }); completed++ }
              else {
                const dMs = ((nxt.delayDays ?? 0) * 86400 + (nxt.delayMinutes ?? 0) * 60) * 1000
                await finish({ step_index: nextIdx, next_run_at: new Date(Date.now() + Math.max(dMs, 60000)).toISOString() })
              }
              continue
            }
          }
        }

        let subject = step.subject ?? ''
        let body = step.body ?? ''
        if (step.templateKey) {
          const { data: tpl } = await sb.from('crm_templates').select('subject,body').eq('key', step.templateKey).maybeSingle()
          if (tpl) { subject = tpl.subject ?? subject; body = tpl.body ?? body }
        }
        if (!body) { await finish({ status: 'stopped' }); await log(`Sequence "${seq.name}" stopped — empty email step`); errored++; continue }
        subject = renderMerge(subject, person)
        body = renderMerge(body, person)

        const mailbox = CRM_MAILBOXES.find((m) => m.slug === person.assigned_broker) ?? CRM_MAILBOXES[0]
        const sent = await sendCrmEmail({ fromMailbox: mailbox.email, to, subject, bodyText: body })
        if (!sent.ok) { await finish({ next_run_at: new Date(Date.now() + 30 * 60000).toISOString() }); await log(`Sequence email send failed, retrying in 30m`, sent.error); errored++; continue }
        await sb.from('crm_timeline').insert({
          person_id: person.id, kind: 'email_out', title: subject, body,
          payload: { gmailId: sent.gmailId, sequence: seq.name, step: en.step_index, templateKey: step.templateKey ?? null, to },
          broker: mailbox.slug, source: 'sequence', dedupe_key: `gmail:${sent.gmailId}:p${person.id}`,
        })
      } else if (step.channel === 'sms') {
        await log(`Sequence "${seq.name}" SMS step skipped — Twilio not yet live`)
        skippedSms++
      } else if (step.channel === 'task') {
        await sb.from('crm_tasks').insert({
          person_id: person.id, name: renderMerge(step.taskName ?? 'Follow up', person),
          type: step.taskType ?? 'Follow Up',
          due_at: new Date(Date.now() + 3600e3).toISOString(),
          assigned_broker: person.assigned_broker, origin: 'sequence',
        })
      } else if (step.channel === 'tag') {
        const current = (person.tags as string[]) ?? []
        const next = [...new Set([...current.filter((t) => !(step.removeTags ?? []).includes(t)), ...(step.addTags ?? [])])]
        await sb.from('crm_people').update({ tags: next, updated_at: new Date().toISOString() }).eq('id', person.id)
        if (person.fub_legacy_id) {
          if (step.removeTags?.length) await replacePersonTags(person.fub_legacy_id, next)
          else if (step.addTags?.length) await addPersonTags(person.fub_legacy_id, step.addTags)
        }
      } else {
        await finish({ status: 'stopped' })
        await log(`Sequence "${seq.name}" stopped — unknown channel "${step.channel}"`)
        errored++
        continue
      }

      // advance
      const nextIndex = en.step_index + 1
      const nextStep = (seq.steps ?? [])[nextIndex] as Step | undefined
      if (!nextStep) {
        await finish({ status: 'completed', step_index: nextIndex })
        await log(`Sequence "${seq.name}" completed`)
        completed++
      } else {
        const delayMs = ((nextStep.delayDays ?? 0) * 86400 + (nextStep.delayMinutes ?? 0) * 60) * 1000
        await finish({ step_index: nextIndex, next_run_at: new Date(Date.now() + Math.max(delayMs, 60000)).toISOString() })
      }
      executed++
    } catch (e) {
      errored++
      await finish({ next_run_at: new Date(Date.now() + 30 * 60000).toISOString() })
      await log('Sequence step error — retrying in 30m', e instanceof Error ? e.message : String(e))
    }
  }

  return NextResponse.json({
    ok: true, due: (due ?? []).length, executed, paused, completed, skippedSms, skippedDupEmail, suppressed, errored,
    duration_ms: Date.now() - startMs,
  })
}
