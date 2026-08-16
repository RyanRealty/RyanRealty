// @no-parity — internal admin surface, no public mockup contract
// Settings (P9 roll:remaining-families, IA lock 2026-08-05): configure the
// machine — one config hub over messaging, compliance, routing, data model,
// team, and system doors (sequence authoring lives here per the IA lock;
// monitoring stays in Oversight). Rows are capability-filtered so nothing
// shown dead-ends. The personal account page moved to /admin/settings/account.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { hasCapability, type Capability } from '@/lib/admin/capabilities'
import { VerdictLine } from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

type Door = { name: string; href: string; what: string; cap: Capability }
type Group = { title: string; doors: Door[] }

const GROUPS: Group[] = [
  {
    title: 'You',
    doors: [
      { name: 'My account', href: '/admin/settings/account', what: 'Notifications, signature, socials, day one.', cap: 'settings.account' },
    ],
  },
  {
    title: 'Messaging',
    doors: [
      { name: 'Templates', href: '/admin/crm/settings/templates', what: 'Every canned message, one library.', cap: 'settings.templates' },
      { name: 'Sequence authoring', href: '/admin/crm/sequences', what: 'Write and edit automated sequences (monitoring lives in Oversight).', cap: 'settings.automations' },
    ],
  },
  {
    title: 'Compliance',
    doors: [
      { name: 'Suppression list', href: '/admin/crm/settings/suppression', what: 'Who we must never text or email, and why.', cap: 'settings.compliance' },
      { name: 'Block list', href: '/admin/crm/settings/company/block-list', what: 'Company-wide hard blocks.', cap: 'settings.compliance' },
    ],
  },
  {
    title: 'Routing & intake',
    doors: [
      { name: 'Assignment', href: '/admin/crm/settings/assignment', what: 'Who gets which new lead.', cap: 'settings.routing' },
      { name: 'Lead flows', href: '/admin/crm/settings/lead-flows', what: 'Per-source intake behavior.', cap: 'settings.routing' },
      { name: 'Ponds', href: '/admin/crm/settings/ponds', what: 'Shared unassigned pools.', cap: 'settings.routing' },
    ],
  },
  {
    title: 'Data model',
    doors: [
      { name: 'Stages', href: '/admin/crm/settings/stages', what: 'The pipeline vocabulary.', cap: 'settings.stages' },
      { name: 'Tags', href: '/admin/crm/settings/tags', what: 'Freeform labels, governed.', cap: 'settings.stages' },
      { name: 'Custom fields', href: '/admin/crm/settings/custom-fields', what: 'Extra person fields.', cap: 'settings.stages' },
      { name: 'Groups', href: '/admin/crm/settings/groups', what: 'People groupings.', cap: 'settings.stages' },
      { name: 'Areas', href: '/admin/crm/settings/areas', what: 'Geography vocabulary for people.', cap: 'settings.stages' },
      { name: 'Appointments', href: '/admin/crm/settings/appointments', what: 'Appointment types + outcomes.', cap: 'settings.appointments' },
    ],
  },
  {
    title: 'Team & company',
    doors: [
      { name: 'Brokers', href: '/admin/brokers', what: 'Roster, profiles, licenses.', cap: 'settings.profile' },
      { name: 'Site users', href: '/admin/users', what: 'Admin access and roles.', cap: 'settings.team' },
      { name: 'Company', href: '/admin/crm/settings/company', what: 'Company record + registration.', cap: 'settings.company' },
    ],
  },
  {
    title: 'System',
    doors: [
      { name: 'CRM settings launchpad', href: '/admin/crm/settings', what: 'The full 19-card configuration surface.', cap: 'settings.crm' },
      { name: 'Audit log', href: '/admin/audit-log', what: 'Who changed what, when.', cap: 'audit.view' },
    ],
  },
]

export default async function SettingsHubPage() {
  const ctx = await requireAdminPage('settings.view')
  const groups = GROUPS.map((g) => ({ ...g, doors: g.doors.filter((d) => hasCapability(ctx, d.cap)) })).filter(
    (g) => g.doors.length > 0,
  )
  const total = groups.reduce((n, g) => n + g.doors.length, 0)

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone="ok">
          <b>Configure the machine.</b> {total} doors you hold, grouped by job.
        </VerdictLine>
      </div>

      {groups.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <h2 className="av2-lane-head">{g.title}</h2>
          <ul className="av2-quietlist">
            {g.doors.map((d) => (
              <li key={d.href} className="av2-quiet">
                <Link href={d.href} className="av2-quiet__name" style={{ textDecoration: 'none', color: 'var(--a-text)', minWidth: 190 }}>
                  {d.name}
                </Link>
                <span style={{ color: 'var(--a-text-2)' }}>{d.what}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
