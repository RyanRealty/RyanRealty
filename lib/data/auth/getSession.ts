import 'server-only'

import { cache } from 'react'
import { normalizeAvatarUrl } from '@/lib/auth/avatar'
import { createClient } from '@/lib/supabase/server'
import type { AuthUser } from '@/lib/auth/types'

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
  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      avatar_url: normalizeAvatarUrl(user),
      user_metadata: user.user_metadata,
    },
  }
})
