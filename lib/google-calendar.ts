/**
 * Google Calendar OAuth helpers for per-broker calendar integration.
 * Uses the existing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET.
 *
 * Scopes requested: calendar.readonly (read events, no write needed for display)
 * Tokens stored in public.broker_gcal_tokens (service-role only RLS).
 */

import { createClient } from '@supabase/supabase-js'

const GCAL_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
].join(' ')

const GCAL_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GCAL_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GCAL_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

function clientId() {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID
  if (!id) throw new Error('GOOGLE_OAUTH_CLIENT_ID not set')
  return id
}

function clientSecret() {
  const s = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!s) throw new Error('GOOGLE_OAUTH_CLIENT_SECRET not set')
  return s
}

export function buildGcalAuthUrl(redirectUri: string, stateToken: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GCAL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: stateToken,
  })
  return `${GCAL_AUTH_URL}?${params.toString()}`
}

export async function exchangeGcalCode(
  code: string,
  redirectUri: string,
): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}> {
  const res = await fetch(GCAL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Google token exchange failed: ${txt}`)
  }
  return res.json()
}

export async function upsertGcalToken(
  brokerId: string,
  tokenData: {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope: string
    token_type: string
  },
): Promise<void> {
  const sb = getServiceSupabase()
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
  const row: Record<string, unknown> = {
    broker_id: brokerId,
    access_token: tokenData.access_token,
    expires_at: expiresAt,
    scope: tokenData.scope,
    token_type: tokenData.token_type,
    updated_at: new Date().toISOString(),
  }
  if (tokenData.refresh_token) row.refresh_token = tokenData.refresh_token
  const { error } = await sb.from('broker_gcal_tokens').upsert(row, { onConflict: 'broker_id' })
  if (error) throw new Error(`Failed to store GCal token: ${error.message}`)
}

async function refreshGcalToken(brokerId: string, refreshToken: string): Promise<string> {
  const res = await fetch(GCAL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  })
  if (!res.ok) throw new Error('GCal token refresh failed')
  const data = await res.json()
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()
  await getServiceSupabase()
    .from('broker_gcal_tokens')
    .update({ access_token: data.access_token, expires_at: expiresAt, updated_at: new Date().toISOString() })
    .eq('broker_id', brokerId)
  return data.access_token
}

export type GcalEvent = {
  id: string
  title: string
  start: string
  end: string | null
  allDay: boolean
  htmlLink: string | null
}

export async function getGcalEvents(brokerId: string, daysAhead = 14): Promise<{ connected: boolean; events: GcalEvent[] }> {
  const sb = getServiceSupabase()
  const { data: row } = await sb
    .from('broker_gcal_tokens')
    .select('access_token,refresh_token,expires_at')
    .eq('broker_id', brokerId)
    .maybeSingle()

  if (!row) return { connected: false, events: [] }

  let token = row.access_token
  const isExpired = new Date(row.expires_at) <= new Date(Date.now() + 60_000)
  if (isExpired && row.refresh_token) {
    try {
      token = await refreshGcalToken(brokerId, row.refresh_token)
    } catch {
      return { connected: true, events: [] }
    }
  }

  const timeMin = new Date().toISOString()
  const timeMax = new Date(Date.now() + daysAhead * 86_400_000).toISOString()
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })

  try {
    const res = await fetch(`${GCAL_EVENTS_URL}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return { connected: true, events: [] }
    const data = await res.json()
    const events: GcalEvent[] = (data.items ?? []).map((item: Record<string, unknown>) => {
      const start = (item.start as Record<string, string> | undefined)
      const end = (item.end as Record<string, string> | undefined)
      const allDay = !!(start?.date && !start?.dateTime)
      return {
        id: String(item.id ?? ''),
        title: String(item.summary ?? 'Untitled'),
        start: String(allDay ? start?.date : start?.dateTime ?? ''),
        end: allDay ? String(end?.date ?? '') : String(end?.dateTime ?? '') || null,
        allDay,
        htmlLink: typeof item.htmlLink === 'string' ? item.htmlLink : null,
      }
    })
    return { connected: true, events }
  } catch {
    return { connected: true, events: [] }
  }
}

export async function disconnectGcal(brokerId: string): Promise<void> {
  await getServiceSupabase().from('broker_gcal_tokens').delete().eq('broker_id', brokerId)
}
