import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { AuthUser } from '@/lib/auth/types'

function normalizeAvatarUrl(user: {
  user_metadata?: Record<string, unknown>
  identities?: Array<{ identity_data?: Record<string, unknown> }>
}): string | null {
  const fromMeta = user.user_metadata?.avatar_url ?? user.user_metadata?.picture
  if (typeof fromMeta === 'string' && fromMeta) return fromMeta
  const fromIdentity =
    user.identities?.[0]?.identity_data?.avatar_url ?? user.identities?.[0]?.identity_data?.picture
  if (typeof fromIdentity === 'string' && fromIdentity) return fromIdentity
  return null
}

/**
 * Request-memoized auth session for public pages (DAL path).
 * app/actions/auth.getSession stays for action callers; pages import here so
 * ci:page-action-imports stays green (no get* from app/actions on page.tsx).
 */
export const getSession = cache(async (): Promise<{ user: AuthUser } | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const avatar_url = normalizeAvatarUrl(user)
  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      avatar_url: avatar_url ?? user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
      user_metadata: user.user_metadata,
    },
  }
})
