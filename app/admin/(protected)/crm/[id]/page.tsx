// @no-parity — internal admin surface, no public mockup contract
import { notFound, redirect } from 'next/navigation'
import { CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import {
  getCrmAccess,
  getCrmEmailTemplates,
  getCrmPersonFull,
  getCrmSmsTemplates,
  getTwilioSmsStatus,
} from '@/app/actions/crm'
import {
  addNoteForm, updateStageForm, addTagForm, removeTagForm, addTaskForm,
  assignBrokerForm, addContactPointForm, sendEmailForm, sendSmsForm,
  sendCmaForm, startBpoForm, setReportSubsForm,
  deleteSavedSearchForm,
} from './form-actions'
// CRM record-card cutover (2026-06-24): home-driven next step, CMA-from-contact,
// market-report subscriptions, source badge.
import { getContactNextStep } from '@/app/actions/contact-next-step'
import { getContactReportSubscription, listAvailableMarketReportAreas } from '@/lib/data/crm/getContactReportSubscriptions'
import { getCrmFieldDefinitions } from '@/lib/data/crm/getCrmFieldDefinitions'
import CustomFieldsPanel from '@/components/admin/crm/CustomFieldsPanel'
import { OwnedHomeCard } from '@/components/admin/crm/OwnedHomeCard'
import { renderCrmMerge } from '@/lib/crm/merge'
import { buildMergeContext } from '@/lib/crm/merge-context'
import { getSignatureForMailbox } from '@/lib/crm/email-signature'
import { CRM_MAILBOXES } from '@/lib/crm/gmail'
import { getOwnedHomeMatches, getListingAlertsForLead, getViewedListingsForLead, type OwnedHomeMatch } from '@/lib/data'
import { getContactSavedHomes, buildHomesPanelUnion } from '@/lib/data/crm/getContactSavedHomes'
import { getOwnedHomeMedia } from '@/lib/crm/owned-home-media'
import { getContactMemberships } from '@/lib/data/crm/getContactMemberships'
import { ContactQuickActions } from '@/components/admin/crm/ContactQuickActions'
import { ContactSendCenter } from '@/components/admin/crm/ContactSendCenter'
import { getContactEmailEngagement } from '@/lib/data/crm/getContactEmailEngagement'
import ContactEmailEngagement from '@/components/admin/crm/ContactEmailEngagement'
import { getNewsletterHistoryForPerson } from '@/lib/data/newsletter/perLead'
import { ContactNewsletterHistory } from '@/components/admin/crm/ContactNewsletterHistory'
import ContactDeliveryPanel from '@/components/admin/crm/ContactDeliveryPanel'
import { getContactBehaviorSummary } from '@/lib/data/crm/getContactBehaviorSummary'
import ContactBehaviorPanel from '@/components/admin/crm/ContactBehaviorPanel'
import { getContactRelationships } from '@/lib/data/crm/getContactRelationships'
import { getRecipientOptionsForContact } from '@/lib/data/crm/getRecipientOptionsForContact'
import { getContactCmas } from '@/lib/data/crm/getContactCmas'
import { getContactBpos } from '@/lib/data/crm/getContactBpos'
import { getLatestNewsletterIssue } from '@/lib/data/crm/getLatestNewsletterIssue'
import { ContactCmaCard } from '@/components/admin/crm/ContactCmaCard'
import { ContactBpoCard } from '@/components/admin/crm/ContactBpoCard'
import { getContactProspectStory } from '@/lib/data/crm/getContactProspectStory'
import { ContactProspectHistoryCard } from '@/components/admin/crm/ContactProspectHistoryCard'
import { sendDeliverableForPerson } from '@/app/actions/send-deliverable'
import { getContactListingAlerts } from '@/lib/data/crm/getContactListingAlerts'
import { ContactListingAlertsPanel } from '@/components/admin/crm/ContactListingAlertsPanel'
import { getContactCollaborators } from '@/lib/data/crm/getContactCollaborators'
import { getContactActionPlanProgress } from '@/lib/data/crm/getContactActionPlanProgress'
import { addCrmCollaboratorAction, removeCrmCollaboratorAction } from '@/app/actions/crm-person-gaps'
import { EmailComposer } from '@/components/admin/crm/EmailComposer'
import { SmsComposer } from '@/components/admin/crm/SmsComposer'
import { getLeadSmsRecipients } from '@/lib/data/crm/getLeadSmsRecipients'
import { getGroupReplyParticipants } from '@/lib/data/crm/getGroupReplyParticipants'
import { TemplatePickerNav } from '@/components/admin/crm/TemplatePickerNav'
import { getContactConversation } from '@/lib/data/crm/getContactConversation'
import ViewedHomeCard from '@/components/admin/crm/ViewedHomeCard'
import { StatusPill } from '@/components/console/StatusPill'
import { CmaKickoffMount } from '@/components/admin/crm/CmaKickoffMount'
// §25 Mobile Contact Detail (mapping + assembly colocated in mobile-detail.tsx)
import { MobileLeadDetail } from './mobile-detail'
// §07 three-column desktop rebuild (CRM_BUILD_MISSION screen: person-detail-desktop)
import { PersonSidebar } from '@/components/admin/crm/person-detail/PersonSidebar'
import { PersonCenterColumn } from '@/components/admin/crm/person-detail/PersonCenterColumn'
import { PersonRightRail } from '@/components/admin/crm/person-detail/PersonRightRail'
import { getPersonDetailExtras } from '@/lib/data/crm/getPersonDetailExtras'
// Pure page→props mapping (spec-03 W5.1): keeps this route file an assembly shell.
import {
  usd,
  describeSearch,
  buildEmailEngagement,
  buildTimelineItems,
  buildSidebarData,
  resolveDisplayName,
  resolveInquiryDate,
} from './person-view-model'
import { getCrmSources } from '@/lib/data/crm/getCrmSources'
import { listActiveSequences } from '@/lib/crm/enroll'
// §25.9 mobile Calendar tab (P2-4): real appointments + create sheet config
import { getAppointmentsForPerson, getAppointmentTypes, getAppointmentOutcomes } from '@/lib/data/crm/getAppointments'
import { createAppointmentAction, updateAppointmentAction } from '@/app/actions/appointments'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Lead · Console' }
export const dynamic = 'force-dynamic'

const BASE = '/admin/crm'

export default async function ConsoleLeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tpl?: string; smsTpl?: string; error?: string; flash?: string; view?: string; intent?: string }>
}) {
  const { id: idRaw } = await params
  const id = Number(idRaw)
  if (!Number.isFinite(id) || id <= 0) notFound()
  const { tpl, smsTpl, error: sendError, flash, view, intent } = await searchParams

  const [crmAccess, full, templates, smsTemplates, twilioStatus] = await Promise.all([
    getCrmAccess(),
    getCrmPersonFull(id),
    getCrmEmailTemplates(),
    getCrmSmsTemplates(),
    getTwilioSmsStatus(),
  ])
  if (!crmAccess) redirect('/admin/access-denied')
  const person = full.person
  if (!person) notFound()

  const personLike = person as unknown as import('@/lib/crm/merge').MergePersonLike & { assigned_broker?: string | null }
  const actingSlug = crmAccess?.brokerSlug ?? personLike.assigned_broker ?? 'matt'
  const mailbox = CRM_MAILBOXES.find((m) => m.slug === actingSlug) ?? CRM_MAILBOXES[0]

  const activeTpl = tpl ? templates.find((t) => t.key === tpl) ?? null : null
  const activeSmsTpl = smsTpl ? smsTemplates.find((t) => t.key === smsTpl) ?? null : null

  const primaryEmail = full.contactPoints.find((c) => c.kind === 'email')?.value ?? null
  const primaryPhone = full.contactPoints.find((c) => c.kind === 'phone')?.value ?? null
  const personEmails = (person.emails ?? []).map((e) => e.value).filter((v): v is string => Boolean(v))

  // Owned home coordinates resolve from batch-1 data (full.geo), so the
  // media/matches lookups can join the big batch below instead of running as
  // a late serial stage (audit 2026-07-14: this page paid four extra
  // sequential round-trip stages per view — signature, appointments trio,
  // conversation, home lookups — all keyed on data available right here).
  const geo = full.geo as { city?: string; neighborhood?: string; subdivision?: string; formatted_address?: string; source_address?: string; latitude?: number; longitude?: number; owner_type?: string } | null
  const homeLat = typeof geo?.latitude === 'number' ? geo.latitude : null
  const homeLng = typeof geo?.longitude === 'number' ? geo.longitude : null
  const homeAddress = geo?.formatted_address ?? geo?.source_address ?? null

  // What they're shopping for — saved searches + the homes they're watching (live MLS) + newsletter status.
  const [savedSearches, viewedListings, savedHomes, contactMemberships, behaviorSummary, relationships, contactAlerts, nextStep, reportSub, reportAreas, fieldDefs, emailEngagementSummary, collaborators, actionPlanEnrollments, detailExtras, activeSequences, crmSources, recipientOptions, contactCmas, contactBpos, latestNewsletter, signature, mergeCtx, personAppointments, apptTypes, apptOutcomes, conversation, homeMedia, homeMatches, prospectStories, newsletterHistory] = await Promise.all([
    getListingAlertsForLead({ crmPersonId: person.id, fubPersonId: person.fub_legacy_id, emails: personEmails }),
    // Native identity keys (crm id + lockstep + emails) — the legacy fub-only
    // call returned [] for every native lead (fub_legacy_id NULL).
    getViewedListingsForLead({ crmPersonId: person.id, fubLegacyId: person.fub_legacy_id, emails: personEmails }),
    // Real consumer stores (likes + saved_listings) via the person → auth-user join.
    getContactSavedHomes({ crmPersonId: person.id, fubLegacyId: person.fub_legacy_id, emails: personEmails }),
    getContactMemberships(person.id),
    getContactBehaviorSummary(person.id),
    getContactRelationships(person.id),
    getContactListingAlerts(person.id),
    // CRM record-card cutover: home-driven next step (owns home → CMA, else → newsletter),
    // the contact's market-report subscription + available areas.
    getContactNextStep(person.id),
    getContactReportSubscription(person.id),
    listAvailableMarketReportAreas(),
    getCrmFieldDefinitions(),
    // Wave 5: per-contact email engagement, read from the unified email_events store.
    getContactEmailEngagement(person.id),
    // §07 parity gaps: collaborators + action-plan progress
    getContactCollaborators(person.id),
    getContactActionPlanProgress(person.id),
    // §07 three-column rebuild: right-rail widgets + exact timeline tab counts
    getPersonDetailExtras(person.id),
    listActiveSequences(),
    // §28 mobile Source picker — the account's source vocabulary, verbatim
    getCrmSources(),
    // Email composer To/Cc/Bcc pickers: contact's emails + linked people.
    getRecipientOptionsForContact(person.id),
    // One-click sends: this contact's CMAs + the newsletter issue a send delivers.
    getContactCmas({ crmPersonId: person.id, emails: personEmails }),
    getContactBpos({ crmPersonId: person.id, emails: personEmails }),
    getLatestNewsletterIssue(),
    getSignatureForMailbox(mailbox.email),
    // Composer prefill renders with the SAME context the send path uses, so the
    // broker sees exactly what will go out (agent/sender/company resolved).
    activeTpl || activeSmsTpl
      ? buildMergeContext({ person: personLike, senderSlug: actingSlug })
      : Promise.resolve(undefined),
    // §25.9 mobile Calendar tab (P2-4): the contact's appointments + the
    // create-sheet vocabulary (types/outcomes).
    getAppointmentsForPerson(person.id),
    getAppointmentTypes(),
    getAppointmentOutcomes(),
    // Full Comms thread (every text + email + call), newest first, paginated —
    // NOT capped to the latest 40 of the 100-row timeline (which hid old
    // messages and group texts on long-running contacts).
    getContactConversation(person.id, { limit: 50 }),
    // Owned home media + MLS matches (only when the geo row carries coords).
    homeLat !== null && homeLng !== null ? getOwnedHomeMedia(homeLat, homeLng) : Promise.resolve(null),
    homeLat !== null && homeLng !== null
      ? getOwnedHomeMatches(homeLat, homeLng, homeAddress)
      : Promise.resolve([] as OwnedHomeMatch[]),
    // Structured expired/FSBO listing story (right-rail card) — data, not a
    // buried prose note.
    getContactProspectStory({ personId: person.id, fubLegacyId: person.fub_legacy_id }),
    // Per-lead newsletter issue history (received / opened / clicked), keyed by
    // the contact's emails + any subscriber rows linked via crm_person_id.
    getNewsletterHistoryForPerson({ crmPersonId: person.id, emails: personEmails }),
  ])

  // Homes panel = union of the behavioral trail (visitor_events) and the REAL
  // consumer stores (likes + saved_listings) — a liked-but-never-viewed home
  // still appears (views 0, Saved badge, Liked chip).
  const homesPanel = buildHomesPanelUnion(viewedListings, savedHomes)

  const emailInitialSubject = activeTpl?.subject ? renderCrmMerge(activeTpl.subject, personLike, mergeCtx) : ''
  const emailInitialBody = activeTpl?.body ? renderCrmMerge(activeTpl.body, personLike, mergeCtx) : ''
  const smsInitialBody = activeSmsTpl?.body ? renderCrmMerge(activeSmsTpl.body, personLike, mergeCtx) : ''

  // Custom-field merge tokens for the composers' "Merge Fields" dropdown —
  // same catalog the template editors offer (consolidation 2026-07-14).
  const composerCustomFields = fieldDefs
    .filter((d) => d.key.startsWith('custom'))
    .map((d) => ({ key: d.key, label: d.label }))

  // Group-text recipients: the lead + every linked person (spouse, …) with a
  // phone (relationships start off), MERGED with everyone this contact shares a
  // group text with (reconstructed from the stored thread members — pre-checked
  // so a reply auto-includes them). Raw thread numbers with no contact come
  // through as personId 0 so nobody is dropped.
  const [relRecipients, groupParticipants] = await Promise.all([
    getLeadSmsRecipients(
      person.id,
      relationships
        .filter((r) => r.relatedPersonId !== null)
        .map((r) => ({ relatedPersonId: r.relatedPersonId as number, label: r.label })),
    ),
    getGroupReplyParticipants(person.id),
  ])
  const smsRecipients: Array<{ personId: number; name: string; phone: string; relation: string; defaultOn?: boolean }> =
    relRecipients.map((r) => ({ ...r, defaultOn: false }))
  for (const g of groupParticipants) {
    const pid = g.personId ?? 0
    const existing = pid > 0 ? smsRecipients.find((m) => m.personId === pid) : smsRecipients.find((m) => m.personId === 0 && m.phone === g.phone)
    if (existing) { existing.defaultOn = true; continue }
    smsRecipients.push({ personId: pid, name: g.name, phone: g.phone, relation: pid > 0 ? 'Group' : 'Group', defaultOn: true })
  }

  // A CMA queued and awaiting broker review (status 'ready') → NextStepCard shows
  // "Review & Send CMA" instead of "Send CMA". Only when the home-driven next step
  // is actually CMA (the contact owns a home) — otherwise a stale, never-sent CMA
  // draft from a past request would hijack a non-owner's "Send newsletter" step.
  const reviewableCma =
    nextStep.step.kind === 'cma'
      ? ((full.cmaDeliveries ?? []).find((d) => String((d as { status?: string }).status ?? '') === 'ready') as { id?: string } | undefined)
      : undefined

  // Owned home (media + matches fetched in the big batch above).
  // Only trust a candidate whose street address actually matches the owner's —
  // proximity alone can land on a neighbor, so a near miss shows no photo / no
  // "on the market" alert rather than the wrong house.
  const confirmedMatches = homeMatches.filter((m) => m.addressMatched)
  const homeMlsPhoto = confirmedMatches.find((m) => m.photoUrl)?.photoUrl ?? null
  const homeActiveListing = confirmedMatches.find((m) => ['Active', 'Coming Soon', 'Active Under Contract', 'Pending'].includes(m.status ?? '')) ?? null
  const homeFacts = confirmedMatches.find((m) => m.beds || m.sqft) ?? null

  // §07 parity: collaborator form actions (bound to this person)
  // person is non-null here: notFound() was called above if person was null.
  const _pid = person!.id
  async function addCollaboratorForm(formData: FormData): Promise<void> {
    'use server'
    const brokerSlug = String(formData.get('brokerSlug') ?? '')
    await addCrmCollaboratorAction(_pid, brokerSlug)
    redirect(`${BASE}/${_pid}?flash=${encodeURIComponent('Collaborator added.')}`)
  }
  async function removeCollaboratorForm(formData: FormData): Promise<void> {
    'use server'
    const brokerSlug = String(formData.get('brokerSlug') ?? '')
    await removeCrmCollaboratorAction(_pid, brokerSlug)
    redirect(`${BASE}/${_pid}?flash=${encodeURIComponent('Collaborator removed.')}`)
  }
  // Enrollment pause/resume/stop now dispatch directly from PersonRightRail
  // (client imports of the crm.ts actions), no page-level wrappers needed.

  const webEvents = full.timeline.filter((t) => t.kind === 'web_event').slice(0, 6)
  const inquiryDate = resolveInquiryDate(full.timeline)
  const displayName = resolveDisplayName(person.name, person.id)
  const openTasks = full.tasks.filter((t) => !t.completed_at)
  const customEntries = Object.entries(person.custom ?? {}).filter(([, v]) => v !== null && v !== '' && v !== undefined)
  const emailEngagement = buildEmailEngagement(full.timeline)
  const latestWeb = webEvents[0] ?? null

  const hasAlerts = Boolean(flash || sendError || full.suppressions.length > 0)

  /* ── §07 three-column desktop assembly ─────────────────────────────────────
     Left sidebar (§07a) + center timeline (§07b) + right rail (§7c.8).
     Both prop bundles are pure mappings — see ./person-view-model.ts. */

  const personExtra = person as unknown as { created_at?: string | null }

  const sidebarData = buildSidebarData({
    person: person as unknown as Record<string, unknown> & { id: number },
    displayName,
    contactPoints: full.contactPoints,
    relationships,
    pondOptions: detailExtras.pondOptions,
    tagOptions: detailExtras.tagOptions,
    campaigns: contactMemberships.sequences.filter((s) => s.enrolled).map((s) => s.name),
    actingBroker: crmAccess.brokerSlug ?? null,
    canDelete: crmAccess.role === 'superuser',
    lastCommunicationAt: conversation.items[0]?.ts ?? null,
  })

  const timelineItems = buildTimelineItems(full.timeline, emailEngagement)

  /* Mobile Comms-tab composer — same send action + recipients as the desktop
     center column, so a reply from the phone goes out from the business line
     (never a personal cell). Pinned to the bottom of the Comms tab. */
  const mobileSmsComposer = primaryPhone ? (
    twilioStatus.canSend ? (
      <SmsComposer
        initialBody={smsInitialBody}
        sendAction={sendSmsForm.bind(null, person.id)}
        recipients={smsRecipients}
        primaryPersonId={person.id}
        personId={person.id}
        customFields={composerCustomFields}
      />
    ) : (
      <p className="px-1 py-2 text-center text-[13px] text-muted-foreground">
        Texting is paused — A2P status is {twilioStatus.a2p ?? 'unknown'}.
      </p>
    )
  ) : (
    <p className="px-1 py-2 text-center text-[13px] text-muted-foreground">No phone number on file.</p>
  )

  /* ── THE SendPanel (Pain #4) — ONE element, mounted on BOTH trees (the mobile
     tree had NO send domain — the audited RC3 gap). All five concepts:
     CMA · BPO · report · newsletter · listing matches. */
  const sendCenterNode = (
    <ContactSendCenter
      personId={person.id}
      emailSuppressed={full.suppressions.some((s) => s.channel === 'email' || s.channel === 'all')}
      bpos={contactBpos}
      cmas={contactCmas}
      reportAreas={reportAreas}
      subscribedAreas={reportSub?.areas ?? []}
      defaultCity={homeFacts?.city ?? null}
      cmaBuildHref="?intent=cma"
      bpoGenerateAction={startBpoForm.bind(null, person.id)}
      newsletterSubscribed={contactMemberships.newsletter.subscribed}
      latestNewsletter={latestNewsletter ? { subject: latestNewsletter.subject, status: latestNewsletter.status, sentAt: latestNewsletter.sentAt } : null}
      newsletterSendAction={sendDeliverableForPerson.bind(null, person.id, 'newsletter')}
    />
  )

  /* ── §25 Mobile Contact Detail — mapping + assembly in ./mobile-detail.tsx.
     Renders at < md; standalone under ?view=mobile (the 390px verification
     affordance — the automation browser can't shrink below 768px). */
  const mobileDetail = (
    <MobileLeadDetail
      sendCenter={sendCenterNode}
      full={full}
      displayName={displayName}
      backHref={BASE}
      inquiryDate={inquiryDate}
      customEntries={customEntries}
      conversation={conversation}
      emailEngagement={emailEngagement}
      relationships={relationships}
      collaborators={collaborators}
      viewedListings={homesPanel}
      smsComposer={mobileSmsComposer}
      pickers={{
        sources: crmSources,
        ponds: detailExtras.pondOptions,
        sequences: activeSequences,
        enrolledNames: actionPlanEnrollments.map((e) => e.sequenceName),
        currentBrokerSlug: actingSlug,
        currentBrokerName: CRM_BROKER_DISPLAY[actingSlug as keyof typeof CRM_BROKER_DISPLAY] ?? actingSlug,
      }}
      appointments={{
        rows: personAppointments,
        types: apptTypes,
        outcomes: apptOutcomes,
        brokerSlugs: [...CRM_BROKERS],
        currentBrokerSlug: actingSlug,
        isSuperuser: crmAccess.role === 'superuser',
      }}
      addNoteAction={addNoteForm.bind(null, person.id)}
      addTaskAction={addTaskForm}
      createAppointmentAction={createAppointmentAction}
      updateAppointmentAction={updateAppointmentAction}
      assignBrokerAction={assignBrokerForm}
      updateStageAction={updateStageForm}
      addTagAction={addTagForm}
      removeTagAction={removeTagForm}
      addCollaboratorAction={addCollaboratorForm}
      removeCollaboratorAction={removeCollaboratorForm}
      addContactPointAction={addContactPointForm}
    />
  )

  /* D8 litmus: `?intent=cma` auto-opens the one-tap CMA kick-off (both trees). */
  const cmaKickoffSheet = (
    <CmaKickoffMount personId={person.id} personName={(person.name as string | null) ?? null} personPhone={primaryPhone} personEmail={primaryEmail} homeAddress={homeAddress} timeline={full.timeline} intent={intent} />
  )

  /* ?view=mobile — forced 390px frame regardless of viewport (verification
     affordance; the automation browser can't resize below 768px). */
  if (view === 'mobile') {
    return (
      <div className="mx-auto w-[390px] max-w-full overflow-hidden border-x border-border bg-secondary">
        {mobileDetail}
        {cmaKickoffSheet}
      </div>
    )
  }

  return (
    <>
      {cmaKickoffSheet}
      {/* §25 mobile layout (< md) — full-bleed: cancel the ConsoleShell main
          padding (px-4 pt-5 pb-24) so the navy header runs edge-to-edge. */}
      <div className="-mx-4 -mt-5 -mb-24 md:hidden">{mobileDetail}</div>
      <div className="hidden md:block">
        {hasAlerts ? (
          <div className="mx-auto mb-3 w-full max-w-6xl space-y-3">
            {flash ? <Alert><AlertDescription>{flash}</AlertDescription></Alert> : null}
            {sendError ? <Alert variant="destructive"><AlertTitle>Couldn&apos;t send</AlertTitle><AlertDescription>{sendError}</AlertDescription></Alert> : null}
            {full.suppressions.length > 0 ? (
              <Alert variant="destructive">
                <AlertTitle>Contact restrictions active</AlertTitle>
                <AlertDescription>{full.suppressions.map((s) => `${s.channel}: ${s.reason}`).join(' \u00b7 ')}. Automated outreach is blocked.</AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}

        {/* \u00a707 three-column layout: left sidebar (\u00a707a) \u00b7 center timeline (\u00a707b) \u00b7 right rail (\u00a77c.8).
            Each column scrolls independently (no outer scroll shell). */}
        <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-5 sm:-mt-7 -mb-24 lg:-mb-8 grid h-[calc(100dvh-3.5rem)] grid-cols-[minmax(230px,24%)_1fr_minmax(290px,28%)] overflow-hidden lg:h-dvh">
          <div data-tour="person-profile" className="overflow-y-auto border-r border-border px-3 py-3">
            <PersonSidebar
              data={sidebarData}
              customFieldsNode={
                Object.keys((person.custom as Record<string, unknown> | null) ?? {}).length > 0 ? (
                  <CustomFieldsPanel personId={person.id} custom={person.custom} defs={fieldDefs} />
                ) : (
                  <p className="px-1 text-sm text-muted-foreground">No custom fields.</p>
                )
              }
            />
          </div>

          <div data-tour="person-timeline" className="min-w-0 overflow-hidden border-r border-border">
            <PersonCenterColumn
              personId={person.id}
              personName={displayName}
              backHref={BASE}
              items={timelineItems}
              counts={detailExtras.kindCounts}
              totalCount={full.timelineTotal}
              starredCount={detailExtras.starredCount}
              smsBlockedReason={
                !primaryPhone
                  ? 'No phone number on file.'
                  : !twilioStatus.canSend
                    ? `A2P status is ${twilioStatus.a2p ?? 'unknown'}. Compose becomes available once the number is verified.`
                    : null
              }
              emailComposer={
                primaryEmail ? (
                  <div className="space-y-3">
                    <TemplatePickerNav templates={templates} channel="email" currentKey={tpl ?? null} className="w-full" />
                    <EmailComposer
                      key={tpl ?? 'blank'}
                      initialSubject={emailInitialSubject}
                      initialBody={emailInitialBody}
                      signatureHtml={signature?.html ?? null}
                      sendAction={sendEmailForm.bind(null, person.id)}
                      personId={person.id}
                      tplKey={tpl ?? null}
                      toLabel={person.name ? `${person.name} \u00b7 ${primaryEmail}` : primaryEmail}
                      initialTo={primaryEmail ? [primaryEmail.toLowerCase()] : []}
                      recipientOptions={recipientOptions}
                      customFields={composerCustomFields}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No email address on file.</p>
                )
              }
              smsComposer={
                primaryPhone ? (
                  <div className="space-y-3">
                    <TemplatePickerNav templates={smsTemplates} channel="sms" currentKey={smsTpl ?? null} className="w-full" />
                    <SmsComposer
                      key={smsTpl ?? 'blank'}
                      initialBody={smsInitialBody}
                      sendAction={sendSmsForm.bind(null, person.id)}
                      recipients={smsRecipients}
                      primaryPersonId={person.id}
                      personId={person.id}
                      customFields={composerCustomFields}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No phone number on file.</p>
                )
              }
            />
          </div>

          <PersonRightRail
            personId={person.id}
            metaAddress={homeAddress}
            metaCreatedAt={personExtra.created_at ?? null}
            metaAssignedName={person.assigned_broker ? (CRM_BROKER_DISPLAY[person.assigned_broker as keyof typeof CRM_BROKER_DISPLAY] ?? person.assigned_broker) : null}
            enrollments={actionPlanEnrollments}
            automationOptions={activeSequences}
            lastSeenAt={latestWeb?.ts ?? null}
            activitySummary={detailExtras.activitySummary}
            tasks={openTasks.map((t) => ({ id: t.id, name: t.name, type: t.type, dueAt: t.due_at, assignedBroker: t.assigned_broker }))}
            appointments={detailExtras.appointments}
            deals={detailExtras.deals}
            files={detailExtras.files}
            collaborators={collaborators.map((c) => ({ brokerSlug: c.brokerSlug, name: c.displayName }))}
            brokerOptions={CRM_BROKERS.map((b) => ({ value: b, label: CRM_BROKER_DISPLAY[b] }))}
            assignedBroker={person.assigned_broker}
            homeCardNode={
              <>
                {nextStep.ownsHome && homeAddress ? (
                  <OwnedHomeCard
                    address={homeAddress}
                    photoUrl={homeMlsPhoto ?? homeMedia?.streetViewUrl ?? null}
                    factsLine={[
                      homeFacts?.beds ? `${homeFacts.beds} bed` : null,
                      homeFacts?.baths ? `${homeFacts.baths} bath` : null,
                      homeFacts?.sqft ? `${Math.round(homeFacts.sqft).toLocaleString('en-US')} sqft` : null,
                    ].filter(Boolean).join(' · ') || null}
                    mapsLink={homeMedia?.googleMapsLink ?? null}
                    onMarket={homeActiveListing ? `${homeActiveListing.status}${usd(homeActiveListing.listPrice) ? ` · ${usd(homeActiveListing.listPrice)}` : ''}` : null}
                    reviewDeliveryId={reviewableCma?.id ? String(reviewableCma.id) : null}
                    buildHref="?intent=cma"
                    sendAction={sendCmaForm.bind(null, person.id)}
                  />
                ) : null}
                {contactCmas.length > 0 ? (
                  <div className={nextStep.ownsHome && homeAddress ? 'mt-2.5' : undefined}>
                    <ContactCmaCard cmas={contactCmas} sendAction={sendCmaForm.bind(null, person.id)} />
                  </div>
                ) : null}
                <div className={nextStep.ownsHome && homeAddress ? 'mt-2.5' : undefined}>
                  <ContactBpoCard bpos={contactBpos} generateAction={startBpoForm.bind(null, person.id)} />
                </div>
                {prospectStories.length > 0 ? (
                  <div className="mt-2.5">
                    <ContactProspectHistoryCard stories={prospectStories} />
                  </div>
                ) : null}
              </>
            }
            websiteActivityNode={
              <div data-tour="person-website-activity" className="space-y-3">
                {sendCenterNode}
                {/* Pain #4: management chips only — one-off SENDS (newsletter,
                    market report) live in the SendPanel above; the duplicate
                    send-now affordances inside these sheets are unwired. */}
                <ContactQuickActions
                  personId={person.id}
                  newsletterSubscribed={contactMemberships.newsletter.subscribed}
                  automations={contactMemberships.sequences}
                  savedSearches={contactAlerts.map((a) => ({ id: a.id, label: a.label, url: a.url, active: a.active }))}
                  reportSub={reportSub ? { isActive: reportSub.isActive, areas: reportSub.areas, frequency: reportSub.frequency } : null}
                  reportAreas={reportAreas}
                  reportSetAction={setReportSubsForm.bind(null, person.id)}
                />
                <ContactBehaviorPanel summary={behaviorSummary} />
                {homesPanel.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Homes viewed &amp; saved ({homesPanel.length})</p>
                    {homesPanel.slice(0, 4).map((l) => (
                      <div key={l.listingKey} className="relative">
                        <ViewedHomeCard home={l} />
                        {/* Consumer-store chip: the card's own badge covers Saved /
                            Viewed; a real `likes` row gets its own Liked chip. */}
                        {l.consumerSources?.includes('liked') ? (
                          <Badge variant="secondary" className="absolute right-2 top-2">Liked</Badge>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                <ContactEmailEngagement engagement={emailEngagementSummary} />
                {/* Per-lead newsletter history: which issues this contact
                    received, opened, and clicked (recipients + ledger). */}
                <ContactNewsletterHistory history={newsletterHistory} />
                {/* WS4 delivery observability: what they're subscribed to +
                    every email they've gotten, with opened/clicked status. */}
                <ContactDeliveryPanel personId={person.id} email={primaryEmail} />
                {/* Pain #4: the standalone ReportSubscriptionsPanel mount is gone —
                    subscription management lives in ContactQuickActions' Market
                    reports sheet; one-off sends in the SendPanel. */}
                <ContactListingAlertsPanel alerts={contactAlerts} />
                {/* Saved searches: assign / edit / remove (in-house feature; \u00a77c.8.5 website-activity slot) */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saved searches ({savedSearches.length})</p>
                  {savedSearches.slice(0, 4).map((s) => {
                    const origin = s.origin ?? 'user'
                    const originTone = origin === 'broker' ? 'info' : origin === 'system' ? 'warning' : 'neutral'
                    return (
                      <div key={s.id} className="rounded-lg border border-border px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-sm font-medium" style={{ color: 'var(--console-info-strong)' }}>{describeSearch(s.filters)}</span>
                            <StatusPill tone={originTone} label={origin} />
                          </div>
                          <form action={deleteSavedSearchForm}>
                            <input type="hidden" name="personId" value={person.id} />
                            <input type="hidden" name="id" value={s.id} />
                            <button type="submit" className="rounded px-1 py-0.5 text-xs text-muted-foreground hover:text-destructive">Remove</button>
                          </form>
                        </div>
                      </div>
                    )
                  })}
                  {/* Pain #4: the duplicate inline assign form is gone — saved-search
                      creation lives in the SendPanel's Listings tab (which also
                      emails the current matches). Removal stays here with the list. */}
                </div>
              </div>
            }
          />
        </div>
      </div>
    </>
  )
}
