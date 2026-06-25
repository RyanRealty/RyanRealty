// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getCrmStages } from '@/lib/data/crm/getCrmStages'
import { getCrmTags } from '@/lib/data/crm/getCrmTags'
import { getCrmTemplatesAdmin } from '@/lib/data/crm/getCrmTemplatesAdmin'
import { getCrmNewsletterSegments } from '@/lib/data/crm/getCrmNewsletterSegments'
import { getCrmReportAreas } from '@/lib/data/crm/getCrmReportAreas'
import { getCrmFieldDefinitions } from '@/lib/data/crm/getCrmFieldDefinitions'
import { getCrmSuppressions } from '@/lib/data/crm/getCrmSuppressions'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { getCrmAssignmentConfig } from '@/lib/data/crm/getCrmAssignmentConfig'
import { getMarketReportSubscribers } from '@/lib/data/crm/getMarketReportSubscribers'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'CRM settings | Admin' }
export const dynamic = 'force-dynamic'

/**
 * /admin/crm/settings — the Wave 2 configurability hub.
 *
 * One owner/superuser-guarded surface that links to every config sub-page, so
 * every hardcoded CRM building block (stages, tags, templates, newsletter
 * segments, market-report areas, custom fields, the suppression list, brokers)
 * is editable from the UI with no SQL. Each card shows a live count pulled from
 * the matching cached reader so the admin sees the shape of each catalog before
 * opening it.
 *
 * Access: superuser only. The destructive config here (deleting a stage, merging
 * a tag, lifting a compliance suppression) can reshape every contact, so the hub
 * itself is owner-gated; restricted brokers are redirected.
 */
export default async function CrmSettingsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  // Pull a count per catalog (each reader fails soft to []), so the hub renders
  // even if a migration has not been applied yet.
  const [stages, tags, templates, segments, areas, fields, suppressions, brokers, routing, reportSubs] = await Promise.all([
    getCrmStages(),
    getCrmTags(),
    getCrmTemplatesAdmin(),
    getCrmNewsletterSegments(),
    getCrmReportAreas(),
    getCrmFieldDefinitions(),
    getCrmSuppressions({ limit: 1 }),
    getCrmBrokers(),
    getCrmAssignmentConfig(),
    // Superuser-only hub, so null scope = brokerage-wide subscriber roster.
    getMarketReportSubscribers(null),
  ])

  const ROUTING_LABEL: Record<string, string> = {
    all_to_one: 'all to one',
    round_robin: 'round robin',
    by_source: 'by source',
  }

  const cards: Array<{
    href: string
    title: string
    description: string
    count: number
    countLabel: string
  }> = [
    {
      href: '/admin/crm/settings/stages',
      title: 'Pipeline stages',
      description: 'The funnel stages a contact moves through. Add, rename, reorder, or retire a stage.',
      count: stages.length,
      countLabel: stages.length === 1 ? 'stage' : 'stages',
    },
    {
      href: '/admin/crm/settings/tags',
      title: 'Tags',
      description: 'The tag taxonomy. Rename or merge across every contact. Compliance tags are protected.',
      count: tags.length,
      countLabel: tags.length === 1 ? 'tag' : 'tags',
    },
    {
      href: '/admin/crm/settings/templates',
      title: 'Email & SMS templates',
      description: 'The reusable copy the composer and sequence steps draw from. Edited copy runs the voice gate.',
      count: templates.length,
      countLabel: templates.length === 1 ? 'template' : 'templates',
    },
    {
      href: '/admin/crm/settings/segments',
      title: 'Newsletter segments',
      description: 'The audience segments the newsletter targets. Move subscribers when a segment is retired.',
      count: segments.length,
      countLabel: segments.length === 1 ? 'segment' : 'segments',
    },
    {
      href: '/admin/crm/settings/areas',
      title: 'Market-report areas',
      description: 'The areas a contact can subscribe to market reports for. Scrubbed cleanly on delete.',
      count: areas.length,
      countLabel: areas.length === 1 ? 'area' : 'areas',
    },
    {
      href: '/admin/crm/settings/custom-fields',
      title: 'Custom fields',
      description: 'The typed fields on the contact card Details section and the saved-view filter builder.',
      count: fields.length,
      countLabel: fields.length === 1 ? 'field' : 'fields',
    },
    {
      href: '/admin/crm/settings/suppression',
      title: 'Suppression list',
      description: 'Who is blocked from email, SMS, or calls and why. Add a block or lift one with an audit trail.',
      count: suppressions.count,
      countLabel: suppressions.count === 1 ? 'suppression' : 'suppressions',
    },
    {
      href: '/admin/crm/settings/brokers',
      title: 'Brokers',
      description: 'The CRM broker roster used for assignment and round-robin routing.',
      count: brokers.length,
      countLabel: brokers.length === 1 ? 'broker' : 'brokers',
    },
    {
      href: '/admin/crm/settings/assignment',
      title: 'Lead routing',
      description: 'How a new lead is assigned to a broker. The live default routes every lead to Matt.',
      count: routing.rules.length,
      countLabel: ROUTING_LABEL[routing.strategy] ?? routing.strategy,
    },
    {
      href: '/admin/crm/settings/market-reports',
      title: 'Market-report subscribers',
      description: 'Who receives the recurring market report, the areas they follow, and how often.',
      count: reportSubs.length,
      countLabel: reportSubs.length === 1 ? 'subscriber' : 'subscribers',
    },
  ]

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3 md:items-end">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">CRM settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every building block of the CRM, editable here. No SQL required.
          </p>
        </div>
        <Link href="/admin/crm" className="shrink-0">
          <Button variant="outline" size="sm" className="h-10 md:h-7">
            Back to contacts
          </Button>
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="block">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{c.title}</CardTitle>
                  <Badge variant="outline" className="shrink-0 tabular-nums">
                    {c.count.toLocaleString('en-US')} {c.countLabel}
                  </Badge>
                </div>
                <CardDescription>{c.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-medium text-primary">Manage {c.title.toLowerCase()} &rarr;</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  )
}
