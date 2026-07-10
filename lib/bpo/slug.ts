/**
 * Stable BPO slug from a subject address. One property → one slug → one row
 * (rebuilds upsert in place). Prefixed `bpo-` so it never collides with a CMA
 * slug for the same address.
 */
export function slugifyBpoAddress(address: string): string {
  const base = address
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/\b(or|oregon|usa?)\b/g, ' ')
    .replace(/\b9\d{4}(-\d{4})?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
  const slug = `bpo-${base}`
  return slug.length > 50 ? slug.slice(0, 50).replace(/-+$/g, '') : slug
}
