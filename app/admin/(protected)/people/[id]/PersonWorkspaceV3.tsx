import Link from 'next/link'
import { Suspense, type ComponentProps } from 'react'
import { CmaTextMeButton } from '@/components/admin/crm/CmaTextMeButton'
import { LeadComposer } from '@/components/admin/crm/lead-page-v3/LeadComposer'
import { LeadSidebar, SidebarSec } from '@/components/admin/crm/lead-page-v3/LeadSidebar'
import { LeadTimeline } from '@/components/admin/crm/lead-page-v3/LeadTimeline'
import { RightNowStrip } from '@/components/admin/crm/lead-page-v3/RightNowStrip'
import type { ContactBpo } from '@/lib/data/crm/getContactBpos'
import type { ContactCma } from '@/lib/data/crm/getContactCmas'
import type { ContactMemberships } from '@/lib/data/crm/getContactMemberships'
import type { ContactReportSubscription } from '@/lib/data/crm/getContactReportSubscriptions'
import type { PersonNoteRow } from '@/lib/data/crm/getPersonNotes'
import type { PersonSiteActivity } from '@/lib/data/crm/getSiteActivity'
import { derivePersonRightNow } from '@/lib/data/crm/person-right-now'
import { type PersonTimelineItem } from '@/lib/data/crm/person-timeline'
import { personalSiteLink } from '@/lib/identity/outbound-links'
import type { PersonWhoLabel } from '@/lib/crm/person-who-labels'
import type { ContactRelationship } from '@/lib/data/crm/getContactRelationships'
import type { PersonDealLink } from '@/lib/data/tc/deal-people'
import type { PersonAddress } from '@/lib/crm/person-address'
import { FieldEditors } from './FieldEditors'
import { HomesSection } from './HomesSection'
import { PersonAddressEditor } from './PersonAddressEditor'
import { PersonDeals } from './PersonDeals'
import { PersonNotesAdd } from './PersonNotesAdd'
import { PersonRelationships } from './PersonRelationships'
import { PersonalLinkCopy } from './PersonalLinkCopy'
import { TasksSection } from './TasksSection'

type TaskRow = {
  id: number
  name: string
  type: string | null
  due_at: string | null
  completed_at: string | null
  assigned_broker: string | null
}

type AppointmentRow = {
  id: number
  title: string
  startAt: string
  typeName: string | null
  outcomeName: string | null
  location: string | null
}

export type PersonWorkspaceV3Details = {
  canReassign: boolean
  assignedBrokerName: string | null
  brokerOptions: Array<{ slug: string; name: string }>
  sources: string[]
  address: PersonAddress | null
  autoEditAddress: boolean
  updateStage: (formData: FormData) => Promise<void>
  assignBroker: (formData: FormData) => Promise<void>
  updateSource: (formData: FormData) => Promise<void>
  addTag: (formData: FormData) => Promise<void>
  removeTag: (tag: string, formData: FormData) => Promise<void>
}

