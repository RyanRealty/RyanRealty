/**
 * MERGE_TOKENS — the canonical list of every token renderCrmMerge resolves.
 * Exported so UI components (MergeFieldPicker, TemplateEditor) can render a
 * click-to-insert chip palette without duplicating the token list.
 *
 * group (§13.3 catalog):
 *   'contact'      — contact/person fields
 *   'agent'        — assigned agent fields
 *   'sender'       — sending broker fields (may differ from assigned agent)
 *   'company'      — company fields from contact record
 *   'lender'       — assigned lender fields
 *   'property'     — listing/property address fields
 *   'lead_source'  — lead source name + campaign
 *   'cma'          — CMA delivery links
 *   'other'        — miscellaneous (greeting, etc.)
 */
export type MergeToken = {
  token: string
  label: string
  group: 'contact' | 'agent' | 'sender' | 'company' | 'lender' | 'property' | 'lead_source' | 'cma' | 'other'
}

export const MERGE_TOKENS: MergeToken[] = [
  // CONTACT
  { token: '%contact_first_name%', label: 'First name', group: 'contact' },
  { token: '%contact_last_name%', label: 'Last name', group: 'contact' },
  { token: '%contact_email%', label: 'Email', group: 'contact' },
  { token: '%contact_phone%', label: 'Phone', group: 'contact' },
  { token: '%contact_stage%', label: 'Stage', group: 'contact' },
  { token: '%contact_address_street%', label: 'Street', group: 'contact' },
  { token: '%contact_address_city%', label: 'City', group: 'contact' },
  { token: '%contact_address_state%', label: 'State', group: 'contact' },
  { token: '%contact_address_zip%', label: 'Zip', group: 'contact' },
  { token: '%contact_address_full%', label: 'Full address', group: 'contact' },

  // AGENT (assigned agent on the contact)
  { token: '%agent_first_name%', label: 'Agent first name', group: 'agent' },
  { token: '%agent_last_name%', label: 'Agent last name', group: 'agent' },
  { token: '%agent_email%', label: 'Agent email', group: 'agent' },
  { token: '%agent_phone%', label: 'Agent phone', group: 'agent' },
  { token: '%agent_title%', label: 'Agent title', group: 'agent' },
  { token: '%agent_brokerage%', label: 'Brokerage', group: 'agent' },
  { token: '%agent_website%', label: 'Website', group: 'agent' },

  // SENDER (the broker actually sending, may differ from assigned agent)
  { token: '%sender_first_name%', label: 'Sender first name', group: 'sender' },
  { token: '%sender_last_name%', label: 'Sender last name', group: 'sender' },
  { token: '%sender_email%', label: 'Sender email', group: 'sender' },
  { token: '%sender_phone%', label: 'Sender phone', group: 'sender' },

  // COMPANY
  { token: '%company_name%', label: 'Company name', group: 'company' },
  { token: '%company_address%', label: 'Company address', group: 'company' },

  // LENDER
  { token: '%lender_first_name%', label: 'Lender first name', group: 'lender' },
  { token: '%lender_last_name%', label: 'Lender last name', group: 'lender' },
  { token: '%lender_email%', label: 'Lender email', group: 'lender' },
  { token: '%lender_phone%', label: 'Lender phone', group: 'lender' },

  // PROPERTY / listing context
  { token: '%customSellerPropertyAddress%', label: 'Seller property address', group: 'property' },
  { token: '%customPropertyAddress%', label: 'Property address', group: 'property' },
  { token: '%address%', label: 'Address (short)', group: 'property' },
  { token: '%property_price%', label: 'Listing price', group: 'property' },
  { token: '%property_mls_number%', label: 'MLS number', group: 'property' },
  { token: '%last_viewed_address%', label: 'Last viewed address', group: 'property' },

  // LEAD SOURCE
  { token: '%lead_source_name%', label: 'Lead source', group: 'lead_source' },
  { token: '%lead_source_campaign%', label: 'Campaign', group: 'lead_source' },

  // CMA
  { token: '%cma_link%', label: 'CMA link', group: 'cma' },

  // OTHER
  { token: '%greeting%', label: 'Greeting', group: 'other' },
]

