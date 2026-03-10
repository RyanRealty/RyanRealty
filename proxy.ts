import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * When OAuth redirects with ?code= on the wrong path, send to callback so the code gets exchanged.
 */
function redirectCodeToCallback(request: NextRequest): NextResponse | null {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) return null
  const path = request.nextUrl.pathname
  if (path === '/auth/callback' || path === '/api/auth/callback') return null
  const callbackUrl = new URL('/api/auth/callback', request.url)
  request.nextUrl.searchParams.forEach((value, key) => callbackUrl.searchParams.set(key, value))
  return NextResponse.redirect(callbackUrl)
}

export async function proxy(request: NextRequest) {
  const codeRedirect = redirectCodeToCallback(request)
  if (codeRedirect) return codeRedirect

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return NextResponse.next({ request })

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as { httpOnly?: boolean; secure?: boolean; sameSite?: 'lax' | 'strict' | 'none'; maxAge?: number; path?: string })
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Protect /admin/* (except /admin/login): require session; admin role is checked in admin layout
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    if (!user) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('next', pathname + request.nextUrl.search)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Protect /dashboard/*: require session
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname + request.nextUrl.search)
      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
