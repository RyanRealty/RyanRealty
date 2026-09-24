import 'server-only'

/**
 * Loads public.brokers into lib/brokers/directory.ts, so the synchronous
 * questions (which files a broker sees, whose mailbox this is, may a lead be
 * assigned to this slug) know about a broker added from Google Workspace
 * without a deploy. Every admin request (getAdminContext) and every mail cron
 * awaits it; it reads the table at most every five minutes per instance.
 *
 * If the table cannot be read, the last good load stays; with none, the
 * three founding brokers answer (the state before 2026-09-24).
 */
import { createServiceClient } from '@/lib/supabase/service'
import { activeBrokerSlugs, activeDirectoryBrokers, brokerDirectoryAge, setBrokerDirectory, type DirectoryBroker } from '@/lib/brokers/directory'
import { WORKSPACE_DOMAIN } from '@/lib/brokers/workspace'

const TTL_MS = 5 * 60_000
let inflight: Promise<void> | null = null

export async function ensureBrokerDirectory(opts: { force?: boolean } = {}): Promise<void> {
  const age = brokerDirectoryAge()
  if (!opts.force && age != null && age < TTL_MS) return
  inflight ??= (async () => {
    try {
      const { data, error } = await createServiceClient()
        .from('brokers')
        .select('crm_slug, display_name, email, crm_active')
        .not('crm_slug', 'is', null)
      if (error) throw new Error(error.message)
      const rows: DirectoryBroker[] = (data ?? []).map((r) => ({
        slug: String(r.crm_slug),
        fileName: String(r.display_name || r.crm_slug),
        email: (r.email as string | null) ?? null,
        active: r.crm_active !== false,
      }))
      setBrokerDirectory(rows)
    } catch (e) {
      console.warn('[broker-directory] kept the previous load:', e instanceof Error ? e.message : e)
    } finally {
      inflight = null
    }
  })()
  await inflight
}

/**
 * The mailboxes the Gmail sync, the Vault mail sweep and the review walk
 * read: every active broker with an address on the Workspace domain.
 */
export async function getCrmMailboxes(): Promise<Array<{ email: string; slug: string }>> {
  await ensureBrokerDirectory()
  const order = activeBrokerSlugs()
  return activeDirectoryBrokers()
    .filter((b) => b.email && b.email.endsWith(`@${WORKSPACE_DOMAIN}`))
    .sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug))
    .map((b) => ({ email: b.email!, slug: b.slug }))
}

/** A broker's own sending mailbox, or null when the slug is not an active broker on the domain. */
export async function ownMailboxForSlug(slug: string | null | undefined): Promise<{ email: string; slug: string } | null> {
  const key = (slug ?? '').trim().toLowerCase()
  if (!key) return null
  return (await getCrmMailboxes()).find((m) => m.slug === key) ?? null
}

/**
 * The mailbox to send from for a broker: their own, else the founding
 * mailbox (what every caller did before 2026-09-24 for a slug it did not
 * know). A broker added from Google now resolves to their own.
 */
export async function mailboxForSlug(slug: string | null | undefined): Promise<{ email: string; slug: string }> {
  const own = await ownMailboxForSlug(slug)
  if (own) return own
  const all = await getCrmMailboxes()
  return all.find((m) => m.slug === 'matt') ?? all[0] ?? { email: 'matt@ryan-realty.com', slug: 'matt' }
}