export function renderCrmMerge(
  text: string,
  person: { first_name?: string | null; name?: string | null; custom?: Record<string, unknown> },
): string {
  const first = person.first_name || (person.name ?? '').split(' ')[0] || 'there'
  const address = String(
    person.custom?.customSellerPropertyAddress ?? person.custom?.customPropertyAddress ?? '',
  )
  const cmaLink = String(person.custom?.cmaLink ?? '')
  const out = text
    .replaceAll('%contact_first_name%', first)
    .replaceAll('%first%', first)
    .replaceAll('{{first_name}}', first)
    .replaceAll('{{firstName}}', first)
    .replaceAll('%customSellerPropertyAddress%', address)
    .replaceAll('%customPropertyAddress%', address)
    .replaceAll('%address%', address)
    .replaceAll('{{address}}', address)
    .replaceAll('%cma_link%', cmaLink)
    .replaceAll('{{cma_link}}', cmaLink)
  // Generic custom-field tokens (%customBuyerSearchAreas%, {{customX}}, …) —
  // resolved from person.custom; unknown/empty tokens stay literal so the
  // composer's unresolved-token warning can catch them before send.
  const custom = (k: string): string | null => {
    const v = person.custom?.[k]
    return v === null || v === undefined || v === '' ? null : String(v)
  }
  return out
    .replace(/%(custom[A-Za-z0-9_]+)%/g, (m, k: string) => custom(k) ?? m)
    .replace(/\{\{(custom[A-Za-z0-9_]+)\}\}/g, (m, k: string) => custom(k) ?? m)
}

/**
 * Stamp the assigned broker onto every public ryan-realty.com link in an
 * outbound message. The ?agent= param sets the 90-day rr_agent_attribution
 * cookie (AgentAttributionBridge), so the site features THAT broker in lead
 * routing and broker-facing CTAs when the lead clicks through from CRM
 * comms. Admin links and links that already carry an agent are untouched.
 */
export function attributeSiteLinks(
  text: string,
  brokerSlug: string | null | undefined,
  fubPersonId?: number | null,
): string {
  const slug = (brokerSlug ?? '').trim()
  const fuid = typeof fubPersonId === 'number' && Number.isInteger(fubPersonId) && fubPersonId > 0 ? String(fubPersonId) : ''
  if (!slug && !fuid) return text
  return text.replace(/https:\/\/(?:www\.)?ryan-realty\.com[^\s"'<)\]]*/g, (url) => {
    if (url.includes('/admin')) return url
    let out = url
    // Agent attribution — routes the lead to the broker whose email this is.
    if (slug && !/[?&]agent=/.test(out)) out += (out.includes('?') ? '&' : '?') + 'agent=' + encodeURIComponent(slug)
    // Recipient identity — every click on a link WE sent stamps ?_fuid=<id>, so
    // FubIdentityBridge cookies this browser to the contact and backfills their
    // anonymous sessions. This is what turns "Anonymous · Portland" into a name.
    if (fuid && !/[?&]_fuid=/.test(out)) out += (out.includes('?') ? '&' : '?') + '_fuid=' + fuid
    return out
  })
}

/** Merge tokens still present after rendering — surfaced as a composer warning
 *  and (since 2026-06-13) a hard fail-closed gate before any automated send.
 *  Covers %x% / %word% (single char allowed — the {{}} arm always did), {{x}},
 *  Mailchimp *|X|*, and ${x}. Bare [x] / {x} are intentionally NOT matched:
 *  they collide with normal prose + markdown and would block legitimate copy. */
export function findUnresolvedMergeTokens(text: string): string[] {
  const hits = new Set<string>()
  const re = /%[A-Za-z][A-Za-z0-9_]*%|\{\{[A-Za-z][A-Za-z0-9_]*\}\}|\*\|[A-Za-z][A-Za-z0-9_]*\|\*|\$\{[A-Za-z][A-Za-z0-9_]*\}/g
  for (const m of text.matchAll(re)) hits.add(m[0])
  return [...hits]
}

/** True when the template references the CMA link merge token. */
export function referencesCmaLink(text: string): boolean {
  return text.includes('%cma_link%') || text.includes('{{cma_link}}')
}
