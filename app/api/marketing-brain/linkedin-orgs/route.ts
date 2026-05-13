/**
 * Diagnostic: list all LinkedIn organizations the stored access token can
 * read or manage. Used to discover the numeric organization ID for the
 * LINKEDIN_ORGANIZATION_ID env var before the marketing-snapshot-linkedin
 * ingestor can pull company-page data.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'

export const maxDuration = 60

interface LinkedInACLEntry {
  organization?: string
  role?: string
  state?: string
  organizationalTarget?: string
  roleAssignee?: string
}

interface LinkedInACLResponse {
  elements?: LinkedInACLEntry[]
  paging?: { count?: number; start?: number; total?: number }
}

interface LinkedInOrgDetails {
  id?: number
  localizedName?: string
  vanityName?: string
  localizedWebsite?: string
}

async function getLinkedInToken(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const supabase = createClient(url, key)
  const { data } = await supabase.from('linkedin_auth').select('access_token').eq('id', 'default').single()
  return data?.access_token ?? null
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const token = await getLinkedInToken()
  if (!token) {
    return NextResponse.json({ error: 'no linkedin token in supabase' }, { status: 500 })
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Restli-Protocol-Version': '2.0.0',
    'LinkedIn-Version': '202405',
  }

  const findings: Record<string, unknown> = {}

  // 1. Check the user's profile (confirms which scopes work)
  try {
    const meRes = await fetch('https://api.linkedin.com/v2/userinfo', { headers })
    findings.userinfo = meRes.ok ? await meRes.json() : { error: `HTTP ${meRes.status}`, body: (await meRes.text()).slice(0, 300) }
  } catch (e) {
    findings.userinfo = { error: e instanceof Error ? e.message : String(e) }
  }

  // 2. List organizations the user is an ACL on (their company pages)
  try {
    const aclRes = await fetch(
      'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&projection=(elements*(organization~(id,localizedName,vanityName,localizedWebsite),role,state))',
      { headers },
    )
    if (!aclRes.ok) {
      findings.organizations = { error: `HTTP ${aclRes.status}`, body: (await aclRes.text()).slice(0, 500) }
    } else {
      // LinkedIn's projection syntax appends ~ to URN fields to inline the
      // resolved entity. TypeScript can't represent that key directly, so
      // index into the raw JSON with a record cast.
      const acl = (await aclRes.json()) as { elements?: Array<Record<string, unknown>> }
      const orgs = (acl.elements ?? []).map((e) => {
        const resolved = (e['organization~'] as LinkedInOrgDetails | undefined) ?? {}
        return {
          organization_urn: e['organization'] as string | undefined,
          role: e['role'] as string | undefined,
          state: e['state'] as string | undefined,
          organization_id: resolved.id,
          name: resolved.localizedName,
          vanity_name: resolved.vanityName,
          website: resolved.localizedWebsite,
        }
      })
      findings.organizations = orgs
    }
  } catch (e) {
    findings.organizations = { error: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json(findings)
}
