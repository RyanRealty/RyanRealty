/**
 * Who the brokers are, for code that has to answer synchronously: which files
 * a broker sees, whose mailbox a message came from, which slug a lead may be
 * assigned to. (Matt 2026-09-24: a broker added in Google is set up with no
 * deploy; lib/brokers/workspace.ts adds the row.)
 *
 * The three founding brokers are seeded here, and their seeded file names win
 * (Rebecca's profile says "Rebecca Ryser Peterson"; her files say "Rebecca
 * Peterson"). Everyone else comes from public.brokers, loaded into this module
 * by lib/data/brokers/directory.ts (ensureBrokerDirectory), which every admin
 * request and every mail cron awaits first. Until it is loaded, an unknown
 * broker maps to nothing: they see no files rather than someone else's.
 */

export type DirectoryBroker = {
  /** CRM slug (brokers.crm_slug): assigned_broker, broker: tags, admin scope. */
  slug: string
  /** The name deals carry in tc_deals.broker_name. */
  fileName: string
  email: string | null
  active: boolean
}

export const SEEDED_BROKERS: readonly DirectoryBroker[] = [
  { slug: 'matt', fileName: 'Matt Ryan', email: 'matt@ryan-realty.com', active: true },
  { slug: 'rebecca', fileName: 'Rebecca Peterson', email: 'rebeccapeterson@ryan-realty.com', active: true },
  { slug: 'paul', fileName: 'Paul Stevenson', email: 'paul@ryan-realty.com', active: true },
]

let loaded: DirectoryBroker[] | null = null
let loadedAt = 0

/** Replace the loaded directory (the loader, and tests). */
export function setBrokerDirectory(rows: readonly DirectoryBroker[] | null, at: number = Date.now()): void {
  loaded = rows ? rows.map((r) => ({ ...r, slug: r.slug.trim().toLowerCase(), email: r.email?.trim().toLowerCase() ?? null })) : null
  loadedAt = rows ? at : 0
}

export function brokerDirectoryAge(now: number = Date.now()): number | null {
  return loaded ? now - loadedAt : null
}

/**
 * Every broker: the loaded rows, then any seeded broker the table did not
 * return. A seeded broker the table marks inactive stays inactive.
 */
export function directoryBrokers(): DirectoryBroker[] {
  const rows = loaded ?? []
  const bySlug = new Map(rows.map((r) => [r.slug, r]))
  const out = [...rows]
  for (const s of SEEDED_BROKERS) if (!bySlug.has(s.slug)) out.push(s)
  // A seeded broker keeps the file name its deals carry.
  return out.map((r) => {
    const seeded = SEEDED_BROKERS.find((s) => s.slug === r.slug)
    return seeded ? { ...r, fileName: seeded.fileName, email: r.email ?? seeded.email } : r
  })
}

export function activeDirectoryBrokers(): DirectoryBroker[] {
  return directoryBrokers().filter((b) => b.active)
}

const lc = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

export function brokerBySlug(slug: string | null | undefined): DirectoryBroker | null {
  const k = lc(slug)
  return k ? directoryBrokers().find((b) => b.slug === k) ?? null : null
}

export function brokerByEmail(email: string | null | undefined): DirectoryBroker | null {
  const k = lc(email)
  return k ? directoryBrokers().find((b) => b.email === k) ?? null : null
}

export function brokerByFileName(name: string | null | undefined): DirectoryBroker | null {
  const k = lc(name)
  return k ? directoryBrokers().find((b) => b.fileName.toLowerCase() === k) ?? null : null
}

/** A slug a lead, a conversation or a scope may name: an active broker. */
export function isActiveBrokerSlug(slug: string | null | undefined): boolean {
  const b = brokerBySlug(slug)
  return !!b && b.active
}

/** Active broker slugs, founders first in their seeded order, then by name. */
export function activeBrokerSlugs(): string[] {
  const seededOrder = SEEDED_BROKERS.map((s) => s.slug)
  return activeDirectoryBrokers()
    .sort((a, b) => {
      const ia = seededOrder.indexOf(a.slug)
      const ib = seededOrder.indexOf(b.slug)
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
      return a.fileName.localeCompare(b.fileName)
    })
    .map((b) => b.slug)
}

/** The name to show for a broker slug (the name their files carry); the slug itself when unknown. */
export function brokerDisplayName(slug: string | null | undefined): string {
  return brokerBySlug(slug)?.fileName ?? (slug ?? '')
}
