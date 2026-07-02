/**
 * §25 Mobile Contact Detail — data mapping + assembly for /admin/console/leads/[id].
 *
 * Renders at < md (and standalone under ?view=mobile, the 390px verification
 * affordance — the automation browser can't shrink below 768px, so the forced
 * frame is how the side-by-side against docs/fub-crm-spec/25-mobile-contact-detail.md
 * gets captured). Extracted from page.tsx to keep the page inside its size budget.
 *
 * Server module — receives the page's already-fetched data + bound server
 * actions; no data fetching of its own.
 */

import { formatDate } from '@/lib/format/date'
import { CRM_BROKERS, CRM_BROKER_DISPLAY, CRM_STAGES } from '@/lib/crm/constants'
import type { CrmPersonFull } from '@/app/actions/crm'
import type { ConversationMessage } from '@/lib/data/crm/getContactConversation'
import type { EmailEngagement } from '@/components/admin/crm/ConversationFeed'
import type { ContactRelationship } from '@/lib/data/crm/getContactRelationships'
import type { ContactCollaborator } from '@/lib/data/crm/getContactCollaborators'
import type { ViewedListing } from '@/lib/data/crm/getViewedListings'
import { MobileContactDetail } from '@/components/admin/crm/mobile/MobileContactDetail'
import { MobileInfoTab, type MobilePickersData } from '@/components/admin/crm/mobile/MobileInfoTab'
import { MobileActivityTab, type MobileActivityRow } from '@/components/admin/crm/mobile/MobileActivityTab'
import { MobileCommsTab } from '@/components/admin/crm/mobile/MobileCommsTab'
import { MobileHomesTab } from '@/components/admin/crm/mobile/MobileHomesTab'
import { MobileNotesTab } from '@/components/admin/crm/mobile/MobileNotesTab'
import { MobileCalendarTab } from '@/components/admin/crm/mobile/MobileCalendarTab'
import type {
  MobilePhoneEntry,
  MobileEmailEntry,
  MobileInquiry,
  MobileCustomField,
  MobileAddress,
  MobileRecentMessage,
} from '@/components/admin/crm/mobile/MobileInfoTab'
import type { MobileNote } from '@/components/admin/crm/mobile/MobileNotesTab'
import type { MobileTask } from '@/components/admin/crm/mobile/MobileCalendarTab'

