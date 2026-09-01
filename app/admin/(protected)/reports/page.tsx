// @no-parity — internal admin surface, no public mockup contract
// Reports (P9 roll:remaining-families, IA lock 2026-08-05): answer a question
// with a defined number — ONE reporting home over the three legacy namespaces
// (/admin/analytics/*, /admin/reports/*, /admin/crm/reporting/*). This is the
// definition-first index the reporting-truth process demanded: every report
// states the question it answers, and each metric keeps ONE source page.
// Deliberately a hub, not 35 rebuilt report UIs — the existing pages behind
// these links carry the machinery until each migrates. DSCR lives here as a
// tool (Matt's IA amendment 2026-08-05).
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { VerdictLine } from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

type ReportLink = { name: string; href: string; question: string }
type ReportGroup = { title: string; reports: ReportLink[] }

const GROUPS: ReportGroup[] = [
  {
    title: 'The business',
    reports: [
      { name: 'Site & marketing overview', href: '/admin/analytics', question: 'How is the whole funnel doing this week?' },
      { name: 'Lead flow', href: '/admin/reports/lead-flow', question: 'Where did leads come from and where did they go?' },
      { name: 'Leads', href: '/admin/reports/leads', question: 'Who came in, one row per lead?' },
      { name: 'Broker production', href: '/admin/reports/brokers', question: 'What has each broker closed and banked?' },
      { name: 'Market', href: '/admin/reports/market', question: 'What is the market doing right now?' },
    ],
  },
  {
    title: 'CRM activity',
    reports: [
      { name: 'CRM overview', href: '/admin/crm/reporting/overview', question: 'What happened in the CRM this period?' },
      { name: 'Speed to lead', href: '/admin/crm/reporting/speed-to-lead', question: 'How fast do we answer new leads?' },
      { name: 'Agent activity', href: '/admin/crm/reporting/agent-activity', question: 'What did each agent actually do?' },
      { name: 'Agent goals', href: '/admin/crm/reporting/agent-goals', question: 'Is each agent pacing to goal?' },
      { name: 'Lead sources', href: '/admin/crm/reporting/lead-sources', question: 'Which sources produce real leads?' },
      { name: 'Contact attempts', href: '/admin/crm/reporting/contact-attempts', question: 'How hard are we working new leads?' },
      { name: 'Calls', href: '/admin/crm/reporting/calls', question: 'What calls happened?' },
      { name: 'Call logs', href: '/admin/crm/reporting/call-logs', question: 'The raw call ledger, filterable.' },
      { name: 'Texts', href: '/admin/crm/reporting/texts', question: 'What text conversations happened?' },
      { name: 'Appointments', href: '/admin/crm/reporting/appointments', question: 'What appointments were set and kept?' },
      { name: 'Properties', href: '/admin/crm/reporting/properties', question: 'Which properties do leads care about?' },
      { name: 'Westside cohort', href: '/admin/crm/reporting/westside', question: 'How is the westside audience performing?' },
      { name: 'Marketing touches', href: '/admin/crm/reporting/marketing', question: 'What marketing reached whom?' },
    ],
  },
  {
    title: 'Email',
    reports: [
      { name: 'Email performance', href: '/admin/reports/emails', question: 'Are our emails landing and getting read?' },
      { name: 'Batch emails', href: '/admin/reports/emails', question: 'How did each bulk send perform?' },
      { name: 'Campaigns', href: '/admin/email/campaigns', question: 'What campaigns ran and to whom?' },
      { name: 'Newsletter analytics', href: '/admin/newsletters/analytics', question: 'How is the newsletter performing?' },
    ],
  },
  {
    title: 'Acquisition & spend',
    reports: [
      { name: 'Ad ROI', href: '/admin/analytics/ad-roi', question: 'Is paid spend paying back?' },
      { name: 'Cost per lead', href: '/admin/analytics/cost-per-lead', question: 'What does a lead cost by channel?' },
      { name: 'Funnel breakdown', href: '/admin/analytics/funnel-breakdown', question: 'Where does the funnel leak?' },
      { name: 'LP leaderboard', href: '/admin/analytics/lp-leaderboard', question: 'Which landing pages convert?' },
      { name: 'Traffic sources', href: '/admin/reports/traffic-sources', question: 'Who sends us visitors?' },
      { name: 'Google search', href: '/admin/analytics/google-search', question: 'What do we rank for and win?' },
      { name: 'Google Business Profile', href: '/admin/analytics/google-business-profile', question: 'How does the GBP listing perform?' },
      { name: 'Social', href: '/admin/analytics/social', question: 'What is social doing for us?' },
      { name: 'Meta health', href: '/admin/analytics/meta-health', question: 'Are the Meta pipelines healthy?' },
      { name: 'Demographics', href: '/admin/analytics/demographics', question: 'Who is our audience?' },
      { name: 'Action required', href: '/admin/analytics/action-required', question: 'Which analytics need a decision?' },
    ],
  },
  {
    title: 'Content & tools',
    reports: [
      { name: 'Listing performance', href: '/admin/analytics/listing-performance', question: 'How do our listings perform online?' },
      { name: 'CMA performance', href: '/admin/reports/cma-performance', question: 'Do CMAs get opened and acted on?' },
      { name: 'DSCR screen', href: '/admin/dscr', question: 'Does a rental pencil at today’s rates?' },
      { name: 'Custom report', href: '/admin/reports/custom', question: 'Build a one-off answer from the data.' },
    ],
  },
]

export default async function ReportsHubPage() {
  await requireAdminPage('performance.view')
  const total = GROUPS.reduce((n, g) => n + g.reports.length, 0)

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone="ok">
          <b>{total} reports, one home.</b> Every number has one page that owns it.
        </VerdictLine>
      </div>

      {GROUPS.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <h2 className="av2-lane-head">{g.title}</h2>
          <ul className="av2-quietlist">
            {g.reports.map((r) => (
              <li key={r.href} className="av2-quiet">
                <Link href={r.href} className="av2-quiet__name" style={{ textDecoration: 'none', color: 'var(--a-text)' }}>
                  {r.name}
                </Link>
                <span style={{ color: 'var(--a-text-2)' }}>{r.question}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
