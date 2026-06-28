// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { createServiceClient } from '@/lib/supabase/service'
import { setCanExportAction, setPauseLeadsAction } from '@/app/actions/admin-broker-permissions'
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export const metadata = { title: 'Team | CRM settings' }
export const dynamic = 'force-dynamic'

/**
 * /admin/crm/settings/team — FUB-style team management table (§8.7).
 *
 * Shows every admin_roles row joined to the matching brokers row so the
 * superuser can see Name / Role / CRM Active / Routing / Can Export /
 * Pause Leads / Last Seen in one surface. The two toggles (can_export,
 * pause_leads) are flipped via superuser-only server actions.
 *
 * Identity fields (display_name, phone, Twilio number) are edited on the
 * AdminBrokerForm at /admin/brokers/edit — we link there from this page.
 */
export default async function TeamSettingsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  // Join admin_roles with brokers on email to get the full picture
  const sb = createServiceClient()
  const { data: roles } = await sb
    .from('admin_roles')
    .select(
      'id, email, role, broker_id, can_export, pause_leads, last_seen_at, last_seen_platform',
    )
    .order('role')
    .order('email')

  // Pull brokers for name + CRM fields
  const { data: brokerRows } = await sb
    .from('brokers')
    .select('id, display_name, email, crm_active, routing_eligible, crm_slug, twilio_number')

  const brokerByEmail = new Map(
    (brokerRows ?? []).map((b) => [String(b.email ?? '').toLowerCase(), b]),
  )
  const brokerById = new Map(
    (brokerRows ?? []).map((b) => [String(b.id), b]),
  )

  type TeamRow = {
    email: string
    role: string
    brokerId: string | null
    brokerName: string | null
    brokerHref: string | null
    crmActive: boolean
    routingEligible: boolean
    canExport: boolean
    pauseLeads: boolean
    lastSeenAt: string | null
    lastSeenPlatform: string | null
  }

  const rows: TeamRow[] = (roles ?? []).map((r) => {
    const email = String(r.email ?? '').toLowerCase()
    // Match broker by broker_id first, then by email
    const broker =
      r.broker_id ? (brokerById.get(String(r.broker_id)) ?? brokerByEmail.get(email)) : brokerByEmail.get(email)
    return {
      email,
      role: String(r.role ?? ''),
      brokerId: r.broker_id ? String(r.broker_id) : null,
      brokerName: broker?.display_name ?? null,
      brokerHref: broker ? `/admin/brokers/edit?id=${broker.id}` : null,
      crmActive: broker?.crm_active ?? false,
      routingEligible: broker?.routing_eligible ?? false,
      canExport: r.can_export ?? true,
      pauseLeads: r.pause_leads ?? false,
      lastSeenAt: r.last_seen_at ?? null,
      lastSeenPlatform: r.last_seen_platform ?? null,
    }
  })

  async function toggleCanExport(formData: FormData) {
    'use server'
    await setCanExportAction(formData)
  }
  async function togglePauseLeads(formData: FormData) {
    'use server'
    await setPauseLeadsAction(formData)
  }

  function roleVariant(role: string): 'default' | 'outline' | 'secondary' {
    if (role === 'superuser') return 'default'
    if (role === 'broker') return 'secondary'
    return 'outline'
  }

  function fmtLastSeen(at: string | null, platform: string | null): string {
    if (!at) return '—'
    const d = new Date(at)
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60000)
    const label =
      mins < 2 ? 'just now'
      : mins < 60 ? `${mins}m ago`
      : mins < 1440 ? `${Math.floor(mins / 60)}h ago`
      : `${Math.floor(mins / 1440)}d ago`
    return platform ? `${label} · ${platform}` : label
  }

  return (
    <SettingsSubpageShell
      title="Team"
      description="All admin users and their CRM permissions. Toggle export access and lead-routing pause state. Edit identity fields (name, phone, Twilio number) via the broker profile."
    >
      <div className="mt-4 rounded-xl border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[112px]">Name / Email</TableHead>
              <TableHead className="hidden w-28 md:table-cell">Role</TableHead>
              <TableHead className="hidden w-24 text-center md:table-cell">CRM active</TableHead>
              <TableHead className="hidden w-24 text-center md:table-cell">Routing</TableHead>
              <TableHead className="w-20 text-center text-xs md:text-sm">Export</TableHead>
              <TableHead className="w-20 text-center text-xs md:text-sm">Pause</TableHead>
              <TableHead className="hidden min-w-[130px] md:table-cell">Last seen</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No admin users found. Add users at{' '}
                  <Link href="/admin/users" className="underline">
                    /admin/users
                  </Link>
                  .
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.email}>
                  {/* Name / Email */}
                  <TableCell>
                    <div className="max-w-[108px] truncate font-medium text-foreground text-sm md:max-w-none">
                      {row.brokerName ?? '—'}
                    </div>
                    <div className="max-w-[108px] truncate text-xs text-muted-foreground md:max-w-none" title={row.email}>
                      {row.email}
                    </div>
                  </TableCell>

                  {/* Role badge */}
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={roleVariant(row.role)} className="text-xs capitalize">
                      {row.role}
                    </Badge>
                  </TableCell>

                  {/* CRM active — read-only here; edit at /admin/crm/settings/brokers */}
                  <TableCell className="hidden text-center md:table-cell">
                    <span className={`text-xs font-medium ${row.crmActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {row.crmActive ? 'Yes' : 'No'}
                    </span>
                  </TableCell>

                  {/* Routing eligible — read-only here */}
                  <TableCell className="hidden text-center md:table-cell">
                    <span className={`text-xs font-medium ${row.routingEligible ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {row.routingEligible ? 'Yes' : 'No'}
                    </span>
                  </TableCell>

                  {/* Can export toggle */}
                  <TableCell className="text-center">
                    <form action={toggleCanExport}>
                      <Input type="hidden" name="email" value={row.email} readOnly />
                      <Input type="hidden" name="value" value={row.canExport ? 'off' : 'on'} readOnly />
                      <Button
                        type="submit"
                        size="sm"
                        variant={row.canExport ? 'default' : 'outline'}
                        className="min-h-9 w-16"
                      >
                        {row.canExport ? 'Yes' : 'No'}
                      </Button>
                    </form>
                  </TableCell>

                  {/* Pause leads toggle */}
                  <TableCell className="text-center">
                    <form action={togglePauseLeads}>
                      <Input type="hidden" name="email" value={row.email} readOnly />
                      <Input type="hidden" name="value" value={row.pauseLeads ? 'off' : 'on'} readOnly />
                      <Button
                        type="submit"
                        size="sm"
                        variant={row.pauseLeads ? 'destructive' : 'outline'}
                        className="min-h-9 w-16"
                      >
                        {row.pauseLeads ? 'Paused' : 'Active'}
                      </Button>
                    </form>
                  </TableCell>

                  {/* Last seen */}
                  <TableCell className="hidden text-xs text-muted-foreground whitespace-nowrap md:table-cell">
                    {fmtLastSeen(row.lastSeenAt, row.lastSeenPlatform)}
                  </TableCell>

                  {/* Edit link */}
                  <TableCell>
                    {row.brokerHref ? (
                      <Link href={row.brokerHref}>
                        <Button variant="ghost" size="sm" className="text-xs h-7">
                          Edit
                        </Button>
                      </Link>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        CRM active and routing flags are managed at{' '}
        <Link href="/admin/crm/settings/brokers" className="underline">
          Brokers
        </Link>
        . Identity fields are managed on each{' '}
        <Link href="/admin/brokers" className="underline">
          broker profile
        </Link>
        .
      </p>
    </SettingsSubpageShell>
  )
}
