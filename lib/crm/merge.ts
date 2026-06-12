export function renderCrmMerge(
  text: string,
  person: { first_name?: string | null; name?: string | null; custom?: Record<string, unknown> },
): string {
  const first = person.first_name || (person.name ?? '').split(' ')[0] || 'there'
  const address = String(
    person.custom?.customSellerPropertyAddress ?? person.custom?.customPropertyAddress ?? '',
  )
  const cmaLink = String(person.custom?.cmaLink ?? '')
  return text
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
}

/** True when the template references the CMA link merge token. */
export function referencesCmaLink(text: string): boolean {
  return text.includes('%cma_link%') || text.includes('{{cma_link}}')
}
