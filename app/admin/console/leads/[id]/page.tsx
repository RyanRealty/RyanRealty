// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { Zap } from 'lucide-react'
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
  getNextRecommendation,
  confirmNextStepAction,
  skipNextStepAction,
  getCrmSmsTemplates,
  getTwilioSmsStatus,
  removeCrmTagAction,
  sendCrmEmailAction,
  sendCrmSmsAction,
  updateCrmStageAction,
} from '@/app/actions/crm'
import { manualEnrollPerson, listActiveSequences } from '@/lib/crm/enroll'
import { getNewsletterMembershipForLead } from '@/lib/data'
import { adminAssignCrmPersonAction, adminAssignSavedSearchAction, adminUpdateSavedSearchAction, adminDeleteSavedSearchAction } from '@/app/actions/newsletter'
import { timelineEmailBody } from '@/lib/crm/email-body'
import { renderCrmMerge } from '@/lib/crm/merge'
import { getSignatureForMailbox } from '@/lib/crm/email-signature'
import { CRM_MAILBOXES } from '@/lib/crm/gmail'
import { getOwnedHomeMatches, getGuestSearchAlertsForLead, getViewedListingsForLead, type OwnedHomeMatch } from '@/lib/data'
import { getOwnedHomeMedia } from '@/lib/crm/owned-home-media'
import { getContactMemberships } from '@/lib/data/crm/getContactMemberships'
import { MembershipToggles } from '@/components/admin/crm/MembershipToggles'
import { EmailComposer } from '@/components/admin/crm/EmailComposer'
import { SmsComposer } from '@/components/admin/crm/SmsComposer'
import ConversationThread, { isConversationEvent } from '@/components/admin/crm/ConversationThread'
import { ListingStatusPill, StatusPill } from '@/components/console/StatusPill'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import { KpiStrip } from '@/components/console/KpiStrip'
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
async function addNoteForm(formData: FormData): Promise<void> {
  'use server'
  const r = await addCrmNoteAction(formData)
  if (!r.ok) console.error('[console] addNote:', r.error)
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
async function confirmNextForm(formData: FormData): Promise<void> {
  'use server'
  const r = await confirmNextStepAction(Number(formData.get('enrollmentId')))
  if (!r.ok) console.error('[console] confirmNext:', r.error)
}
async function skipNextForm(formData: FormData): Promise<void> {
  'use server'
  const r = await skipNextStepAction(Number(formData.get('enrollmentId')))
  if (!r.ok) console.error('[console] skipNext:', r.error)
}
async function manualEnrollForm(formData: FormData): Promise<void> {
  'use server'
  const personId = Number(formData.get('personId'))
  const sequenceId = Number(formData.get('sequenceId'))
  if (!sequenceId) redirect(`${BASE}/${personId}?flash=${encodeURIComponent('Pick a workflow first')}`)
  const r = await manualEnrollPerson(personId, sequenceId)
  const msg = r.enrolled ? `Enrolled in ${r.sequence}` : `Not enrolled — ${r.reason}`
  redirect(`${BASE}/${personId}?flash=${encodeURIComponent(msg)}`)
}
async function assignNewsletterForm(formData: FormData): Promise<void> {
  'use server'
  const personId = Number(formData.get('personId'))
  const r = await adminAssignCrmPersonAction(personId)
  const msg = r.ok ? 'Added to the newsletter' : `Not added — ${r.error ?? 'unknown error'}`
  redirect(`${BASE}/${personId}?flash=${encodeURIComponent(msg)}`)
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
  const msg = r.ok ? 'Saved search updated' : `Not updated — ${r.error ?? 'unknown error'}`
  redirect(`${BASE}/${personId}?flash=${encodeURIComponent(msg)}`)
}
async function deleteSavedSearchForm(formData: FormData): Promise<void> {
  'use server'
  const personId = Number(formData.get('personId'))
  const id = String(formData.get('id') ?? '')
  await adminDeleteSavedSearchAction(id)
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

  const [crmAccess, full, templates, smsTemplates, twilioStatus, rec] = await Promise.all([
    getCrmAccess(),
    getCrmPersonFull(id),
    getCrmEmailTemplates(),
    getCrmSmsTemplates(),
    getTwilioSmsStatus(),
    getNextRecommendation(id),
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
  const [savedSearches, viewedListings, membership, activeSequences, contactMemberships] = await Promise.all([
    getGuestSearchAlertsForLead({ fubPersonId: person.fub_legacy_id, emails: personEmails }),
    getViewedListingsForLead(person.fub_legacy_id),
    getNewsletterMembershipForLead({ crmPersonId: person.id, emails: personEmails }),
    listActiveSequences(),
    getContactMemberships(person.id),
  ])

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

  const webEvents = full.timeline.filter((t) => t.kind === 'web_event').slice(0, 6)
  const activityLog = full.timeline.filter((t) => !isConversationEvent(t.kind) && t.kind !== 'email_open' && t.kind !== 'email_click')
  const openTasks = full.tasks.filter((t) => !t.completed_at)
  const doneTasks = full.tasks.filter((t) => t.completed_at)
  const activeEnrollments = full.enrollments.filter((e) => e.status === 'running' || e.status === 'paused')
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
        name={person.name ?? `Contact #${person.id}`}
        pictureUrl={person.picture_url}
        stage={person.stage}
        live={isLiveNow}
        ownerName={person.assigned_broker ? (CRM_BROKER_DISPLAY[person.assigned_broker as keyof typeof CRM_BROKER_DISPLAY] ?? person.assigned_broker) : null}
        backHref={BASE}
        fubHref={person.fub_legacy_id ? `https://ryan-realty.followupboss.com/2/people/view/${person.fub_legacy_id}` : null}
        flushTop={!hasAlerts}
        overview={
          <>
      {/* ── Quick actions + stage/owner + contacts ── */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex gap-2">
            {primaryPhone ? <Button asChild className="min-h-11 flex-1"><a href={`tel:+1${primaryPhone.replace(/\D/g, '').slice(-10)}`}>Call</a></Button> : null}
            {primaryPhone ? <Button asChild variant="outline" className="min-h-11 flex-1"><a href="#comms">Text</a></Button> : null}
            {primaryEmail ? <Button asChild variant="outline" className="min-h-11 flex-1"><a href="#comms">Email</a></Button> : null}
          </div>

          {/* Inline stage + broker + contact points */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <form action={updateStageForm} className="flex items-center gap-2">
              <input type="hidden" name="personId" value={person.id} />
              <Select name="stage" defaultValue={person.stage}>
                <SelectTrigger className="h-10 flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CRM_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="submit" size="sm" variant="outline" className="min-h-[40px] shrink-0">Set stage</Button>
            </form>
            <form action={assignBrokerForm} className="flex items-center gap-2">
              <input type="hidden" name="personId" value={person.id} />
              <Select name="broker" defaultValue={person.assigned_broker ?? undefined}>
                <SelectTrigger className="h-10 flex-1"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>{CRM_BROKERS.map((b) => <SelectItem key={b} value={b}>{CRM_BROKER_DISPLAY[b]}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="submit" size="sm" variant="outline" className="min-h-[40px] shrink-0">Assign</Button>
            </form>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            {full.contactPoints.length === 0 ? <span className="text-muted-foreground">No contact info on file.</span> : full.contactPoints.slice(0, 4).map((cp) => (
              <a key={cp.id} href={cp.kind === 'email' ? `mailto:${cp.value}` : `tel:+1${cp.value}`} className="text-foreground hover:underline">
                {cp.kind === 'phone' ? fmtPhone(cp.value) : cp.value}
                <span className="ml-1 text-xs text-muted-foreground">{cp.is_primary ? 'primary' : cp.kind}</span>
              </a>
            ))}
          </div>

          {/* Plugged in — newsletter / workflow / saved searches, folded into the identity panel */}
          <div className="mt-4 border-t border-border pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Plugged in</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {membership.subscribed ? (
                <StatusPill tone="success" label={`Newsletter${membership.segment ? ` · ${membership.segment}` : ''}`} />
              ) : (
                <form action={assignNewsletterForm} className="inline-flex">
                  <input type="hidden" name="personId" value={person.id} />
                  <button type="submit" disabled={!primaryEmail} title={primaryEmail ? undefined : 'No email on file'} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-dashed border-border px-3 text-xs font-medium text-muted-foreground hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">
                    + Newsletter
                  </button>
                </form>
              )}
              {activeEnrollments.length > 0 ? (
                <StatusPill tone="info" label={`In ${activeEnrollments[0].crm_sequences?.name ?? 'a workflow'}`} />
              ) : (
                <span className="inline-flex min-h-8 items-center rounded-full bg-secondary px-3 text-xs font-medium text-muted-foreground">No workflow</span>
              )}
              <a href="#saved-searches" className="inline-flex min-h-8 items-center rounded-full border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:border-foreground">
                {savedSearches.length > 0 ? `${savedSearches.length} saved search${savedSearches.length === 1 ? '' : 'es'}` : 'No saved searches'}
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Memberships: one-click toggles (workflow / newsletter / listing alerts) ── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Memberships</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          <MembershipToggles personId={person.id} memberships={contactMemberships} />
        </CardContent>
      </Card>

      {/* ── Next best action (the mockup hero) — always present ── */}
      <Card style={{ backgroundColor: 'var(--console-info-soft)', borderColor: 'var(--console-info)' }}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" style={{ color: 'var(--console-info-strong)' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--console-info-strong)' }}>Next best action</span>
          </div>

          {rec ? (
            <>
              <div className="mt-2 text-[15px] font-semibold text-foreground">
                {rec.channel === 'sms' ? 'Send a text' : rec.channel === 'email' ? 'Send an email' : rec.channel === 'task' ? 'Do this' : 'Next step'} · {rec.sequenceName}
              </div>
              {rec.subjectPreview ? <div className="mt-2 break-words text-sm font-medium text-foreground">{rec.subjectPreview}</div> : null}
              <div className="mt-1.5 whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground [overflow-wrap:anywhere]">{rec.bodyPreview}</div>
              {rec.unresolved.length ? <div className="mt-2 text-xs font-medium text-destructive">Unresolved fields: {rec.unresolved.join(', ')}</div> : null}
              {rec.holdReason ? <div className="mt-2 text-xs text-muted-foreground">{rec.holdReason}</div> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={confirmNextForm}><input type="hidden" name="enrollmentId" value={rec.enrollmentId} /><Button type="submit" size="sm" disabled={!!rec.holdReason || rec.unresolved.length > 0} className="min-h-10">Confirm &amp; send</Button></form>
                <form action={skipNextForm}><input type="hidden" name="enrollmentId" value={rec.enrollmentId} /><Button type="submit" size="sm" variant="outline" className="min-h-10">Skip</Button></form>
              </div>
            </>
          ) : activeEnrollments.length > 0 ? (
            <>
              <div className="mt-2 text-[15px] font-semibold text-foreground">In {activeEnrollments[0].crm_sequences?.name ?? 'a workflow'} — next touch is scheduled</div>
              <div className="mt-1 text-sm text-muted-foreground">The engine sends the next step automatically. Nothing to confirm right now.</div>
            </>
          ) : (
            <>
              <div className="mt-2 text-[15px] font-semibold text-foreground">Put {person.first_name ?? 'this lead'} into a workflow</div>
              <div className="mt-1 text-sm text-muted-foreground">Pick a workflow and the first touch sends automatically.</div>
              {activeSequences.length > 0 ? (
                <form action={manualEnrollForm} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input type="hidden" name="personId" value={person.id} />
                  <Select name="sequenceId">
                    <SelectTrigger className="h-10 flex-1 bg-card"><SelectValue placeholder="Choose a workflow…" /></SelectTrigger>
                    <SelectContent>{activeSequences.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="submit" size="sm" className="min-h-10 shrink-0">Enroll</Button>
                </form>
              ) : <div className="mt-2 text-xs text-muted-foreground">No active workflows configured.</div>}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── KPI strip — shared console kit (per the picked mockup) ── */}
      <KpiStrip items={[
        { label: 'Homes viewed', value: viewedListings.length },
        { label: 'Saved searches', value: savedSearches.length },
        { label: 'Web sessions', value: full.visitorSessions },
        { label: 'Open tasks', value: openTasks.length },
      ]} />
          </>
        }
        comms={
          <>
          {/* Comms with preview */}
          <Card id="comms" className="scroll-mt-20">
            <CardHeader className="pb-3"><CardTitle className="text-base">Send a message</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {/* Email */}
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email {primaryEmail ? `· ${primaryEmail}` : ''}</div>
                {primaryEmail ? (
                  <>
                    <form method="GET" className="flex items-center gap-2">
                      <Select name="tpl" defaultValue={tpl ?? 'blank'}><SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="blank">Blank email</SelectItem>{templates.map((t) => <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>)}</SelectContent></Select>
                      <Button type="submit" size="sm" variant="outline" className="min-h-[40px] shrink-0 sm:min-h-0">Load</Button>
                    </form>
                    {(emailInitialSubject || emailInitialBody) ? (
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preview · exactly what sends</div>
                        {emailInitialSubject ? <div className="mt-1.5 text-sm font-semibold text-foreground">{emailInitialSubject}</div> : null}
                        <div className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground [overflow-wrap:anywhere]">{timelineEmailBody(emailInitialBody)}</div>
                        {signature?.html ? <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: signature.html }} /> : null}
                      </div>
                    ) : null}
                    <EmailComposer key={tpl ?? 'blank'} initialSubject={emailInitialSubject} initialBody={emailInitialBody} signatureHtml={signature?.html ?? null} sendAction={sendEmailForm.bind(null, person.id)} />
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
                    <form method="GET" className="flex items-center gap-2">
                      <input type="hidden" name="tpl" value={tpl ?? ''} />
                      <Select name="smsTpl" defaultValue={smsTpl ?? 'blank'}><SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="blank">Blank text</SelectItem>{smsTemplates.map((t) => <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>)}</SelectContent></Select>
                      <Button type="submit" size="sm" variant="outline" className="min-h-[40px] shrink-0 sm:min-h-0">Load</Button>
                    </form>
                    {smsInitialBody ? (
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preview · exactly what sends</div>
                        <div className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{smsInitialBody}</div>
                      </div>
                    ) : null}
                    <SmsComposer key={smsTpl ?? 'blank'} initialBody={smsInitialBody} sendAction={sendSmsForm.bind(null, person.id)} />
                  </>
                ) : <p className="text-sm text-muted-foreground">No phone number on file.</p>}
              </div>

              <Separator />

              {/* Note */}
              <form action={addNoteForm} className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add a note</div>
                <input type="hidden" name="personId" value={person.id} />
                <Textarea name="body" placeholder="Logs to the timeline" rows={2} />
                <div className="flex justify-end"><Button type="submit" size="sm" className="min-h-[40px] sm:min-h-0">Save note</Button></div>
              </form>
            </CardContent>
          </Card>
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
                  <Select name="type" defaultValue="Follow Up"><SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger><SelectContent>{['Follow Up', 'Call', 'Text', 'Email'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
                  <Select name="dueHours" defaultValue="24"><SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">in 1 hour</SelectItem><SelectItem value="4">in 4 hours</SelectItem><SelectItem value="24">tomorrow</SelectItem><SelectItem value="72">in 3 days</SelectItem><SelectItem value="168">in a week</SelectItem></SelectContent></Select>
                </div>
                <Button type="submit" size="sm" variant="outline" className="min-h-[40px] sm:min-h-0">Add</Button>
              </form>
            </CardContent>
          </Card>
          </>
        }
        watching={
          <>
          {/* Watching — live homes from their site behavior */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Watching <span className="font-normal text-muted-foreground">({viewedListings.length})</span></CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {viewedListings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No homes viewed yet. Listings this lead opens on the site show up here with live status.</p>
              ) : viewedListings.slice(0, 6).map((l) => (
                <div key={l.listingKey} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  {l.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.photoUrl} alt="" className="h-12 w-16 shrink-0 rounded-md border border-border object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs text-muted-foreground">—</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      {l.listingKey ? (
                        <Link href={`/listing/${l.listingKey}`} className="truncate text-sm font-medium text-foreground hover:underline">{l.address}</Link>
                      ) : (
                        <span className="truncate text-sm font-medium text-foreground">{l.address}</span>
                      )}
                      <ListingStatusPill status={l.status} />
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                      <span className="tabular-nums">{usd(l.listPrice) ?? 'Price n/a'}</span>
                      <span>·</span>
                      <span className="tabular-nums">{l.views} view{l.views === 1 ? '' : 's'}</span>
                      {l.saved ? <><span>·</span><span style={{ color: 'var(--console-info-strong)' }}>saved</span></> : null}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Saved searches */}
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


          {/* Home they own */}
          {homeAddress && homeMedia ? (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center justify-between text-base"><span>Home they own</span>{geo?.owner_type ? <Badge variant="outline" className="text-[11px]">{geo.owner_type}</Badge> : null}</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <a href={homeMedia.googleMapsLink} target="_blank" rel="noopener noreferrer" className="block font-medium text-foreground hover:underline">{homeAddress}</a>
                {homeFacts ? <div className="text-muted-foreground">{[homeFacts.beds ? `${homeFacts.beds} bed` : null, homeFacts.baths ? `${homeFacts.baths} bath` : null, homeFacts.sqft ? `${Math.round(homeFacts.sqft).toLocaleString('en-US')} sqft` : null, homeFacts.yearBuilt ? `built ${homeFacts.yearBuilt}` : null].filter(Boolean).join(' · ')}</div> : null}
                {homeActiveListing ? (
                  <Alert><AlertTitle className="text-sm">On the market right now</AlertTitle><AlertDescription className="text-sm">{homeActiveListing.status}{usd(homeActiveListing.listPrice) ? ` · ${usd(homeActiveListing.listPrice)}` : ''}{homeActiveListing.listingKey ? <> · <Link href={`/listing/${homeActiveListing.listingKey}`} className="underline">view</Link></> : null}</AlertDescription></Alert>
                ) : null}
                {(homeMedia.streetViewUrl || homeMlsPhoto) ? (
                  <div className={`grid gap-2 ${homeMedia.streetViewUrl && homeMlsPhoto ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {homeMedia.streetViewUrl ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={homeMedia.streetViewUrl} alt="" className="aspect-[2/1] w-full rounded-md border border-border object-cover" loading="lazy" />) : null}
                    {homeMlsPhoto ? (/* eslint-disable-next-line @next/next/no-img-element */ <img src={homeMlsPhoto} alt="" className="aspect-[2/1] w-full rounded-md border border-border object-cover" loading="lazy" />) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
          </>
        }
        workflow={
          <>
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
          </>
        }
        activity={
          <ConsoleSection title="Activity">
        {(() => {
          const convo = full.timeline.filter((t) => isConversationEvent(t.kind)).slice(0, 40).map((t) => ({ id: t.id, ts: t.ts, kind: t.kind, title: t.title, body: t.body, broker: t.broker }))
          const hasConvo = convo.length > 0
          const hasOther = activityLog.length > 0
          if (!hasConvo && !hasOther) return <p className="text-sm text-muted-foreground">No messages, calls, or visits yet.</p>
          return (
            <>
              {hasConvo ? (
                <ConversationThread events={convo} engagement={emailEngagement} personName={person.first_name ?? person.name ?? 'this contact'} />
              ) : null}
              {hasOther ? (
                <div className={hasConvo ? 'mt-4 border-t border-border pt-3' : ''}>
                  {hasConvo ? <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Site &amp; system</div> : null}
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
