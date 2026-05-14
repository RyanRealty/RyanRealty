#!/usr/bin/env node
/**
 * Verify the Workspace DWD allowlist has gmail.modify + gmail.send for
 * marketing@ryan-realty.com. Prints a structured report.
 *
 * Usage:
 *   node --env-file=.env.local scripts/marketing-inbox-verify-auth.mjs
 */

import { google } from 'googleapis'

const SUBJECT = 'marketing@ryan-realty.com'

async function checkScope(label, scopes) {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()

  if (!clientEmail || !privateKey) {
    console.error(`[${label}] MISSING ENV: GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY not set`)
    return false
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes,
    subject: SUBJECT,
  })

  try {
    await auth.authorize()
    console.log(`[${label}] ok — scopes granted: ${scopes.join(', ')}`)
    return auth
  } catch (e) {
    const msg = e?.message || String(e)
    console.error(`[${label}] FAIL — ${msg}`)
    if (/unauthorized_client/i.test(msg)) {
      console.error(`         hint: add scope to DWD allowlist for service account.`)
      console.error(`         See docs/handoffs/marketing-inbox-admin-setup.md`)
    }
    return false
  }
}

async function main() {
  console.log('Verifying marketing inbox DWD allowlist…\n')

  const sendAuth = await checkScope('send scope', ['https://www.googleapis.com/auth/gmail.send'])
  const readAuth = await checkScope('read scope', ['https://www.googleapis.com/auth/gmail.modify'])

  if (!readAuth) {
    console.log()
    console.log('Read scope NOT yet authorized — the poll path will return auth_pending.')
    console.log('Reply path remains operational if send scope passed.')
    process.exit(readAuth || sendAuth ? 0 : 1)
  }

  // Read path live — probe the actual mailbox
  const gmail = google.gmail({ version: 'v1', auth: readAuth })
  try {
    const profile = await gmail.users.getProfile({ userId: 'me' })
    console.log('\nMailbox profile:')
    console.log('  emailAddress:', profile.data.emailAddress)
    console.log('  messagesTotal:', profile.data.messagesTotal)
    console.log('  threadsTotal:', profile.data.threadsTotal)

    const unread = await gmail.users.messages.list({ userId: 'me', q: 'is:unread in:inbox', maxResults: 5 })
    console.log('\nUnread inbox (last 5):')
    console.log('  count:', unread.data.resultSizeEstimate ?? 0)
    for (const m of unread.data.messages ?? []) {
      console.log(' ', m.id, m.threadId)
    }
  } catch (e) {
    console.error('Mailbox probe FAILED:', e?.message || e)
    process.exit(1)
  }

  console.log('\nAll checks passed. Cron poll will run live on next tick.')
}

main().catch((e) => {
  console.error('Fatal:', e?.message || e)
  process.exit(1)
})
