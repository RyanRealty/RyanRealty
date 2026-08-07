// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCrmAccess } from '@/app/actions/crm'
import { createServiceClient } from '@/lib/supabase/service'
import { setCanExportAction, setPauseLeadsAction } from '@/app/actions/admin-broker-permissions'
import { TeamAccessForm, RemoveAccessButton } from './TeamAccess'
import { Button, QueueRow, SectionHead, StateWord, VerdictLine } from '@/components/admin/v2'

export const metadata = { title: 'Team | CRM settings' }
export const dynamic = 'force-dynamic'

/**
 * /admin/crm/settings/team — THE single admin_roles surface (consolidation
 * 2026-07-15), migrated to the v2 admin language (11C).
 *
 * Same reads (admin_roles joined to brokers on broker_id, then email), same
 * superuser-only server actions for the can_export / pause_leads toggles, same
 * upsertAdminRole / removeAdminRole access management — now on the co-located
 * v2 client (./TeamAccess) instead of the legacy role manager. Identity fields
 * (display_name, phone, Twilio number) are still edited on the broker profile
 * at /admin/brokers/edit — the per-row Edit door is unchanged.
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

  // Both toggles post the OPPOSITE of the flag's current value, exactly as the
  // hidden `value` field did before — the same `email` + `value` payload the
  // superuser-guarded actions already parse out of FormData.
  async function toggleCanExport(email: string, value: 'on' | 'off'): Promise<void> {
    'use server'
    const formData = new FormData()
    formData.set('email', email)
    formData.set('value', value)
    await setCanExportAction(formData)
  }
  async function togglePauseLeads(email: string, value: 'on' | 'off'): Promise<void> {
    'use server'
    const formData = new FormData()
    formData.set('email', email)
    formData.set('value', value)
    await setPauseLeadsAction(formData)
  }

  function roleTone(role: string): 'accent' | 'ok' | 'waiting' {
    if (role === 'superuser') return 'accent'
    if (role === 'broker') return 'ok'
    return 'waiting'
  }

  function roleLabel(role: string): string {
    if (role === 'report_viewer') return 'Report viewer'
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'No role'
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

  const brokerOptions = (brokerRows ?? [])
    .filter((b) => b.display_name)
    .map((b) => ({ id: String(b.id), display_name: String(b.display_name) }))

  const paused = rows.filter((r) => r.pauseLeads).length

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <p style={{ margin: '0 0 8px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        <Link href="/admin/crm/settings" style={{ color: 'var(--a-text-2)' }}>
          CRM settings
        </Link>
      </p>

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={rows.length === 0 || paused > 0 ? 'attention' : 'ok'}>
          {rows.length === 0 ? (
            <>
              <b>No admin users yet.</b> Add an email and role below.
            </>
          ) : (
            <>
              <b>
                {rows.length} {rows.length === 1 ? 'person has' : 'people have'} admin access.
              </b>{' '}
              {paused > 0 ? `${paused} paused from lead routing.` : 'Nobody is paused from lead routing.'}
            </>
          )}
        </VerdictLine>
      </div>

      {rows.length > 0 ? (
        <section aria-label="Team">
          <SectionHead>Access</SectionHead>
          <ul className="av2-queue">
            {rows.map((row) => (
              <QueueRow
                key={row.email}
                kind={roleLabel(row.role)}
                kindTone={roleTone(row.role)}
                title={
                  row.brokerHref ? (
                    <Link href={row.brokerHref} style={{ color: 'var(--a-text)' }}>
                      {row.brokerName ?? row.email}
                    </Link>
                  ) : (
                    (row.brokerName ?? row.email)
                  )
                }
                context={
                  <>
                    <span style={{ overflowWrap: 'anywhere' }}>{row.email}</span>
                    {' · '}
                    {row.crmActive ? 'in CRM' : 'not in CRM'}
                    {' · '}
                    {row.routingEligible ? 'routing eligible' : 'no routing'}
                    {' · '}
                    {row.canExport ? 'can export' : 'no export'}
                    {row.pauseLeads ? (
                      <>
                        {' · '}
                        <StateWord state="slow">Leads paused</StateWord>
                      </>
                    ) : null}
                  </>
                }
                age={fmtLastSeen(row.lastSeenAt, row.lastSeenPlatform)}
                action={
                  <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <form action={toggleCanExport.bind(null, row.email, row.canExport ? 'off' : 'on')}>
                      <Button type="submit" variant="quiet">
                        {row.canExport ? 'Block export' : 'Allow export'}
                      </Button>
                    </form>
                    <form action={togglePauseLeads.bind(null, row.email, row.pauseLeads ? 'off' : 'on')}>
                      <Button type="submit" variant="quiet">
                        {row.pauseLeads ? 'Resume leads' : 'Pause leads'}
                      </Button>
                    </form>
                    {row.brokerHref ? (
                      <Link href={row.brokerHref} className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
                        Edit
                      </Link>
                    ) : null}
                    {row.role !== 'superuser' ? <RemoveAccessButton email={row.email} /> : null}
                  </span>
                }
              />
            ))}
          </ul>
        </section>
      ) : null}

      <TeamAccessForm brokers={brokerOptions} />

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        CRM active and routing flags are managed at{' '}
        <Link href="/admin/crm/settings/brokers" style={{ color: 'var(--a-accent)' }}>
          Brokers
        </Link>
        . Identity fields are managed on each{' '}
        <Link href="/admin/brokers" style={{ color: 'var(--a-accent)' }}>
          broker profile
        </Link>
        .
      </p>
    </div>
  )
}
