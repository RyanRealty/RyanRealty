/**
 * Native lead capture. Creates or reuses a crm_people row via ensureNativeLead.
 * This is the one public write entry for site / LP / webhook leads.
 */

const PLACEHOLDER_EMAIL_RE = /@placeholder\.ryan-realty\.com$/i

/** Synthetic @placeholder.ryan-realty.com addresses — not deliverable, not a dedup key. */
export function isPlaceholderLeadEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false
  return PLACEHOLDER_EMAIL_RE.test(email.trim())
}

export type LeadEventPerson = {
  id?: number
  firstName?: string
  lastName?: string
  emails?: Array<{ value: string }>
  phones?: Array<{ value: string }>
  assignedTo?: string
  assignedUserId?: number
  tags?: string[]
}

export type LeadProperty = {
  street?: string
  city?: string
  state?: string
  code?: string
  mlsNumber?: string
  price?: number
  url?: string
  bedrooms?: string
  bathrooms?: string
  area?: string
}

export type SendEventParams = {
  type: 'Registration' | 'General Inquiry' | 'Property Inquiry' | 'Viewed Property' | 'Saved Property' | 'Visited Website' | 'Property Search' | 'Saved Property Search' | 'Viewed Page' | 'Seller Inquiry' | 'Visited Open House' | 'Incoming Call' | 'Unsubscribed'
  person: LeadEventPerson
  source: string
  system?: string
  sourceUrl?: string
  message?: string
  property?: LeadProperty
  pageUrl?: string
  pageTitle?: string
  brokerAttribution?: {
    brokerSlug: string
    brokerEmail?: string
  }
  campaign?: {
    source?: string
    medium?: string
    campaign?: string
    term?: string
    content?: string
  }
}

/**
 * Capture a site event as a native CRM lead (creates or reuses the person).
 * Use type "Registration" for sign-ups; matching is by email to avoid duplicates.
 */
export async function sendEvent(params: SendEventParams): Promise<{ ok: true; status: number; personId: number | null } | { ok: false; status?: number; error?: string }> {
  try {
    const email = params.person?.emails?.[0]?.value ?? null
    const phone = params.person?.phones?.[0]?.value ?? null
    const name = [params.person?.firstName, params.person?.lastName].filter(Boolean).join(' ').trim() || null
    const t = params.type
    const audience: 'seller' | 'buyer' | null =
      t === 'Seller Inquiry'
        ? 'seller'
        : t === 'Property Inquiry' || t === 'Viewed Property' || t === 'Saved Property' || t === 'Property Search' || t === 'Saved Property Search'
          ? 'buyer'
          : null
    const tags = [audience ? `audience:${audience}` : null, params.source ? `source:${params.source}` : null].filter(
      (x): x is string => Boolean(x),
    )
    const slug = params.brokerAttribution?.brokerSlug
    const assignedBroker = slug === 'matt' || slug === 'rebecca' || slug === 'paul' ? slug : undefined
    const { ensureNativeLead } = await import('@/lib/data/crm/ensureNativeLead')
    const native = await ensureNativeLead({ name, email, phone, source: params.source, tags, assignedBroker })
    return { ok: true, status: 200, personId: native.personId > 0 ? native.personId : null }
  } catch (err) {
    console.error('[sendEvent] capture failed:', err)
    return { ok: false, error: 'native capture failed' }
  }
}

/**
 * After a user signs in or signs up, capture them as a native CRM lead.
 * sourceUrl / message / campaign stay on the signature for existing callers
 * and are not forwarded.
 */
export async function trackSignedInUser(params: {
  email: string
  firstName?: string
  lastName?: string
  fullName?: string
  sourceUrl?: string
  message?: string
  campaign?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string }
}): Promise<void> {
  const email = params.email?.trim()
  if (!email) return

  let firstName = params.firstName?.trim()
  let lastName = params.lastName?.trim()
  if ((!firstName || !lastName) && params.fullName?.trim()) {
    const parts = String(params.fullName).trim().split(/\s+/)
    firstName = firstName ?? parts[0]
    lastName = lastName ?? (parts.length > 1 ? parts.slice(1).join(' ') : '')
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || params.fullName?.trim() || null
  try {
    const { ensureNativeLead } = await import('@/lib/data/crm/ensureNativeLead')
    await ensureNativeLead({ name: fullName, email, source: 'website-signup', tags: ['source:website-signup'] })
  } catch (err) {
    console.warn('[trackSignedInUser] native capture failed:', err)
  }
}
