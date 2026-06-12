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
 *  - SMS steps send via Twilio messaging service when A2P campaign is VERIFIED.
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
import { sendCrmEmail, CRM_MAILBOXES } from '@/lib/crm/gmail'
import { isSuppressed } from '@/lib/crm/suppressions'
import { renderCrmMerge, referencesCmaLink } from '@/lib/crm/merge'
import { sendSmsViaMessagingService, getA2pCampaignStatus } from '@/lib/crm/twilio'
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

function inSmsQuietHours(): boolean {
  const h = laHour()
  return h < 8 || h >= 21
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
  return renderCrmMerge(text, person)
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

  let executed = 0, paused = 0, completed = 0, skippedSms = 0, skippedDupEmail = 0, suppressed = 0, errored = 0, queuedSms = 0

  // A2P campaign status — one Twilio call per run. Until VERIFIED, SMS steps
  // queue visibly (timeline row with the rendered text) instead of erroring,
  // and fire automatically on the first run after approval.
  const a2pStatus = await getA2pCampaignStatus().catch(() => null)

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
        .select('id,fub_legacy_id,first_name,name,emails,phones,tags,custom,assigned_broker')
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
          person_id: person.id, kind: 'email_out', title: subject, body: sent.plainBody,
          payload: { gmailId: sent.gmailId, sequence: seq.name, step: en.step_index, templateKey: step.templateKey ?? null, to },
          broker: mailbox.slug, source: 'sequence', dedupe_key: `gmail:${sent.gmailId}:p${person.id}`,
        })
      } else if (step.channel === 'sms') {
        if (inSmsQuietHours()) {
          await finish({ next_run_at: nextSendWindow().toISOString() })
          continue
        }
        const gate = await isSuppressed(person.id, 'sms')
        if (gate.suppressed) {
          await finish({ status: 'suppressed' })
          await log(`Sequence "${seq.name}" halted — suppressed (${gate.reasons.join(', ')})`)
          suppressed++
          continue
        }
        let toPhone =
          (person.phones as Array<{ value?: string; isPrimary?: number | boolean }> | null)
            ?.sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary))[0]?.value ?? ''
        if (!toPhone) {
          const { data: pt } = await sb.from('crm_contact_points').select('value').eq('person_id', person.id).eq('kind', 'phone').limit(1).maybeSingle()
          toPhone = pt?.value ?? ''
        }
        if (!toPhone) {
          await finish({ status: 'stopped' })
          await log(`Sequence "${seq.name}" stopped — no phone on file`)
          errored++
          continue
        }
        let body = step.body ?? ''
        if (step.templateKey) {
          const { data: tpl } = await sb.from('crm_templates').select('body').eq('key', step.templateKey).maybeSingle()
          if (tpl?.body) body = tpl.body
        }
        if (!body.trim()) {
          await finish({ status: 'stopped' })
          await log(`Sequence "${seq.name}" stopped — empty SMS step`)
          errored++
          continue
        }

        // Hold until the CMA the text links to actually exists (the expired
        // opening text merges %cma_link%; never send a dead or empty link).
        const custom = (person.custom as Record<string, unknown> | null) ?? {}
        if (referencesCmaLink(body) && !custom.cmaLink) {
          await sb.from('crm_timeline').upsert(
            {
              person_id: person.id, kind: 'system',
              title: 'Text holding — waiting for the CMA to be built',
              body: `Step ${en.step_index} of "${seq.name}" links the property CMA. It sends once the CMA link is on the contact.`,
              source: 'sequence', dedupe_key: `sms-hold-cma:e${en.id}:s${en.step_index}`,
            },
            { onConflict: 'dedupe_key', ignoreDuplicates: true },
          )
          await finish({ next_run_at: new Date(Date.now() + 4 * 3600e3).toISOString() })
          queuedSms++
          continue
        }

        body = renderMerge(body, person)

        // A2P gate: queue (visible, with the exact text) instead of erroring.
        if (a2pStatus !== 'VERIFIED') {
          await sb.from('crm_timeline').upsert(
            {
              person_id: person.id, kind: 'system',
              title: 'Text queued — sends when A2P campaign is approved',
              body,
              payload: { sequence: seq.name, step: en.step_index, to: toPhone, a2pStatus: a2pStatus ?? 'UNKNOWN', queued: true },
              source: 'sequence', dedupe_key: `sms-queued-a2p:e${en.id}:s${en.step_index}`,
            },
            { onConflict: 'dedupe_key', ignoreDuplicates: true },
          )
          await finish({ next_run_at: new Date(Date.now() + 4 * 3600e3).toISOString() })
          queuedSms++
          continue
        }

        const sent = await sendSmsViaMessagingService({ to: toPhone, body })
        if (!sent.ok) {
          await finish({ next_run_at: new Date(Date.now() + 30 * 60000).toISOString() })
          await log(`Sequence SMS send failed, retrying in 30m`, sent.error)
          errored++
          continue
        }
        const mailbox = CRM_MAILBOXES.find((m) => m.slug === person.assigned_broker) ?? CRM_MAILBOXES[0]
        await sb.from('crm_timeline').insert({
          person_id: person.id, kind: 'sms_out', title: 'Text sent', body,
          payload: { twilioSid: sent.sid, sequence: seq.name, step: en.step_index, templateKey: step.templateKey ?? null, to: toPhone },
          broker: mailbox.slug, source: 'sequence', dedupe_key: `twilio:${sent.sid}:p${person.id}`,
        })
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
    ok: true, due: (due ?? []).length, executed, paused, completed, skippedSms, skippedDupEmail, suppressed, errored, queuedSms, a2pStatus,
    duration_ms: Date.now() - startMs,
  })
}
