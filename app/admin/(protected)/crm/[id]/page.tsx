// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
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
  updateCrmStageAction,
} from '@/app/actions/crm'
import { timelineEmailBody } from '@/lib/crm/email-body'
import { renderCrmMerge } from '@/lib/crm/merge'
import { getSignatureForMailbox } from '@/lib/crm/email-signature'
import { CRM_MAILBOXES } from '@/lib/crm/gmail'
import { getOwnedHomeMatches, type OwnedHomeMatch } from '@/lib/data'
import { getOwnedHomeMedia } from '@/lib/crm/owned-home-media'
import { EmailComposer } from '@/components/admin/crm/EmailComposer'
import { SmsComposer } from '@/components/admin/crm/SmsComposer'
import ConversationThread, { isConversationEvent } from '@/components/admin/crm/ConversationThread'
import QuickContactFab from '@/components/admin/crm/QuickContactFab'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

export const metadata = { title: 'Contact | CRM | Admin' }
export const dynamic = 'force-dynamic'

// <form action> requires Promise<void> — discard the structured results here.
// Failures are logged server-side; the page re-renders current state either way.
async function addNoteForm(formData: FormData): Promise<void> {
  'use server'
  const r = await addCrmNoteAction(formData)
  if (!r.ok) console.error('[crm] addNote failed:', r.error)
}
async function updateStageForm(formData: FormData): Promise<void> {
  'use server'
  const r = await updateCrmStageAction(formData)
  if (!r.ok) console.error('[crm] updateStage failed:', r.error)
}
async function addTagForm(formData: FormData): Promise<void> {
  'use server'
  const r = await addCrmTagAction(formData)
  if (!r.ok) console.error('[crm] addTag failed:', r.error)
}
async function removeTagForm(formData: FormData): Promise<void> {
  'use server'
  const r = await removeCrmTagAction(formData)
  if (!r.ok) console.error('[crm] removeTag failed:', r.error)
}
async function addTaskForm(formData: FormData): Promise<void> {
  'use server'
  const r = await addCrmTaskAction(formData)
  if (!r.ok) console.error('[crm] addTask failed:', r.error)
}
async function completeTaskForm(formData: FormData): Promise<void> {
  'use server'
  const r = await completeCrmTaskAction(formData)
  if (!r.ok) console.error('[crm] completeTask failed:', r.error)
}
async function assignBrokerForm(formData: FormData): Promise<void> {
  'use server'
  const r = await assignCrmBrokerAction(formData)
  if (!r.ok) console.error('[crm] assignBroker failed:', r.error)
}
async function sendEmailForm(personId: number, formData: FormData): Promise<void> {
  'use server'
  formData.set('personId', String(personId))
  const r = await sendCrmEmailAction(formData)
  if (!r.ok) console.error('[crm] sendEmail failed:', r.error)
}
async function sendSmsForm(personId: number, formData: FormData): Promise<void> {
  'use server'
  formData.set('personId', String(personId))
  const r = await sendCrmSmsAction(formData)
  if (!r.ok) console.error('[crm] sendSms failed:', r.error)
}

const KIND_ICON: Record<string, string> = {
  note: '📝', email_in: '📥', email_out: '📤', sms_in: '💬', sms_out: '📲',
  call: '📞', voicemail: '🎙', web_event: '🌐', task: '☑', stage_change: '🪜', system: '⚙',
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  })
}

function stripHtml(s: string): string {
  return timelineEmailBody(s)
}

function fmtPhoneDisplay(tenDigits: string): string {
  if (tenDigits.length !== 10) return tenDigits
  return `${tenDigits.slice(0, 3)}.${tenDigits.slice(3, 6)}.${tenDigits.slice(6)}`
}

