import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import {
  getCrmEmailTemplates,
  getCrmSmsTemplates,
  getTwilioSmsStatus,
  type CrmAccess,
  type CrmPersonFull,
} from '@/app/actions/crm'
import type { MergePersonLike } from '@/lib/crm/merge'
import {
  addNoteForm, updateStageForm, addTagForm, removeTagForm, addTaskForm,
  assignBrokerForm, addContactPointForm, sendEmailForm, sendSmsForm,
  startBpoForm,
} from '@/app/admin/(protected)/crm/[id]/form-actions'
import { getContactReportSubscription, listAvailableMarketReportAreas } from '@/lib/data/crm/getContactReportSubscriptions'
import { getCrmFieldDefinitions } from '@/lib/data/crm/getCrmFieldDefinitions'
import CustomFieldsPanel from '@/components/admin/crm/CustomFieldsPanel'
import { renderCrmMerge } from '@/lib/crm/merge'
import { buildMergeContext } from '@/lib/crm/merge-context'
import { getSignatureForMailbox } from '@/lib/crm/email-signature'
import { CRM_MAILBOXES } from '@/lib/crm/gmail'
import { getContactMemberships } from '@/lib/data/crm/getContactMemberships'
import { ContactSendCenter } from '@/components/admin/crm/ContactSendCenter'
import { getContactRelationships } from '@/lib/data/crm/getContactRelationships'
import { getRecipientOptionsForContact } from '@/lib/data/crm/getRecipientOptionsForContact'
import { getContactCmas } from '@/lib/data/crm/getContactCmas'
import { getContactBpos } from '@/lib/data/crm/getContactBpos'
import { getLatestNewsletterIssue } from '@/lib/data/crm/getLatestNewsletterIssue'
import { sendDeliverableForPerson } from '@/app/actions/send-deliverable'
import { getContactCollaborators } from '@/lib/data/crm/getContactCollaborators'
import { getContactActionPlanProgress } from '@/lib/data/crm/getContactActionPlanProgress'
import { addCrmCollaboratorAction, removeCrmCollaboratorAction } from '@/app/actions/crm-person-gaps'
import { EmailComposer } from '@/components/admin/crm/EmailComposer'
import { SmsComposer } from '@/components/admin/crm/SmsComposer'
import { getLeadSmsRecipients } from '@/lib/data/crm/getLeadSmsRecipients'
import { getGroupReplyParticipants } from '@/lib/data/crm/getGroupReplyParticipants'
import { TemplatePickerNav } from '@/components/admin/crm/TemplatePickerNav'
import { getContactConversation } from '@/lib/data/crm/getContactConversation'
import { CmaKickoffMount } from '@/components/admin/crm/CmaKickoffMount'
import { MobileLeadDetail } from './MobileLeadDetail'
import { PersonWorkspace } from './PersonWorkspace'
import { PersonSidebar } from '@/components/admin/crm/person-detail/PersonSidebar'
import { PersonCenterColumn } from '@/components/admin/crm/person-detail/PersonCenterColumn'
import { PersonRightRail } from '@/components/admin/crm/person-detail/PersonRightRail'
import { getPersonDetailExtras } from '@/lib/data/crm/getPersonDetailExtras'
import {
  buildEmailEngagement,
  buildTimelineItems,
  buildSidebarData,
  resolveDisplayName,
  resolveInquiryDate,
} from '@/app/admin/(protected)/crm/[id]/person-view-model'
import { getContactEmailEngagement, mergeEmailSendsIntoTimeline } from '@/lib/data/crm/getContactEmailEngagement'
import { getCrmSources } from '@/lib/data/crm/getCrmSources'
import { listActiveSequences } from '@/lib/crm/enroll'
import { PersonHomesRegion } from './PersonHomesRegion'
import { PersonEngagementRegion } from './PersonEngagementRegion'
import { PersonMobileHomesRegion } from './PersonMobileHomesRegion'
import { PersonMobileCalendarRegion } from './PersonMobileCalendarRegion'
import { PersonRegionSkeleton } from './PersonRegionSkeleton'

