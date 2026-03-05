import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * When OAuth redirects with ?code= on the wrong path (e.g. /?code=xxx), send to /auth/callback
 * so the code gets exchanged and the user is sent back to the page they signed in from.
 */
function redirectCodeToCallback(request: NextRequest): NextResponse | null {
  const code = request.nextUrl.searchParams.get('code')
  if (!code || request.nextUrl.pathname === '/auth/callback') return null
  const callbackUrl = new URL('/auth/callback', request.url)
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
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