function TimelineEntry({ e }: { e: { id: number; ts: string; kind: string; title: string | null; body: string | null; broker: string | null; payload: unknown } }) {
  return (
    <div className="flex gap-3">
      <div className="w-6 shrink-0 text-center text-base leading-6">{KIND_ICON[e.kind] ?? '•'}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-foreground">{e.title ?? e.kind.replace('_', ' ')}</span>
          <span className="text-xs tabular-nums text-muted-foreground">{fmtDateTime(e.ts)}</span>
          {e.broker ? <Badge variant="outline" className="text-xs">{e.broker}</Badge> : null}
        </div>
        {e.body ? (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {stripHtml(e.body).slice(0, 1200)}
          </p>
        ) : null}
        {(e.payload as { recordingSid?: string })?.recordingSid ? (
          <audio
            controls
            preload="none"
            className="mt-1.5 h-9 w-full max-w-md"
            src={`/api/admin/crm/recording/${(e.payload as { recordingSid: string }).recordingSid}`}
          />
        ) : null}
      </div>
    </div>
  )
}

export default async function CrmPersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tpl?: string; smsTpl?: string }> }) {
  const { id: idRaw } = await params
  const id = Number(idRaw)
  if (!Number.isFinite(id) || id <= 0) notFound()
  const { tpl, smsTpl } = await searchParams

  // One parallel wave — getCrmAccess carries the auth gate (session + role),
  // so the old sequential session → role → data chain is gone.
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
  const activeTpl = tpl ? templates.find((t) => t.key === tpl) ?? null : null
  const activeSmsTpl = smsTpl ? smsTemplates.find((t) => t.key === smsTpl) ?? null : null

  // Acting broker — same resolution as the send actions, so the signature and
  // merged preview show exactly what the send will produce.
  const personLike = person as unknown as { first_name?: string | null; name?: string | null; custom?: Record<string, unknown>; assigned_broker?: string | null }
  const actingSlug = crmAccess?.brokerSlug ?? personLike.assigned_broker ?? 'matt'
  const mailbox = CRM_MAILBOXES.find((m) => m.slug === actingSlug) ?? CRM_MAILBOXES[0]
  const signature = await getSignatureForMailbox(mailbox.email)
  const emailInitialSubject = activeTpl?.subject ? renderCrmMerge(activeTpl.subject, personLike) : ''
  const emailInitialBody = activeTpl?.body ? renderCrmMerge(activeTpl.body, personLike) : ''
  const smsInitialBody = activeSmsTpl?.body ? renderCrmMerge(activeSmsTpl.body, personLike) : ''
  const primaryEmail = full.contactPoints.find((c) => c.kind === 'email')?.value ?? null
  const primaryPhone = full.contactPoints.find((c) => c.kind === 'phone')?.value ?? null

  const customEntries = Object.entries(person.custom ?? {}).filter(
    ([, v]) => v !== null && v !== '' && v !== undefined,
  )
  const openTasks = full.tasks.filter((t) => !t.completed_at)
  const doneTasks = full.tasks.filter((t) => t.completed_at)
  const geo = full.geo as {
    city?: string
    neighborhood?: string
    subdivision?: string
    city_slug?: string
    neighborhood_slug?: string
    subdivision_slug?: string
    source_address?: string
    formatted_address?: string
    latitude?: number
    longitude?: number
    owner_type?: string
  } | null

  // Owned home — map, exterior photo, MLS history for the address we have.
  const homeLat = typeof geo?.latitude === 'number' ? geo.latitude : null
  const homeLng = typeof geo?.longitude === 'number' ? geo.longitude : null
  const homeAddress = geo?.formatted_address ?? geo?.source_address ?? null
  let homeMedia: Awaited<ReturnType<typeof getOwnedHomeMedia>> | null = null
  let homeMatches: OwnedHomeMatch[] = []
  if (homeLat !== null && homeLng !== null) {
    ;[homeMedia, homeMatches] = await Promise.all([
      getOwnedHomeMedia(homeLat, homeLng),
      getOwnedHomeMatches(homeLat, homeLng),
    ])
  }
  const homeMlsPhoto = homeMatches.find((m) => m.photoUrl)?.photoUrl ?? null
  const homeActiveListing = homeMatches.find((m) =>
    ['Active', 'Coming Soon', 'Active Under Contract', 'Pending'].includes(m.status ?? ''),
  ) ?? null
  const homeSales = homeMatches.filter((m) => m.closePrice && m.closeDate)
  const homeFacts = homeMatches.find((m) => m.beds || m.sqft) ?? null

  const webEvents = full.timeline.filter((t) => t.kind === 'web_event').slice(0, 8)

  // Live right now — most recent web event inside 30 minutes.
  const latestWeb = webEvents[0] ?? null
  const liveAgeMin = latestWeb ? Math.round((Date.now() - new Date(latestWeb.ts).getTime()) / 60000) : null
  const isLiveNow = liveAgeMin !== null && liveAgeMin >= 0 && liveAgeMin <= 30

  return (
    <main className="mx-auto max-w-[1600px] px-2 py-4 sm:px-6 sm:py-8">
      <div className="mb-4 text-sm text-muted-foreground">
        <Link href="/admin/crm" className="hover:text-foreground">← Back to CRM</Link>
      </div>

      {isLiveNow && latestWeb ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary p-5 text-primary-foreground">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>
              On the site {liveAgeMin === 0 ? 'right now' : `${liveAgeMin} min ago`}
            </div>
            <div className="mt-0.5 truncate text-sm opacity-90">{latestWeb.title ?? 'Browsing'}</div>
          </div>
          <div className="flex shrink-0 gap-2">
            {primaryPhone ? (
              <Button asChild size="sm" variant="secondary">
                <a href={`tel:+1${primaryPhone.replace(/\D/g, '').slice(-10)}`}>Call</a>
              </Button>
            ) : null}
            {primaryPhone ? (
              <Button asChild size="sm" variant="secondary"><a href="#send-text">Text</a></Button>
            ) : null}
            {primaryEmail ? (
              <Button asChild size="sm" variant="secondary"><a href="#send-email">Email</a></Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {full.suppressions.length > 0 ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Contact restrictions active</AlertTitle>
          <AlertDescription>
            {full.suppressions.map((s) => `${s.channel}: ${s.reason}`).join(' · ')}. Automated outreach is blocked for the listed channels.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[420px_1fr]">
        {/* ── Left: identity (second on phones — comms come first) ── */}
        <div className="order-2 space-y-4 sm:space-y-6 lg:order-none">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-4">
                  {person.picture_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={person.picture_url} alt="" className="h-24 w-24 shrink-0 rounded-xl border border-border object-cover shadow-sm" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
                      {(person.name ?? '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                <div>
                  <CardTitle className="text-xl">{person.name ?? `Contact #${person.id}`}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {person.source ?? 'Unknown source'} · created {fmtDateTime(person.fub_created_at)}
                  </p>
                </div>
                </div>
                {person.fub_legacy_id ? (
                  <a
                    href={`https://ryan-realty.followupboss.com/2/people/view/${person.fub_legacy_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    Open in FUB ↗
                  </a>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stage */}
              <form action={updateStageForm} className="flex items-center gap-2">
                <input type="hidden" name="personId" value={person.id} />
                <select
                  name="stage"
                  defaultValue={person.stage}
                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  {CRM_STAGES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline">Set stage</Button>
              </form>

              <form action={assignBrokerForm} className="flex items-center gap-2 text-sm">
                <input type="hidden" name="personId" value={person.id} />
                <span className="text-muted-foreground">Broker:</span>
                <select
                  name="broker"
                  defaultValue={person.assigned_broker ?? ''}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                >
                  {!person.assigned_broker ? <option value="">unassigned</option> : null}
                  {CRM_BROKERS.map((b) => (
                    <option key={b} value={b}>{CRM_BROKER_DISPLAY[b]}</option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline">Assign</Button>
              </form>

              <Separator />

              {/* Contact points */}
              <div className="space-y-1.5">
                {full.contactPoints.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contact info on file.</p>
                ) : (
                  full.contactPoints.map((cp) => (
                    <div key={cp.id} className="flex items-center justify-between text-sm">
                      <a
                        href={cp.kind === 'email' ? `mailto:${cp.value}` : `tel:+1${cp.value}`}
                        className="text-foreground hover:underline"
                      >
                        {cp.kind === 'phone' ? fmtPhoneDisplay(cp.value) : cp.value}
                      </a>
                      <span className="text-xs text-muted-foreground">
                        {cp.label ?? cp.kind}{cp.is_primary ? ' · primary' : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <Separator />

              {/* Tags — collapsed by default; the 20-badge wall buried the page */}
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium uppercase text-muted-foreground hover:text-foreground">
                  Tags ({person.tags.length}) <span className="normal-case text-muted-foreground/70 group-open:hidden">· tap to manage</span>
                </summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {person.tags.map((t) => (
                    <form key={t} action={removeTagForm} className="inline-flex">
                      <input type="hidden" name="personId" value={person.id} />
                      <input type="hidden" name="tag" value={t} />
                      <Badge variant="outline" className="gap-1 pr-1 text-xs">
                        {t}
                        <button type="submit" aria-label={`Remove ${t}`} className="rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground">×</button>
                      </Badge>
                    </form>
                  ))}
                </div>
                <form action={addTagForm} className="mt-2 flex gap-2">
                  <input type="hidden" name="personId" value={person.id} />
                  <Input name="tag" placeholder="add-tag" className="h-8 text-sm" />
                  <Button type="submit" size="sm" variant="outline">Add</Button>
                </form>
              </details>
            </CardContent>
          </Card>

          {/* Linked intel — the stuff FUB can't show */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Platform intel</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {geo && (geo.city || geo.neighborhood || geo.subdivision) ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Geo</span>
                  <span className="text-right text-foreground">
                    {[geo.subdivision, geo.neighborhood, geo.city].filter(Boolean).join(' · ')}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Website sessions</span>
                <span className="tabular-nums text-foreground">{full.visitorSessions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CMA deliveries</span>
                <span className="tabular-nums text-foreground">{full.cmaDeliveries.length}</span>
              </div>
              {full.enrollments.length > 0 ? (
                <div>
                  <div className="mb-1 text-muted-foreground">Sequences</div>
                  {full.enrollments.map((e) => (
                    <div key={e.id} className="flex justify-between">
                      <span className="text-foreground">{e.crm_sequences?.name ?? `Sequence`}</span>
                      <Badge variant="outline" className="text-[11px]">{e.status} · step {e.step_index}</Badge>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Owned home — address, exterior photos, map, MLS history */}
          {homeAddress && homeMedia ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>Owned home</span>
                  {geo?.owner_type ? <Badge variant="outline" className="text-[11px]">{geo.owner_type}</Badge> : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <a
                  href={homeMedia.googleMapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-medium text-foreground hover:underline"
                >
                  {homeAddress}
                </a>
                {homeFacts ? (
                  <div className="text-muted-foreground">
                    {[
                      homeFacts.beds ? `${homeFacts.beds} bed` : null,
                      homeFacts.baths ? `${homeFacts.baths} bath` : null,
                      homeFacts.sqft ? `${Math.round(homeFacts.sqft).toLocaleString('en-US')} sqft` : null,
                      homeFacts.yearBuilt ? `built ${homeFacts.yearBuilt}` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                ) : null}
                {homeActiveListing ? (
                  <Alert>
                    <AlertTitle className="text-sm">On the market right now</AlertTitle>
                    <AlertDescription className="text-sm">
                      {homeActiveListing.status}
                      {homeActiveListing.listPrice ? ` · $${(Math.round(homeActiveListing.listPrice / 1000) * 1000).toLocaleString('en-US')}` : ''}
                      {homeActiveListing.listingKey ? (
                        <> · <Link href={`/listing/${homeActiveListing.listingKey}`} className="underline">view listing</Link></>
                      ) : null}
                    </AlertDescription>
                  </Alert>
                ) : null}
                {(homeMedia.streetViewUrl || homeMlsPhoto) ? (
                  <div className={`grid gap-2 ${homeMedia.streetViewUrl && homeMlsPhoto ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {homeMedia.streetViewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={homeMedia.streetViewUrl} alt={`Street view of ${homeAddress}`} className="aspect-[2/1] w-full rounded-md border border-border object-cover" loading="lazy" />
                    ) : null}
                    {homeMlsPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={homeMlsPhoto} alt={`MLS photo of ${homeAddress}`} className="aspect-[2/1] w-full rounded-md border border-border object-cover" loading="lazy" />
                    ) : null}
                  </div>
                ) : null}
                {homeMedia.mapUrl ? (
                  <a href={homeMedia.googleMapsLink} target="_blank" rel="noopener noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={homeMedia.mapUrl} alt={`Map of ${homeAddress}`} className="w-full rounded-md border border-border" loading="lazy" />
                  </a>
                ) : null}
                {homeSales.length > 0 ? (
                  <div>
                    <div className="mb-1 text-muted-foreground">Sale history (MLS)</div>
                    {homeSales.slice(0, 4).map((s, i) => (
                      <div key={`${s.listingKey ?? i}`} className="flex justify-between">
                        <span className="text-foreground">
                          {s.listingKey ? (
                            <Link href={`/listing/${s.listingKey}`} className="hover:underline">
                              Sold ${(Math.round((s.closePrice as number) / 1000) * 1000).toLocaleString('en-US')}
                            </Link>
                          ) : (
                            <>Sold ${(Math.round((s.closePrice as number) / 1000) * 1000).toLocaleString('en-US')}</>
                          )}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {new Date(s.closeDate as string).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'America/Los_Angeles' })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {homeMatches.length === 0 ? (
                  <p className="text-muted-foreground">No MLS record within 40m of this address. Map and street view are from the geocoded point.</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* Website activity — most recent identified page views */}
          {webEvents.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Website activity ({full.visitorSessions} sessions)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {webEvents.map((e) => (
                  <div key={e.id} className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-foreground">{e.title ?? 'page view'}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{fmtDateTime(e.ts)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {/* Custom fields */}
          {customEntries.length > 0 ? (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Fields ({customEntries.length})</CardTitle></CardHeader>
              <CardContent>
                <dl className="space-y-1.5 text-sm">
                  {customEntries.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="shrink-0 text-muted-foreground">{k.replace(/^custom/, '')}</dt>
                      <dd className="truncate text-right text-foreground">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          {person.background ? (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Background</CardTitle></CardHeader>
              <CardContent><p className="whitespace-pre-wrap text-sm text-foreground">{person.background}</p></CardContent>
            </Card>
          ) : null}
        </div>

        {/* ── Right: conversation + tasks + timeline (first on phones) ── */}
        <div className="order-1 space-y-4 sm:space-y-6 lg:order-none">
          {/* Conversation — texts and emails only, chat style */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              <ConversationThread
                events={full.timeline.filter((t) => isConversationEvent(t.kind)).map((t) => ({
                  id: t.id, ts: t.ts, kind: t.kind, title: t.title, body: t.body, broker: t.broker,
                }))}
                personName={person.first_name ?? person.name ?? 'this contact'}
              />
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tasks ({openTasks.length} open)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {openTasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <div>
                    <div className="text-sm font-medium text-foreground">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.type ?? 'Task'} · due {fmtDateTime(t.due_at)}
                    </div>
                  </div>
                  <form action={completeTaskForm}>
                    <input type="hidden" name="taskId" value={t.id} />
                    <input type="hidden" name="personId" value={person.id} />
                    <Button type="submit" size="sm" variant="outline">Done</Button>
                  </form>
                </div>
              ))}
              {doneTasks.length > 0 ? (
                <p className="text-xs text-muted-foreground">{doneTasks.length} completed</p>
              ) : null}
              <form action={addTaskForm} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="personId" value={person.id} />
                <Input name="name" placeholder="New task" className="h-8 w-56 text-sm" />
                <select name="type" className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground" defaultValue="Follow Up">
                  {['Follow Up', 'Call', 'Text', 'Email'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select name="dueHours" className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground" defaultValue="24">
                  <option value="1">in 1 hour</option>
                  <option value="4">in 4 hours</option>
                  <option value="24">tomorrow</option>
                  <option value="72">in 3 days</option>
                  <option value="168">in a week</option>
                </select>
                <Button type="submit" size="sm" variant="outline">Add task</Button>
              </form>
            </CardContent>
          </Card>

          {/* Email composer */}
          <Card id="send-email" className="scroll-mt-20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Send email {primaryEmail ? <span className="font-normal text-muted-foreground">to {primaryEmail}</span> : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {primaryEmail ? (
                <>
                  <form method="GET" className="flex items-center gap-2">
                    <select name="tpl" defaultValue={tpl ?? ''} className="h-8 max-w-[360px] flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground">
                      <option value="">Blank email</option>
                      {templates.map((t) => (
                        <option key={t.key} value={t.key}>{t.name}</option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" variant="outline">Load template</Button>
                  </form>
                  <EmailComposer
                    key={tpl ?? 'blank'}
                    initialSubject={emailInitialSubject}
                    initialBody={emailInitialBody}
                    signatureHtml={signature?.html ?? null}
                    sendAction={sendEmailForm.bind(null, person.id)}
                  />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No email address on file.</p>
              )}
            </CardContent>
          </Card>

          {/* SMS composer */}
          <Card id="send-text" className="scroll-mt-20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Send text {primaryPhone ? <span className="font-normal text-muted-foreground">to {fmtPhoneDisplay(primaryPhone)}</span> : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!twilioStatus.canSend ? (
                <Alert>
                  <AlertTitle>Outbound texting not live yet</AlertTitle>
                  <AlertDescription>
                    Twilio A2P campaign status is {twilioStatus.a2p ?? 'unknown'}. Carriers block delivery until status is VERIFIED.
                    You can compose messages here, but sends will fail until approval completes.{' '}
                    <a
                      href="https://console.twilio.com/us1/develop/sms/regulatory-compliance/campaigns"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      Check live status in Twilio ↗
                    </a>
                  </AlertDescription>
                </Alert>
              ) : null}
              {primaryPhone ? (
                <>
                  <form method="GET" className="flex items-center gap-2">
                    <input type="hidden" name="tpl" value={tpl ?? ''} />
                    <select name="smsTpl" defaultValue={smsTpl ?? ''} className="h-8 max-w-[360px] flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground">
                      <option value="">Blank text</option>
                      {smsTemplates.map((t) => (
                        <option key={t.key} value={t.key}>{t.name}</option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" variant="outline">Load template</Button>
                  </form>
                  <SmsComposer
                    key={smsTpl ?? 'blank'}
                    initialBody={smsInitialBody}
                    sendAction={sendSmsForm.bind(null, person.id)}
                  />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No phone number on file.</p>
              )}
            </CardContent>
          </Card>

          {/* Composer */}
          <Card id="add-note" className="scroll-mt-20">
            <CardHeader className="pb-3"><CardTitle className="text-base">Add note</CardTitle></CardHeader>
            <CardContent>
              <form action={addNoteForm} className="space-y-2">
                <input type="hidden" name="personId" value={person.id} />
                <Textarea name="body" placeholder="Note — writes to the CRM timeline and to FUB while the parallel run is on" rows={3} />
                <div className="flex justify-end">
                  <Button type="submit" size="sm">Save note</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Timeline <span className="font-normal text-muted-foreground">({full.timelineTotal.toLocaleString('en-US')} entries, latest 100)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {full.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <>
                  <div className="space-y-4">
                    {full.timeline.slice(0, 15).map((e) => (
                      <TimelineEntry key={e.id} e={e} />
                    ))}
                  </div>
                  {full.timeline.length > 15 ? (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium text-primary">
                        Show older activity ({full.timeline.length - 15} more)
                      </summary>
                      <div className="mt-4 space-y-4">
                        {full.timeline.slice(15).map((e) => (
                          <TimelineEntry key={e.id} e={e} />
                        ))}
                      </div>
                    </details>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <QuickContactFab phone={primaryPhone} email={primaryEmail} />
    </main>
  )
}