const BASE = '/admin/crm'

export type PersonWorkspaceIdentity = {
  personId: number
  crmAccess: CrmAccess
  full: CrmPersonFull
  templates: Awaited<ReturnType<typeof getCrmEmailTemplates>>
  smsTemplates: Awaited<ReturnType<typeof getCrmSmsTemplates>>
  twilioStatus: Awaited<ReturnType<typeof getTwilioSmsStatus>>
  tpl?: string
  smsTpl?: string
  sendError?: string
  flash?: string
  view?: string
  intent?: string
}

/**
 * Notice band for the three page-level alerts (flash, send failure, contact
 * restrictions). 11F: the shadcn Alert is gone, so the band is drawn from the
 * locked admin tokens. `role="alert"` is what shadcn's Alert carried and what
 * a screen reader needs, so it stays.
 */
function NoticeBand({
  tone,
  title,
  children,
}: {
  tone: 'quiet' | 'danger'
  title?: string
  children: React.ReactNode
}) {
  const danger = tone === 'danger'
  return (
    <div
      role="alert"
      className="rounded-lg px-4 py-3 text-sm"
      style={{
        border: `1px solid ${danger ? 'var(--a-danger)' : 'var(--a-border)'}`,
        background: danger ? 'var(--a-danger-wash)' : 'var(--a-surface)',
        color: danger ? 'var(--a-danger)' : 'var(--a-text)',
      }}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <p>{children}</p>
    </div>
  )
}

/**
 * Critical-path assembly for send + conversation + identity chrome.
 * Heavy secondary panels (homes, engagement, mobile calendar) stream under
 * nested Suspense — uncached request-scoped reads (no revalidateTag) so a
 * CRM surface never serves cross-contact cache.
 *
 * 11F: on the LOCKED admin v2 language. PRESENTATION ONLY — the same reads,
 * the same Suspense boundaries, the same region props.
 */
