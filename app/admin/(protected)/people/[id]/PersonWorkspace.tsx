// @no-parity — streamed person workspace. Heavy reads stay off the first paint.
import Link from 'next/link'
import { Suspense } from 'react'
import type { InboxContactCard } from '@/lib/data/crm/getInboxThread'
import { getContactActivityFeed } from '@/lib/data/crm/getContactActivityFeed'
import { getContactCmas } from '@/lib/data/crm/getContactCmas'
import { getContactBpos } from '@/lib/data/crm/getContactBpos'
import { getContactProspectStory } from '@/lib/data/crm/getContactProspectStory'
import { getContactConversation } from '@/lib/data/crm/getContactConversation'
import { getContactRelationships } from '@/lib/data/crm/getContactRelationships'
import { getRecipientOptionsForContact } from '@/lib/data/crm/getRecipientOptionsForContact'
import { getCrmFieldDefinitions } from '@/lib/data/crm/getCrmFieldDefinitions'
import { getLeadSmsRecipients } from '@/lib/data/crm/getLeadSmsRecipients'
import { getGroupReplyParticipants } from '@/lib/data/crm/getGroupReplyParticipants'
import { getAppointmentsForPerson } from '@/lib/data/crm/getAppointments'
import { getContactBehaviorSummary } from '@/lib/data/crm/getContactBehaviorSummary'
import { getDealsForPerson } from '@/lib/data/tc/deal-people'
import { extractAddressCandidate } from '@/lib/crm/seller-intent'
import { inSmsQuietHours } from '@/lib/crm/quiet-hours'
import { CRM_MAILBOXES } from '@/lib/crm/gmail'
import { renderCrmMerge, type MergePersonLike } from '@/lib/crm/merge'
import { buildMergeContext } from '@/lib/crm/merge-context'
import { getSignatureForMailbox } from '@/lib/crm/email-signature'
import { mapPersonWhoLabels } from '@/lib/crm/person-who-labels'
import { listingViewIsRecent } from '@/lib/crm/person-header-lines'
import {
  getCrmAccess,
  getCrmEmailTemplates,
  getCrmPersonFull,
  getCrmSmsTemplates,
  getTwilioSmsStatus,
} from '@/app/actions/crm'
import { SectionHead, StateWord, ThreadBubble } from '@/components/admin/v2'
import { CmaTextMeButton } from '@/components/admin/crm/CmaTextMeButton'
import { PersonDeals } from './PersonDeals'
import { stripHtml, tsLabel } from './person-format'
import {
  addTaskFromPerson,
  completeTaskFromPerson,
  saveEmailDraftFromPerson,
  saveSmsDraftFromPerson,
  sendEmailFromPerson,
  sendSmsFromPerson,
} from '../actions'
import { CommsSection } from './CommsSection'
import { HomesSection } from './HomesSection'
import { SendSection } from './SendSection'
import { TasksSection } from './TasksSection'

export type PersonWorkspaceSearch = {
  intent?: string
  kicked?: string
  err?: string
  tpl?: string
  smsTpl?: string
  replyChannel?: string
  composeCma?: string
}

export async function PersonWorkspace({
  idNum,
  card,
  sp,
}: {
  idNum: number
  card: InboxContactCard
  sp: PersonWorkspaceSearch
}) {
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
    appointments,
    access,
    relationships,
    recipientOptions,
    fieldDefs,
    behaviorSummary,
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
    getAppointmentsForPerson(idNum),
    getCrmAccess(),
    getContactRelationships(idNum),
    getRecipientOptionsForContact(idNum),
    getCrmFieldDefinitions(),
    getContactBehaviorSummary(idNum),
    getDealsForPerson(idNum),
  ])
  const showKickoff = sp.intent === 'cma' || sp.kicked === '1'
  const kicked = sp.kicked === '1'
  const latestInbound = feed.find((t) => t.kind === 'sms_in')?.snippet ?? null
  const suggestedAddress = extractAddressCandidate(latestInbound)
  const nowMs = Date.now()
  const latestListingView = behaviorSummary.latestListingView
  const whoLabels = mapPersonWhoLabels({
    tags: card.tags,
    stage: card.stage,
    prospectKinds: prospectStory.map((s) => s.kind),
    hasRecentListingView: listingViewIsRecent(latestListingView, nowMs),
  })

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
    const initialChannel =
      replyChannel ??
      (sp.composeCma ? 'email' : smsTpl ? 'sms' : tpl ? 'email' : primaryPhone ? 'sms' : 'email')

    const geo = full.geo as { city?: string } | null

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
            saveEmailDraft={saveEmailDraftFromPerson.bind(null, idNum)}
            saveSmsDraft={saveSmsDraftFromPerson.bind(null, idNum)}
            cmas={cmas}
            composeCma={sp.composeCma ?? null}
          />

          {/* One send surface (Matt 2026-08-25). This page carried TWO: the
              composer here, and a separate "Send" section below it whose whole
              body was one trigger button. Writing a message and sending a
              deliverable are the same intent — "get something to this person" —
              so the deliverable trigger now sits with the composer instead of
              asking which of two panels to scroll to. */}
          <Suspense
            fallback={<div className="av2-sysnote" style={{ padding: 12 }}>Loading send options…</div>}
          >
            <SendSection
              personId={idNum}
              emailSuppressed={emailSuppressed}
              defaultCity={geo?.city ?? null}
              cmas={cmas}
              bpos={bpos}
            />
          </Suspense>
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
          <HomesSection personId={idNum} personEmails={personEmails} />
        </Suspense>

      </>
    )
  }

  return (
    <>
      {showKickoff && kicked ? (
        <section aria-label="CMA build" style={{ marginBottom: 16 }}>
          <p style={{ color: 'var(--a-ok)', fontWeight: 500, fontSize: 'var(--a-text-sm)' }}>
            CMA build kicked off. You&apos;ll get a text when the draft is ready. Nothing is sent to the lead until you
            approve it.
          </p>
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
          <SectionHead>Prospecting</SectionHead>
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
          <SectionHead>Valuations</SectionHead>
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
                {c.buildState === 'ready' ? <CmaTextMeButton slug={c.slug} label="Text me" fullWidth={false} /> : null}
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

      <SectionHead>Recent activity</SectionHead>
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
    </>
  )
}
