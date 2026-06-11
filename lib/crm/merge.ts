export function renderCrmMerge(
  text: string,
  person: { first_name?: string | null; name?: string | null; custom?: Record<string, unknown> },
): string {
  const first = person.first_name || (person.name ?? '').split(' ')[0] || 'there'
  const address = String(
    person.custom?.customSellerPropertyAddress ?? person.custom?.customPropertyAddress ?? '',
  )
  return text
    .replaceAll('%contact_first_name%', first)
    .replaceAll('%first%', first)
    .replaceAll('{{first_name}}', first)
    .replaceAll('{{firstName}}', first)
    .replaceAll('%customSellerPropertyAddress%', address)
    .replaceAll('%customPropertyAddress%', address)
    .replaceAll('%address%', address)
    .replaceAll('{{address}}', address)
}
