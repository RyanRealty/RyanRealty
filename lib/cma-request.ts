/**
 * CMA request intake — the canonical seller-LP → CMA flow.
 *
 * When a visitor submits the seller landing page, we:
 *   1. Create a draft row in `public.cmas` so the request shows up in
 *      /admin/cmas instantly (status='draft', no value yet).
 *   2. Queue a `content:cma` action row in `public.marketing_brain_actions`
 *      so the brain dispatcher (or a broker / agent following
 *      marketing_brain_skills/producers/cma/SKILL.md) picks it up and
 *      builds the canonical 15-page CMA deliverable.
 *   3. Email the assigned broker with a link to the CMA queue.
 *   4. Email the lead with a confirmation so they know we received it.
 *
 * The canonical CMA producer (marketing_brain_skills/producers/cma/SKILL.md)
 * owns the actual CMA computation, HTML build, PDF render, and delivery
 * via /api/cma/[slug]/email. This file is purely intake + notification.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { resolveSigningBrokerForPerson } from '@/lib/data/cma/signing-broker'
import { fireGa4Event } from '@/lib/ga4-measurement-protocol'
import { sendBrokerNotification, sendLeadConfirmation } from '@/lib/cma/request-emails'

export type CreateCmaRequestInput = {
  rawAddress: string
  parsedStreet: string | null
  parsedCity: string | null
  parsedState: string | null
  parsedPostalCode: string | null
  /** Null for cron-originated requests (e.g. expired-listing detection) where
   *  the owner may be phone-only. No lead confirmation email is sent then. */
  leadEmail: string | null
  leadName?: string | null
  leadPhone?: string | null
  leadTimeline?: string | null
  leadClassification?: string | null
  fubPersonId?: number | null
  /** Native crm_people id (post-FUB-cutover callers pass this instead of, or in
   *  addition to, fubPersonId). Used to stamp the CMA slug onto the correct
   *  crm_people row directly by id when the lead has no fub_legacy_id. */
  crmPersonId?: number | null
  /** Optional "About your home" details the seller added on the LP form.
   *  Compiled into the CMA payload (home_details + seller_improvements). */
  sellerHomeDetails?: {
    bedrooms?: string
    bathrooms?: string
    roofAge?: string
    furnaceAge?: string
    acAge?: string
    improvements?: string
    improvementsSpend?: string
    condition?: string
  } | null
  /** Where the request came from. Default 'seller-lp'. */
  requestSource?: 'seller-lp' | 'expired-listing-cron' | 'fsbo-lp' | 'fsbo-cron' | 'crm-kickoff'
  /** Doc-type LABEL for the cmas row. Since 2026-08-05 (Matt: one CMA) the
   *  content no longer varies by this — the last-listing review section is
   *  driven by listing history inside buildCma. 'expired-audit' remains a
   *  legal input for compat only; every caller now sends 'cma'. */
  docType?: 'cma' | 'expired-audit'
  /** Send the "we received your request" email to the lead. Default true.
   *  MUST be false for outbound-originated requests (expired) — the owner
   *  never asked us for anything. */
  notifyLead?: boolean
  /** Email the assigned broker about the new request. Default true. False for
   *  broker-initiated kick-offs — the broker who tapped the button doesn't
   *  need a "new seller lead submitted" email about their own action. */
  notifyBroker?: boolean
  /** When set, the CMA build worker texts this broker (crm_broker_alerts) the
   *  moment the draft is ready to review (D8 kick-off + notify). Seeds the
   *  payload's notify_broker_sms LIST — later kickers that attach to the open
   *  build append their own entries (lib/data/cma/queue.ts
   *  appendCmaActionNotify) and the worker texts each one. */
  brokerSmsNotify?: { personId: number; broker: string } | null
}

export type CreateCmaRequestResult =
  | { ok: true; cmaId: string; actionId: string; slug: string }
  | { ok: false; error: string }

// Canonical implementation moved to the dependency-free lib/cma/address-slug.ts
// (this module pulls GA4/node:crypto, which lighter import graphs must avoid).
// Re-exported here so every existing `import { slugifyAddress } from '@/lib/cma-request'`
// keeps working unchanged.
import { slugifyAddress } from '@/lib/cma/address-slug'
export { slugifyAddress }

