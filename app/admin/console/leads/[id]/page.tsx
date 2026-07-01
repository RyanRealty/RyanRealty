// @no-parity — internal admin surface, no public mockup contract
import { notFound, redirect } from 'next/navigation'
import { CRM_STAGES, CRM_BROKERS, CRM_BROKER_DISPLAY } from '@/lib/crm/constants'
import {
  addCrmNoteAction,
  addCrmTagAction,
  addCrmTaskAction,
  assignCrmBrokerAction,
  completeCrmTaskAction,
  getCrmAccess,
  getCrmEmailTemplates,
  getCrmPersonFull,
  getCrmSmsTemplates,
  getTwilioSmsStatus,
  removeCrmTagAction,
  sendCrmEmailAction,
  sendCrmSmsAction,
  startCrmCallAction,
  updateCrmStageAction,
} from '@/app/actions/crm'
import { adminAssignSavedSearchAction, adminUpdateSavedSearchAction, adminDeleteSavedSearchAction } from '@/app/actions/newsletter'
// CRM record-card cutover (2026-06-24): home-driven next step, CMA-from-contact,
// market-report subscriptions, source badge.
import { getContactNextStep } from '@/app/actions/contact-next-step'
import { startCmaForContactAction, sendCmaForContactAction } from '@/app/actions/contact-cma'
import { sendNewsletterToContactAction } from '@/app/actions/contact-newsletter'
import { getContactReportSubscription, listAvailableMarketReportAreas } from '@/lib/data/crm/getContactReportSubscriptions'
import { getCrmFieldDefinitions } from '@/lib/data/crm/getCrmFieldDefinitions'
import CustomFieldsPanel from '@/components/admin/crm/CustomFieldsPanel'
import { setReportSubscriptionAction } from '@/app/actions/crm-report-subscriptions'
import { saveContactCustomFieldsAction } from '@/app/actions/contact-custom-fields'
import ReportSubscriptionsPanel from '@/components/admin/crm/ReportSubscriptionsPanel'
import { OwnedHomeCard } from '@/components/admin/crm/OwnedHomeCard'
import { timelineEmailBody } from '@/lib/crm/email-body'
import { renderCrmMerge } from '@/lib/crm/merge'
import { getSignatureForMailbox } from '@/lib/crm/email-signature'
import { CRM_MAILBOXES } from '@/lib/crm/gmail'
import { getOwnedHomeMatches, getGuestSearchAlertsForLead, getViewedListingsForLead, type OwnedHomeMatch } from '@/lib/data'
import { getOwnedHomeMedia } from '@/lib/crm/owned-home-media'
import { getContactMemberships } from '@/lib/data/crm/getContactMemberships'
import { ContactQuickActions } from '@/components/admin/crm/ContactQuickActions'
import { ContactInfoTab } from '@/components/admin/crm/ContactInfoTab'
import { getContactActivityFeed } from '@/lib/data/crm/getContactActivityFeed'
import { getContactEmailEngagement } from '@/lib/data/crm/getContactEmailEngagement'
import ContactEmailEngagement from '@/components/admin/crm/ContactEmailEngagement'
import { getContactBehaviorSummary } from '@/lib/data/crm/getContactBehaviorSummary'
import ContactBehaviorPanel from '@/components/admin/crm/ContactBehaviorPanel'
import { getContactRelationships } from '@/lib/data/crm/getContactRelationships'
import { RelationshipsPanel } from '@/components/admin/crm/RelationshipsPanel'
import { getContactListingAlerts } from '@/lib/data/crm/getContactListingAlerts'
import { ContactListingAlertsPanel } from '@/components/admin/crm/ContactListingAlertsPanel'
import { getContactCollaborators } from '@/lib/data/crm/getContactCollaborators'
import { CollaboratorsPanel } from '@/components/admin/crm/CollaboratorsPanel'
import { getContactActionPlanProgress } from '@/lib/data/crm/getContactActionPlanProgress'
import { ActionPlanProgressPanel } from '@/components/admin/crm/ActionPlanProgressPanel'
import { addCrmCollaboratorAction, removeCrmCollaboratorAction } from '@/app/actions/crm-person-gaps'
import { pauseEnrollmentAction, resumeEnrollmentAction, dismissEnrollmentAction } from '@/app/actions/crm'
import { MergeContactDialog } from '@/components/admin/crm/MergeContactDialog'
import { EmailComposer } from '@/components/admin/crm/EmailComposer'
import { SmsComposer } from '@/components/admin/crm/SmsComposer'
import { getLeadSmsRecipients } from '@/lib/data/crm/getLeadSmsRecipients'
import { TemplatePickerNav } from '@/components/admin/crm/TemplatePickerNav'
import ConversationFeed from '@/components/admin/crm/ConversationFeed'
import { getContactConversation } from '@/lib/data/crm/getContactConversation'
import ViewedHomeCard from '@/components/admin/crm/ViewedHomeCard'
import { isConversationEvent } from '@/components/admin/crm/ConversationThread'
import { StatusPill } from '@/components/console/StatusPill'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { LeadTabs } from '@/components/console/LeadTabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const metadata = { title: 'Lead · Console' }
export const dynamic = 'force-dynamic'

