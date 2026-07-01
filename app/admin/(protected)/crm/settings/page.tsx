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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
 *
 * Layout: FUB-style grouped catalog — section headers with a responsive card
 * grid underneath. Each card = setting name + one-line description + live count
 * + chevron. Groups: Customize · Follow Up · Account · Compliance.
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

  /** A single settings panel link inside the catalog. */
  type SettingCard = {
    href: string
    title: string
    description: string
    count?: number
    countLabel: string
    icon: string
  }

  /** Top-level group of related settings panels. */
  type SettingGroup = {
    label: string
    cards: SettingCard[]
  }

  const groups: SettingGroup[] = [
    {
      label: 'Customize',
      cards: [
        {
          href: '/admin/crm/settings/stages',
          title: 'Pipeline stages',
          description: 'Add, rename, reorder, or retire the funnel stages a contact moves through.',
          count: stages.length,
          countLabel: stages.length === 1 ? 'stage' : 'stages',
          icon: '◈',
        },
        {
          href: '/admin/crm/settings/tags',
          title: 'Tags',
          description: 'Rename or merge tags across every contact. Compliance tags are protected.',
          count: tags.length,
          countLabel: tags.length === 1 ? 'tag' : 'tags',
          icon: '⊞',
        },
        {
          href: '/admin/crm/settings/custom-fields',
          title: 'Custom fields',
          description: 'The typed fields on the contact card Details section and the saved-view filter builder.',
          count: fields.length,
          countLabel: fields.length === 1 ? 'field' : 'fields',
          icon: '⊟',
        },
      ],
    },
    {
      label: 'Follow Up',
      cards: [
        {
          href: '/admin/crm/settings/templates',
          title: 'Email & SMS templates',
          description: 'The reusable copy the composer and sequence steps draw from. Edited copy runs the voice gate.',
          count: templates.length,
          countLabel: templates.length === 1 ? 'template' : 'templates',
          icon: '✉',
        },
        {
          href: '/admin/crm/settings/segments',
          title: 'Newsletter segments',
          description: 'The audience segments the newsletter targets. Move subscribers when a segment is retired.',
          count: segments.length,
          countLabel: segments.length === 1 ? 'segment' : 'segments',
          icon: '⊕',
        },
      ],
    },
    {
      label: 'Lead Distribution',
      cards: [
        {
          href: '/admin/crm/settings/lead-flows',
          title: 'Lead Flows',
          description: 'Per-source routing: send each lead source to a broker, Group, or Pond, with conditional rules that run before the global default.',
          countLabel: 'configure',
          icon: '⑃',
        },
        {
          href: '/admin/crm/settings/groups',
          title: 'Groups',
          description: 'Named broker pools for round-robin or first-to-claim distribution.',
          countLabel: 'manage',
          icon: '◇',
        },
        {
          href: '/admin/crm/settings/ponds',
          title: 'Ponds',
          description: 'Shared lead pools that any member can claim from — for nurture and farm leads.',
          countLabel: 'manage',
          icon: '≈',
        },
      ],
    },
    {
      label: 'Account',
      cards: [
        {
          href: '/admin/crm/settings/company',
          title: 'Company settings',
          description: 'Brokerage identity, address, timezone, virtual phone, call recording, and business goals.',
          countLabel: 'configure',
          icon: '⚙',
        },
        {
          href: '/admin/crm/settings/team',
          title: 'Team',
          description: 'Per-broker permissions: export access, lead-routing pause, role, and last-seen activity.',
          count: brokers.length,
          countLabel: brokers.length === 1 ? 'member' : 'members',
          icon: '◎',
        },
        {
          href: '/admin/crm/import',
          title: 'Import contacts',
          description: 'Upload a CSV to add or update contacts in bulk. Deduplicates by email and merges tags.',
          countLabel: 'wizard',
          icon: '↑',
        },
        {
          href: '/admin/crm/settings/appointments',
          title: 'Appointment types & outcomes',
          description: 'The type and outcome labels used when scheduling on the calendar.',
          countLabel: 'configure',
          icon: '◷',
        },
        {
          href: '/admin/crm/settings/brokers',
          title: 'Brokers',
          description: 'The CRM broker roster used for assignment and round-robin routing.',
          count: brokers.length,
          countLabel: brokers.length === 1 ? 'broker' : 'brokers',
          icon: '◎',
        },
        {
          href: '/admin/crm/settings/assignment',
          title: 'Lead routing',
          description: 'How a new lead is assigned to a broker. The live default routes every lead to Matt.',
          count: routing.rules.length,
          countLabel: ROUTING_LABEL[routing.strategy] ?? routing.strategy,
          icon: '⇄',
        },
        {
          href: '/admin/crm/settings/areas',
          title: 'Market-report areas',
          description: 'The areas a contact can subscribe to market reports for. Scrubbed cleanly on delete.',
          count: areas.length,
          countLabel: areas.length === 1 ? 'area' : 'areas',
          icon: '⊙',
        },
        {
          href: '/admin/crm/settings/market-reports',
          title: 'Market-report subscribers',
          description: 'Who receives the recurring market report, the areas they follow, and how often.',
          count: reportSubs.length,
          countLabel: reportSubs.length === 1 ? 'subscriber' : 'subscribers',
          icon: '◉',
        },
      ],
    },
    {
      label: 'Compliance',
      cards: [
        {
          href: '/admin/crm/settings/suppression',
          title: 'Suppression list',
          description: 'Who is blocked from email, SMS, or calls and why. Add a block or lift one with an audit trail.',
          count: suppressions.count,
          countLabel: suppressions.count === 1 ? 'suppression' : 'suppressions',
          icon: '⊗',
        },
      ],
    },
  ]

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3 md:items-end">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Admin overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every CRM building block, editable here. No SQL required.
          </p>
        </div>
        <Link href="/admin/crm" className="shrink-0">
          <Button variant="outline" size="sm" className="h-10 md:h-7">
            Back to contacts
          </Button>
        </Link>
      </div>

      {/* Grouped catalog */}
      <div className="mt-8 space-y-10">
        {groups.map((group) => (
          <section key={group.label} aria-labelledby={`section-${group.label.toLowerCase().replace(/\s+/g, '-')}`}>
            {/* Section label — FUB-style: small-caps, tracked, muted */}
            <h2
              id={`section-${group.label.toLowerCase().replace(/\s+/g, '-')}`}
              className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
            >
              {group.label}
            </h2>

            {/* Card grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.cards.map((card) => (
                <SettingCardLink key={card.href} card={card} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}

/** Individual settings panel card — icon + title + description + count + chevron. */
function SettingCardLink({
  card,
}: {
  card: {
    href: string
    title: string
    description: string
    count?: number
    countLabel: string
    icon: string
  }
}) {
  return (
    <Link
      href={card.href}
      className={cn(
        'group flex items-start gap-4 rounded-xl border border-border bg-card px-5 py-4',
        'transition-shadow hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      {/* Icon well */}
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-base text-muted-foreground"
      >
        {card.icon}
      </span>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-foreground leading-snug">{card.title}</span>
          <Badge variant="outline" className="shrink-0 tabular-nums text-xs">
            {card.count !== undefined ? <>{card.count.toLocaleString('en-US')}&nbsp;</> : null}{card.countLabel}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{card.description}</p>
      </div>

      {/* Trailing chevron */}
      <span
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      >
        ›
      </span>
    </Link>
  )
}
