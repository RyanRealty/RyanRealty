/**
 * The count you use is the count you show.
 *
 * A headline, a sentence, or an adjusted-price line must not count a sale or
 * an expired listing the table left off. This is the check. It does not decide
 * which sales belong. It only refuses a counted address that the table does
 * not print. A sentence that names the sale is not the table.
 */

/** Prose blocks. An address that lives only in one of these is not on the grid. */
const PROSE_BLOCK = /<(?:p|h[1-6]|li)\b[^>]*>[\s\S]*?<\/(?:p|h[1-6]|li)>/gi

export function tableHtml(html: string): string {
  return html.replace(PROSE_BLOCK, ' ')
}

export function countedAddressesMissingFromDocument(
  addresses: readonly (string | null | undefined)[],
  html: string,
): string[] {
  const hay = tableHtml(html).toLowerCase()
  const missing: string[] = []
  const seen = new Set<string>()
  for (const raw of addresses) {
    const addr = (raw ?? '').replace(/\s+/g, ' ').trim()
    if (addr.length < 3) continue
    const key = addr.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    if (!hay.includes(key)) missing.push(addr)
  }
  return missing
}
