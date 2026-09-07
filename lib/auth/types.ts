/**
 * Shared auth viewer shape for client + server.
 * Kept out of `app/actions/auth` ('use server' + next/headers) so client
 * components can type session JSON without pulling the server module into the
 * Turbopack client graph.
 */
export type AuthUser = {
  id: string
  email?: string | null
  /** Normalized from user_metadata and identities so Google/profile picture always works. */
  avatar_url?: string | null
  user_metadata?: { full_name?: string; name?: string; avatar_url?: string; picture?: string }
}
