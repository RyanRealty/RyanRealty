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
import { SectionHead, VerdictLine } from '@/components/admin/v2'

export const metadata = { title: 'CRM settings | Admin' }
export const dynamic = 'force-dynamic'

/**
 * /admin/crm/settings — the CRM configuration launchpad (P11C, v2 language).
 *
 * One owner/superuser-guarded surface that links to every config sub-page, so
 * every CRM building block (stages, tags, templates, newsletter segments,
 * market-report areas, custom fields, the suppression list, brokers) is
 * editable from the UI with no SQL. Each door shows a live count pulled from
 * the matching cached reader so the broker sees the shape of each catalog
 * before opening it.
 *
 * Access: superuser only. The destructive config here (deleting a stage, merging
 * a tag, lifting a compliance suppression) can reshape every contact, so the hub
 * itself is owner-gated; restricted brokers are redirected.
 *
 * Layout (ADMIN_UI.md pattern 3 + 6): a verdict line answers "what is this
 * screen" in one sentence, then quiet grouped door rows — every door name is a
 * link, every count is a figure. No page-title chrome, no cards, no chip walls.
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

  /** A single settings door inside the catalog. */
  type SettingDoor = {
    href: string
    title: string
    description: string
    count?: number
    countLabel: string
  }

  /** Top-level group of related settings doors. */
  type SettingGroup = {
    label: string
    doors: SettingDoor[]
  }

  const groups: SettingGroup[] = [
    {
      label: 'Customize',
      doors: [
        {
          href: '/admin/crm/settings/stages',
          title: 'Pipeline stages',
          description: 'Add, rename, reorder, or retire the funnel stages a contact moves through.',
          count: stages.length,
          countLabel: stages.length === 1 ? 'stage' : 'stages',
        },
        {
          href: '/admin/crm/settings/tags',
          title: 'Tags',
          description: 'Rename or merge tags across every contact. Compliance tags are protected.',
          count: tags.length,
          countLabel: tags.length === 1 ? 'tag' : 'tags',
        },
        {
          href: '/admin/crm/settings/custom-fields',
          title: 'Custom fields',
          description: 'The typed fields on the contact card Details section and the saved-view filter builder.',
          count: fields.length,
          countLabel: fields.length === 1 ? 'field' : 'fields',
        },
      ],
    },
    {
      label: 'Follow Up',
      doors: [
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
      ],
    },
    {
      label: 'Lead Distribution',
      doors: [
        {
          href: '/admin/crm/settings/lead-flows',
          title: 'Lead Flows',
          description: 'Per-source routing: send each lead source to a broker, Group, or Pond, with conditional rules that run before the global default.',
          countLabel: 'configure',
        },
        {
          href: '/admin/crm/settings/groups',
          title: 'Groups',
          description: 'Named broker pools for round-robin or first-to-claim distribution.',
          countLabel: 'manage',
        },
        {
          href: '/admin/crm/settings/ponds',
          title: 'Ponds',
          description: 'Shared lead pools that any member can claim from — for nurture and farm leads.',
          countLabel: 'manage',
        },
      ],
    },
    {
      label: 'Account',
      doors: [
        {
          href: '/admin/crm/settings/company',
          title: 'Company settings',
          description: 'Brokerage identity, address, timezone, virtual phone, call recording, and business goals.',
          countLabel: 'configure',
        },
        {
          href: '/admin/crm/settings/team',
          title: 'Team',
          description: 'Admin access and roles, plus per-broker permissions: export access, lead-routing pause, and last-seen activity.',
          count: brokers.length,
          countLabel: brokers.length === 1 ? 'member' : 'members',
        },
        {
          href: '/admin/crm/import',
          title: 'Import contacts',
          description: 'Upload a CSV to add or update contacts in bulk. Deduplicates by email and merges tags.',
          countLabel: 'wizard',
        },
        {
          href: '/admin/crm/settings/appointments',
          title: 'Appointment types & outcomes',
          description: 'The type and outcome labels used when scheduling on the calendar.',
          countLabel: 'configure',
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
          href: '/admin/crm/settings/areas',
          title: 'Market-report areas',
          description: 'The areas a contact can subscribe to market reports for. Scrubbed cleanly on delete.',
          count: areas.length,
          countLabel: areas.length === 1 ? 'area' : 'areas',
        },
        {
          href: '/admin/crm/settings/market-reports',
          title: 'Market-report subscribers',
          description: 'Who receives the recurring market report, the areas they follow, and how often.',
          count: reportSubs.length,
          countLabel: reportSubs.length === 1 ? 'subscriber' : 'subscribers',
        },
      ],
    },
    {
      label: 'Compliance',
      doors: [
        {
          href: '/admin/crm/settings/suppression',
          title: 'Suppression list',
          description: 'Who is blocked from email, SMS, or calls and why. Add a block or lift one with an audit trail.',
          count: suppressions.count,
          countLabel: suppressions.count === 1 ? 'suppression' : 'suppressions',
        },
      ],
    },
  ]

  const total = groups.reduce((n, g) => n + g.doors.length, 0)

  return (
    <div className="av2-scope" style={{ maxWidth: 880, margin: '0 auto', padding: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          margin: '0 0 14px',
        }}
      >
        <VerdictLine tone="ok">
          <b>Configure the CRM.</b> {total} doors, grouped by job. No SQL required.
        </VerdictLine>
        <Link
          href="/admin/crm"
          style={{ color: 'var(--a-accent)', textDecoration: 'none', fontSize: 'var(--a-text-sm)' }}
        >
          Back to contacts
        </Link>
      </div>

      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <SectionHead>{group.label}</SectionHead>
          <ul className="av2-quietlist">
            {group.doors.map((door) => (
              <li key={door.href} className="av2-quiet" style={{ flexWrap: 'wrap' }}>
                <Link
                  href={door.href}
                  className="av2-quiet__name"
                  style={{ textDecoration: 'none', color: 'var(--a-text)', minWidth: 190, flex: 'none' }}
                >
                  {door.title}
                </Link>
                <span style={{ color: 'var(--a-text-2)', flex: '1 1 200px', minWidth: 0 }}>
                  {door.description}
                </span>
                <span
                  className="av2-quiet__fig"
                  style={{ whiteSpace: 'nowrap', paddingLeft: 12, flex: 'none' }}
                >
                  {door.count !== undefined ? `${door.count.toLocaleString('en-US')} ` : ''}
                  {door.countLabel}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
