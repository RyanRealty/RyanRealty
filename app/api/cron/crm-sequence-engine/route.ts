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
import { referencesCmaLink, findUnresolvedMergeTokens } from '@/lib/crm/merge'
import { isArchivedPlaceholder, isAuthorized, laHour, inSmsQuietHours, nextSendWindow, renderMerge, type Step } from './helpers'
import { buildMergeContext } from '@/lib/crm/merge-context'
import { sendSms, sendSmsViaMessagingService, brokerTwilioNumber, getA2pCampaignStatus } from '@/lib/crm/twilio'
import { addPersonTags, replacePersonTags } from '@/lib/followupboss'
import { isConditionNode, type AnyStepOrCondition } from '@/lib/crm/sequence-step-schema'
import { resolveConditionPath } from '@/lib/crm/conditions-eval'
import { manualEnrollPerson } from '@/lib/crm/enroll'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BATCH = 50


export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const startMs = Date.now()
  const sb = createServiceClient()

  // Overlap lease: if a previous run is still going (it exceeded the cron
  // interval), skip this tick instead of re-processing the same due enrollments
  // and racing the step-index advance. The lease self-expires after 300s (the
  // maxDuration) so a crash can't wedge the cron.
  const { data: gotLease } = await sb.rpc('crm_try_cron_lease', {
    p_name: 'crm-sequence-engine',
    p_lease_seconds: 300,
  })
  if (gotLease === false) {
    return NextResponse.json({ ok: true, skipped: 'previous run still in progress' })
  }

  const { data: due, error } = await sb
    .from('crm_sequence_enrollments')
    .select('id,person_id,sequence_id,step_index,created_at,first_touch_override,crm_sequences!inner(id,name,status,stop_on_reply,steps)')
    .eq('status', 'running')
    .eq('crm_sequences.status', 'active')
    .or(`next_run_at.is.null,next_run_at.lte.${new Date().toISOString()}`)
    .limit(BATCH)
  if (error) {
    await sb.rpc('crm_release_cron_lease', { p_name: 'crm-sequence-engine' })
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  let executed = 0, paused = 0, completed = 0, skippedDupEmail = 0, suppressed = 0, errored = 0, queuedSms = 0
  const skippedSms = 0 // reserved for future direct-SMS skip tracking; currently unused

  // A2P campaign status — one Twilio call per run. Until VERIFIED, SMS steps
  // queue visibly (timeline row with the rendered text) instead of erroring,
  // and fire automatically on the first run after approval.
  const a2pStatus = await getA2pCampaignStatus().catch(() => null)

  // Per-run template cache: a batch of 50 enrollments commonly shares a handful
  // of templates. Fetch each templateKey at most once per run instead of once
  // per enrollment (perf audit: repeated crm_templates lookups in the loop).
  const templateCache = new Map<string, { subject: string | null; body: string | null }>()
  async function loadTemplate(key: string): Promise<{ subject: string | null; body: string | null }> {
    const hit = templateCache.get(key)
    if (hit) return hit
    const { data } = await sb.from('crm_templates').select('subject,body').eq('key', key).maybeSingle()
    const tpl = { subject: (data?.subject as string | null) ?? null, body: (data?.body as string | null) ?? null }
    templateCache.set(key, tpl)
    return tpl
  }

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

      // Load the contact ONCE per enrollment. Previously the condition loop
      // re-fetched stage/tags/source every iteration (up to 10 queries) and the
      // step path fetched the full row again — this single read replaces all of
      // them (perf audit: per-enrollment N+1 + duplicate person fetch).
      const { data: person } = await sb
        .from('crm_people')
        .select('id,fub_legacy_id,first_name,last_name,name,stage,source,lender_name,emails,phones,addresses,tags,custom,assigned_broker')
        .eq('id', en.person_id)
        .single()
      if (!person) { await finish({ status: 'stopped' }); errored++; continue }

      // ── Condition node resolution ────────────────────────────────────────
      // A 'condition' node (type === 'condition') is not an execution step —
      // it is a branching decision. The engine evaluates it, splices the
      // chosen path into the remaining steps, and then re-reads the step at
      // the same index (which is now the first step of the chosen path).
      // This is done in a loop so nested conditions resolve correctly. The
      // contact loaded above (stage/tags/source live on it) is reused every
      // iteration — no per-iteration re-fetch.
      let rawSteps = (seq.steps ?? []) as AnyStepOrCondition[]
      let condIterations = 0
      while (condIterations < 10) {
        const candidate = rawSteps[en.step_index] as AnyStepOrCondition | undefined
        if (!candidate || !isConditionNode(candidate)) break
        const chosen = resolveConditionPath(candidate, person)
        // Splice: replace the condition node with the chosen path's steps
        rawSteps = [
          ...rawSteps.slice(0, en.step_index),
          ...chosen,
          ...rawSteps.slice(en.step_index + 1),
        ]
        // Materialized in-memory only; the steps column stays authoritative.
        condIterations++
      }

      const step = rawSteps[en.step_index] as Step | undefined
      if (!step || !step.channel) {
        await finish({ status: 'stopped' })
        await log(`Sequence "${seq.name}" stopped — step ${en.step_index} missing or not normalized`)
        errored++
        continue
      }

      // Merge context — resolves %agent_*%/%sender_*%/%company_*% from real
      // data. Automated sends come "from" the assigned broker, so sender=agent.
      // Cheap per-iteration: it reads cached DALs (brokers/telephony/company).
      const mergeCtx = await buildMergeContext({ person, senderSlug: person.assigned_broker ?? null })

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
              const nxt = rawSteps[nextIdx] as Step | undefined
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
          const tpl = await loadTemplate(step.templateKey)
          subject = tpl.subject ?? subject
          body = tpl.body ?? body
        }
        if (!body) { await finish({ status: 'stopped' }); await log(`Sequence "${seq.name}" stopped — empty email step`); errored++; continue }
        // Archived-placeholder guard: a FUB-archived template imports with
        // subject/body = the literal "archived". The empty-body check above
        // misses it (it is 8 non-empty chars). NEVER deliver a placeholder.
        if (isArchivedPlaceholder(subject, body)) {
          await finish({ status: 'stopped' })
          await log(`Sequence "${seq.name}" stopped — archived/placeholder template (${step.templateKey ?? 'inline'})`)
          errored++
          continue
        }

        // CMA hold (parity with SMS): never email a dead/empty CMA link. Checked
        // on the raw body (the %cma_link% token survives until renderMerge).
        const emailCustom = (person.custom as Record<string, unknown> | null) ?? {}
        if (referencesCmaLink(body) && !emailCustom.cmaLink) {
          await sb.from('crm_timeline').upsert(
            {
              person_id: person.id, kind: 'system',
              title: 'Email holding — waiting for the CMA to be built',
              body: `Step ${en.step_index} of "${seq.name}" links the property CMA. It sends once the CMA link is on the contact.`,
              source: 'sequence', dedupe_key: `email-hold-cma:e${en.id}:s${en.step_index}`,
            },
            { onConflict: 'dedupe_key', ignoreDuplicates: true },
          )
          await finish({ next_run_at: new Date(Date.now() + 4 * 3600e3).toISOString() })
          continue
        }

        subject = renderMerge(subject, person, mergeCtx)
        body = renderMerge(body, person, mergeCtx)

        // Fail-closed: never deliver literal %token% / {{token}} text to a client.
        const emailUnresolved = findUnresolvedMergeTokens(`${subject} ${body}`)
        if (emailUnresolved.length) {
          await finish({ status: 'stopped' })
          await log(`Sequence "${seq.name}" stopped — unresolved merge tokens (${emailUnresolved.join(', ')})`)
          errored++
          continue
        }

        const mailbox = CRM_MAILBOXES.find((m) => m.slug === person.assigned_broker) ?? CRM_MAILBOXES[0]
        const sent = await sendCrmEmail({
          fromMailbox: mailbox.email, to, subject, bodyText: body, withSignature: true,
          track: { personId: person.id, emailKey: `seq:${seq.name}:${en.step_index}`, label: subject },
        })
        if (!sent.ok) { await finish({ next_run_at: new Date(Date.now() + 30 * 60000).toISOString() }); await log(`Sequence email send failed, retrying in 30m`, sent.error); errored++; continue }
        await sb.from('crm_timeline').insert({
          person_id: person.id, kind: 'email_out', title: subject, body: sent.plainBody,
          payload: { gmailId: sent.gmailId, sequence: seq.name, step: en.step_index, templateKey: step.templateKey ?? null, to },
          broker: mailbox.slug, source: 'sequence', dedupe_key: `gmail:${sent.gmailId}:p${person.id}`,
        })
      } else if (step.channel === 'sms') {
        // Gate order matters: suppression first (suppressed people never even
        // show a queued text), then CMA hold + A2P queue (visible immediately,
        // even during quiet hours — nothing is being sent), then quiet hours
        // for the actual send.
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
          const tpl = await loadTemplate(step.templateKey)
          if (tpl.body) body = tpl.body
        }
        // Broker-edited first touch (set at approval) wins over the template.
        if (en.step_index === 0 && (en as { first_touch_override?: string | null }).first_touch_override) {
          body = (en as { first_touch_override?: string | null }).first_touch_override as string
        }
        if (!body.trim()) {
          await finish({ status: 'stopped' })
          await log(`Sequence "${seq.name}" stopped — empty SMS step`)
          errored++
          continue
        }
        // Same archived-placeholder guard as the email path (FUB-archived
        // templates import body = the literal "archived").
        if (isArchivedPlaceholder(body, body)) {
          await finish({ status: 'stopped' })
          await log(`Sequence "${seq.name}" stopped — archived/placeholder SMS template`)
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

        body = renderMerge(body, person, mergeCtx)

        // Fail-closed: never text literal %token% / {{token}} content to a client.
        const smsUnresolved = findUnresolvedMergeTokens(body)
        if (smsUnresolved.length) {
          await finish({ status: 'stopped' })
          await log(`Sequence "${seq.name}" stopped — unresolved merge tokens (${smsUnresolved.join(', ')})`)
          errored++
          continue
        }

        // ── Channel decision (Matt 2026-06-13): text via Twilio if A2P is live;
        // else the Mac iMessage relay as backup; else the step's email fallback
        // ("optional email or text"); else hold + queue visibly until A2P clears.
        const mailbox = CRM_MAILBOXES.find((m) => m.slug === person.assigned_broker) ?? CRM_MAILBOXES[0]
        if (a2pStatus === 'VERIFIED') {
          // Quiet hours gate the actual Twilio send only (8 AM to 9 PM PT).
          if (inSmsQuietHours()) { await finish({ next_run_at: nextSendWindow().toISOString() }); continue }
          // Send from the assigned broker's OWN Twilio line (same model as the
          // composer) so the lead always sees a consistent caller ID — the
          // pooled messaging service picks an arbitrary sticky number (this is
          // how texts went out from the temp 541.224.5025 line, 2026-07-02
          // fix). MS remains the fallback when no broker line resolves.
          const seqFrom = await brokerTwilioNumber(mailbox.slug)
          const sent = seqFrom
            ? await sendSms({ from: seqFrom, to: toPhone, body })
            : await sendSmsViaMessagingService({ to: toPhone, body })
          if (!sent.ok) {
            await finish({ next_run_at: new Date(Date.now() + 30 * 60000).toISOString() })
            await log(`Sequence SMS send failed, retrying in 30m`, sent.error)
            errored++
            continue
          }
          await sb.from('crm_timeline').insert({
            person_id: person.id, kind: 'sms_out', title: 'Text sent', body,
            payload: { twilioSid: sent.sid, sequence: seq.name, step: en.step_index, templateKey: step.templateKey ?? null, to: toPhone },
            broker: mailbox.slug, source: 'sequence', dedupe_key: `twilio:${sent.sid}:p${person.id}`,
          })
        } else if (step.fallbackEmailBody) {
          // A2P not live — NEVER route a lead text through a personal iMessage
          // (incident 2026-06-16). Fall back to email so the touch still lands.
          // Reuses the email suppression + send path.
          // Texting unavailable and no relay — fall back to email so the touch
          // still lands. Reuses the email suppression + send path.
          const fbTo = (person.emails as Array<{ value?: string }>)?.[0]?.value
          if (fbTo && !(await isSuppressed(person.id, 'email')).suppressed) {
            const fbSubject = renderMerge(step.fallbackEmailSubject ?? 'A quick note from Ryan Realty', person, mergeCtx)
            const fbBody = renderMerge(step.fallbackEmailBody, person, mergeCtx)
            const sent = await sendCrmEmail({ fromMailbox: mailbox.email, to: fbTo, subject: fbSubject, bodyText: fbBody, withSignature: true })
            if (!sent.ok) { await finish({ next_run_at: new Date(Date.now() + 30 * 60000).toISOString() }); await log('Fallback email send failed, retrying in 30m', sent.error); errored++; continue }
            await sb.from('crm_timeline').insert({
              person_id: person.id, kind: 'email_out', title: fbSubject, body: sent.plainBody,
              payload: { gmailId: sent.gmailId, sequence: seq.name, step: en.step_index, via: 'sms-email-fallback', to: fbTo },
              broker: mailbox.slug, source: 'sequence', dedupe_key: `gmail:${sent.gmailId}:p${person.id}`,
            })
          } else {
            await finish({ next_run_at: new Date(Date.now() + 4 * 3600e3).toISOString() }); queuedSms++; continue
          }
        } else {
          // No live text channel and no email fallback — queue visibly.
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
      } else if (step.channel === 'task') {
        await sb.from('crm_tasks').insert({
          person_id: person.id, name: renderMerge(step.taskName ?? 'Follow up', person, mergeCtx),
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

      // ── v2 channels ────────────────────────────────────────────────────────

      } else if (step.channel === 'change_stage') {
        const stage = (step.value ?? '').trim()
        if (!stage) {
          await finish({ status: 'stopped' })
          await log(`Sequence "${seq.name}" stopped — change_stage step has no value`)
          errored++
          continue
        }
        await sb.from('crm_people').update({ stage, updated_at: new Date().toISOString() }).eq('id', person.id)
        await sb.from('crm_timeline').insert({
          person_id: person.id, kind: 'stage_change',
          title: `Stage updated by workflow "${seq.name}": ${stage}`,
          source: 'sequence',
        })

      } else if (step.channel === 'add_note') {
        const noteText = (step.value ?? '').trim()
        if (!noteText) {
          await finish({ status: 'stopped' })
          await log(`Sequence "${seq.name}" stopped — add_note step has no text`)
          errored++
          continue
        }
        const renderedNote = renderMerge(noteText, person, mergeCtx)
        await sb.from('crm_timeline').insert({
          person_id: person.id, kind: 'note',
          title: 'Note added by workflow',
          body: renderedNote,
          source: 'sequence',
          broker: person.assigned_broker ?? null,
        })

      } else if (step.channel === 'reassign') {
        const broker = (step.value ?? '').trim()
        if (!broker) {
          await finish({ status: 'stopped' })
          await log(`Sequence "${seq.name}" stopped — reassign step has no broker`)
          errored++
          continue
        }
        await sb.from('crm_people').update({ assigned_broker: broker, updated_at: new Date().toISOString() }).eq('id', person.id)
        await sb.from('crm_timeline').insert({
          person_id: person.id, kind: 'system',
          title: `Reassigned by workflow "${seq.name}" to ${broker}`,
          source: 'sequence',
        })

      } else if (step.channel === 'run_automation') {
        const targetId = Number(step.value)
        if (!Number.isInteger(targetId) || targetId <= 0) {
          await finish({ status: 'stopped' })
          await log(`Sequence "${seq.name}" stopped — run_automation step has invalid sequence id`)
          errored++
          continue
        }
        // Fire-and-don't-block: enroll the person in the target sequence.
        // If they are already enrolled the enroll guard returns enrolled:false — fine.
        const enrollResult = await manualEnrollPerson(person.id, targetId, `seq:${seq.name}`)
        await log(
          `Workflow "${seq.name}" triggered automation: ${enrollResult.enrolled ? `enrolled in #${targetId}` : `skipped (${(enrollResult as { reason?: string }).reason ?? 'already enrolled'})`}`,
        )

      } else if (step.channel === 'stop_other_plans') {
        // FUB parity: "Pause All Other Action Plans". Pauses every OTHER running
        // enrollment for this contact (excludes the current enrollment `en.id`).
        // Uses status='paused' (the broker-paused state) so the enrollments are
        // surfaced clearly in the enrollment board and can be manually resumed.
        // This enrollment continues normally — only OTHERS are paused.
        const PAUSEABLE_STATUSES = ['running', 'awaiting_broker', 'awaiting_broker_next'] as const
        const { data: otherEnrollments, error: otherErr } = await sb
          .from('crm_sequence_enrollments')
          .select('id')
          .eq('person_id', person.id)
          .neq('id', en.id)
          .in('status', PAUSEABLE_STATUSES as unknown as string[])
        if (otherErr) {
          // Fail-safe: do not stop the current workflow on a read failure here.
          // Log and continue — the step is considered "done" even if we couldn't
          // pause siblings (better than stopping the primary drip).
          await log(`Workflow "${seq.name}" stop_other_plans read error — ${otherErr.message}`)
        } else if ((otherEnrollments ?? []).length > 0) {
          const pauseIds = (otherEnrollments ?? []).map((e) => e.id as number)
          await sb
            .from('crm_sequence_enrollments')
            .update({ status: 'paused', updated_at: new Date().toISOString() })
            .in('id', pauseIds)
          await log(
            `Workflow "${seq.name}" paused ${pauseIds.length} other active workflow${pauseIds.length === 1 ? '' : 's'} for this contact`,
          )
        }
        // Zero other running enrollments = a no-op; no log needed.

      } else {
        await finish({ status: 'stopped' })
        await log(`Sequence "${seq.name}" stopped — unknown channel "${step.channel}"`)
        errored++
        continue
      }

      // advance — use the (possibly condition-flattened) rawSteps array so the
      // delay of the next step is read from the materialized path, not the tree.
      const nextIndex = en.step_index + 1
      const nextStep = rawSteps[nextIndex] as Step | undefined
      if (!nextStep) {
        await finish({ status: 'completed', step_index: nextIndex })
        await log(`Sequence "${seq.name}" completed`)
        completed++
      } else if (nextStep.confirm) {
        // Later steps are broker-confirmed, not auto-sent. Park as a recommended
        // next step; the contact page / dashboard surfaces it for one-click send.
        await finish({ step_index: nextIndex, status: 'awaiting_broker_next', next_run_at: null })
        await log(`Next step ready for "${seq.name}" — waiting on broker confirmation`)
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

  // Release the overlap lease so the next scheduled tick (or a manual re-run)
  // can proceed immediately; it self-expires anyway if this line is missed.
  await sb.rpc('crm_release_cron_lease', { p_name: 'crm-sequence-engine' })

  return NextResponse.json({
    ok: true, due: (due ?? []).length, executed, paused, completed, skippedSms, skippedDupEmail, suppressed, errored, queuedSms, a2pStatus,
    duration_ms: Date.now() - startMs,
  })
}
