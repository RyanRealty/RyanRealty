#!/usr/bin/env node
/**
 * Send the AgentFire support ticket re: footer Twig 'exclusive' string + parse-error JSON-LD bug.
 *
 * Sends via Resend. Reply-to is Matt's Google Workspace email pulled from
 * GOOGLE_SERVICE_ACCOUNT_SUBJECT (the domain-wide-delegation impersonation subject).
 *
 * Recipient: support@agentfire.com (standard SaaS support address). If that bounces,
 * Matt can resend through the in-admin chat.
 *
 * Usage: node --env-file=.env.local scripts/seo-send-agentfire-support-ticket.mjs
 */

import { Resend } from 'resend'

async function main() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    console.error('RESEND_API_KEY not set')
    process.exit(1)
  }

  const replyTo = process.env.GOOGLE_SERVICE_ACCOUNT_SUBJECT?.trim()
  if (!replyTo) {
    console.error('GOOGLE_SERVICE_ACCOUNT_SUBJECT not set — cannot derive reply-to address')
    process.exit(1)
  }

  const resend = new Resend(apiKey)

  const subject = 'Two SEO bugs on the Spark theme: parse-error JSON-LD block + footer Twig "exclusive" string'

  const html = `
<p>Hi AgentFire team,</p>

<p>We're running an SEO audit on ryan-realty.com and found two theme-level issues we can't fix from the customer dashboard. Both affect every page on the site, so they're worth flagging:</p>

<h3>1. JSON-LD template stub renders as a broken &lt;script&gt; block on every page</h3>

<p>Every page on ryan-realty.com renders a JSON-LD <code>&lt;script type="application/ld+json"&gt;</code> block whose content is a template comment instead of valid JSON. The block reads (approximately):</p>

<blockquote><code>into &lt;head&gt;. Handles 0-level (homepage, no breadcrumb), 1-level (/sellers/), and 2-leve...</code></blockquote>

<p>That looks like a developer placeholder/comment that wasn't substituted before output. Because it's wrapped in a <code>&lt;script type="application/ld+json"&gt;</code> tag, structured-data validators flag it as a parse error on every page. Google Search Console likely reports the same.</p>

<p><strong>To reproduce:</strong></p>
<ul>
<li>Open <a href="https://ryan-realty.com/">https://ryan-realty.com/</a> (or any page) and view source</li>
<li>Search for <code>application/ld+json</code> blocks</li>
<li>Among the 6 blocks rendered on the homepage, one starts with the comment text above and fails JSON.parse</li>
</ul>

<p>The fix is theme-level. The template that emits this script needs the substitution logic completed or the empty block suppressed.</p>

<h3>2. Footer Twig "Create Your Account" signup uses the word "exclusive"</h3>

<p>There's a sitewide modal/widget that renders the Twig block:</p>

<pre>{% block subtitle %}
  Gain immediate access to exclusive features such as notifications for newly listed homes,
  customized searches, and listing...
{% endblock %}</pre>

<p>The word "exclusive" is on our brand-voice banned list. It appears once on every page on the site. We'd like it changed to "saved features" or "member-only features" — anything that avoids the word "exclusive".</p>

<p>We can't edit Twig templates from the customer dashboard. Can you either:</p>
<ol>
<li>Tell us where that template lives so we can request the change explicitly, OR</li>
<li>Update the wording directly to a substitute. Suggested: <em>"Gain immediate access to saved features such as notifications for newly listed homes, customized searches, and listings."</em></li>
</ol>

<h3>Why both matter</h3>

<p>These are sitewide and persistent across every URL. They create noise in Search Console's structured-data report (issue 1) and conflict with our brand voice (issue 2). Fixing once propagates to every page.</p>

<p>Site: <a href="https://ryan-realty.com/">https://ryan-realty.com/</a><br>
Account: Ryan Realty (Matt Ryan)</p>

<p>Thanks,<br>
Matt Ryan<br>
Ryan Realty<br>
115 NW Oregon Avenue, Bend, OR 97703<br>
541.213.6706</p>
`.trim()

  const text = `Hi AgentFire team,

We're running an SEO audit on ryan-realty.com and found two theme-level issues we can't fix from the customer dashboard. Both affect every page on the site:

1. JSON-LD template stub renders as a broken <script> block on every page

Every page renders a JSON-LD <script type="application/ld+json"> block whose content is a template comment instead of valid JSON. The block reads (approximately):

  "into <head>. Handles 0-level (homepage, no breadcrumb), 1-level (/sellers/), and 2-leve..."

That looks like a developer placeholder/comment that wasn't substituted before output. Because it's wrapped in a <script type="application/ld+json"> tag, structured-data validators flag it as a parse error on every page.

To reproduce: open https://ryan-realty.com/ and view source, search for "application/ld+json", and one of the blocks starts with the comment text above and fails JSON.parse.

The fix is theme-level.

2. Footer Twig "Create Your Account" signup uses the word "exclusive"

There's a sitewide modal/widget that renders the Twig block:

  {% block subtitle %}
    Gain immediate access to exclusive features such as notifications for newly listed homes,
    customized searches, and listing...
  {% endblock %}

The word "exclusive" is on our brand-voice banned list. It appears once on every page on the site. We'd like it changed to "saved features" or "member-only features" — anything that avoids the word "exclusive".

We can't edit Twig templates from the customer dashboard. Can you either:

  (a) Tell us where that template lives so we can request the change explicitly, OR
  (b) Update the wording directly. Suggested: "Gain immediate access to saved features such as notifications for newly listed homes, customized searches, and listings."

Why both matter

These are sitewide and persistent across every URL. They create noise in Search Console's structured-data report (issue 1) and conflict with our brand voice (issue 2). Fixing once propagates to every page.

Site: https://ryan-realty.com/
Account: Ryan Realty (Matt Ryan)

Thanks,
Matt Ryan
Ryan Realty
115 NW Oregon Avenue, Bend, OR 97703
541.213.6706
`

  const { data, error } = await resend.emails.send({
    to: 'support@agentfire.com',
    cc: [replyTo],
    from: 'Ryan Realty <noreply@ryan-realty.com>',
    replyTo,
    subject,
    html,
    text,
  })

  if (error) {
    console.error('SEND FAILED:', JSON.stringify(error))
    process.exit(1)
  }

  console.log('Email sent. Resend message id:', data?.id || '(no id)')
}

main().catch(e => {
  console.error('Fatal:', e?.message || e)
  process.exit(1)
})
