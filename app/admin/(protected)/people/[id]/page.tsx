// @no-parity — internal admin surface, no public mockup contract
// Person entity page (P9 roll:people + P11B B2 fold; locked pattern 5:
// identity header + ONE primary action + stacked context sections). B2 folds
// the daily-use workspace machinery onto this page: the comms thread with the
// G50 canonical composers (?tpl/?smsTpl server-merged via renderCrmMerge,
// ?reply&replyChannel preload client-side inside the composers, #comms is the
// deep-link anchor), the Send center chokepoint, field editors (stage /
// broker / source / tags), tasks + appointments, homes (viewed ∪ saved), and
// notes — every mutation through the SAME gated server actions the legacy
// workspace used. The full legacy workspace stays one tap away at
// /admin/people/[id]/tools. This route also resolves LEGACY ids
// (pre-2026-07-09 bookmarks): unknown person id falls back to the legacy-id
// map before 404ing.
import Link from 'next/link'
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { randomUUID } from 'node:crypto'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getInboxContactCard } from '@/lib/data/crm/getInboxThread'
import { getContactActivityFeed } from '@/lib/data/crm/getContactActivityFeed'
import { getPersonIdByLegacyId } from '@/lib/data/crm/getPersonIdByLegacyId'
import { getContactCmas } from '@/lib/data/crm/getContactCmas'
import { getContactBpos } from '@/lib/data/crm/getContactBpos'
import { getContactProspectStory } from '@/lib/data/crm/getContactProspectStory'
import { getContactConversation } from '@/lib/data/crm/getContactConversation'
import { getContactRelationships } from '@/lib/data/crm/getContactRelationships'
import { getRecipientOptionsForContact } from '@/lib/data/crm/getRecipientOptionsForContact'
import { getCrmFieldDefinitions } from '@/lib/data/crm/getCrmFieldDefinitions'
import { getCrmSources } from '@/lib/data/crm/getCrmSources'
import { getLeadSmsRecipients } from '@/lib/data/crm/getLeadSmsRecipients'
import { getGroupReplyParticipants } from '@/lib/data/crm/getGroupReplyParticipants'
import { getAppointmentsForPerson } from '@/lib/data/crm/getAppointments'
import { getContactBehaviorSummary } from '@/lib/data/crm/getContactBehaviorSummary'
import { getPersonAwaitingBrokerStep } from '@/lib/data/crm/getBrokerActionQueue'
import { getDealsForPerson } from '@/lib/data'
import { isTriageTaskCandidate } from '@/lib/data/crm/getInboundTriage'
import { extractAddressCandidate } from '@/lib/crm/seller-intent'
import { inSmsQuietHours } from '@/lib/crm/quiet-hours'
import { CRM_MAILBOXES } from '@/lib/crm/gmail'
import { renderCrmMerge, type MergePersonLike } from '@/lib/crm/merge'
import { buildMergeContext } from '@/lib/crm/merge-context'
import { getSignatureForMailbox } from '@/lib/crm/email-signature'
import { mapPersonWhoLabels } from '@/lib/crm/person-who-labels'
import { lookingAtAskHrefIfRecent } from '@/lib/crm/looking-at'
import {
  composePersonNextStep,
  composePersonNowLine,
  listingViewIsRecent,
  replyIntentFromTimeline,
  unrepliedInboundFromMessages,
} from '@/lib/crm/person-header-lines'
import {
  getCrmAccess,
  getCrmEmailTemplates,
  getCrmPersonFull,
  getCrmSmsTemplates,
  getTwilioSmsStatus,
  requirePersonInScope,
} from '@/app/actions/crm'
import { Button, SectionHead, StateWord, TextField, ThreadBubble } from '@/components/admin/v2'
import { PersonDeals } from './PersonDeals'
import { PersonIdentityHeader } from './PersonIdentityHeader'
import { stripHtml, tsLabel } from './person-format'
import {
  addNoteFromPerson,
  addTagFromPerson,
  addTaskFromPerson,
  assignBrokerFromPerson,
  completeTaskFromPerson,
  kickoffCmaFromPerson,
  removeTagFromPerson,
  sendEmailFromPerson,
  sendSmsFromPerson,
  updateSourceFromPerson,
  updateStageFromPerson,
} from '../actions'
import { CommsSection } from './CommsSection'
import { FieldEditors } from './FieldEditors'
import { HomesSection } from './HomesSection'
import { NotesSection } from './NotesSection'
import { SendSection } from './SendSection'
import { TasksSection } from './TasksSection'