export function PersonWorkspaceV3(props: {
  personId: number
  card: {
    name: string | null
    stage: string
    assignedBroker: string | null
    source: string | null
    tags: string[]
    phone: string | null
    email: string | null
  }
  notes: PersonNoteRow[]
  nowLine: string | null
  kickoffReady: boolean
  timeline: PersonTimelineItem[]
  tasks: TaskRow[]
  appointments: AppointmentRow[]
  completeTask: (taskId: number, formData: FormData) => Promise<void>
  addTask: (formData: FormData) => Promise<void>
  details: PersonWorkspaceV3Details
  deals: PersonDealLink[]
  prospectStory: ReadonlyArray<{
    prospectId: string
    streetAddress: string | null
    city: string | null
    kind: string
    status: string
    lastListPrice: number | null
    priorAgentName: string | null
    detailHref: string
  }>
  inboundAddress: string | null
  whoLabels: readonly PersonWhoLabel[]
  relationships: ContactRelationship[]
  personEmails: string[]
  cmas: ContactCma[]
  bpos: ContactBpo[]
  memberships: ContactMemberships
  reportSub: ContactReportSubscription | null
  siteActivity: PersonSiteActivity
  composer: ComponentProps<typeof LeadComposer>
}) {
  const openTasks = props.tasks.filter((t) => !t.completed_at)
  const strip = derivePersonRightNow({
    timeline: props.timeline,
    tasks: props.tasks,
    nowLine: props.nowLine,
  })
  const personalLink = personalSiteLink(props.personId, props.card.assignedBroker)

  return (
    <>
      <style>{`
        @media (max-width: 900px) {
          .lead-v3-grid { grid-template-columns: 1fr !important; }
          .lead-v3-now { grid-template-columns: 1fr !important; }
        }
      `}</style>
      {props.kickoffReady ? (
        <section aria-label="CMA build" style={{ marginBottom: 16 }}>
          <p style={{ color: 'var(--a-ok)', fontWeight: 500, fontSize: 'var(--a-text-sm)' }}>
            CMA build kicked off. You&apos;ll get a text when the draft is ready. Nothing is sent to the lead until you
            approve it.
          </p>
        </section>
      ) : null}

      <RightNowStrip strip={strip} completeReplyTasks={props.completeTask} />

      <div
        className="lead-v3-grid"
        style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 16 }}
      >
        <div className="av2-pane" style={{ borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <LeadTimeline items={props.timeline} />
          <LeadComposer {...props.composer} personalLink={personalLink} inboundClearsImportDnt={props.composer.inboundClearsImportDnt} />
        </div>

        <LeadSidebar>
          <SidebarSec title="Tasks" meta={openTasks.length === 0 ? 'none' : `${openTasks.length} open`}>
            <TasksSection
              hideHeading
              tasks={props.tasks}
              appointments={props.appointments}
              completeTask={props.completeTask}
              addTask={props.addTask}
            />
          </SidebarSec>

          <SidebarSec title="Details" id="details" meta="edit">
            <FieldEditors
              stage={props.card.stage}
              assignedBroker={props.card.assignedBroker}
              assignedBrokerName={props.details.assignedBrokerName}
              brokerOptions={props.details.brokerOptions}
              canReassign={props.details.canReassign}
              source={props.card.source}
              sources={props.details.sources}
              tags={props.card.tags}
              updateStage={props.details.updateStage}
              assignBroker={props.details.assignBroker}
              updateSource={props.details.updateSource}
              addTag={props.details.addTag}
              removeTag={props.details.removeTag}
            />
            <div style={{ marginTop: 10 }}>
              <PersonAddressEditor
                personId={props.personId}
                address={props.details.address}
                autoEdit={props.details.autoEditAddress}
              />
            </div>
          </SidebarSec>

          <SidebarSec title="Notes" meta={props.notes.length === 1 ? '1 note' : `${props.notes.length} notes`}>
            <PersonNotesAdd personId={props.personId} notes={props.notes} hideHeading latestOnly />
          </SidebarSec>

          <SidebarSec title="Deals" meta={props.deals.length === 0 ? 'none' : String(props.deals.length)}>
            <PersonDeals
              hideHeading
              personId={props.personId}
              deals={props.deals}
              prospectStory={props.prospectStory}
              inboundAddress={props.inboundAddress}
              whoLabels={props.whoLabels}
              relationships={props.relationships}
            />
          </SidebarSec>

          <SidebarSec
            title="Homes & site"
            meta={
              props.siteActivity.pageViews === 0
                ? '0 views'
                : `${props.siteActivity.pageViews} page${props.siteActivity.pageViews === 1 ? '' : 's'}`
            }
          >
            <Suspense fallback={<p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>Loading homes…</p>}>
              <HomesSection personId={props.personId} personEmails={props.personEmails} hideHeading />
            </Suspense>
            <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '8px 0' }}>
              {props.siteActivity.pageViews > 0
                ? `${props.siteActivity.pageViews} pages in ${props.siteActivity.visits.length} visit${
                    props.siteActivity.visits.length === 1 ? '' : 's'
                  } over the last ${props.siteActivity.windowDays} days.`
                : `No visits identified to this contact in the last ${props.siteActivity.windowDays} days.`}
            </p>
            <PersonalLinkCopy href={personalLink} />
          </SidebarSec>

          <SidebarSec
            title="Valuations"
            meta={props.cmas.length + props.bpos.length === 0 ? 'none' : String(props.cmas.length + props.bpos.length)}
          >
            {props.cmas.length === 0 && props.bpos.length === 0 ? (
              <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                No CMA or price opinion yet · build from Attach
              </p>
            ) : (
              <ul className="av2-quietlist">
                {props.cmas.map((c) => (
                  <li key={c.slug} className="av2-quiet">
                    <Link href={c.reviewUrl} className="av2-quiet__name" style={{ textDecoration: 'none', color: 'var(--a-text)' }}>
                      {c.subjectAddress}
                    </Link>
                    <span className="av2-quiet__ok" style={{ color: c.buildState === 'failed' ? 'var(--a-danger)' : undefined }}>
                      {c.status}
                    </span>
                    {c.buildState === 'ready' ? <CmaTextMeButton slug={c.slug} label="Text me" fullWidth={false} /> : null}
                  </li>
                ))}
                {props.bpos.map((b) => (
                  <li key={b.slug} className="av2-quiet">
                    <Link href={b.previewUrl} className="av2-quiet__name" style={{ textDecoration: 'none', color: 'var(--a-text)' }}>
                      {b.subjectAddress}
                    </Link>
                    <span className="av2-quiet__ok">{b.status} BPO</span>
                  </li>
                ))}
              </ul>
            )}
            {props.prospectStory.length > 0 ? (
              <ul className="av2-quietlist" style={{ marginTop: 8 }}>
                {props.prospectStory.map((s) => (
                  <li key={s.prospectId} className="av2-quiet">
                    <Link href={s.detailHref} className="av2-quiet__name" style={{ textDecoration: 'none', color: 'var(--a-text)' }}>
                      {[s.streetAddress, s.city].filter(Boolean).join(', ') || s.prospectId}
                    </Link>
                    <span style={{ color: 'var(--a-text-2)' }}>{s.kind === 'expired' ? s.status : 'FSBO'}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </SidebarSec>

          <SidebarSec title="Related people" meta={String(props.relationships.length)}>
            <PersonRelationships personId={props.personId} relationships={props.relationships} hideHeading />
          </SidebarSec>

          <SidebarSec
            title="Subscriptions"
            meta={
              props.memberships.newsletter.subscribed || (props.reportSub?.isActive ?? false) || props.memberships.listingAlerts.active > 0
                ? 'on'
                : 'off'
            }
          >
            <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: 0 }}>
              Newsletter {props.memberships.newsletter.subscribed ? 'on' : 'off'}
              {' · '}
              Market reports {props.reportSub?.isActive ? `${props.reportSub.areas.length} area${props.reportSub.areas.length === 1 ? '' : 's'}` : 'off'}
              {' · '}
              Listing alerts {props.memberships.listingAlerts.active}
            </p>
          </SidebarSec>
        </LeadSidebar>
      </div>
    </>
  )
}

