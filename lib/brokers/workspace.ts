/**
 * Who works here, from Google Workspace. Pure. (Matt 2026-09-24: "as we add a
 * new broker into Google and they start getting emails from that domain, it's
 * just going to automatically pick them up, automatically file them,
 * automatically create a login for them in the CRM ... fully automated.")
 *
 * He chose: read Google's user list; every active person is a broker (own
 * files and leads) except shared inboxes; he gets a text when someone is
 * added. The reverse holds too: a person suspended, archived or deleted in
 * Google loses their login and their mailbox stops being read.
 */

export const WORKSPACE_DOMAIN = 'ryan-realty.com'

/**
 * Mailboxes that belong to a function, not a person. The Directory on
 * 2026-09-24 held admin@ ("Admin Account") and marketing@ ("Marketing Ryan");
 * the rest are the usual role addresses, so a new one never becomes a broker.
 * A person removed on the team page also stays removed (see planWorkspaceSync).
 */
export const SHARED_LOCAL_PARTS = new Set([
  'admin',
  'marketing',
  'info',
  'hello',
  'contact',
  'office',
  'support',
  'help',
  'noreply',
  'no-reply',
  'donotreply',
  'tc',
  'transactions',
  'closings',
  'listings',
  'leads',
  'team',
  'sales',
  'accounting',
  'billing',
  'careers',
  'jobs',
  'press',
  'media',
  'social',
  'webmaster',
  'postmaster',
  'test',
])

export type WorkspaceUser = {
  id: string
  email: string
  givenName: string | null
  familyName: string | null
  fullName: string | null
  suspended: boolean
  archived: boolean
  mailbox: boolean
}

export type BrokerRow = { id: string; slug: string; email: string | null; displayName: string }
export type RoleRow = { email: string; role: string; brokerId: string | null }

export function isSharedMailbox(u: Pick<WorkspaceUser, 'email' | 'fullName'>): boolean {
  const local = u.email.toLowerCase().split('@')[0] ?? ''
  if (SHARED_LOCAL_PARTS.has(local)) return true
  // A shared inbox is often named for its job ("Admin Account", "Marketing Ryan").
  return /^(admin|marketing|info|office|support|transactions?|listings)\b/i.test(u.fullName ?? '')
}

const onDomain = (email: string | null | undefined) => !!email && email.toLowerCase().endsWith(`@${WORKSPACE_DOMAIN}`)

/** A slug no other broker holds: first name, then first name + last initial, then full name, then a number. */
export function slugFor(u: Pick<WorkspaceUser, 'givenName' | 'familyName' | 'email'>, taken: ReadonlySet<string>): string {
  const clean = (s: string | null | undefined) => (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')
  const given = clean(u.givenName) || clean(u.email.split('@')[0])
  const family = clean(u.familyName)
  const tries = [given, family ? `${given}${family[0]}` : '', family ? `${given}${family}` : ''].filter(Boolean)
  for (const t of tries) if (!taken.has(t)) return t
  for (let n = 2; ; n++) if (!taken.has(`${tries[0]}${n}`)) return `${tries[0]}${n}`
}

export type SyncPlan = {
  /** A person in Google with no broker row: add the broker and a broker login. */
  add: Array<{ user: WorkspaceUser; slug: string; displayName: string }>
  /** A broker row with no login yet (never removed on purpose): give it a broker login. */
  grant: Array<{ broker: BrokerRow }>
  /** Gone from Google, suspended or archived: remove the login, stop reading the mailbox. */
  remove: Array<{ email: string; brokerId: string | null; reason: string }>
  /** In Google but a shared inbox, or removed on the team page: left alone. */
  skipped: Array<{ email: string; reason: string }>
}

/**
 * What to change so the broker list and the logins follow Google. Never
 * touches a superuser. `removedOnPurpose` holds addresses a person took off
 * the team page: those are not added back. `complete` must be true (every
 * page of the Directory read) before anyone is removed for being absent.
 */
export function planWorkspaceSync(input: {
  users: WorkspaceUser[]
  complete: boolean
  brokers: BrokerRow[]
  roles: RoleRow[]
  removedOnPurpose: ReadonlySet<string>
}): SyncPlan {
  const plan: SyncPlan = { add: [], grant: [], remove: [], skipped: [] }
  const byEmail = new Map(input.brokers.filter((b) => b.email).map((b) => [b.email!.toLowerCase(), b]))
  const roleByEmail = new Map(input.roles.map((r) => [r.email.toLowerCase(), r]))
  const taken = new Set(input.brokers.map((b) => b.slug))
  const seen = new Set<string>()

  for (const u of input.users) {
    const email = u.email.toLowerCase()
    seen.add(email)
    if (!onDomain(email)) continue
    const role = roleByEmail.get(email)
    if (role?.role === 'superuser') continue
    const inactive = u.suspended || u.archived || !u.mailbox
    if (inactive) {
      if (role) plan.remove.push({ email, brokerId: role.brokerId, reason: u.suspended ? 'suspended in Google' : u.archived ? 'archived in Google' : 'no mailbox in Google' })
      continue
    }
    if (isSharedMailbox(u)) {
      plan.skipped.push({ email, reason: 'shared inbox' })
      continue
    }
    if (input.removedOnPurpose.has(email)) {
      plan.skipped.push({ email, reason: 'removed on the team page' })
      continue
    }
    const broker = byEmail.get(email)
    if (!broker) {
      const slug = slugFor(u, taken)
      taken.add(slug)
      plan.add.push({ user: u, slug, displayName: u.fullName?.trim() || [u.givenName, u.familyName].filter(Boolean).join(' ') || email })
    } else if (!role) {
      plan.grant.push({ broker })
    }
  }

  if (input.complete) {
    for (const r of input.roles) {
      const email = r.email.toLowerCase()
      if (r.role === 'superuser' || !onDomain(email) || seen.has(email)) continue
      plan.remove.push({ email, brokerId: r.brokerId, reason: 'no longer in Google' })
    }
  }
  return plan
}
