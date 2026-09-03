import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

describe('admin login Google hosted-domain hint', () => {
  const form = readFileSync(join(ROOT, 'app/admin/login/_components/AdminLoginForm.tsx'), 'utf8')
  const oauth = readFileSync(join(ROOT, 'lib/supabase/oauth.ts'), 'utf8')
  const publicGis = readFileSync(join(ROOT, 'lib/auth/google-gis.ts'), 'utf8')
  const publicLogin = readFileSync(join(ROOT, 'components/auth/LoginForm.tsx'), 'utf8')

  it('initializes GIS with hd so One Tap prefers @ryan-realty.com', () => {
    expect(form).toMatch(/hd:\s*ADMIN_GOOGLE_HOSTED_DOMAIN/)
    expect(form).toContain("ADMIN_GOOGLE_HOSTED_DOMAIN = 'ryan-realty.com'")
  })

  it('passes hd on the admin OAuth fallback', () => {
    expect(form).toMatch(
      /signInWithOAuthBrowser\(\s*'google',\s*dest,\s*\{\s*hd:\s*ADMIN_GOOGLE_HOSTED_DOMAIN\s*\}\s*\)/,
    )
  })

  it('keeps queryParams optional so public login is unchanged', () => {
    expect(oauth).toMatch(/queryParams\?: Record<string, string>/)
    expect(oauth).toMatch(/\.\.\.\(queryParams \? \{ queryParams \} : \{\}\)/)
  })

  it('does not add hd to the public GIS client or public login', () => {
    expect(publicGis).not.toMatch(/\bhd:\s*['"]ryan-realty\.com['"]/)
    expect(publicLogin).not.toMatch(/\bhd:\s*['"]ryan-realty\.com['"]/)
  })
})
