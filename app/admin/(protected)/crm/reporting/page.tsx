// @no-parity — internal admin surface, no public mockup contract
//
// /admin/crm/reporting — the reporting launchpad. P11D: migrated to the LOCKED
// admin v2 language (design_system/admin/ADMIN_UI.md) on the same door-row shape
// the CRM settings hub already uses. PRESENTATION ONLY — this page reads nothing.
//
// Carried over verbatim: requireAdminPage('people.view'), the getCrmAccess() →
// /admin/access-denied guard, `dynamic = 'force-dynamic'`, the metadata title,
// ReportingTabStrip mounted UNCHANGED with active={null}, the three group names,
// and every surviving href character for character.
//
// Shape changed, data did not: the <h1> is gone (the nav names the page), the
// emoji card grid became quiet door rows, and each door now carries the name its
// destination answers to.
//
// TWO CLAIMS CUT, both verified against the pages they pointed at:
//  1. "Closed Deals By Source — see which lead source has the most closed deals,
//     commission and conversion rate %" pointed at /reporting/lead-sources, a
//     SECOND door onto a route already listed above it. That report renders new
//     leads · calls · emails · texts · notes · tasks done · appointments
//     (LS_COL_KEYS in lib/crm/reporting-constants.ts) — no deals, no commission,
//     no conversion rate. The card promised a report that does not exist; the
//     Deals door two rows up is the one that carries commissions.
//  2. "Properties — see which properties and zipcodes have the most inquiries."
//     That report's columns are Listing · City · Rank · Inquiries — it ranks
//     listings, never zip codes (the postal code only rides along inside the
//     city string). The door now says what the page shows.
// Renamed to match their destinations: "Source Report" → Lead Sources and
// "Marketing UTM Report" → Marketing, which is what both the tab strip and each
// page's own title call them.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import { ReportingTabStrip } from '@/components/admin/crm/reporting/ReportingTabStrip'

export const metadata = { title: 'Reporting | CRM' }
export const dynamic = 'force-dynamic'

/** One door onto a report. The title is the name that report answers to. */
type ReportDoor = { title: string; description: string; href: string }
type ReportGroup = { label: string; doors: ReportDoor[] }

const GROUPS: ReportGroup[] = [
  {
    label: 'Agents',
    doors: [
      { title: 'Agent Activity', description: 'Leads per agent, alongside the follow-up logged against them.', href: '/admin/crm/reporting/agent-activity' },
      { title: 'Calls', description: 'Calls made, conversations, missed calls, and talk time by agent.', href: '/admin/crm/reporting/calls' },
      { title: 'Call Logs', description: 'Recent inbound and outbound calls, with the recording and transcript.', href: '/admin/crm/reporting/call-logs' },
      { title: 'Texts', description: 'Text delivery rates and volume by phone number.', href: '/admin/crm/reporting/texts' },
      { title: 'Appointments', description: 'Appointments and their outcomes, with the lead source and agent on each.', href: '/admin/crm/reporting/appointments' },
      { title: 'Deals', description: 'Deals with commissions, by deal stage and lead source.', href: '/admin/crm/reporting/deals' },
      { title: 'Agent Goals', description: 'Annual commission and personal goals for each agent.', href: '/admin/crm/reporting/agent-goals' },
    ],
  },
  {
    label: 'Lead Sources',
    doors: [
      { title: 'Lead Sources', description: 'Which providers and sources send leads, and the activity logged against them.', href: '/admin/crm/reporting/lead-sources' },
      { title: 'Speed to Lead', description: 'How fast the first follow-up goes out, by source and follow-up type.', href: '/admin/crm/reporting/speed-to-lead' },
      { title: 'Contact Attempts', description: 'How many times a lead is worked on average, by source.', href: '/admin/crm/reporting/contact-attempts' },
    ],
  },
  {
    label: 'Marketing',
    doors: [
      { title: 'Batch Emails', description: 'Campaign results: sends, opens, and clicks.', href: '/admin/crm/reporting/batch-emails' },
      { title: 'Properties', description: 'Which listings drew the most inquiries, ranked, with the city each sits in.', href: '/admin/crm/reporting/properties' },
      { title: 'Marketing', description: 'UTM and campaign metrics through to appointments and closed deals.', href: '/admin/crm/reporting/marketing' },
    ],
  },
]

export default async function CrmReportingPage() {
  await requireAdminPage('people.view')
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const total = GROUPS.reduce((n, g) => n + g.doors.length, 0)

  return (
    <div className="av2-scope" style={{ maxWidth: 880, margin: '0 auto', padding: 16 }}>
      <ReportingTabStrip active={null} />

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone="ok">
          <b>{total} reports, grouped by the question each answers.</b>
        </VerdictLine>
      </div>

      {GROUPS.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <SectionHead>{group.label}</SectionHead>
          <ul className="av2-quietlist">
            {group.doors.map((door) => (
              <li key={door.href} className="av2-quiet" style={{ flexWrap: 'wrap' }}>
                <Link
                  href={door.href}
                  className="av2-quiet__name"
                  style={{ textDecoration: 'none', color: 'var(--a-text)', minWidth: 170, flex: 'none' }}
                >
                  {door.title}
                </Link>
                <span style={{ color: 'var(--a-text-2)', flex: '1 1 220px', minWidth: 0 }}>
                  {door.description}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