function fmtPhone(d: string): string {
  return d.length === 10 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}` : d
}

/** FUB date convention (§25 observed): current year → "Jun 1"; other years →
    "Jul 2, 2025". */
function fubDate(iso: string): string {
  const y = new Date(iso).toLocaleString('en-US', { year: 'numeric', timeZone: 'America/Los_Angeles' })
  const nowY = new Date(Date.now()).toLocaleString('en-US', { year: 'numeric', timeZone: 'America/Los_Angeles' })
  return formatDate(iso, { month: 'short', day: 'numeric', year: y === nowY ? undefined : 'numeric' })
}

/** Notes ingested from FUB carry literal `<br />` markup — convert to newlines
    and strip residual tags so the card shows clean text (§25.8.3). */
function cleanNoteBody(s: string): string {
  return s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim()
}

/** §25.8.3: note cards show the real broker headshot, not initials. */
const BROKER_HEADSHOTS: Record<string, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}

function brokerDisplay(slug: string | null | undefined): string | null {
  return slug ? (CRM_BROKER_DISPLAY[slug as keyof typeof CRM_BROKER_DISPLAY] ?? slug) : null
}

/** §25.8.3 date format: "Tue, 8:16pm" this week, "Jun 13" older — computed on
    the server so the client Notes tab has no now()-dependence. */
function noteDateLabel(iso: string): string {
  const d = new Date(iso)
  const diffDays = (Date.now() - d.getTime()) / 86_400_000
  if (diffDays >= 0 && diffDays < 7) {
    return d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Los_Angeles' })
  }
  return formatDate(iso, { month: 'short', day: 'numeric' })
}

export interface MobileLeadDetailProps {
  full: CrmPersonFull
  displayName: string
  backHref: string
  inquiryDate: string | null
  customEntries: Array<[string, unknown]>
  conversation: { items: ConversationMessage[]; nextCursor: string | null }
  emailEngagement: Record<string, EmailEngagement>
  relationships: ContactRelationship[]
  collaborators: ContactCollaborator[]
  viewedListings: ViewedListing[]
  /** §28 mobile-pickers data (mobile-calendar-tasks sibling slice, M7):
      account sources · ponds · active automations + this contact's
      enrollments · the acting broker (Me row + Currently banner). */
  pickers: MobilePickersData
  addNoteAction: (formData: FormData) => Promise<void>
  addTaskAction: (formData: FormData) => Promise<void>
  /** §25.5 interactivity (pickers + add contact point) */
  assignBrokerAction: (formData: FormData) => Promise<void>
  updateStageAction: (formData: FormData) => Promise<void>
  addTagAction: (formData: FormData) => Promise<void>
  removeTagAction: (formData: FormData) => Promise<void>
  addCollaboratorAction: (formData: FormData) => Promise<void>
  removeCollaboratorAction: (formData: FormData) => Promise<void>
  addContactPointAction: (formData: FormData) => Promise<void>
}

export function MobileLeadDetail({
  full,
  displayName,
  backHref,
  inquiryDate,
  customEntries,
  conversation,
  emailEngagement,
  relationships,
  collaborators,
  viewedListings,
  pickers,
  addNoteAction,
  addTaskAction,
  assignBrokerAction,
  updateStageAction,
  addTagAction,
  removeTagAction,
  addCollaboratorAction,
  removeCollaboratorAction,
  addContactPointAction,
}: MobileLeadDetailProps) {
  const person = full.person!

  const customMap = (person.custom ?? {}) as Record<string, unknown>
  const customVal = (re: RegExp): string | null => {
    const hit = Object.entries(customMap).find(([k, v]) => re.test(k) && v !== null && v !== undefined && v !== '')
    return hit ? String(hit[1]) : null
  }

  const recentMessages: MobileRecentMessage[] = conversation.items
    .filter((m) => m.kind === 'sms_in' || m.kind === 'sms_out')
    .slice(0, 2)
    .map((m) => ({
      id: m.id,
      participants: [displayName, brokerDisplay(m.broker) ?? brokerDisplay(person.assigned_broker)]
        .filter((v): v is string => Boolean(v))
        .join(', '),
      preview: (m.body ?? m.title ?? '').slice(0, 140),
      date: fubDate(m.ts),
    }))
  const phones: MobilePhoneEntry[] = full.contactPoints
    .filter((c) => c.kind === 'phone')
    .map((c) => ({ id: c.id, display: fmtPhone(c.value), tel: `tel:+1${c.value}`, label: c.label ?? 'Mobile' }))
  const emails: MobileEmailEntry[] = full.contactPoints
    .filter((c) => c.kind === 'email')
    .map((c) => ({ id: c.id, value: c.value, label: c.label }))
  // Inquiry date = lead_created event, FUB-formatted (falls back to the page's
  // preformatted label if the event is outside the loaded timeline window).
  const leadCreatedTs = full.timeline.find((t) => t.kind === 'lead_created')?.ts ?? null
  const inquiries: MobileInquiry[] = person.source
    ? [{ type: 'Registration', source: person.source, address: null, date: leadCreatedTs ? fubDate(leadCreatedTs) : (inquiryDate ?? '') }]
    : []
  const customFields: MobileCustomField[] = customEntries.map(([k, v]) => ({
    key: k,
    label: k.replace(/^custom/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
    value: String(v),
  }))
  const addresses: MobileAddress[] = ((person.addresses ?? []) as Array<Record<string, unknown>>)
    .map((a) => ({
      type: String(a.type ?? 'home'),
      street: String(a.street ?? ''),
      city: String(a.city ?? ''),
      state: String(a.state ?? ''),
      zip: String(a.code ?? a.zip ?? ''),
    }))
    .filter((a) => a.street.trim().length > 0)
  const notes: MobileNote[] = full.timeline
    .filter((t) => t.kind === 'note')
    .map((t) => ({
      id: t.id,
      ts: t.ts,
      dateLabel: noteDateLabel(t.ts),
      body: cleanNoteBody(t.body ?? t.title ?? ''),
      broker: t.broker,
      avatarUrl: BROKER_HEADSHOTS[t.broker ?? 'matt'] ?? null,
    }))
  const tasks: MobileTask[] = full.tasks.map((t) => ({
    id: t.id, name: t.name, type: t.type, due_at: t.due_at, completed_at: t.completed_at,
  }))

  // Punch #5 Activity tab — the same kinds the desktop center column's
  // Activity filter shows (web_event/stage_change/system/lead_created/task),
  // incl. the visitor-events merge getCrmPersonFull already performs.
  const ACTIVITY_KINDS = new Set(['web_event', 'stage_change', 'system', 'lead_created', 'task'])
  const activityRows: MobileActivityRow[] = full.timeline
    .filter((t) => ACTIVITY_KINDS.has(t.kind))
    .map((t) => ({
      id: t.id,
      kind: t.kind,
      title: t.title ?? t.kind.replace(/_/g, ' '),
      body: t.body && t.body !== t.title ? cleanNoteBody(t.body) : null,
      dateLabel: fubDate(t.ts),
    }))

  // Punch #2 header Edit mode — name + the raw phone/email rows the §07
  // actions expect (savePhoneNumbersAction replaces the set atomically).
  const editData = {
    firstName: person.first_name ?? '',
    lastName: person.last_name ?? '',
    phones: full.contactPoints
      .filter((c) => c.kind === 'phone')
      .map((c) => {
        // FUB-imported labels are lowercase ('mobile') — normalize to the
        // §07a PHONE_LABELS vocabulary so the label select shows the value.
        const raw = (c.label ?? 'Mobile').toLowerCase()
        const label = ['mobile', 'home', 'work', 'other', 'fax'].includes(raw)
          ? raw[0].toUpperCase() + raw.slice(1)
          : 'Mobile'
        return { value: c.value, label, bad: c.status === 'bad', isPrimary: Boolean(c.is_primary) }
      }),
    emails: full.contactPoints.filter((c) => c.kind === 'email').map((c) => c.value),
  }

  return (
    <MobileContactDetail
      personId={person.id}
      displayName={displayName}
      pictureUrl={person.picture_url}
      lastCommLabel={person.last_activity_at ? fubDate(person.last_activity_at) : null}
      priceTarget={(person as unknown as { price?: number | null }).price ?? null}
      backHref={backHref}
      editData={editData}
      activityTab={<MobileActivityTab rows={activityRows} />}
      infoTab={
        <MobileInfoTab
          personId={person.id}
          personName={displayName}
          recentMessages={recentMessages}
          phones={phones}
          emails={emails}
          relationships={relationships}
          collaborators={collaborators}
          assignedTo={brokerDisplay(person.assigned_broker)}
          assignedToSlug={person.assigned_broker ?? null}
          stage={person.stage}
          source={person.source}
          tags={Array.isArray(person.tags) ? person.tags : []}
          timeframe={
            /* §28 §4: prefer the first-class crm_people.timeframe column the
               picker writes; fall back to the legacy FUB custom field. */
            (person as unknown as { timeframe?: string | null }).timeframe ?? customVal(/time.?frame/i)
          }
          brokerOptions={CRM_BROKERS.map((b) => ({ value: b, label: CRM_BROKER_DISPLAY[b] }))}
          stageOptions={[...CRM_STAGES]}
          pickers={pickers}
          assignBrokerAction={assignBrokerAction}
          updateStageAction={updateStageAction}
          addTagAction={addTagAction}
          removeTagAction={removeTagAction}
          addCollaboratorAction={addCollaboratorAction}
          removeCollaboratorAction={removeCollaboratorAction}
          addContactPointAction={addContactPointAction}
          lender={customVal(/lender/i)}
          background={person.background}
          inquiries={inquiries}
          customFields={customFields}
          addresses={addresses}
        />
      }
      commsTab={
        <MobileCommsTab
          personId={person.id}
          personName={person.first_name ?? displayName}
          items={conversation.items}
          nextCursor={conversation.nextCursor}
          engagement={emailEngagement}
        />
      }
      homesTab={<MobileHomesTab listings={viewedListings} />}
      notesTab={
        <MobileNotesTab
          personId={person.id}
          notes={notes}
          brokerDisplayNames={CRM_BROKER_DISPLAY}
          addNoteAction={addNoteAction}
        />
      }
      calendarTab={<MobileCalendarTab personId={person.id} tasks={tasks} addTaskAction={addTaskAction} />}
    />
  )
}
