/**
 * Thin FUB auth helper for the marketing-snapshot-fub ingestor.
 *
 * Kept separate so the ingestor route does not pull in the full
 * followupboss.ts dependency graph (event tracking, person update,
 * broker attribution, etc.).
 *
 * Uses the same credential resolution pattern as lib/followupboss.ts:
 * Basic auth with API key as username, empty password.
 */

/**
 * Returns HTTP headers for FUB v1 API calls, or null if FOLLOWUPBOSS_API_KEY
 * is not configured. The caller should bail early on null.
 */
export function getFubHeaders(): HeadersInit | null {
  const apiKey = process.env.FOLLOWUPBOSS_API_KEY?.trim()
  if (!apiKey) return null
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
  }
  const system = process.env.FOLLOWUPBOSS_SYSTEM?.trim()
  const systemKey = process.env.FOLLOWUPBOSS_SYSTEM_KEY?.trim()
  if (system) headers['X-System'] = system
  if (systemKey) headers['X-System-Key'] = systemKey
  return headers
}
