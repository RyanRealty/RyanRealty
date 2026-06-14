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
export function attributeSiteLinks(text: string, brokerSlug: string | null | undefined): string {
  const slug = (brokerSlug ?? '').trim()
  if (!slug) return text
  return text.replace(/https:\/\/(?:www\.)?ryan-realty\.com[^\s"'<)\]]*/g, (url) => {
    if (url.includes('/admin') || /[?&]agent=/.test(url)) return url
    return url + (url.includes('?') ? '&' : '?') + 'agent=' + encodeURIComponent(slug)
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