/**
 * Resolve the broker who signs the CMA: the lead's ASSIGNED broker, Matt as
 * the fallback (locked directive, Matt 2026-08-04 / restated 2026-08-06).
 * The one implementation lives in lib/data/cma/signing-broker.ts.
 *
 * Person-id spaces: crmPersonId is always a crm_people.id. fubPersonId is the
 * legacy field name — every LIVE caller passes a native crm_people.id in it
 * (identity-bridge cookie, sendEvent/ensureNativeLead returns; verified
 * 2026-08-06), so it is a safe second choice when crmPersonId is absent.
 */
async function resolveSigningBroker(input: {
  crmPersonId?: number | null
  fubPersonId?: number | null
}) {
  return resolveSigningBrokerForPerson(input.crmPersonId ?? input.fubPersonId ?? null)
}

export async function createCmaRequest(
  input: CreateCmaRequestInput
): Promise<CreateCmaRequestResult> {
  try {
    const sb = createServiceClient()
    const rawAddress = input.rawAddress.trim()
    const baseSlug = slugifyAddress(rawAddress)
    const linkedPersonId = input.crmPersonId ?? input.fubPersonId ?? null
    const leadEmail = input.leadEmail?.toLowerCase().trim() || null
    const leadName = input.leadName?.trim() || null
    const requestSource = input.requestSource ?? 'seller-lp'
    const sourceLabel =
      requestSource === 'expired-listing-cron'
        ? 'Expired-listing detection'
        : requestSource === 'fsbo-lp'
          ? 'FSBO LP submission'
          : requestSource === 'crm-kickoff'
            ? 'Broker kick-off (CRM)'
            : 'Seller LP submission'
    const broker = await resolveSigningBroker(input)

    // Resolve broker uuid so the cmas row has a valid FK if the cmas.broker_id
    // column is uuid (it is). If we can't resolve, leave null and let the
    // producer fill in during finalization.
    const { data: brokerRow } = await sb
      .from('brokers')
      .select('id')
      .eq('slug', broker.slug)
      .limit(1)
    const brokerId = (brokerRow as Array<{ id: string }> | null)?.[0]?.id ?? null

    // Compile optional seller-supplied home details into the structured
    // home_details object + a human-readable seller_improvements string the CMA
    // producer consumes (effective age, Method 2 value-add, condition, beds/baths).
    const hd = input.sellerHomeDetails ?? null
    const conditionLabel: Record<string, string> = {
      excellent: 'Excellent (renovated / move-in)',
      good: 'Good (well maintained)',
      average: 'Average (dated but functional)',
      'needs-work': 'Needs some work',
    }
    let homeDetails: Record<string, string> | null = null
    let sellerImprovementsText: string | null = null
    let sellerImprovementsTotal: number | null = null
    if (hd) {
      const d: Record<string, string> = {}
      if (hd.bedrooms?.trim()) d.bedrooms = hd.bedrooms.trim()
      if (hd.bathrooms?.trim()) d.bathrooms = hd.bathrooms.trim()
      if (hd.roofAge?.trim()) d.roof_age = hd.roofAge.trim()
      if (hd.furnaceAge?.trim()) d.furnace_age = hd.furnaceAge.trim()
      if (hd.acAge?.trim()) d.ac_age = hd.acAge.trim()
      if (hd.condition?.trim()) d.condition = conditionLabel[hd.condition] ?? hd.condition
      homeDetails = Object.keys(d).length > 0 ? d : null

      const parts: string[] = []
      if (hd.bedrooms?.trim() || hd.bathrooms?.trim()) {
        parts.push(`Beds/baths (seller-reported): ${hd.bedrooms?.trim() || '?'} / ${hd.bathrooms?.trim() || '?'}`)
      }
      const sys: string[] = []
      if (hd.roofAge?.trim()) sys.push(`roof ${hd.roofAge.trim()}`)
      if (hd.furnaceAge?.trim()) sys.push(`furnace ${hd.furnaceAge.trim()}`)
      if (hd.acAge?.trim()) sys.push(`AC ${hd.acAge.trim()}`)
      if (sys.length) parts.push(`Systems: ${sys.join(', ')}`)
      if (hd.improvements?.trim()) parts.push(`Improvements: ${hd.improvements.trim()}`)
      if (hd.condition?.trim()) parts.push(`Condition: ${conditionLabel[hd.condition] ?? hd.condition}`)
      sellerImprovementsText = parts.length ? parts.join('. ') : null

      if (hd.improvementsSpend?.trim()) {
        const n = Number(hd.improvementsSpend.replace(/[^0-9.]/g, ''))
        if (Number.isFinite(n) && n > 0) sellerImprovementsTotal = Math.round(n)
      }
    }

    const baseNotes = input.leadTimeline
      ? `Lead timeline: ${input.leadTimeline}${input.leadClassification ? ` · classification: ${input.leadClassification}` : ''}`
      : null
    const clientNotesFull = [baseNotes, sellerImprovementsText].filter(Boolean).join(' · ') || null

    // Step 1: land the intake on a writable cmas row. The old blind
    // upsert-by-slug here was the clobber class (adversarial review 2026-07-17
    // HIGH): a new request for an address whose CMA was already finalized or
    // delivered flipped that document back to draft, reassigned the client,
    // and killed the client's live /cma/[slug] link. The intake now resolves
    // a version-chain slot instead (lib/cma/versions.ts):
    //   · empty slot → create a fresh draft there (base slug, or --vN after a
    //     protected document — the protected row is never touched)
    //   · open draft → refresh contact fields only; status, html_path, broker,
    //     and built content are never written, so a built draft keeps its
    //     content pointer and the broker keeps their work
    const {
      upsertCmaRowBySlug,
      updateCmaRowFieldsBySlug,
      findOpenCmaActionBySlug,
      mergeCmaActionContact,
      appendCmaActionNotify,
      stampCmaPersonId,
    } = await import('@/lib/data')
    const { resolveWritableCmaSlot } = await import('@/lib/cma/versions')

    const leadPhoneTrimmed = input.leadPhone?.trim() || null
    let slug = baseSlug
    let cmaRow: { id: string; slug: string } | null = null
    // Two attempts: if the open draft gets finalized between the probe and the
    // status-guarded patch (TOCTOU), re-resolve once — the second pass lands on
    // the next version slot instead of touching the now-protected document.
    for (let attempt = 0; attempt < 2 && !cmaRow; attempt++) {
      const slot = await resolveWritableCmaSlot(baseSlug)
      if (!slot.ok) return { ok: false, error: slot.error }
      slug = slot.slug
      const generationReason = `${sourceLabel} from ${leadEmail ?? input.leadPhone ?? 'unknown contact'}${
        input.leadTimeline ? ` (${input.leadTimeline})` : ''
      }${slot.priorStatus ? ` · new version — the earlier ${slot.priorStatus} CMA for this address is preserved` : ''}`

      if (slot.existing) {
        const patch: Record<string, unknown> = { generation_reason: generationReason }
        if (leadName) patch.client_name = leadName
        if (leadEmail) patch.client_email = leadEmail
        if (leadPhoneTrimmed) patch.client_phone = leadPhoneTrimmed
        if (clientNotesFull) patch.client_notes = clientNotesFull
        const updated = await updateCmaRowFieldsBySlug(slug, patch, { onlyWhenStatus: 'draft' })
        if (!updated.ok) {
          if (attempt === 0) continue
          return { ok: false, error: `cmas update failed: ${updated.error ?? 'unknown'}` }
        }
        cmaRow = { id: slot.existing.id, slug }
      } else {
        const inserted = await upsertCmaRowBySlug({
          slug,
          subject_address: rawAddress,
          subject_city: input.parsedCity,
          client_name: leadName,
          client_email: leadEmail,
          client_phone: leadPhoneTrimmed,
          client_notes: clientNotesFull,
          broker_id: brokerId,
          broker_slug: broker.slug,
          status: 'draft',
          // Placeholder until the deterministic builder writes html_content and
          // stamps html_path 'db:cmas.html_content:<slug>' (lib/cma/build.ts).
          html_path: `pending:${slug}`,
          generation_reason: generationReason,
          ...(linkedPersonId ? { person_id: linkedPersonId } : {}),
        })
        if (inserted.error || !inserted.id) {
          return { ok: false, error: `cmas upsert failed: ${inserted.error ?? 'no row'}` }
        }
        cmaRow = { id: inserted.id, slug: inserted.slug ?? slug }
      }
    }
    if (!cmaRow) {
      return { ok: false, error: 'could not land the CMA intake on a writable row' }
    }

    if (linkedPersonId) {
      await stampCmaPersonId(cmaRow.slug, linkedPersonId)
    }

    // Step 2: queue the action row for the brain dispatcher. The CMA
    // producer SKILL.md picks this up by scanning for pending content:cma rows.
    const { data: actionRow, error: actionErr } = await sb
      .from('marketing_brain_actions')
      .insert({
        action_type: 'content:cma',
        target: `cma:${slug}`,
        assigned_producer: 'marketing_brain_skills/producers/cma',
        payload: {
          cma_slug: slug,
          // Doc-type label only (2026-08-05: one CMA; the expired review is a
          // history-driven section). Every caller sends 'cma' now.
          doc_type: input.docType ?? 'cma',
          subject_address: rawAddress,
          subject_city: input.parsedCity,
          subject_state: input.parsedState,
          subject_postal_code: input.parsedPostalCode,
          client_name: leadName,
          client_email: leadEmail,
          client_phone: input.leadPhone?.trim() || null,
          broker_email: broker.email,
          broker_slug: broker.slug,
          client_notes: clientNotesFull,
          seller_improvements: sellerImprovementsText,
          seller_improvements_total: sellerImprovementsTotal,
          home_details: homeDetails,
          // D8 kick-off + notify: the build worker texts each listed broker a
          // review link when the draft is ready. A LIST, not a flag — kickers
          // that attach to this build while it is open append their own
          // entries via the cma_action_append_notify RPC.
          ...(input.brokerSmsNotify
            ? {
                notify_broker_sms: [
                  {
                    person_id: input.brokerSmsNotify.personId,
                    broker: input.brokerSmsNotify.broker,
                  },
                ],
              }
            : {}),
        },
        data_evidence: {
          request_source:
            requestSource === 'expired-listing-cron'
              ? 'expired-listing-cron'
              : requestSource === 'crm-kickoff'
                ? 'crm-kickoff'
                : 'lead-form',
          client_relationship: 'cold-lead',
          fub_person_id: input.fubPersonId ?? null,
        },
        generation_reason:
          requestSource === 'expired-listing-cron'
            ? `Expired-listing detection — CMA for ${rawAddress} to open outreach to ${leadName ?? 'the owner'}`
            : `Seller LP submission — ${leadName ?? leadEmail} requested a CMA for ${rawAddress}`,
        status: 'pending',
        // Legacy NOT-NULL fields inherited from the content_briefs view shape.
        // For CMA action rows these are best-effort descriptive labels — the
        // producer reads `payload` for its real inputs.
        topic: `cma: ${rawAddress}`,
        format: 'cma',
        platforms: ['email'],
        hook: `Personalized CMA for ${leadName ?? leadEmail} at ${rawAddress}`,
        target_audience: 'seller-lead',
        data_sources: { lp_form: 'seller-home-value', subject_address: rawAddress },
        predicted_outcome: {
          deliverable: '15-page CMA PDF via /api/cma/<slug>/email',
          sla: '1 business day',
        },
        generated_by: 'seller-lp-form',
      })
      .select('id')
      .single()
    let actionId = (actionRow as { id?: string } | null)?.id ?? null
    if (actionErr || !actionId) {
      // A build for this slug is already open: the partial unique index on
      // open content:cma rows (marketing_brain_actions_open_cma_uidx) rejects
      // a second one with 23505. That open build will pick up the draft row
      // refreshed above, so attach to it instead of failing the lead's request.
      const isDuplicate =
        actionErr?.code === '23505' || /duplicate key/i.test(actionErr?.message ?? '')
      const open = isDuplicate ? await findOpenCmaActionBySlug(slug) : null
      if (!open) {
        return {
          ok: false,
          error: `marketing_brain_actions insert failed: ${actionErr?.message ?? 'no row'}`,
        }
      }
      // Refresh the open action's contact payload so the worker builds for the
      // NEWEST requester — the draft row was already patched above, and without
      // this the build would revert client fields to the first requester's
      // (adversarial review 2026-07-17 MED). Atomic server-side merge on ONLY
      // the four contact keys (cma_action_merge_contact, row-locked), so a
      // concurrent notify append can never lose an entry to this write.
      try {
        await mergeCmaActionContact(open.id, {
          clientName: leadName,
          clientEmail: leadEmail,
          clientPhone: leadPhoneTrimmed,
          clientNotes: clientNotesFull,
        })
      } catch (e) {
        console.warn('[cma-request] attach payload refresh failed:', e instanceof Error ? e.message : String(e))
      }
      // Join the build's ready-notify list — the failed insert carried this
      // kicker's seed entry, so append it to the winner (atomic RPC). If the
      // worker closed the build in the race, text now instead (same contract
      // as lib/crm/cma-kickoff.ts joinReadyNotify).
      if (input.brokerSmsNotify) {
        try {
          const res = await appendCmaActionNotify(open.id, {
            personId: input.brokerSmsNotify.personId,
            broker: input.brokerSmsNotify.broker,
          })
          if (res.status === 'ready') {
            const { queueCmaReadyAlert } = await import('@/lib/crm/broker-alerts')
            await queueCmaReadyAlert({
              slug,
              subjectAddress: rawAddress,
              personId: input.brokerSmsNotify.personId,
              broker: input.brokerSmsNotify.broker,
            })
          }
        } catch (e) {
          console.warn('[cma-request] attach notify join failed:', e instanceof Error ? e.message : String(e))
        }
      }
      actionId = open.id
    }

    // GA4 Measurement Protocol mirror — fire valuation_requested server-side
    // so ad-blocked clients still register a conversion. No cookies access
    // here (this lib is also called from cron paths); the client_id falls
    // back to a fresh uuid which still counts as a session-less conversion
    // tied to the right event taxonomy. ONLY fired for genuine visitor
    // submissions (the two LPs) — broker kick-offs and cron builds are not
    // visitor conversions, and fabricating one corrupts ad attribution (§0).
    // Verified 2026-07-28: cron/rebuild paths had inflated GA4 to 90
    // valuation_requested/90d against ~10 real submissions.
    if (requestSource === 'seller-lp' || requestSource === 'fsbo-lp') void fireGa4Event({
      eventName: 'valuation_requested',
      eventParams: {
        cma_slug: slug,
        lp_variant: requestSource === 'fsbo-lp' ? 'fsbo' : 'seller-home-value',
        broker_slug: broker.slug,
        lead_classification: input.leadClassification ?? undefined,
        lead_type: 'seller',
        subject_city: input.parsedCity ?? undefined,
        subject_state: input.parsedState ?? undefined,
      },
      userProperties: {
        // Short CRM slug (matt/rebecca/paul) — lead-tracking types this
        // property in the short space; the cmas ROW keeps the full slug.
        assigned_broker: broker.crmSlug ?? broker.slug,
        lead_status: 'cma-draft',
      },
    })

    // Step 3 + 4: fire-and-forget the notification emails. We don't await —
    // the visitor sees a fast "we got it" response on the LP.
    if (input.notifyBroker ?? true) void sendBrokerNotification({
      brokerEmail: broker.email,
      brokerName: broker.displayName,
      cmaSlug: slug,
      subjectAddress: rawAddress,
      leadName,
      leadEmail: leadEmail ?? 'no email on file',
      leadPhone: input.leadPhone?.trim() || null,
      leadTimeline: input.leadTimeline ?? null,
    }).catch((e) => console.warn('[cma-request] broker notify failed:', e))

    if (leadEmail && (input.notifyLead ?? true)) {
      void sendLeadConfirmation({
        leadEmail,
        leadName,
        subjectAddress: rawAddress,
        brokerName: broker.displayName,
        brokerEmail: broker.email,
        brokerPhone: broker.phone,
      }).catch((e) => console.warn('[cma-request] lead confirmation failed:', e))
    }

    // Stamp the CMA SLUG (not the link) onto the CRM mirror — awaited, so it
    // lands before any enroll/sequence step runs. We deliberately do NOT stamp
    // cmaLink here: the CMA HTML isn't built yet, so the link would 404. cmaLink
    // is stamped at finalize (lib/cma-deliver.ts) once the page actually exists,
    // and that is what releases the sequence engine's %cma_link% hold-gate — so a
    // lead never receives an empty or dead CMA link.
    if (input.crmPersonId || input.fubPersonId) {
      try {
        // Prefer a direct crm_people id (native/post-cutover callers); fall back
        // to resolving by fub_legacy_id for legacy FUB-mirrored leads.
        const query = sb.from('crm_people').select('id,custom')
        const { data: mirror } = input.crmPersonId
          ? await query.eq('id', input.crmPersonId).maybeSingle()
          : await query.eq('fub_legacy_id', input.fubPersonId!).maybeSingle()
        if (mirror) {
          const custom = { ...((mirror.custom as Record<string, unknown>) ?? {}), cmaSlug: slug }
          await sb.from('crm_people').update({ custom, updated_at: new Date().toISOString() }).eq('id', mirror.id)
        }
      } catch (e) {
        console.warn('[cma-request] cmaSlug stamp failed:', e instanceof Error ? e.message : String(e))
      }
    }

    return {
      ok: true,
      cmaId: cmaRow.id,
      actionId,
      slug,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'unknown error in createCmaRequest',
    }
  }
}

