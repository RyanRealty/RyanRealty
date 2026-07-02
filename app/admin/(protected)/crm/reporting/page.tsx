// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Reporting | CRM' }
export const dynamic = 'force-dynamic'

// --- Sub-nav tab strip ---
const REPORTING_TABS = [
  { label: 'Overview', href: '/admin/crm/reporting' },
  { label: 'Agent Activity', href: '/admin/crm/reporting/agent-activity' },
  { label: 'Properties', href: '/admin/crm/reporting/properties' },
  { label: 'Lead Sources', href: '/admin/crm/reporting/lead-sources' },
  { label: 'Calls', href: '/admin/crm/reporting/calls' },
  { label: 'Texts', href: '/admin/crm/reporting/texts' },
  { label: 'Batch Emails', href: '/admin/crm/reporting/batch-emails' },
  { label: 'Marketing', href: '/admin/crm/reporting/marketing' },
  { label: 'Deals', href: '/admin/crm/reporting/deals' },
  { label: 'Appointments', href: '/admin/crm/reporting/appointments' },
  { label: 'Agent Goals', href: '/admin/crm/reporting/agent-goals' },
]

// --- Report card data (14 reports in 3 sections) ---
const AGENT_REPORTS = [
  { icon: '📊', title: 'Agent Activity', description: 'See the number of leads per agent alongside stats on follow up.', href: '/admin/crm/reporting/agent-activity' },
  { icon: '📞', title: 'Calls', description: 'See calls made, conversations, missed calls, talk time and more by agent.', href: '/admin/crm/reporting/calls' },
  { icon: '📋', title: 'Call Logs', description: 'See and listen to recent inbound and outbound calls.', href: '/admin/crm/reporting/call-logs' },
  { icon: '💬', title: 'Texts', description: 'See text message delivery rates and other stats by phone number.', href: '/admin/crm/reporting/texts' },
  { icon: '📅', title: 'Appointments', description: 'See a list of appointments & outcomes with details on lead source and agent.', href: '/admin/crm/reporting/appointments' },
  { icon: '💰', title: 'Deals', description: 'See a list of deals with commissions by deal stage and lead source.', href: '/admin/crm/reporting/deals' },
  { icon: '📝', title: 'Agent Goals', description: 'Manage annual commission and personal goals for each agent.', href: '/admin/crm/reporting/agent-goals' },
]

const LEAD_SOURCE_REPORTS = [
  { icon: '📈', title: 'Source Report', description: 'See your top lead providers and sources of appointments.', href: '/admin/crm/reporting/lead-sources' },
  { icon: '🚀', title: 'Speed To Lead', description: 'See how quickly you follow up by source and follow up type.', href: '/admin/crm/reporting/speed-to-lead' },
  { icon: '📱', title: 'Contact Attempts', description: 'See how many times you follow up on average by source.', href: '/admin/crm/reporting/contact-attempts' },
  { icon: '🤓', title: 'Closed Deals By Source', description: 'See which lead source has the most closed deals, commission and conversion rate %.', href: '/admin/crm/reporting/lead-sources' },
]

const MARKETING_REPORTS = [
  { icon: '💌', title: 'Batch Emails', description: 'See the results of your email campaigns, opens & clicks.', href: '/admin/crm/reporting/batch-emails' },
  { icon: '🏠', title: 'Properties', description: 'See which properties and zipcodes have the most inquiries.', href: '/admin/crm/reporting/properties' },
  { icon: '🔍', title: 'Marketing UTM Report', description: 'See advanced UTM and campaign metrics and appointments & deals.', href: '/admin/crm/reporting/marketing' },
]

interface ReportCard {
  icon: string
  title: string
  description: string
  href: string
}

function ReportCardItem({ card }: { card: ReportCard }) {
  return (
    <Link href={card.href} className="group block">
      <Card className="h-full cursor-pointer p-5 transition-shadow hover:shadow-md">
        <div className="mb-2 text-xl">{card.icon}</div>
        <p className="text-base font-semibold text-foreground group-hover:underline">{card.title}</p>
        <p className="mt-1 text-sm leading-snug text-muted-foreground">{card.description}</p>
      </Card>
    </Link>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  )
}

export default async function CrmReportingPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Page title */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">Reporting</h1>
      </div>

      {/* Sub-nav tab strip */}
      <div className="mb-6 flex items-center gap-0 overflow-x-auto no-scrollbar border-b border-border">
        {REPORTING_TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="shrink-0 border-b-2 border-primary px-3 py-2.5 text-sm font-medium text-foreground"
          >
            {tab.label}
          </Link>
        ))}
        <div className="ml-auto shrink-0 pb-0.5">
          <Badge variant="outline" className="text-muted-foreground">
            ⓘ How Reporting works
          </Badge>
        </div>
      </div>

      {/* Section: Agents */}
      <section className="mb-8">
        <SectionLabel>Agents</SectionLabel>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {AGENT_REPORTS.map((card) => (
            <ReportCardItem key={card.title} card={card} />
          ))}
        </div>
      </section>

      {/* Section: Lead Sources */}
      <section className="mb-8">
        <SectionLabel>Lead Sources</SectionLabel>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {LEAD_SOURCE_REPORTS.map((card) => (
            <ReportCardItem key={card.title} card={card} />
          ))}
        </div>
      </section>

      {/* Section: Marketing */}
      <section>
        <SectionLabel>Marketing</SectionLabel>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {MARKETING_REPORTS.map((card) => (
            <ReportCardItem key={card.title} card={card} />
          ))}
        </div>
      </section>
    </div>
  )
}
