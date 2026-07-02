// @no-parity — internal admin surface, no public mockup contract
import { notFound, redirect } from 'next/navigation'
import { formatDate } from '@/lib/format/date'
import { CRM_STAGES, CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
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
  startCmaForm, sendCmaForm, setReportSubsForm, assignSavedSearchForm,
  deleteSavedSearchForm,
} from './form-actions'
// CRM record-card cutover (2026-06-24): home-driven next step, CMA-from-contact,
// market-report subscriptions, source badge.
import { getContactNextStep } from '@/app/actions/contact-next-step'
import { getContactReportSubscription, listAvailableMarketReportAreas } from '@/lib/data/crm/getContactReportSubscriptions'
import { getCrmFieldDefinitions } from '@/lib/data/crm/getCrmFieldDefinitions'
import CustomFieldsPanel from '@/components/admin/crm/CustomFieldsPanel'
import ReportSubscriptionsPanel from '@/components/admin/crm/ReportSubscriptionsPanel'
import { OwnedHomeCard } from '@/components/admin/crm/OwnedHomeCard'
import { timelineEmailBody } from '@/lib/crm/email-body'
import { renderCrmMerge } from '@/lib/crm/merge'
import { buildMergeContext } from '@/lib/crm/merge-context'
import { getSignatureForMailbox } from '@/lib/crm/email-signature'
import { CRM_MAILBOXES } from '@/lib/crm/gmail'
import { getOwnedHomeMatches, getGuestSearchAlertsForLead, getViewedListingsForLead, type OwnedHomeMatch } from '@/lib/data'
import { getOwnedHomeMedia } from '@/lib/crm/owned-home-media'
import { getContactMemberships } from '@/lib/data/crm/getContactMemberships'
import { ContactQuickActions } from '@/components/admin/crm/ContactQuickActions'
import { getContactEmailEngagement } from '@/lib/data/crm/getContactEmailEngagement'
import ContactEmailEngagement from '@/components/admin/crm/ContactEmailEngagement'
import { getContactBehaviorSummary } from '@/lib/data/crm/getContactBehaviorSummary'
import ContactBehaviorPanel from '@/components/admin/crm/ContactBehaviorPanel'
import { getContactRelationships } from '@/lib/data/crm/getContactRelationships'
import { getContactListingAlerts } from '@/lib/data/crm/getContactListingAlerts'
import { ContactListingAlertsPanel } from '@/components/admin/crm/ContactListingAlertsPanel'
import { getContactCollaborators } from '@/lib/data/crm/getContactCollaborators'
import { getContactActionPlanProgress } from '@/lib/data/crm/getContactActionPlanProgress'
import { addCrmCollaboratorAction, removeCrmCollaboratorAction } from '@/app/actions/crm-person-gaps'
import { EmailComposer } from '@/components/admin/crm/EmailComposer'
import { SmsComposer } from '@/components/admin/crm/SmsComposer'
import { getLeadSmsRecipients } from '@/lib/data/crm/getLeadSmsRecipients'
import { TemplatePickerNav } from '@/components/admin/crm/TemplatePickerNav'
import { getContactConversation } from '@/lib/data/crm/getContactConversation'
import ViewedHomeCard from '@/components/admin/crm/ViewedHomeCard'
import { StatusPill } from '@/components/console/StatusPill'
// §25 Mobile Contact Detail (mapping + assembly colocated in mobile-detail.tsx)
import { MobileLeadDetail } from './mobile-detail'
// §07 three-column desktop rebuild (CRM_BUILD_MISSION screen: person-detail-desktop)
import { PersonSidebar, type SidebarData } from '@/components/admin/crm/person-detail/PersonSidebar'
import { PersonCenterColumn, type TimelineItem } from '@/components/admin/crm/person-detail/PersonCenterColumn'
import { PersonRightRail } from '@/components/admin/crm/person-detail/PersonRightRail'
import { getPersonDetailExtras } from '@/lib/data/crm/getPersonDetailExtras'
import { getCrmSources } from '@/lib/data/crm/getCrmSources'
import { listActiveSequences } from '@/lib/crm/enroll'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const metadata = { title: 'Lead · Console' }
export const dynamic = 'force-dynamic'

const BASE = '/admin/console/leads'

