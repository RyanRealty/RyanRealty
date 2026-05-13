/**
 * Diagnostic: list all Google Search Console properties the service
 * account has access to. Helps reconcile the ingestor's site URL with
 * the actual property identifier registered in GSC.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  if (!clientEmail || !privateKeyRaw) {
    return NextResponse.json({ error: 'service account creds missing' }, { status: 500 })
  }

  try {
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKeyRaw.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    })
    const webmasters = google.webmasters({ version: 'v3', auth })
    const sitesResponse = await webmasters.sites.list()
    return NextResponse.json({
      service_account: clientEmail,
      sites: sitesResponse.data.siteEntry ?? [],
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
