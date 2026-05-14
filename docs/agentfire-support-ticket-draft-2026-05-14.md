# AgentFire Support Ticket — Draft for Matt to review/send

**Recipient:** AgentFire support (likely `support@agentfire.com` or via the in-admin chat widget — Matt to confirm right channel)
**From:** Matt Ryan, ryan-realty.com
**Subject:** Two SEO bugs on theme: footer Twig signup string + broken JSON-LD `<script>` block on every page

---

## Body

Hi AgentFire team,

We're running an SEO audit on ryan-realty.com and found two theme-level issues that we can't fix from the customer dashboard. Both affect every page on the site, so they're worth flagging:

### 1. JSON-LD template stub renders as a broken `<script>` block on every page

Every page on the site renders a JSON-LD `<script type="application/ld+json">` block whose content is a template comment instead of valid JSON. The block reads (approximately):

> `into <head>. Handles 0-level (homepage, no breadcrumb), 1-level (/sellers/), and 2-leve...`

That looks like a developer placeholder/comment that wasn't substituted before output. Because it's wrapped in a `<script type="application/ld+json">` tag, structured-data validators flag it as a parse error on every page. Google's Search Console likely reports the same.

To reproduce:
- Open https://ryan-realty.com/ (or any page) → view source
- Search for `application/ld+json` blocks
- Among the 6 blocks rendered on the homepage, one starts with the comment text above and fails JSON.parse

The fix is theme-level — the template that emits this script needs the substitution logic completed or the empty block suppressed.

### 2. Footer Twig "Create Your Account" signup uses the word "exclusive" in a way our brand voice prohibits

There's a sitewide modal/widget that renders the Twig block:

```
{% block subtitle %}
  Gain immediate access to exclusive features such as notifications for newly listed homes,
  customized searches, and listing...
{% endblock %}
```

The word "exclusive" is on our brand-voice banned list. It appears once on every page on the site (we counted it via crawl). We'd like to change "exclusive features" → "saved features" or "member-only features" — anything that avoids the word "exclusive."

We can't edit Twig templates from the customer dashboard. Can someone on your end:

(a) Tell me where that template lives so I can request the change explicitly, OR
(b) Update the wording directly to a substitute (suggested: "Gain immediate access to saved features such as notifications for newly listed homes, customized searches, and listings.")

### Why both matter

These are sitewide and persistent across every URL. They're not big enough to block SEO outright, but they create unnecessary noise in Search Console's structured-data report (issue 1) and conflict with our brand voice (issue 2). Fixing once propagates to every page.

Site: https://ryan-realty.com/
Account: Ryan Realty (Matt Ryan)

Thanks,
Matt Ryan
Ryan Realty
115 NW Oregon Avenue
Bend, OR 97703
541.213.6706

---

## Channel notes

- AgentFire's in-admin chat is likely the fastest route (look for the "Chat With Support" link in wp-admin sidebar)
- Email fallback: `support@agentfire.com` (standard SaaS support pattern; not yet confirmed)
- Help-desk pattern: support.agentfire.com may have a ticket form

Once response comes back, log AgentFire's reference number + ETA in `docs/seo-execution-log-2026-05-14.md`.