// ── Helpers ──────────────────────────────────────────────────────────────────
function usd(n: number | null | undefined): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  return `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}`
}
function describeSearch(filters: Record<string, unknown> | null): string {
  if (!filters) return 'Saved search'
  const f = filters as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() && !Number.isNaN(Number(v)) ? Number(v) : null)
  const parts: string[] = []
  const where = (f.city ?? f.neighborhood ?? f.subdivision ?? f.area ?? f.location) as string | undefined
  if (where) parts.push(String(where))
  const min = num(f.minPrice ?? f.priceMin ?? f.min_price)
  const max = num(f.maxPrice ?? f.priceMax ?? f.max_price)
  if (min && max) parts.push(`${usd(min)}–${usd(max)}`)
  else if (max) parts.push(`up to ${usd(max)}`)
  else if (min) parts.push(`${usd(min)}+`)
  const beds = num(f.beds ?? f.minBeds ?? f.bedrooms)
  if (beds) parts.push(`${beds}+ bd`)
  const baths = num(f.baths ?? f.minBaths ?? f.bathrooms)
  if (baths) parts.push(`${baths}+ ba`)
  const type = (f.propertyType ?? f.type ?? f.homeType) as string | undefined
  if (type) parts.push(String(type))
  return parts.length ? parts.join(' · ') : 'All listings'
}