const BASE = '/admin/console/leads'

// ── Server-action form wrappers (return to the console route) ────────────────
async function addNoteForm(personId: number, formData: FormData): Promise<void> {
  'use server'
  formData.set('personId', String(personId))
  const r = await addCrmNoteAction(formData)
  if (!r.ok) redirect(`${BASE}/${personId}?error=${encodeURIComponent(`Note not saved — ${r.error ?? 'unknown error'}`)}`)
  else redirect(`${BASE}/${personId}?flash=${encodeURIComponent('Note saved.')}`)
}
async function updateStageForm(formData: FormData): Promise<void> {
  'use server'
  const r = await updateCrmStageAction(formData)
  if (!r.ok) console.error('[console] updateStage:', r.error)
}
async function addTagForm(formData: FormData): Promise<void> {
  'use server'
  const r = await addCrmTagAction(formData)
  if (!r.ok) console.error('[console] addTag:', r.error)
}
async function removeTagForm(formData: FormData): Promise<void> {
  'use server'
  const r = await removeCrmTagAction(formData)
  if (!r.ok) console.error('[console] removeTag:', r.error)
}
async function addTaskForm(formData: FormData): Promise<void> {
  'use server'
  const r = await addCrmTaskAction(formData)
  if (!r.ok) console.error('[console] addTask:', r.error)
}
async function completeTaskForm(formData: FormData): Promise<void> {
  'use server'
  const r = await completeCrmTaskAction(formData)
  if (!r.ok) console.error('[console] completeTask:', r.error)
}
async function assignBrokerForm(formData: FormData): Promise<void> {
  'use server'
  const r = await assignCrmBrokerAction(formData)
  if (!r.ok) console.error('[console] assignBroker:', r.error)
}
async function sendEmailForm(personId: number, formData: FormData): Promise<void> {
  'use server'
  formData.set('personId', String(personId))
  const r = await sendCrmEmailAction(formData)
  if (!r.ok) redirect(`${BASE}/${personId}?error=${encodeURIComponent(`Email not sent — ${r.error ?? 'unknown error'}`)}`)
}
async function sendSmsForm(personId: number, formData: FormData): Promise<void> {
  'use server'
  formData.set('personId', String(personId))
  const r = await sendCrmSmsAction(formData)
  if (!r.ok) redirect(`${BASE}/${personId}?error=${encodeURIComponent(`Text not sent — ${r.error ?? 'unknown error'}`)}`)
}
async function startCallForm(personId: number, formData: FormData): Promise<void> {
  'use server'
  formData.set('personId', String(personId))
  const r = await startCrmCallAction(formData)
  redirect(
    r.ok
      ? `${BASE}/${personId}?flash=${encodeURIComponent('Calling now — your phone rings first, then connects to the lead (recorded).')}`
      : `${BASE}/${personId}?error=${encodeURIComponent(`Call not started — ${r.error ?? 'unknown error'}`)}`,
  )
}
// ── Home-driven next step (CRM record-card cutover) ──────────────────────────
async function startCmaForm(personId: number): Promise<void> {
  'use server'
  const r = await startCmaForContactAction(personId)
  redirect(
    r.ok
      ? `${BASE}/${personId}?flash=${encodeURIComponent('CMA queued and building. Review it below, then send.')}`
      : `${BASE}/${personId}?error=${encodeURIComponent(`CMA not started — ${r.error}`)}`,
  )
}
async function sendCmaForm(personId: number, formData: FormData): Promise<void> {
  'use server'
  const deliveryId = String(formData.get('deliveryId') ?? '')
  const r = await sendCmaForContactAction(deliveryId)
  redirect(
    r.ok
      ? `${BASE}/${personId}?flash=${encodeURIComponent('CMA sent.')}`
      : `${BASE}/${personId}?error=${encodeURIComponent(`CMA not sent — ${r.error}`)}`,
  )
}
async function sendNewsletterForm(personId: number): Promise<void> {
  'use server'
  const r = await sendNewsletterToContactAction(personId)
  redirect(
    r.ok
      ? `${BASE}/${personId}?flash=${encodeURIComponent('Newsletter sent.')}`
      : `${BASE}/${personId}?error=${encodeURIComponent(`Newsletter not sent — ${r.error}`)}`,
  )
}
async function setReportSubsForm(personId: number, formData: FormData): Promise<void> {
  'use server'
  const isActive = String(formData.get('active') ?? '') === 'on'
  const frequency = String(formData.get('frequency') ?? 'monthly') as 'weekly' | 'monthly' | 'quarterly'
  const areas = formData.getAll('areas').map((a) => String(a)).filter(Boolean)
  const r = await setReportSubscriptionAction(personId, { areas, frequency, isActive })
  redirect(
    r.ok
      ? `${BASE}/${personId}?flash=${encodeURIComponent(r.message ?? 'Market reports updated.')}`
      : `${BASE}/${personId}?error=${encodeURIComponent(`Market reports not updated — ${r.error}`)}`,
  )
}
async function assignSavedSearchForm(formData: FormData): Promise<void> {
  'use server'
  const personId = Number(formData.get('personId'))
  // Build the filters JSON from the simple inline fields before handing off.
  const filters: Record<string, unknown> = {}
  const city = String(formData.get('city') ?? '').trim()
  const minPrice = Number(formData.get('minPrice'))
  const maxPrice = Number(formData.get('maxPrice'))
  const minBeds = Number(formData.get('minBeds'))
  if (city) filters.city = city
  if (Number.isFinite(minPrice) && minPrice > 0) filters.minPrice = minPrice
  if (Number.isFinite(maxPrice) && maxPrice > 0) filters.maxPrice = maxPrice
  if (Number.isFinite(minBeds) && minBeds > 0) filters.beds = minBeds
  formData.set('filters', JSON.stringify(filters))
  const r = await adminAssignSavedSearchAction(formData)
  if (r.ok && Number.isFinite(personId) && personId > 0) {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { getCrmAccess } = await import('@/app/actions/crm')
    const [sb, access] = [createServiceClient(), await getCrmAccess()]
    const name = String(formData.get('name') ?? 'Saved search').trim() || 'Saved search'
    await sb.from('crm_timeline').insert({
      person_id: personId,
      kind: 'system',
      title: `Saved search "${name}" added by ${access?.email ?? 'broker'}`,
      source: 'app',
      broker: access?.brokerSlug ?? null,
    })
  }
  const msg = r.ok ? 'Saved search assigned' : `Not assigned — ${r.error ?? 'unknown error'}`
  redirect(`${BASE}/${personId}?flash=${encodeURIComponent(msg)}`)
}
async function updateSavedSearchForm(formData: FormData): Promise<void> {
  'use server'
  const personId = Number(formData.get('personId'))
  // Build the filters JSON the same way assignSavedSearchForm does.
  const filters: Record<string, unknown> = {}
  const city = String(formData.get('city') ?? '').trim()
  const minPrice = Number(formData.get('minPrice'))
  const maxPrice = Number(formData.get('maxPrice'))
  const minBeds = Number(formData.get('minBeds'))
  if (city) filters.city = city
  if (Number.isFinite(minPrice) && minPrice > 0) filters.minPrice = minPrice
  if (Number.isFinite(maxPrice) && maxPrice > 0) filters.maxPrice = maxPrice
  if (Number.isFinite(minBeds) && minBeds > 0) filters.beds = minBeds
  formData.set('filters', JSON.stringify(filters))
  const r = await adminUpdateSavedSearchAction(formData)
  if (r.ok && Number.isFinite(personId) && personId > 0) {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { getCrmAccess } = await import('@/app/actions/crm')
    const [sb, access] = [createServiceClient(), await getCrmAccess()]
    const name = String(formData.get('name') ?? 'Saved search').trim() || 'Saved search'
    await sb.from('crm_timeline').insert({
      person_id: personId,
      kind: 'system',
      title: `Saved search "${name}" updated by ${access?.email ?? 'broker'}`,
      source: 'app',
      broker: access?.brokerSlug ?? null,
    })
  }
  const msg = r.ok ? 'Saved search updated' : `Not updated — ${r.error ?? 'unknown error'}`
  redirect(`${BASE}/${personId}?flash=${encodeURIComponent(msg)}`)
}
async function deleteSavedSearchForm(formData: FormData): Promise<void> {
  'use server'
  const personId = Number(formData.get('personId'))
  const id = String(formData.get('id') ?? '')
  const r = await adminDeleteSavedSearchAction(id)
  if (r.ok && Number.isFinite(personId) && personId > 0) {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const { getCrmAccess } = await import('@/app/actions/crm')
    const [sb, access] = [createServiceClient(), await getCrmAccess()]
    await sb.from('crm_timeline').insert({
      person_id: personId,
      kind: 'system',
      title: `Saved search removed by ${access?.email ?? 'broker'}`,
      source: 'app',
      broker: access?.brokerSlug ?? null,
    })
  }
  redirect(`${BASE}/${personId}?flash=${encodeURIComponent('Saved search removed')}`)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })
}
function fmtAgo(iso: string | null): string {
  if (!iso) return '—'
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return `${Math.round(mins / 1440)}d ago`
}
function fmtPhone(d: string): string {
  return d.length === 10 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}` : d
}
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

const KIND_ICON: Record<string, string> = {
  note: '📝', email_in: '📥', email_out: '📤', sms_in: '💬', sms_out: '📲',
  call: '📞', voicemail: '🎙', web_event: '🌐', task: '☑', stage_change: '🪜', system: '⚙',
}


export default async function ConsoleLeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tpl?: string; smsTpl?: string; error?: string; flash?: string }>
}) {
  const { id: idRaw } = await params
  const id = Number(idRaw)
  if (!Number.isFinite(id) || id <= 0) notFound()
  const { tpl, smsTpl, error: sendError, flash } = await searchParams

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

  const personLike = person as unknown as { first_name?: string | null; name?: string | null; custom?: Record<string, unknown>; assigned_broker?: string | null }
  const actingSlug = crmAccess?.brokerSlug ?? personLike.assigned_broker ?? 'matt'
  const mailbox = CRM_MAILBOXES.find((m) => m.slug === actingSlug) ?? CRM_MAILBOXES[0]
  const signature = await getSignatureForMailbox(mailbox.email)

  const activeTpl = tpl ? templates.find((t) => t.key === tpl) ?? null : null
  const activeSmsTpl = smsTpl ? smsTemplates.find((t) => t.key === smsTpl) ?? null : null
  const emailInitialSubject = activeTpl?.subject ? renderCrmMerge(activeTpl.subject, personLike) : ''
  const emailInitialBody = activeTpl?.body ? renderCrmMerge(activeTpl.body, personLike) : ''
  const smsInitialBody = activeSmsTpl?.body ? renderCrmMerge(activeSmsTpl.body, personLike) : ''

  const primaryEmail = full.contactPoints.find((c) => c.kind === 'email')?.value ?? null
  const primaryPhone = full.contactPoints.find((c) => c.kind === 'phone')?.value ?? null
  const personEmails = (person.emails ?? []).map((e) => e.value).filter((v): v is string => Boolean(v))

  // What they're shopping for — saved searches + the homes they're watching (live MLS) + newsletter status.
  const [savedSearches, viewedListings, contactMemberships, activityFeed, behaviorSummary, relationships, contactAlerts, nextStep, reportSub, reportAreas, fieldDefs, emailEngagementSummary, collaborators, actionPlanEnrollments] = await Promise.all([
    getGuestSearchAlertsForLead({ fubPersonId: person.fub_legacy_id, emails: personEmails }),
    getViewedListingsForLead(person.fub_legacy_id),
    getContactMemberships(person.id),
    getContactActivityFeed(person.id),
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
  // §07 parity: enrollment action wrappers (FormData, enrollmentId from hidden input)
  async function pauseEnrollmentForm(formData: FormData): Promise<void> {
    'use server'
    const enrollmentId = Number(formData.get('enrollmentId'))
    await pauseEnrollmentAction(enrollmentId)
  }
  async function resumeEnrollmentForm(formData: FormData): Promise<void> {
    'use server'
    const enrollmentId = Number(formData.get('enrollmentId'))
    await resumeEnrollmentAction(enrollmentId)
  }
  async function stopEnrollmentForm(formData: FormData): Promise<void> {
    'use server'
    const enrollmentId = Number(formData.get('enrollmentId'))
    await dismissEnrollmentAction(enrollmentId)
  }

  const webEvents = full.timeline.filter((t) => t.kind === 'web_event').slice(0, 6)
  const activityLog = full.timeline.filter((t) => !isConversationEvent(t.kind) && t.kind !== 'email_open' && t.kind !== 'email_click')
  // Inquiry date for the Info tab "Inquiries" section — when the lead was created.
  const inquiryDate = (() => {
    const created = full.timeline.find((t) => t.kind === 'lead_created')?.ts ?? null
    return created ? new Date(created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : null
  })()
  // Display name: many imported leads have a placeholder name like
  // "Lead someone@example.com". Strip the "Lead " prefix so the header shows the
  // address cleanly instead of the ugly placeholder, and drop the duplicate email
  // line when the name already IS the email.
  const rawName = person.name ?? `Contact #${person.id}`
  const nameIsPlaceholderEmail = /^lead\s+\S+@\S+$/i.test(rawName)
  const displayName = nameIsPlaceholderEmail ? rawName.replace(/^lead\s+/i, '') : rawName
  const headerEmail = primaryEmail && primaryEmail !== displayName ? primaryEmail : null
  const openTasks = full.tasks.filter((t) => !t.completed_at)
  const doneTasks = full.tasks.filter((t) => t.completed_at)
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
  const liveAgeMin = latestWeb ? Math.round((Date.now() - new Date(latestWeb.ts).getTime()) / 60000) : null
  const isLiveNow = liveAgeMin !== null && liveAgeMin >= 0 && liveAgeMin <= 30

  const hasAlerts = Boolean(flash || sendError || full.suppressions.length > 0)

  return (
    <>
      {hasAlerts ? (
        <div className="mx-auto mb-4 w-full max-w-6xl space-y-3">
          {flash ? <Alert><AlertDescription>{flash}</AlertDescription></Alert> : null}
          {sendError ? <Alert variant="destructive"><AlertTitle>Couldn&apos;t send</AlertTitle><AlertDescription>{sendError}</AlertDescription></Alert> : null}
          {full.suppressions.length > 0 ? (
            <Alert variant="destructive">
              <AlertTitle>Contact restrictions active</AlertTitle>
              <AlertDescription>{full.suppressions.map((s) => `${s.channel}: ${s.reason}`).join(' · ')}. Automated outreach is blocked.</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}

      <LeadTabs
        name={displayName}
        pictureUrl={person.picture_url}
        stage={person.stage}
        live={isLiveNow}
        ownerName={person.assigned_broker ? (CRM_BROKER_DISPLAY[person.assigned_broker as keyof typeof CRM_BROKER_DISPLAY] ?? person.assigned_broker) : null}
        lastCommLabel={person.last_activity_at ? new Date(person.last_activity_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : null}
        email={headerEmail}
        phone={primaryPhone ? fmtPhone(primaryPhone) : null}
        defaultTab="comms"
        quickActions={
          <ContactQuickActions
            personId={person.id}
            newsletterSubscribed={contactMemberships.newsletter.subscribed}
            automations={contactMemberships.sequences}
            savedSearches={contactAlerts.map((a) => ({ id: a.id, label: a.label, url: a.url, active: a.active }))}
            reportSub={reportSub ? { isActive: reportSub.isActive, areas: reportSub.areas, frequency: reportSub.frequency } : null}
            reportAreas={reportAreas}
            reportSetAction={setReportSubsForm.bind(null, person.id)}
          />
        }
        homeCard={
          nextStep.ownsHome && homeAddress ? (
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
              generateAction={startCmaForm.bind(null, person.id)}
              sendAction={sendCmaForm.bind(null, person.id)}
            />
          ) : null
        }
        backHref={BASE}
        fubHref={null}
        flushTop={!hasAlerts}
        overview={
          <>
      {/* FUB-parity Info tab: clean iOS grouped sections (Phone · Emails ·
          Relationships · Details · Inquiries · Custom fields). Newsletter /
          automations / CMA / KPIs live in the header chips + home card, not here. */}
      <ContactInfoTab
        personId={person.id}
        phones={full.contactPoints.filter((c) => c.kind === 'phone').map((c) => ({ id: c.id, display: fmtPhone(c.value), tel: `tel:+1${c.value}`, isPrimary: !!c.is_primary }))}
        emails={full.contactPoints.filter((c) => c.kind === 'email').map((c) => ({ id: c.id, value: c.value, isPrimary: !!c.is_primary }))}
        assignedBroker={person.assigned_broker}
        stage={person.stage}
        source={person.source}
        tags={Array.isArray(person.tags) ? person.tags : []}
        brokerOptions={CRM_BROKERS.map((b) => ({ value: b, label: CRM_BROKER_DISPLAY[b] }))}
        stageOptions={[...CRM_STAGES]}
        assignBrokerAction={assignBrokerForm}
        updateStageAction={updateStageForm}
        startCallAction={startCallForm.bind(null, person.id)}
        inquiry={person.source ? { source: person.source, date: inquiryDate } : null}
        relationshipsNode={<RelationshipsPanel personId={person.id} relationships={relationships} />}
        customFieldsNode={Object.keys((person.custom as Record<string, unknown> | null) ?? {}).length > 0 ? <CustomFieldsPanel personId={person.id} custom={person.custom} defs={fieldDefs} /> : null}
      />
          </>
        }
        comms={
          <>
          {/* Comms feed — every message (calls, texts, emails) as a FUB-style
              chronological row list, newest first: channel icon · subject/
              descriptor · participant · 2-line preview · date · email open-count.
              Rows expand on tap for the full body, MMS, and call recordings.
              Identical-to-FUB clone (Matt 2026-06-29); composer sits below. */}
          {(() => {
            if (conversation.items.length === 0) return null
            return (
              <Card id="conversation" className="scroll-mt-20">
                <CardContent className="px-4">
                  <ConversationFeed
                    events={conversation.items}
                    initialCursor={conversation.nextCursor}
                    personId={person.id}
                    engagement={emailEngagement}
                    personName={person.first_name ?? person.name ?? 'this contact'}
                  />
                </CardContent>
              </Card>
            )
          })()}
          {/* Comms with preview */}
          <Card id="comms" className="scroll-mt-20">
            <CardHeader className="pb-3"><CardTitle className="text-base">Send a message</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {/* Email */}
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email {primaryEmail ? `· ${primaryEmail}` : ''}</div>
                {primaryEmail ? (
                  <>
                    <TemplatePickerNav
                      templates={templates}
                      channel="email"
                      currentKey={tpl ?? null}
                      className="w-full"
                    />
                    {(emailInitialSubject || emailInitialBody) ? (
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preview · exactly what sends</div>
                        {emailInitialSubject ? <div className="mt-1.5 text-sm font-semibold text-foreground">{emailInitialSubject}</div> : null}
                        <div className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground [overflow-wrap:anywhere]">{timelineEmailBody(emailInitialBody)}</div>
                        {signature?.html ? <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: signature.html }} /> : null}
                      </div>
                    ) : null}
                    <EmailComposer key={tpl ?? 'blank'} initialSubject={emailInitialSubject} initialBody={emailInitialBody} signatureHtml={signature?.html ?? null} sendAction={sendEmailForm.bind(null, person.id)} tplKey={tpl ?? null} toLabel={person.name ? `${person.name} · ${primaryEmail}` : primaryEmail} />
                  </>
                ) : <p className="text-sm text-muted-foreground">No email address on file.</p>}
              </div>

              <Separator />

              {/* SMS */}
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Text {primaryPhone ? `· ${fmtPhone(primaryPhone)}` : ''}</div>
                {!twilioStatus.canSend ? (
                  <Alert><AlertTitle className="text-sm">Texting not live yet</AlertTitle><AlertDescription className="text-sm">A2P status is {twilioStatus.a2p ?? 'unknown'}. Compose now, sends start working once verified.</AlertDescription></Alert>
                ) : null}
                {primaryPhone ? (
                  <>
                    <TemplatePickerNav
                      templates={smsTemplates}
                      channel="sms"
                      currentKey={smsTpl ?? null}
                      className="w-full"
                    />
                    {smsInitialBody ? (
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preview · exactly what sends</div>
                        <div className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{smsInitialBody}</div>
                      </div>
                    ) : null}
                    <SmsComposer key={smsTpl ?? 'blank'} initialBody={smsInitialBody} sendAction={sendSmsForm.bind(null, person.id)} recipients={smsRecipients} primaryPersonId={person.id} />
                  </>
                ) : <p className="text-sm text-muted-foreground">No phone number on file.</p>}
              </div>

              <Separator />

              {/* Note */}
              <form action={addNoteForm.bind(null, person.id)} className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add a note</div>
                <Textarea name="body" placeholder="Logs to the timeline" rows={2} />
                <div className="flex justify-end"><Button type="submit" size="sm" className="min-h-[40px] sm:min-h-0">Save note</Button></div>
              </form>
            </CardContent>
          </Card>

          {/* Email engagement — opens, clicks, deliverability — from the unified
              email_events store (Resend webhook + Gmail tracker rails). */}
          <ContactEmailEngagement engagement={emailEngagementSummary} />
          </>
        }
        tasks={
          <>
          {/* Tasks */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Tasks <span className="font-normal text-muted-foreground">({openTasks.length} open)</span></CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {openTasks.length === 0 ? <p className="text-sm text-muted-foreground">Nothing due. {doneTasks.length > 0 ? `${doneTasks.length} completed.` : ''}</p> : openTasks.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0"><div className="text-sm font-medium text-foreground">{t.name}</div><div className="text-xs text-muted-foreground">{t.type ?? 'Task'} · due {fmtDateTime(t.due_at)}</div></div>
                  <form action={completeTaskForm} className="shrink-0"><input type="hidden" name="taskId" value={t.id} /><input type="hidden" name="personId" value={person.id} /><Button type="submit" size="sm" variant="outline" className="min-h-[40px] sm:min-h-0">Done</Button></form>
                </div>
              ))}
              <form action={addTaskForm} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input type="hidden" name="personId" value={person.id} />
                <Input name="name" placeholder="New task" className="h-9 flex-1 text-sm" />
                <div className="flex gap-2">
                  <Select name="type" defaultValue="Follow Up"><SelectTrigger className="h-9 flex-1 sm:w-32"><SelectValue /></SelectTrigger><SelectContent>{['Follow Up', 'Call', 'Text', 'Email'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
                  <Select name="dueHours" defaultValue="24"><SelectTrigger className="h-9 flex-1 sm:w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">in 1 hour</SelectItem><SelectItem value="4">in 4 hours</SelectItem><SelectItem value="24">tomorrow</SelectItem><SelectItem value="72">in 3 days</SelectItem><SelectItem value="168">in a week</SelectItem></SelectContent></Select>
                </div>
                <Button type="submit" size="sm" variant="outline" className="min-h-[40px] w-full sm:min-h-0 sm:w-auto">Add</Button>
              </form>
            </CardContent>
          </Card>
          </>
        }
        watching={
          <>
          <ContactBehaviorPanel summary={behaviorSummary} />
          {/* Homes — the live homes this lead is shopping, as FUB-style property
              cards (photo · activity badge · price · beds/baths · address · MLS#
              · view count). Clones the FUB Homes tab (Matt 2026-06-29, ui1_5835);
              price + status are live from listing_tile_mv. */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Activity <span className="font-normal text-muted-foreground">({viewedListings.length})</span></CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {viewedListings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No homes viewed yet. Listings this lead opens on the site show up here with live status.</p>
              ) : viewedListings.slice(0, 6).map((l) => (
                <ViewedHomeCard key={l.listingKey} home={l} />
              ))}
            </CardContent>
          </Card>

          {/* Market reports — distinct subscription: which areas + cadence
              (CRM record-card cutover). */}
          <ReportSubscriptionsPanel
            current={reportSub ? { isActive: reportSub.isActive, areas: reportSub.areas, frequency: reportSub.frequency } : null}
            areaOptions={reportAreas}
            setAction={setReportSubsForm.bind(null, person.id)}
          />

          {/* Saved searches */}
          <ContactListingAlertsPanel alerts={contactAlerts} />
          <Card id="saved-searches" className="scroll-mt-20">
            <CardHeader className="pb-3"><CardTitle className="text-base">Saved searches <span className="font-normal text-muted-foreground">({savedSearches.length})</span></CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {savedSearches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved searches yet. When this lead saves a search on the site, it shows here. You can also assign one below.</p>
              ) : savedSearches.slice(0, 6).map((s) => {
                const origin = s.origin ?? 'user'
                const originTone = origin === 'broker' ? 'info' : origin === 'system' ? 'warning' : 'neutral'
                const f = (s.filters ?? {}) as Record<string, unknown>
                const sv = (v: unknown) => (v === null || v === undefined ? '' : String(v))
                return (
                  <div key={s.id} className="rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium" style={{ color: 'var(--console-info-strong)' }}>{describeSearch(s.filters)}</span>
                          <StatusPill tone={originTone} label={origin} />
                        </div>
                        {s.name?.trim() ? <div className="truncate text-xs text-muted-foreground">{s.name.trim()}</div> : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-muted-foreground">{s.is_active ? (s.notification_frequency ?? 'active') : 'paused'}</span>
                        <form action={deleteSavedSearchForm}>
                          <input type="hidden" name="personId" value={person.id} />
                          <input type="hidden" name="id" value={s.id} />
                          <button type="submit" className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-destructive">Remove</button>
                        </form>
                      </div>
                    </div>
                    <details className="group mt-1.5">
                      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Edit</summary>
                      <form action={updateSavedSearchForm} className="mt-2 space-y-2 border-t border-border pt-2">
                        <input type="hidden" name="personId" value={person.id} />
                        <input type="hidden" name="id" value={s.id} />
                        <Input name="name" defaultValue={sv(s.name)} placeholder="Search name (e.g. Westside under 700k)" className="h-9 text-sm" />
                        <Input name="city" defaultValue={sv(f.city)} placeholder="City (e.g. Bend)" className="h-9 text-sm" />
                        <div className="grid grid-cols-2 gap-2">
                          <Input name="minPrice" type="number" inputMode="numeric" defaultValue={sv(f.minPrice)} placeholder="Min price" className="h-9 text-sm" />
                          <Input name="maxPrice" type="number" inputMode="numeric" defaultValue={sv(f.maxPrice)} placeholder="Max price" className="h-9 text-sm" />
                        </div>
                        <Input name="minBeds" type="number" inputMode="numeric" defaultValue={sv(f.beds)} placeholder="Min beds" className="h-9 text-sm" />
                        <div className="flex justify-end">
                          <Button type="submit" size="sm" variant="outline" className="min-h-[40px] sm:min-h-0">Save changes</Button>
                        </div>
                      </form>
                    </details>
                  </div>
                )
              })}

              {/* Quick-assign a broker-created saved search */}
              {primaryEmail ? (
                <details className="group rounded-lg border border-dashed border-border">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground">+ Add saved search</summary>
                  <form action={assignSavedSearchForm} className="space-y-2 border-t border-border p-3">
                    <input type="hidden" name="personId" value={person.id} />
                    <input type="hidden" name="email" value={primaryEmail} />
                    <input type="hidden" name="fubPersonId" value={person.fub_legacy_id ?? ''} />
                    <Input name="name" placeholder="Search name (e.g. Westside under 700k)" className="h-9 text-sm" />
                    <Input name="city" placeholder="City (e.g. Bend)" className="h-9 text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input name="minPrice" type="number" inputMode="numeric" placeholder="Min price" className="h-9 text-sm" />
                      <Input name="maxPrice" type="number" inputMode="numeric" placeholder="Max price" className="h-9 text-sm" />
                    </div>
                    <Input name="minBeds" type="number" inputMode="numeric" placeholder="Min beds" className="h-9 text-sm" />
                    <div className="flex justify-end">
                      <Button type="submit" size="sm" variant="outline" className="min-h-[40px] sm:min-h-0">Assign saved search</Button>
                    </div>
                  </form>
                </details>
              ) : (
                <p className="text-xs text-muted-foreground">Add an email on file to assign a saved search.</p>
              )}
            </CardContent>
          </Card>


          {/* "Home they own" card removed — the owned-home card (thumbnail +
              address + Generate comp) now sits in the always-visible landing
              header via LeadTabs homeCard. */}
          </>
        }
        workflow={
          <>
          {/* §07 parity gap 3: Action-plan progress (FUB §7c.8.1 / §7c.8.7) */}
          <ActionPlanProgressPanel
            enrollments={actionPlanEnrollments}
            pauseAction={pauseEnrollmentForm}
            resumeAction={resumeEnrollmentForm}
            stopAction={stopEnrollmentForm}
          />

          {/* §07 parity gap 1: Collaborators (FUB §7c.8.9 / §7c.7) */}
          <CollaboratorsPanel
            collaborators={collaborators}
            assignedBroker={person.assigned_broker}
            addAction={addCollaboratorForm}
            removeAction={removeCollaboratorForm}
          />

          {/* Tags */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Tags <span className="font-normal text-muted-foreground">({person.tags.length})</span></CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {person.tags.length === 0 ? <span className="text-sm text-muted-foreground">No tags.</span> : person.tags.slice(0, 24).map((t) => (
                  <form key={t} action={removeTagForm} className="inline-flex">
                    <input type="hidden" name="personId" value={person.id} /><input type="hidden" name="tag" value={t} />
                    <Badge variant="outline" className="gap-1 pr-1 text-xs">{t}<button type="submit" aria-label={`Remove ${t}`} className="rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground">×</button></Badge>
                  </form>
                ))}
              </div>
              <form action={addTagForm} className="flex gap-2">
                <input type="hidden" name="personId" value={person.id} />
                <Input name="tag" placeholder="add-tag" className="h-9 flex-1 text-sm" />
                <Button type="submit" size="sm" variant="outline" className="min-h-[40px] sm:min-h-0">Add</Button>
              </form>
            </CardContent>
          </Card>

          {/* Details — background + FUB custom fields (collapsed) */}
          {(person.background || customEntries.length > 0) ? (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {person.background ? <p className="whitespace-pre-wrap break-words text-foreground">{person.background}</p> : null}
                {customEntries.length > 0 ? (
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground">Fields ({customEntries.length})</summary>
                    <dl className="mt-2 space-y-1.5">
                      {customEntries.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3">
                          <dt className="shrink-0 text-muted-foreground">{k.replace(/^custom/, '')}</dt>
                          <dd className="truncate text-right text-foreground">{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* §07 parity gap 2: Merge / dedup (FUB spec §7a §4.2) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Duplicate management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">
                Found a duplicate? Merge the other contact into this one. Its timeline,
                tasks, and enrollments move here. The duplicate is archived to Trash.
                This action cannot be undone.
              </p>
              <MergeContactDialog survivorId={person.id} />
            </CardContent>
          </Card>
          </>
        }
        activity={
          <ConsoleSection title="Activity">
        {(() => {
          // Conversation (calls/texts/emails/notes) now lives in the Comms tab.
          // Activity is the site + system log only.
          const hasOther = activityLog.length > 0
          if (!hasOther) return <p className="text-sm text-muted-foreground">No site or system activity yet. Calls, texts, and emails are in the Comms tab.</p>
          return (
            <>
              {hasOther ? (
                <div>
                  <div className="space-y-3.5">
                    {activityLog.slice(0, 10).map((e) => (
                      <div key={e.id} className="flex gap-3">
                        <div className="w-5 shrink-0 text-center text-sm leading-5">{KIND_ICON[e.kind] ?? '•'}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-sm font-medium text-foreground">{e.title ?? e.kind.replace('_', ' ')}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">{fmtAgo(e.ts)}</span>
                          </div>
                          {e.body ? <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted-foreground">{timelineEmailBody(e.body).slice(0, 400)}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )
        })()}
          </ConsoleSection>
        }
      />
    </>
  )
}
