/**
 * Supabase Auth: browser client (client components) and server client factory (server components / API routes).
 * Use createBrowserClient in 'use client' code; use createServerClient in server code (it reads cookies).
 */

import { createBrowserClient as createBrowserClientSSR } from '@supabase/ssr'
import { createServerClient as createServerClientSSR } from '@supabase/ssr'
import { cookies } from 'next/headers'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getEnv() {
  if (!url || !anonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return { url, anonKey }
}

/** Browser client for client components. Use in 'use client' only. */
export function createBrowserClient() {
  const { url: u, anonKey: k } = getEnv()
  return createBrowserClientSSR(u, k)
}

/** Server client factory for server components and API routes. Reads cookies. */
export async function createServerClient() {
  const { url: u, anonKey: k } = getEnv()
  const cookieStore = await cookies()
  return createServerClientSSR(u, k, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as { httpOnly?: boolean; secure?: boolean; sameSite?: 'lax' | 'strict' | 'none'; maxAge?: number; path?: string })
          )
        } catch {
          // Ignore in Server Components / read-only contexts
        }
      },
    },
  })
}
