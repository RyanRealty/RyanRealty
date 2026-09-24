import 'server-only'

/**
 * Brokers follow Google Workspace (Matt 2026-09-24). Every hour:
 *   1. read every user in the Workspace (Admin SDK Directory, read-only, the
 *      same service account and domain-wide delegation the Gmail sync uses),
 *   2. plan (lib/brokers/workspace.ts): a new person becomes a broker with a
 *      broker login; a shared inbox is skipped; someone suspended, archived or
 *      deleted loses the login and their mailbox stops being read,
 *   3. write it, record it in public.workspace_directory, text Matt.
 *
 * A new broker's mailbox is picked up by the next Gmail sync and Vault mail
 * sweep (getCrmMailboxes reads public.brokers), and the review walk files
 * their whole history. They start outside the paid lead rotation
 * (routing_eligible false) and off the public team page (is_active false):
 * both are Matt's calls, one switch each on the broker's page.
 */
import { google } from 'googleapis'
import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'
import { ensureBrokerDirectory } from '@/lib/data/brokers/directory'
import {
  WORKSPACE_DOMAIN,
  isSharedMailbox,
  planWorkspaceSync,
  type BrokerRow,
  type RoleRow,
  type SyncPlan,
  type WorkspaceUser,
} from '@/lib/brokers/workspace'

const DIRECTORY_SCOPE = 'https://www.googleapis.com/auth/admin.directory.user.readonly'

/** The admin the service account acts as to read the Directory. */
function directorySubject(): string {
  return process.env.GOOGLE_SERVICE_ACCOUNT_SUBJECT?.trim() || `matt@${WORKSPACE_DOMAIN}`
}

/** Every user in the Workspace, all pages. `complete` is false if any page failed. */
export async function listWorkspaceUsers(): Promise<{ users: WorkspaceUser[]; complete: boolean; error: string | null }> {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const key = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').replace(/^"|"$/g, '')
  if (!clientEmail || !key) return { users: [], complete: false, error: 'Google service account not configured' }
  const auth = new google.auth.JWT({ email: clientEmail, key, scopes: [DIRECTORY_SCOPE], subject: directorySubject() })
  const admin = google.admin({ version: 'directory_v1', auth, timeout: 30_000 })
  const users: WorkspaceUser[] = []
  let pageToken: string | undefined
  try {
    do {
      const res = await admin.users.list({ customer: 'my_customer', maxResults: 200, projection: 'basic', viewType: 'admin_view', pageToken })
      for (const u of res.data.users ?? []) {
        if (!u.primaryEmail) continue
        users.push({
          id: String(u.id ?? u.primaryEmail),
          email: u.primaryEmail.toLowerCase(),
          givenName: u.name?.givenName ?? null,
          familyName: u.name?.familyName ?? null,
          fullName: u.name?.fullName ?? null,
          suspended: u.suspended === true,
          archived: u.archived === true,
          mailbox: u.isMailboxSetup !== false,
        })
      }
      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken)
    return { users, complete: true, error: null }
  } catch (e) {
    const err = e as { response?: { data?: { error?: unknown } }; message?: string }
    const detail = err.response?.data?.error
    return { users, complete: false, error: typeof detail === 'string' ? detail : JSON.stringify(detail ?? err.message ?? String(e)).slice(0, 300) }
  }
}

export type WorkspaceSyncResult = {
  ok: boolean
  dryRun: boolean
  error: string | null
  users: number
  added: Array<{ email: string; slug: string; name: string }>
  granted: string[]
  removed: Array<{ email: string; reason: string }>
  skipped: Array<{ email: string; reason: string }>
}

