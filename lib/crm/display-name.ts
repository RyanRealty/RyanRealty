/**
 * Display name for a CRM contact. Imported leads often carry a placeholder name
 * like "Lead anna@example.com" — strip the "Lead " prefix so feeds and lists
 * show the address cleanly instead of the ugly placeholder. Used everywhere a
 * contact name is rendered so the whole CRM is consistent.
 */
export function cleanContactName(name: string | null | undefined, fallbackId?: number | string): string {
  const n = String(name ?? '').trim()
  if (!n) return fallbackId != null ? `Contact #${fallbackId}` : 'Contact'
  if (/^lead\s+\S+@\S+$/i.test(n)) return n.replace(/^lead\s+/i, '')
  return n
}
