#!/usr/bin/env node
/**
 * Send the AgentFire support ticket via Gmail API using the existing service account
 * with domain-wide delegation. Sends AS Matt's Workspace email.
 *
 * Requires:
 *   - GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL
 *   - GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *   - GOOGLE_SERVICE_ACCOUNT_SUBJECT  (the user to impersonate)
 *   - Gmail API enabled in the GCP project
 *   - `gmail.send` scope added to the service account's domain-wide-delegation allow list
 *
 * Usage: node --env-file=.env.local scripts/seo-send-agentfire-support-ticket-gmail.mjs
 */

import { google } from 'googleapis'

async function main() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim()
  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  const subject = process.env.GOOGLE_SERVICE_ACCOUNT_SUBJECT?.trim()

  if (!clientEmail || !privateKeyRaw || !subject) {
    console.error('Missing service account env vars')
    process.exit(1)
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKeyRaw.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject, // impersonate the workspace user
  })

  const gmail = google.gmail({ version: 'v1', auth })

  const to = 'support@agentfire.com'
  const subj = 'Two SEO bugs on the Spark theme: parse-error JSON-LD block + footer Twig "exclusive" string'

  const body = `Hi AgentFire team,

We're running an SEO audit on ryan-realty.com and found two theme-level issues we can't fix from the customer dashboard. Both affect every page on the site:

1) JSON-LD template stub renders as a broken <script> block on every page

Every page renders a JSON-LD <script type="application/ld+json"> block whose content is a template comment instead of valid JSON. The block reads (approximately):

  "into <head>. Handles 0-level (homepage, no breadcrumb), 1-level (/sellers/), and 2-leve..."

That looks like a developer placeholder that wasn't substituted before output. Because it's wrapped in a <script type="application/ld+json"> tag, structured-data validators flag it as a parse error on every page.

To reproduce: open https://ryan-realty.com/ and view source, search for "application/ld+json", and one of the blocks starts with the comment text above and fails JSON.parse.

The fix is theme-level — the template that emits this script needs the substitution logic completed or the empty block suppressed.

2) Footer Twig "Create Your Account" signup uses the word "exclusive"

There's a sitewide modal/widget that renders:

  {% block subtitle %}
    Gain immediate access to exclusive features such as notifications for newly listed homes,
    customized searches, and listing...
  {% endblock %}

The word "exclusive" is on our brand-voice banned list. It appears once on every page on the site. We'd like it changed to "saved features" or "member-only features" — anything that avoids the word "exclusive".

We can't edit Twig templates from the customer dashboard. Can you either:
  (a) Tell us where that template lives so we can request the change explicitly, OR
  (b) Update the wording directly. Suggested: "Gain immediate access to saved features such as notifications for newly listed homes, customized searches, and listings."

These are sitewide and persistent across every URL. They create noise in Search Console's structured-data report (issue 1) and conflict with our brand voice (issue 2). Fixing once propagates to every page.

Site: https://ryan-realty.com/
Account: Ryan Realty (Matt Ryan)

Thanks,
Matt Ryan
Ryan Realty
115 NW Oregon Avenue, Bend, OR 97703
541.213.6706
`

  // Build RFC822 message
  const messageLines = [
    `From: ${subject}`,
    `To: ${to}`,
    `Subject: ${subj}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
  ]
  const raw = Buffer.from(messageLines.join('\r\n')).toString('base64url')

  try {
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    })
    console.log('Email sent. Gmail message id:', res.data.id)
  } catch (e) {
    console.error('SEND FAILED:', e?.message || e)
    if (e?.errors) console.error('Details:', JSON.stringify(e.errors))
    process.exit(1)
  }
}

main().catch(e => {
  console.error('Fatal:', e?.message || e)
  process.exit(1)
})