export async function PersonWorkspaceBody(props: PersonWorkspaceIdentity) {
  const {
    personId: id,
    crmAccess,
    full,
    templates,
    smsTemplates,
    twilioStatus,
    tpl,
    smsTpl,
    sendError,
    flash,
    view,
    intent,
  } = props
  const person = full.person
  if (!person) return null

  const personLike = person as unknown as MergePersonLike & { assigned_broker?: string | null }
  const actingSlug = crmAccess?.brokerSlug ?? personLike.assigned_broker ?? 'matt'
  const mailbox = CRM_MAILBOXES.find((m) => m.slug === actingSlug) ?? CRM_MAILBOXES[0]

  const activeTpl = tpl ? templates.find((t) => t.key === tpl) ?? null : null
  const activeSmsTpl = smsTpl ? smsTemplates.find((t) => t.key === smsTpl) ?? null : null

  const primaryEmail = full.contactPoints.find((c) => c.kind === 'email')?.value ?? null
  const primaryPhone = full.contactPoints.find((c) => c.kind === 'phone')?.value ?? null
  const personEmails = (person.emails ?? []).map((e) => e.value).filter((v): v is string => Boolean(v))

  const geo = full.geo as {
    city?: string
    neighborhood?: string
    subdivision?: string
    formatted_address?: string
    source_address?: string
    latitude?: number
    longitude?: number
    owner_type?: string
  } | null
  const homeLat = typeof geo?.latitude === 'number' ? geo.latitude : null
  const homeLng = typeof geo?.longitude === 'number' ? geo.longitude : null
  const homeAddress = geo?.formatted_address ?? geo?.source_address ?? null

  // Critical path only: SendPanel + composers + conversation + sidebar chrome.
  // Homes / engagement / mobile calendar stream in nested Suspense regions.
  const [
    contactMemberships,
    relationships,
    reportSub,
    reportAreas,
    fieldDefs,
    collaborators,
    actionPlanEnrollments,
    detailExtras,
    activeSequences,
    crmSources,
    recipientOptions,
    contactCmas,
    contactBpos,
    latestNewsletter,
    signature,
    mergeCtx,
    conversation,
    emailTracking,
  ] = await Promise.all([
    getContactMemberships(person.id),
    getContactRelationships(person.id),
    getContactReportSubscription(person.id),
    listAvailableMarketReportAreas(),
    getCrmFieldDefinitions(),
    getContactCollaborators(person.id),
    getContactActionPlanProgress(person.id),
    getPersonDetailExtras(person.id),
    listActiveSequences(),
    getCrmSources(),
    getRecipientOptionsForContact(person.id),
    getContactCmas({ crmPersonId: person.id, emails: personEmails }),
    getContactBpos({ crmPersonId: person.id, emails: personEmails }),
    getLatestNewsletterIssue(),
    getSignatureForMailbox(mailbox.email),
    activeTpl || activeSmsTpl
      ? buildMergeContext({ person: personLike, senderSlug: actingSlug })
      : Promise.resolve(undefined),
    getContactConversation(person.id, { limit: 50 }),
    getContactEmailEngagement(person.id),
  ])

  const emailInitialSubject = activeTpl?.subject ? renderCrmMerge(activeTpl.subject, personLike, mergeCtx) : ''
  const emailInitialBody = activeTpl?.body ? renderCrmMerge(activeTpl.body, personLike, mergeCtx) : ''
  const smsInitialBody = activeSmsTpl?.body ? renderCrmMerge(activeSmsTpl.body, personLike, mergeCtx) : ''

  const composerCustomFields = fieldDefs
    .filter((d) => d.key.startsWith('custom'))
    .map((d) => ({ key: d.key, label: d.label }))

  const [relRecipients, groupParticipants] = await Promise.all([
    getLeadSmsRecipients(
      person.id,
      relationships
        .filter((r) => r.relatedPersonId !== null)
        .map((r) => ({ relatedPersonId: r.relatedPersonId as number, label: r.label })),
    ),
    getGroupReplyParticipants(person.id),
  ])
  const smsRecipients: Array<{
    personId: number
    name: string
    phone: string
    relation: string
    defaultOn?: boolean
  }> = relRecipients.map((r) => ({ ...r, defaultOn: false }))
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
    smsRecipients.push({
      personId: pid,
      name: g.name,
      phone: g.phone,
      relation: pid > 0 ? 'Group' : 'Group',
      defaultOn: true,
    })
  }

  const readyCma = (full.cmaDeliveries ?? []).find(
    (d) => String((d as { status?: string }).status ?? '') === 'ready',
  ) as { id?: string } | undefined
  const reviewableCmaId = readyCma?.id ? String(readyCma.id) : null

  const _pid = person.id
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

  const webEvents = full.timeline.filter((t) => t.kind === 'web_event').slice(0, 6)
  const inquiryDate = resolveInquiryDate(full.timeline)
  const displayName = resolveDisplayName(person.name, person.id)
  const openTasks = full.tasks.filter((t) => !t.completed_at)
  const customEntries = Object.entries(person.custom ?? {}).filter(
    ([, v]) => v !== null && v !== '' && v !== undefined,
  )
  const emailEngagement = buildEmailEngagement(full.timeline)
  const latestWeb = webEvents[0] ?? null

  const hasAlerts = Boolean(flash || sendError || full.suppressions.length > 0)

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

  const timelineItems = mergeEmailSendsIntoTimeline(
    buildTimelineItems(full.timeline, emailEngagement),
    emailTracking.sends,
  )

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
      <p className="px-1 py-2 text-center text-[13px]" style={{ color: 'var(--a-text-2)' }}>
        Texting is paused — A2P status is {twilioStatus.a2p ?? 'unknown'}.
      </p>
    )
  ) : (
    <p className="px-1 py-2 text-center text-[13px]" style={{ color: 'var(--a-text-2)' }}>
      No phone number on file.
    </p>
  )

  const sendCenterNode = (
    <ContactSendCenter
      personId={person.id}
      emailSuppressed={full.suppressions.some((s) => s.channel === 'email' || s.channel === 'all')}
      bpos={contactBpos}
      cmas={contactCmas}
      reportAreas={reportAreas}
      subscribedAreas={reportSub?.areas ?? []}
      defaultCity={geo?.city ?? null}
      cmaBuildHref="?intent=cma"
      bpoGenerateAction={startBpoForm.bind(null, person.id)}
      newsletterSubscribed={contactMemberships.newsletter.subscribed}
      latestNewsletter={
        latestNewsletter
          ? { subject: latestNewsletter.subject, status: latestNewsletter.status, sentAt: latestNewsletter.sentAt }
          : null
      }
      newsletterSendAction={sendDeliverableForPerson.bind(null, person.id, 'newsletter')}
    />
  )

  const homesFallback = <PersonRegionSkeleton rows={4} />
  const engagementFallback = <PersonRegionSkeleton rows={6} />
  const mobileTabFallback = <PersonRegionSkeleton rows={5} className="px-4 py-3" />

  const mobileCalendarTasks = full.tasks.map((t) => ({
    id: t.id,
    name: t.name,
    type: t.type,
    due_at: t.due_at,
    completed_at: t.completed_at,
  }))

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
      homesTab={
        <Suspense fallback={mobileTabFallback}>
          <PersonMobileHomesRegion
            personId={person.id}
            fubLegacyId={person.fub_legacy_id}
            personEmails={personEmails}
          />
        </Suspense>
      }
      calendarTab={
        <Suspense fallback={mobileTabFallback}>
          <PersonMobileCalendarRegion
            personId={person.id}
            displayName={displayName}
            tasks={mobileCalendarTasks}
            currentBrokerSlug={actingSlug}
            isSuperuser={crmAccess.role === 'superuser'}
            addTaskAction={addTaskForm}
          />
        </Suspense>
      }
      smsComposer={mobileSmsComposer}
      pickers={{
        sources: crmSources,
        ponds: detailExtras.pondOptions,
        sequences: activeSequences,
        enrolledNames: actionPlanEnrollments.map((e) => e.sequenceName),
        currentBrokerSlug: actingSlug,
        currentBrokerName: CRM_BROKER_DISPLAY[actingSlug as keyof typeof CRM_BROKER_DISPLAY] ?? actingSlug,
      }}
      addNoteAction={addNoteForm.bind(null, person.id)}
      assignBrokerAction={assignBrokerForm}
      updateStageAction={updateStageForm}
      addTagAction={addTagForm}
      removeTagAction={removeTagForm}
      addCollaboratorAction={addCollaboratorForm}
      removeCollaboratorAction={removeCollaboratorForm}
      addContactPointAction={addContactPointForm}
    />
  )

  const cmaKickoffSheet = (
    <CmaKickoffMount
      personId={person.id}
      personName={(person.name as string | null) ?? null}
      personPhone={primaryPhone}
      personEmail={primaryEmail}
      homeAddress={homeAddress}
      timeline={full.timeline}
      intent={intent}
    />
  )

  const desktopTree = (
    <>
      {hasAlerts ? (
        <div className="mx-auto mb-3 w-full max-w-6xl space-y-3">
          {flash ? <NoticeBand tone="quiet">{flash}</NoticeBand> : null}
          {sendError ? (
            <NoticeBand tone="danger" title="Couldn't send">
              {sendError}
            </NoticeBand>
          ) : null}
          {full.suppressions.length > 0 ? (
            <NoticeBand tone="danger" title="Contact restrictions active">
              {full.suppressions.map((s) => `${s.channel}: ${s.reason}`).join(' · ')}. Automated
              outreach is blocked.
            </NoticeBand>
          ) : null}
        </div>
      ) : null}

      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-5 sm:-mt-7 -mb-24 lg:-mb-8 grid h-[calc(100dvh-3.5rem)] grid-cols-[minmax(230px,24%)_1fr_minmax(290px,28%)] overflow-hidden lg:h-dvh">
        <div
          data-slot="person-profile"
          className="overflow-y-auto px-3 py-3"
          style={{ borderRight: '1px solid var(--a-border)' }}
        >
          <PersonSidebar
            data={sidebarData}
            customFieldsNode={
              Object.keys((person.custom as Record<string, unknown> | null) ?? {}).length > 0 ? (
                <CustomFieldsPanel personId={person.id} custom={person.custom} defs={fieldDefs} />
              ) : (
                <p className="px-1 text-sm" style={{ color: 'var(--a-text-2)' }}>
                  No custom fields.
                </p>
              )
            }
          />
        </div>

        <div
          data-slot="person-timeline"
          className="min-w-0 overflow-hidden"
          style={{ borderRight: '1px solid var(--a-border)' }}
        >
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
                    toLabel={person.name ? `${person.name} · ${primaryEmail}` : primaryEmail}
                    initialTo={primaryEmail ? [primaryEmail.toLowerCase()] : []}
                    recipientOptions={recipientOptions}
                    customFields={composerCustomFields}
                  />
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--a-text-2)' }}>
                  No email address on file.
                </p>
              )
            }
            smsComposer={
              primaryPhone ? (
                <div className="space-y-3">
                  <TemplatePickerNav
                    templates={smsTemplates}
                    channel="sms"
                    currentKey={smsTpl ?? null}
                    className="w-full"
                  />
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
                <p className="text-sm" style={{ color: 'var(--a-text-2)' }}>
                  No phone number on file.
                </p>
              )
            }
          />
        </div>

        <PersonRightRail
          personId={person.id}
          metaAddress={homeAddress}
          metaCreatedAt={personExtra.created_at ?? null}
          metaAssignedName={
            person.assigned_broker
              ? (CRM_BROKER_DISPLAY[person.assigned_broker as keyof typeof CRM_BROKER_DISPLAY] ??
                person.assigned_broker)
              : null
          }
          enrollments={actionPlanEnrollments}
          automationOptions={activeSequences}
          lastSeenAt={latestWeb?.ts ?? null}
          activitySummary={detailExtras.activitySummary}
          tasks={openTasks.map((t) => ({
            id: t.id,
            name: t.name,
            type: t.type,
            dueAt: t.due_at,
            assignedBroker: t.assigned_broker,
          }))}
          appointments={detailExtras.appointments}
          deals={detailExtras.deals}
          files={detailExtras.files}
          collaborators={collaborators.map((c) => ({ brokerSlug: c.brokerSlug, name: c.displayName }))}
          brokerOptions={CRM_BROKERS.map((b) => ({ value: b, label: CRM_BROKER_DISPLAY[b] }))}
          assignedBroker={person.assigned_broker}
          homeCardNode={
            <Suspense fallback={homesFallback}>
              <PersonHomesRegion
                personId={person.id}
                fubLegacyId={person.fub_legacy_id}
                homeLat={homeLat}
                homeLng={homeLng}
                homeAddress={homeAddress}
                contactCmas={contactCmas}
                contactBpos={contactBpos}
                reviewableCmaId={reviewableCmaId}
              />
            </Suspense>
          }
          websiteActivityNode={
            <div className="space-y-3">
              {sendCenterNode}
              <Suspense fallback={engagementFallback}>
                <PersonEngagementRegion
                  personId={person.id}
                  fubLegacyId={person.fub_legacy_id}
                  personEmails={personEmails}
                  primaryEmail={primaryEmail}
                  contactMemberships={contactMemberships}
                  reportSub={reportSub}
                  reportAreas={reportAreas}
                />
              </Suspense>
            </div>
          }
        />
      </div>
    </>
  )

  return (
    <PersonWorkspace
      forceMobile={view === 'mobile'}
      mobile={mobileDetail}
      desktop={desktopTree}
      kickoff={cmaKickoffSheet}
    />
  )
}