/** Run the sync. `dryRun` plans and returns without writing. */
export async function runWorkspaceBrokerSync(opts: { dryRun?: boolean } = {}): Promise<WorkspaceSyncResult> {
  const sb = createServiceClient()
  const listed = await listWorkspaceUsers()
  const base: WorkspaceSyncResult = { ok: false, dryRun: !!opts.dryRun, error: listed.error, users: listed.users.length, added: [], granted: [], removed: [], skipped: [] }
  // Nothing is decided from a Directory read that failed outright.
  if (!listed.users.length) return base

  const [{ data: brokerRows, error: bErr }, { data: roleRows, error: rErr }, { data: dirRows, error: dErr }] = await Promise.all([
    sb.from('brokers').select('id, slug, crm_slug, email, display_name, sort_order'),
    sb.from('admin_roles').select('email, role, broker_id'),
    sb.from('workspace_directory').select('email, status'),
  ])
  const readError = bErr?.message ?? rErr?.message ?? dErr?.message ?? null
  if (readError) return { ...base, error: readError }

  const brokers: BrokerRow[] = (brokerRows ?? []).map((b) => ({ id: String(b.id), slug: String(b.crm_slug ?? b.slug), email: (b.email as string | null) ?? null, displayName: String(b.display_name ?? '') }))
  const roles: RoleRow[] = (roleRows ?? []).map((r) => ({ email: String(r.email), role: String(r.role), brokerId: (r.broker_id as string | null) ?? null }))
  const removedOnPurpose = new Set((dirRows ?? []).filter((d) => d.status === 'removed').map((d) => String(d.email).toLowerCase()))
  const plan: SyncPlan = planWorkspaceSync({ users: listed.users, complete: listed.complete, brokers, roles, removedOnPurpose })

  const result: WorkspaceSyncResult = {
    ...base,
    ok: true,
    added: plan.add.map((a) => ({ email: a.user.email, slug: a.slug, name: a.displayName })),
    granted: plan.grant.map((g) => g.broker.email ?? g.broker.slug),
    removed: plan.remove.map((r) => ({ email: r.email, reason: r.reason })),
    skipped: plan.skipped,
  }
  if (opts.dryRun) return result

  const now = new Date().toISOString()
  const seen = new Map(listed.users.map((u) => [u.email, u]))
  const touch = async (email: string, patch: Record<string, unknown>) => {
    const u = seen.get(email)
    await sb.from('workspace_directory').upsert(
      { email, google_user_id: u?.id ?? null, full_name: u?.fullName ?? null, last_seen_at: now, ...patch },
      { onConflict: 'email' },
    )
  }

  const nextSort = Math.max(0, ...(brokerRows ?? []).map((b) => Number((b as { sort_order?: number }).sort_order ?? 0))) + 1
  for (const [i, a] of plan.add.entries()) {
    const publicSlug = `${a.displayName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}` || a.slug
    const { data: row, error } = await sb
      .from('brokers')
      .insert({
        slug: publicSlug,
        crm_slug: a.slug,
        display_name: a.displayName,
        email: a.user.email,
        sort_order: nextSort + i,
        is_active: false, // off the public team page until the profile is filled in
        crm_active: true,
        routing_eligible: false, // out of the paid lead rotation until Matt adds them
      })
      .select('id')
      .single()
    if (error || !row) {
      result.error = `add ${a.user.email}: ${error?.message ?? 'no row'}`
      continue
    }
    await sb.from('admin_roles').upsert({ email: a.user.email, role: 'broker', broker_id: row.id, updated_at: now }, { onConflict: 'email' })
    await touch(a.user.email, { status: 'active', broker_id: row.id, provisioned_at: now })
  }
  for (const g of plan.grant) {
    if (!g.broker.email) continue
    await sb.from('admin_roles').upsert({ email: g.broker.email, role: 'broker', broker_id: g.broker.id, updated_at: now }, { onConflict: 'email' })
    await sb.from('brokers').update({ crm_active: true }).eq('id', g.broker.id)
    await touch(g.broker.email.toLowerCase(), { status: 'active', broker_id: g.broker.id, provisioned_at: now })
  }
  for (const r of plan.remove) {
    await sb.from('admin_roles').delete().eq('email', r.email).neq('role', 'superuser')
    if (r.brokerId) await sb.from('brokers').update({ crm_active: false, routing_eligible: false }).eq('id', r.brokerId)
    else await sb.from('brokers').update({ crm_active: false, routing_eligible: false }).eq('email', r.email)
    await touch(r.email, { status: 'gone', removed_at: now, removed_by: 'workspace-sync', note: r.reason })
  }
  for (const u of listed.users) if (isSharedMailbox(u)) await touch(u.email, { status: 'shared' })

  if (plan.add.length || plan.grant.length || plan.remove.length) {
    revalidateTag('crm-brokers', 'max')
    await ensureBrokerDirectory({ force: true })
    const lines = [
      ...plan.add.map((a) => `Added ${a.displayName} (${a.user.email}) as a broker: login, mail filing and their own files and leads are on. Not in the lead rotation or on the team page yet.`),
      ...plan.grant.map((g) => `Gave ${g.broker.displayName} (${g.broker.email}) a broker login.`),
      ...plan.remove.map((r) => `Removed the login for ${r.email} (${r.reason}); their mail is no longer read.`),
    ]
    await queueBrokerHealthAlert({ key: `workspace-sync-${now.slice(0, 13)}`, body: `Ryan Realty team: ${lines.join(' ')}`, cooldownMinutes: 1 })
  }
  return result
}

/**
 * The team page's side of the one decision a person makes: an address whose
 * login was removed by hand is never re-added; one given a login by hand is
 * active again.
 */
export async function recordTeamPageDecision(email: string, decision: 'removed' | 'active', by: string): Promise<void> {
  const e = email.trim().toLowerCase()
  if (!e.endsWith(`@${WORKSPACE_DOMAIN}`)) return
  const now = new Date().toISOString()
  await createServiceClient()
    .from('workspace_directory')
    .upsert(
      decision === 'removed'
        ? { email: e, status: 'removed', removed_at: now, removed_by: by, last_seen_at: now }
        : { email: e, status: 'active', removed_at: null, removed_by: null, last_seen_at: now },
      { onConflict: 'email' },
    )
}
