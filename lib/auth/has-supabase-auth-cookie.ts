/**
 * Edge-safe: a request looks signed-in when it carries a Supabase SSR
 * auth cookie (possibly chunked as `sb-<ref>-auth-token.0`).
 *
 * Used by middleware to 307 `/account` before Next streams a hollow 200.
 * Layout still calls getSession() — this is only the edge gate.
 */

export function hasSupabaseAuthCookie(cookies: readonly { name: string }[]): boolean {
  return cookies.some((c) => c.name.includes('-auth-token'))
}