export const dynamic = 'force-dynamic'

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    intent?: string
    kicked?: string
    err?: string
    tpl?: string
    smsTpl?: string
    flash?: string
    error?: string
    replyChannel?: string
  }>
}) {
  const ctx = await requireAdminPage('people.view')
  const idNum = Number((await params).id)
  if (!Number.isFinite(idNum) || idNum <= 0) notFound()
  const sp = await searchParams

  // BROKER SCOPE, and it has to run BEFORE the reads below.
  //
  // The B2 fold was already scoped — getCrmPersonFull returns an empty bundle
  // out of scope — and the comment there says the identity header still renders
  // from the card, which was the accepted trade. But the header is not the only
  // thing outside the fold: the prospect story, the CMA/BPO list and the full
  // 30-item activity feed all render after {fold} from reads that carry no
  // scope of their own. That is materially more than the documented intent, on
  // the one family (CRM) that IS broker-scoped everywhere else — its list page,
  // its mutations and the fold itself all apply this rule.
  //
  // Same function every CRM mutation uses. Superuser is unaffected: scopeBroker
  // returns null inside it and it short-circuits to ok. notFound() rather than
  // access-denied so the response cannot be used to probe which ids exist.
  const inScope = await requirePersonInScope(idNum, {
    email: ctx.email,
    role: ctx.role,
    brokerSlug: ctx.brokerSlug,
  })
  if (!inScope.ok) notFound()

  const card = await getInboxContactCard(idNum)
  if (!card) {
    // Legacy-id fallback (absorbed /admin/people/[legacyId] shim, renamed 2026-07-09).
    const mapped = await getPersonIdByLegacyId(idNum)
    if (mapped) redirect(`/admin/people/${mapped}`)
    notFound()
  }

  const [
    feed,
    cmas,
    bpos,
    prospectStory,
    full,
    conversation,
    emailTemplates,
    smsTemplates,
    twilioStatus,
    crmSources,
    appointments,
    access,
    relationships,
    recipientOptions,
    fieldDefs,
    behaviorSummary,
    awaitingStep,
    personDeals,
  ] = await Promise.all([
    getContactActivityFeed(idNum, 30),
    getContactCmas({ crmPersonId: idNum, emails: card.email ? [card.email] : [] }),
    getContactBpos({ crmPersonId: idNum }),
    getContactProspectStory({ personId: idNum }),
    getCrmPersonFull(idNum),
    getContactConversation(idNum, { limit: 50 }),
    getCrmEmailTemplates(),
    getCrmSmsTemplates(),
    getTwilioSmsStatus(),
    getCrmSources(),
    getAppointmentsForPerson(idNum),
    getCrmAccess(),
    getContactRelationships(idNum),
    getRecipientOptionsForContact(idNum),
    getCrmFieldDefinitions(),
    getContactBehaviorSummary(idNum),
    getPersonAwaitingBrokerStep(idNum),
    getDealsForPerson(idNum),
  ])
  const showKickoff = sp.intent === 'cma' || sp.kicked === '1'
  const kicked = sp.kicked === '1'
  const latestInbound = feed.find((t) => t.kind === 'sms_in')?.snippet ?? null
  const suggestedAddress = extractAddressCandidate(latestInbound)
  const nowMs = Date.now()
  const latestListingView = behaviorSummary.latestListingView
  const unreplied = unrepliedInboundFromMessages(conversation.items)
  const openTriageTask =
    full.tasks.find((t) => !t.completed_at && isTriageTaskCandidate({ name: t.name, type: t.type, origin: null })) ??
    null
  const whoLabels = mapPersonWhoLabels({
    tags: card.tags,
    stage: card.stage,
    prospectKinds: prospectStory.map((s) => s.kind),
    hasRecentListingView: listingViewIsRecent(latestListingView, nowMs),
  })
  const nextLine = composePersonNextStep({
    unrepliedInbound: unreplied ? { channel: unreplied.channel } : null,
    replyIntent: replyIntentFromTimeline(full.timeline) ?? unreplied?.replyIntent ?? null,
    triageTask: openTriageTask ? { name: openTriageTask.name, type: openTriageTask.type } : null,
    sequenceWaiting: awaitingStep,
  })
  const nowLine = composePersonNowLine({ latestListingView, nowMs })
  const askHref = lookingAtAskHrefIfRecent(idNum, latestListingView?.listingStreet, listingViewIsRecent(latestListingView, nowMs))

  // ── B2 fold: daily-use machinery (renders only when the person is in the
  // acting broker's scope — getCrmPersonFull returns the empty bundle
  // otherwise, and the identity header above still renders from the card). ──
  const person = full.person
  let fold: React.ReactNode = null
  if (person) {
    const personLike = person as unknown as MergePersonLike & { assigned_broker?: string | null }
    const actingSlug = access?.brokerSlug ?? personLike.assigned_broker ?? 'matt'
    const mailbox = CRM_MAILBOXES.find((m) => m.slug === actingSlug) ?? CRM_MAILBOXES[0]
    const tpl = sp.tpl ?? null
    const smsTpl = sp.smsTpl ?? null
    const activeTpl = tpl ? emailTemplates.find((t) => t.key === tpl) ?? null : null
    const activeSmsTpl = smsTpl ? smsTemplates.find((t) => t.key === smsTpl) ?? null : null

    const [signature, mergeCtx, relRecipients, groupParticipants] = await Promise.all([
      getSignatureForMailbox(mailbox.email),
      activeTpl || activeSmsTpl
        ? buildMergeContext({ person: personLike, senderSlug: actingSlug })
        : Promise.resolve(undefined),
      getLeadSmsRecipients(
        idNum,
        relationships
          .filter((r) => r.relatedPersonId !== null)
          .map((r) => ({ relatedPersonId: r.relatedPersonId as number, label: r.label })),
      ),
      getGroupReplyParticipants(idNum),
    ])

    const emailInitialSubject = activeTpl?.subject ? renderCrmMerge(activeTpl.subject, personLike, mergeCtx) : ''
    const emailInitialBody = activeTpl?.body ? renderCrmMerge(activeTpl.body, personLike, mergeCtx) : ''
    const smsInitialBody = activeSmsTpl?.body ? renderCrmMerge(activeSmsTpl.body, personLike, mergeCtx) : ''

    const primaryEmail = full.contactPoints.find((c) => c.kind === 'email')?.value ?? null
    const primaryPhone = full.contactPoints.find((c) => c.kind === 'phone')?.value ?? null
    const personEmails = (person.emails ?? []).map((e) => e.value).filter((v): v is string => Boolean(v))

    // Group-text recipients: relationship contacts start unchecked; live
    // group-thread participants come pre-checked (legacy semantics, verbatim).
    const smsRecipients: Array<{ personId: number; name: string; phone: string; relation: string; defaultOn?: boolean }> =
      relRecipients.map((r) => ({ ...r, defaultOn: false }))
    for (const g of groupParticipants) {
      const pid = g.personId ?? 0
      const existing =
        pid > 0
          ? smsRecipients.find((m) => m.personId === pid)
          : smsRecipients.find((m) => m.personId === 0 && m.phone === g.phone)
      if (existing) {
        existing.defaultOn = true
        continue
      }
      smsRecipients.push({ personId: pid, name: g.name, phone: g.phone, relation: 'Group', defaultOn: true })
    }

    const composerCustomFields = fieldDefs
      .filter((d) => d.key.startsWith('custom'))
      .map((d) => ({ key: d.key, label: d.label }))

    const smsSuppressed = full.suppressions.some((s) => s.channel === 'sms' || s.channel === 'all')
    const emailSuppressed = full.suppressions.some((s) => s.channel === 'email' || s.channel === 'all')
    const suppressionWords = full.suppressions.map((s) => `${s.channel}: ${s.reason}`).join(' · ')

    const canSms = Boolean(primaryPhone) && twilioStatus.canSend
    const smsNote = !primaryPhone
      ? 'No phone number on file.'
      : !twilioStatus.canSend
        ? `Texting is paused — A2P status is ${twilioStatus.a2p ?? 'unknown'}.`
        : null
    const canEmail = Boolean(primaryEmail)

    const replyChannel = sp.replyChannel === 'email' ? ('email' as const) : sp.replyChannel === 'sms' ? ('sms' as const) : null
    const initialChannel = replyChannel ?? (smsTpl ? 'sms' : tpl ? 'email' : primaryPhone ? 'sms' : 'email')

    const geo = full.geo as { city?: string } | null

    const notes = full.timeline
      .filter((t) => t.kind === 'note')
      .slice(0, 20)
      .map((n) => ({ id: n.id, ts: n.ts, body: n.body ?? n.title ?? '', broker: n.broker }))

    const foldTasks = full.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      due_at: t.due_at,
      completed_at: t.completed_at,
      assigned_broker: t.assigned_broker,
    }))
    const foldAppointments = appointments.map((a) => ({
      id: a.id,
      title: a.title,
      startAt: a.startAt,
      typeName: a.typeName,
      outcomeName: a.outcomeName,
      location: a.location,
    }))

    fold = (
      <>
        <section id="comms" aria-label="Messages">
          <SectionHead>Messages</SectionHead>
          {smsSuppressed || emailSuppressed ? (
            <div className="av2-wordrow" style={{ marginBottom: 8 }}>
              <StateWord state={smsSuppressed && emailSuppressed ? 'down' : 'slow'}>
                {smsSuppressed && emailSuppressed ? 'Blocked' : smsSuppressed ? 'Email only' : 'Text only'}
              </StateWord>
              <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>{suppressionWords}</span>
            </div>
          ) : null}
          <div className="av2-pane av2-pane--thread" style={{ marginBottom: 12 }}>
            {conversation.items.map((m) => {
              const chan = m.kind.startsWith('sms') ? ('SMS' as const) : m.kind.startsWith('email') ? ('Email' as const) : null
              const dir = m.kind.endsWith('_in') ? ('in' as const) : m.kind.endsWith('_out') ? ('out' as const) : null
              if (!chan || !dir) {
                return (
                  <div key={m.id} className="av2-sysnote">
                    {(m.title ?? m.kind).slice(0, 140)} · {tsLabel(m.ts)}
                  </div>
                )
              }
              const raw =
                chan === 'Email'
                  ? `${m.title ? `${m.title} — ` : ''}${stripHtml(m.body ?? '')}`
                  : (m.body ?? m.title ?? '')
              const text = raw.length > 400 ? `${raw.slice(0, 400)}…` : raw
              return (
                <ThreadBubble
                  key={m.id}
                  direction={dir}
                  channel={chan}
                  stamp={`${tsLabel(m.ts)}${dir === 'out' && m.broker ? ` · ${m.broker}` : ''}`}
                >
                  {text}
                </ThreadBubble>
              )
            })}
            {conversation.items.length === 0 ? <div className="av2-sysnote">No messages yet.</div> : null}
          </div>
          <CommsSection
            personId={idNum}
            initialChannel={initialChannel}
            canSms={canSms}
            smsNote={smsNote}
            canEmail={canEmail}
            emailNote="No email address on file."
            quietHours={inSmsQuietHours()}
            smsTemplates={smsTemplates.map((t) => ({ key: t.key, name: t.name }))}
            emailTemplates={emailTemplates.map((t) => ({ key: t.key, name: t.name }))}
            tplKey={tpl}
            smsTplKey={smsTpl}
            emailInitialSubject={emailInitialSubject}
            emailInitialBody={emailInitialBody}
            smsInitialBody={smsInitialBody}
            signatureHtml={signature?.html ?? null}
            toLabel={primaryEmail ? (person.name ? `${person.name} · ${primaryEmail}` : primaryEmail) : null}
            initialTo={primaryEmail ? [primaryEmail.toLowerCase()] : []}
            recipientOptions={recipientOptions}
            customFields={composerCustomFields}
            smsRecipients={smsRecipients}
            sendSms={sendSmsFromPerson.bind(null, idNum)}
            sendEmail={sendEmailFromPerson.bind(null, idNum)}
          />
        </section>

        <Suspense
          fallback={
            <section aria-label="Send">
              <SectionHead>Send</SectionHead>
              <div className="av2-sysnote" style={{ padding: 12 }}>Loading send options…</div>
            </section>
          }
        >
          <SendSection
            personId={idNum}
            emailSuppressed={emailSuppressed}
            defaultCity={geo?.city ?? null}
            cmas={cmas}
            bpos={bpos}
          />
        </Suspense>

        <section aria-label="Details">
          <SectionHead>Details</SectionHead>
          <FieldEditors
            stage={person.stage}
            assignedBroker={(person.assigned_broker as string | null) ?? null}
            canReassign={access?.role === 'superuser'}
            source={(person.source as string | null) ?? null}
            sources={crmSources}
            tags={(person.tags as string[] | null) ?? []}
            updateStage={updateStageFromPerson.bind(null, idNum)}
            assignBroker={assignBrokerFromPerson.bind(null, idNum)}
            updateSource={updateSourceFromPerson.bind(null, idNum)}
            addTag={addTagFromPerson.bind(null, idNum)}
            removeTag={removeTagFromPerson.bind(null, idNum)}
          />
        </section>

        <TasksSection
          tasks={foldTasks}
          appointments={foldAppointments}
          completeTask={completeTaskFromPerson.bind(null, idNum)}
          addTask={addTaskFromPerson.bind(null, idNum)}
        />

        <Suspense
          fallback={
            <section aria-label="Homes">
              <SectionHead>Homes</SectionHead>
              <div className="av2-sysnote" style={{ padding: 12 }}>Loading homes…</div>
            </section>
          }
        >
          <HomesSection personId={idNum} fubLegacyId={person.fub_legacy_id} personEmails={personEmails} />
        </Suspense>

        <NotesSection notes={notes} addNote={addNoteFromPerson.bind(null, idNum)} />
      </>
    )
  }

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <PersonIdentityHeader
        name={card.name}
        whoLabels={whoLabels}
        stage={card.stage}
        assignedBroker={card.assignedBroker}
        nextLine={nextLine}
        nowLine={nowLine}
        phone={card.phone}
        email={card.email}
        source={card.source}
        price={card.price}
        timeframe={card.timeframe}
        tags={card.tags}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Link href={askHref ?? `/admin/messages?c=${card.personId}`}>
          <Button>{askHref ? 'Ask' : 'Message'}</Button>
        </Link>
        {card.phone ? (
          <a href={`tel:${card.phone}`} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
            Call
          </a>
        ) : null}
        {card.email ? (
          <a href={`mailto:${card.email}`} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
            Email
          </a>
        ) : null}
        {!showKickoff ? (
          <Link href={`/admin/people/${card.personId}?intent=cma`}>
            <Button variant="quiet">Build a CMA</Button>
          </Link>
        ) : null}
        <Link href={`/admin/people/${card.personId}/tools`}>
          <Button variant="quiet">All tools</Button>
        </Link>
      </div>

      {sp.flash ? (
        <div style={{ marginBottom: 12, fontSize: 'var(--a-text-sm)', color: 'var(--a-ok)', fontWeight: 500 }}>
          {sp.flash}
        </div>
      ) : null}
      {sp.error ? (
        <div style={{ marginBottom: 12, fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)', fontWeight: 500 }}>
          {sp.error}
        </div>
      ) : null}

      {showKickoff ? (
        <section
          aria-label="Build a CMA"
          style={{ background: 'var(--a-surface)', border: '1px solid var(--a-border)', borderRadius: 'var(--a-r-lg)', padding: 16, marginBottom: 20 }}
        >
          <h2 style={{ fontSize: 'var(--a-text-lg)', fontWeight: 600, marginBottom: 4 }}>Build a CMA</h2>
          {kicked ? (
            <p style={{ color: 'var(--a-ok)', fontWeight: 500 }}>
              CMA build kicked off — you&apos;ll get a text when the draft is ready to review. Nothing is sent to the
              lead until you approve it.
            </p>
          ) : (
            <form action={kickoffCmaFromPerson} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="hidden" name="personId" value={card.personId} />
              <input type="hidden" name="idempotencyKey" value={randomUUID()} />
              <TextField
                label="Property address"
                name="address"
                required
                defaultValue={suggestedAddress ?? undefined}
                placeholder="123 NW Bond St, Bend"
                hint={
                  suggestedAddress
                    ? 'Parsed from their text — confirm it before building.'
                    : 'Include the city so comps resolve. Confirm it before building.'
                }
                error={sp.err ? decodeURIComponent(sp.err) : undefined}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="submit" touch>
                  Build CMA — text me when ready
                </Button>
                <Link href={`/admin/people/${card.personId}`}>
                  <Button variant="quiet" touch>
                    Not now
                  </Button>
                </Link>
              </div>
              <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: 0 }}>
                The draft lands in the CMA queue for your review. Nothing is sent to the lead until you approve it.
              </p>
            </form>
          )}
        </section>
      ) : null}

      <PersonDeals
        personId={idNum}
        deals={personDeals}
        prospectStory={prospectStory}
        inboundAddress={suggestedAddress}
        whoLabels={whoLabels}
        relationships={relationships}
      />

      {fold}

      {prospectStory.length > 0 && (
        <section aria-label="Prospect story">
          <h2 className="av2-lane-head">Prospecting</h2>
          <ul className="av2-quietlist">
            {prospectStory.map((s) => (
              <li key={s.prospectId} className="av2-quiet">
                <Link href={s.detailHref} className="av2-quiet__name" style={{ textDecoration: 'none', color: 'var(--a-text)', minWidth: 180 }}>
                  {[s.streetAddress, s.city].filter(Boolean).join(', ') || s.prospectId}
                </Link>
                <span style={{ color: 'var(--a-text-2)' }}>
                  {s.kind === 'expired' ? s.status : 'FSBO'}
                  {s.lastListPrice != null ? ` · was $${Math.round(s.lastListPrice).toLocaleString('en-US')}` : ''}
                  {s.priorAgentName ? ` · prior agent ${s.priorAgentName}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(cmas.length > 0 || bpos.length > 0) && (
        <section aria-label="Valuations">
          <h2 className="av2-lane-head">Valuations</h2>
          <ul className="av2-quietlist">
            {cmas.map((c) => (
              <li key={c.slug} className="av2-quiet">
                <Link href={c.reviewUrl} className="av2-quiet__name" style={{ textDecoration: 'none', color: 'var(--a-text)', minWidth: 180 }}>
                  {c.subjectAddress}
                </Link>
                <span className="av2-quiet__ok" style={{ color: c.buildState === 'failed' ? 'var(--a-danger)' : undefined }}>
                  {c.status}
                </span>
                <span className="av2-quiet__fig">{c.valueLine ?? ''}</span>
              </li>
            ))}
            {bpos.map((b) => (
              <li key={b.slug} className="av2-quiet">
                <Link href={b.previewUrl} className="av2-quiet__name" style={{ textDecoration: 'none', color: 'var(--a-text)', minWidth: 180 }}>
                  {b.subjectAddress}
                </Link>
                <span className="av2-quiet__ok">{b.status} BPO</span>
                <span className="av2-quiet__fig">{b.opinionLine ?? ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="av2-lane-head">Recent activity</h2>
      <ul className="av2-quiet-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {feed.map((m) => (
          <li key={m.id} className="av2-quiet">
            <span className="av2-quiet__name" style={{ minWidth: 90 }}>
              {tsLabel(m.ts)}
            </span>
            <span style={{ color: 'var(--a-text)' }}>{m.label}</span>
            {m.snippet ? <span className="av2-quiet__fig" style={{ fontVariantNumeric: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '45%' }}>{m.snippet}</span> : null}
          </li>
        ))}
        {feed.length === 0 ? <li className="av2-sysnote" style={{ padding: 12 }}>No activity yet.</li> : null}
      </ul>
    </div>
  )
}