export default async function ConsoleLeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tpl?: string; smsTpl?: string; error?: string; flash?: string; view?: string }>
}) {
  const { id: idRaw } = await params
  const id = Number(idRaw)
  if (!Number.isFinite(id) || id <= 0) notFound()
  const { tpl, smsTpl, error: sendError, flash, view } = await searchParams

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
  const signature = await getSignatureForMailbox(mailbox.email)

  const activeTpl = tpl ? templates.find((t) => t.key === tpl) ?? null : null
  const activeSmsTpl = smsTpl ? smsTemplates.find((t) => t.key === smsTpl) ?? null : null
  // Composer prefill renders with the SAME context the send path uses, so the
  // broker sees exactly what will go out (agent/sender/company resolved).
  const mergeCtx = (activeTpl || activeSmsTpl)
    ? await buildMergeContext({ person: personLike, senderSlug: actingSlug })
    : undefined
  const emailInitialSubject = activeTpl?.subject ? renderCrmMerge(activeTpl.subject, personLike, mergeCtx) : ''
  const emailInitialBody = activeTpl?.body ? renderCrmMerge(activeTpl.body, personLike, mergeCtx) : ''
  const smsInitialBody = activeSmsTpl?.body ? renderCrmMerge(activeSmsTpl.body, personLike, mergeCtx) : ''

  const primaryEmail = full.contactPoints.find((c) => c.kind === 'email')?.value ?? null
  const primaryPhone = full.contactPoints.find((c) => c.kind === 'phone')?.value ?? null
  const personEmails = (person.emails ?? []).map((e) => e.value).filter((v): v is string => Boolean(v))

  // What they're shopping for — saved searches + the homes they're watching (live MLS) + newsletter status.
  const [savedSearches, viewedListings, contactMemberships, behaviorSummary, relationships, contactAlerts, nextStep, reportSub, reportAreas, fieldDefs, emailEngagementSummary, collaborators, actionPlanEnrollments, detailExtras, activeSequences, crmSources] = await Promise.all([
    getGuestSearchAlertsForLead({ fubPersonId: person.fub_legacy_id, emails: personEmails }),
    getViewedListingsForLead(person.fub_legacy_id),
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
  ])

  // Full Comms thread (every text + email + call), newest first, paginated —
  // NOT capped to the latest 40 of the 100-row timeline (which hid old messages
  // and group texts on long-running contacts).
  const conversation = await getContactConversation(person.id, { limit: 50 })

  // Group-text recipients: the lead + every linked person (spouse, …) with a
  // phone, so the SMS composer can quick-add them without typing.
  const smsRecipients = await getLeadSmsRecipients(
    person.id,
    relationships
      .filter((r) => r.relatedPersonId !== null)
      .map((r) => ({ relatedPersonId: r.relatedPersonId as number, label: r.label })),
  )

  // A CMA queued and awaiting broker review (status 'ready') → NextStepCard shows
  // "Review & Send CMA" instead of "Send CMA". Only when the home-driven next step
  // is actually CMA (the contact owns a home) — otherwise a stale, never-sent CMA
  // draft from a past request would hijack a non-owner's "Send newsletter" step.
  const reviewableCma =
    nextStep.step.kind === 'cma'
      ? ((full.cmaDeliveries ?? []).find((d) => String((d as { status?: string }).status ?? '') === 'ready') as { id?: string } | undefined)
      : undefined

  // Owned home.
  const geo = full.geo as { city?: string; neighborhood?: string; subdivision?: string; formatted_address?: string; source_address?: string; latitude?: number; longitude?: number; owner_type?: string } | null
  const homeLat = typeof geo?.latitude === 'number' ? geo.latitude : null
  const homeLng = typeof geo?.longitude === 'number' ? geo.longitude : null
  const homeAddress = geo?.formatted_address ?? geo?.source_address ?? null
  let homeMedia: Awaited<ReturnType<typeof getOwnedHomeMedia>> | null = null
  let homeMatches: OwnedHomeMatch[] = []
  if (homeLat !== null && homeLng !== null) {
    ;[homeMedia, homeMatches] = await Promise.all([getOwnedHomeMedia(homeLat, homeLng), getOwnedHomeMatches(homeLat, homeLng, homeAddress)])
  }
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
  // Inquiry date for the Info tab "Inquiries" section — when the lead was created.
  const inquiryDate = (() => {
    const created = full.timeline.find((t) => t.kind === 'lead_created')?.ts ?? null
    return created ? formatDate(created, { month: 'short', day: 'numeric' }) : null
  })()
  // Display name: many imported leads have a placeholder name like
  // "Lead someone@example.com". Strip the "Lead " prefix so the header shows the
  // address cleanly instead of the ugly placeholder, and drop the duplicate email
  // line when the name already IS the email.
  const rawName = person.name ?? `Contact #${person.id}`
  const nameIsPlaceholderEmail = /^lead\s+\S+@\S+$/i.test(rawName)
  const displayName = nameIsPlaceholderEmail ? rawName.replace(/^lead\s+/i, '') : rawName
  const openTasks = full.tasks.filter((t) => !t.completed_at)
  const customEntries = Object.entries(person.custom ?? {}).filter(([, v]) => v !== null && v !== '' && v !== undefined)

  const emailEngagement: Record<string, { opens: number; lastOpen: string | null; clicks: number }> = {}
  for (const t of full.timeline) {
    if (t.kind !== 'email_open' && t.kind !== 'email_click') continue
    const pl = (t.payload ?? {}) as { label?: string }
    const key = (pl.label ?? t.title ?? '').trim()
    if (!key) continue
    const e = (emailEngagement[key] ??= { opens: 0, lastOpen: null, clicks: 0 })
    if (t.kind === 'email_open') { e.opens++; if (!e.lastOpen || t.ts > e.lastOpen) e.lastOpen = t.ts }
    else e.clicks++
  }

  const latestWeb = webEvents[0] ?? null

  const hasAlerts = Boolean(flash || sendError || full.suppressions.length > 0)

  /* ── §07 three-column desktop assembly ─────────────────────────────────────
     Left sidebar (§07a) + center timeline (§07b) + right rail (§7c.8). */

  function fmtAgoLong(iso: string | null): string | null {
    if (!iso) return null
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000)
    if (days <= 0) return 'today'
    if (days === 1) return 'a day ago'
    if (days < 30) return `${days} days ago`
    const months = Math.round(days / 30)
    return months === 1 ? 'a month ago' : `${months} months ago`
  }
  function fmtPhoneParen(d: string): string {
    return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d
  }

  const lastComm = conversation.items[0]?.ts ?? null
  const addr0 = (Array.isArray(person.addresses) ? person.addresses[0] : null) as Record<string, unknown> | null
  const sidebarAddress = addr0
    ? {
        street: String(addr0.street ?? addr0.address1 ?? ''),
        city: String(addr0.city ?? ''),
        state: String(addr0.state ?? ''),
        zip: String(addr0.zip ?? addr0.code ?? addr0.postal_code ?? ''),
      }
    : null

  const SOURCE_PRESETS = ['Google', 'Zillow', 'Realtor.com', 'Import', 'Referral', 'Ryan-Realty.com', 'inbound-call', 'Expired Listing Cron', 'FSBO']
  const personExtra = person as unknown as { price?: number | null; timeframe?: string | null; lender_name?: string | null; pond_id?: number | null; created_at?: string | null }

  const sidebarData: SidebarData = {
    personId: person.id,
    name: displayName,
    firstName: person.first_name ?? null,
    lastName: (person as unknown as { last_name?: string | null }).last_name ?? null,
    pictureUrl: person.picture_url,
    lastCommunicationLabel: lastComm ? `Last communication ${fmtAgoLong(lastComm)}` : null,
    phones: full.contactPoints
      .filter((c) => c.kind === 'phone')
      .map((c) => ({
        value: c.value,
        label: c.label && c.label.trim() ? c.label : 'Mobile',
        bad: c.status === 'bad',
        isPrimary: !!c.is_primary,
        display: fmtPhoneParen(c.value),
      })),
    emails: full.contactPoints
      .filter((c) => c.kind === 'email')
      .map((c) => ({ value: c.value, isPrimary: !!c.is_primary, status: c.status ?? 'active' })),
    address: sidebarAddress,
    relationships: relationships.map((r) => ({ relatedPersonId: r.relatedPersonId, name: r.name, label: r.label })),
    stage: person.stage,
    stageOptions: [...CRM_STAGES],
    assignedBroker: person.assigned_broker,
    brokerOptions: CRM_BROKERS.map((b) => ({ value: b, label: CRM_BROKER_DISPLAY[b] })),
    pondOptions: detailExtras.pondOptions,
    pondId: personExtra.pond_id ?? null,
    actingBroker: crmAccess.brokerSlug ?? null,
    source: person.source,
    sourceOptions: [...new Set([...(person.source ? [person.source] : []), ...SOURCE_PRESETS])],
    sourceRecency: fmtAgoLong(personExtra.created_at ?? null),
    price: typeof personExtra.price === 'number' ? personExtra.price : personExtra.price ? Number(personExtra.price) : null,
    timeframe: personExtra.timeframe ?? null,
    tags: Array.isArray(person.tags) ? person.tags : [],
    tagOptions: [...new Set([...detailExtras.tagOptions, ...(Array.isArray(person.tags) ? person.tags : [])])],
    campaigns: contactMemberships.sequences.filter((s) => s.enrolled).map((s) => s.name),
    lenderName: personExtra.lender_name ?? null,
    background: person.background,
    socialLinks: [],
    groups: [],
    canDelete: crmAccess.role === 'superuser',
  }

  const timelineItems: TimelineItem[] = full.timeline
    .filter((t) => t.kind !== 'email_open' && t.kind !== 'email_click')
    .map((t) => {
      const eng = emailEngagement[(t.title ?? '').trim()]
      return {
        id: t.id,
        kind: t.kind,
        ts: t.ts,
        title: t.title,
        body: t.body ? timelineEmailBody(t.body) : null,
        broker: t.broker,
        source: t.source,
        starred: Boolean(t.starred),
        payload: (t.payload ?? {}) as Record<string, unknown>,
        opens: t.kind === 'email_out' ? eng?.opens : undefined,
        clicks: t.kind === 'email_out' ? eng?.clicks : undefined,
      }
    })

  /* ── §25 Mobile Contact Detail — mapping + assembly in ./mobile-detail.tsx.
     Renders at < md; standalone under ?view=mobile (the 390px verification
     affordance — the automation browser can't shrink below 768px). */
  const mobileDetail = (
    <MobileLeadDetail
      full={full}
      displayName={displayName}
      backHref={BASE}
      inquiryDate={inquiryDate}
      customEntries={customEntries}
      conversation={conversation}
      emailEngagement={emailEngagement}
      relationships={relationships}
      collaborators={collaborators}
      viewedListings={viewedListings}
      pickers={{
        sources: crmSources,
        ponds: detailExtras.pondOptions,
        sequences: activeSequences,
        enrolledNames: actionPlanEnrollments.map((e) => e.sequenceName),
        currentBrokerSlug: actingSlug,
        currentBrokerName: CRM_BROKER_DISPLAY[actingSlug as keyof typeof CRM_BROKER_DISPLAY] ?? actingSlug,
      }}
      addNoteAction={addNoteForm.bind(null, person.id)}
      addTaskAction={addTaskForm}
      assignBrokerAction={assignBrokerForm}
      updateStageAction={updateStageForm}
      addTagAction={addTagForm}
      removeTagAction={removeTagForm}
      addCollaboratorAction={addCollaboratorForm}
      removeCollaboratorAction={removeCollaboratorForm}
      addContactPointAction={addContactPointForm}
    />
  )

  /* ?view=mobile — forced 390px frame regardless of viewport (verification
     affordance; the automation browser can't resize below 768px). */
  if (view === 'mobile') {
    return (
      <div className="mx-auto w-[390px] max-w-full overflow-hidden border-x border-border bg-secondary">
        {mobileDetail}
      </div>
    )
  }

  return (
    <>
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
          <div className="overflow-y-auto border-r border-border px-3 py-3">
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

          <div className="min-w-0 overflow-hidden border-r border-border">
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
                      tplKey={tpl ?? null}
                      toLabel={person.name ? `${person.name} \u00b7 ${primaryEmail}` : primaryEmail}
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
              nextStep.ownsHome && homeAddress ? (
                <OwnedHomeCard
                  address={homeAddress}
                  photoUrl={homeMlsPhoto ?? homeMedia?.streetViewUrl ?? null}
                  factsLine={[
                    homeFacts?.beds ? `${homeFacts.beds} bed` : null,
                    homeFacts?.baths ? `${homeFacts.baths} bath` : null,
                    homeFacts?.sqft ? `${Math.round(homeFacts.sqft).toLocaleString('en-US')} sqft` : null,
                  ].filter(Boolean).join(' \u00b7 ') || null}
                  mapsLink={homeMedia?.googleMapsLink ?? null}
                  onMarket={homeActiveListing ? `${homeActiveListing.status}${usd(homeActiveListing.listPrice) ? ` \u00b7 ${usd(homeActiveListing.listPrice)}` : ''}` : null}
                  reviewDeliveryId={reviewableCma?.id ? String(reviewableCma.id) : null}
                  generateAction={startCmaForm.bind(null, person.id)}
                  sendAction={sendCmaForm.bind(null, person.id)}
                />
              ) : null
            }
            websiteActivityNode={
              <div className="space-y-3">
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
                {viewedListings.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Homes viewed ({viewedListings.length})</p>
                    {viewedListings.slice(0, 4).map((l) => (
                      <ViewedHomeCard key={l.listingKey} home={l} />
                    ))}
                  </div>
                ) : null}
                <ContactEmailEngagement engagement={emailEngagementSummary} />
                <ReportSubscriptionsPanel
                  current={reportSub ? { isActive: reportSub.isActive, areas: reportSub.areas, frequency: reportSub.frequency } : null}
                  areaOptions={reportAreas}
                  setAction={setReportSubsForm.bind(null, person.id)}
                />
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
                  {primaryEmail ? (
                    <details className="group rounded-lg border border-dashed border-border">
                      <summary className="cursor-pointer px-2.5 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground">+ Add saved search</summary>
                      <form action={assignSavedSearchForm} className="space-y-2 border-t border-border p-2.5">
                        <input type="hidden" name="personId" value={person.id} />
                        <input type="hidden" name="email" value={primaryEmail} />
                        <input type="hidden" name="fubPersonId" value={person.fub_legacy_id ?? ''} />
                        <Input name="name" placeholder="Search name" className="h-8 text-sm" />
                        <Input name="city" placeholder="City (e.g. Bend)" className="h-8 text-sm" />
                        <div className="grid grid-cols-2 gap-2">
                          <Input name="minPrice" type="number" inputMode="numeric" placeholder="Min price" className="h-8 text-sm" />
                          <Input name="maxPrice" type="number" inputMode="numeric" placeholder="Max price" className="h-8 text-sm" />
                        </div>
                        <Input name="minBeds" type="number" inputMode="numeric" placeholder="Min beds" className="h-8 text-sm" />
                        <div className="flex justify-end">
                          <Button type="submit" size="sm" variant="outline">Assign</Button>
                        </div>
                      </form>
                    </details>
                  ) : null}
                </div>
              </div>
            }
          />
        </div>
      </div>
    </>
  )
}
