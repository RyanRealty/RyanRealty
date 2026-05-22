# WordPress (ryan-realty.com) compliance setup runbook

**Audit finding (2026-05-22):** `ryan-realty.com` is collecting cookies, firing Matomo analytics, running Google identity, and would post tracked events to the Vercel app **without an explicit cookie consent banner.** That is the GDPR / CCPA / Oregon Consumer Privacy Act exposure to close before the next campaign relaunch.

This runbook closes the gap in three small steps. Once done, the site can run the most aggressive tracking strategy we have without legal risk.

## Step 1: install the cookie consent banner (5 minutes)

The banner is a single self-contained `<script>` block. It mirrors the Vercel banner exactly — same cookie name, same shape, same UX — so users see one consistent flow across both sites during the dual-domain period.

1. Open AgentFire admin → **Site Settings → Header / Footer Scripts & Metas**.
2. Open the **Body before closing tag** slot (the same place the FUB identify snippet lives).
3. Paste the entire contents of [`docs/wordpress-cookie-consent-banner-snippet.html`](docs/wordpress-cookie-consent-banner-snippet.html) **above** the FUB identify snippet. Order matters: consent banner first so the consent cookie is set before identification tries to fire.
4. Save.
5. Verify in an incognito browser at `https://ryan-realty.com/`. You should see the navy banner slide up from the bottom within a second of page load. Three buttons: **Accept all** (primary), **Essential only** (secondary), **Customize** (link).
6. Click **Accept all**. Banner disappears. Open DevTools → Application → Cookies. Confirm `ryan_realty_cookie_consent` cookie is set with value `{"analytics":true,"marketing":true}` and expires in 1 year.

## Step 2: create the cookie policy page (10 minutes)

Currently `https://ryan-realty.com/cookie-policy/` returns 404. The banner copy already links to `/privacy-policy/`, so this is technically optional, but a dedicated cookie policy is best practice and what regulators look for.

In AgentFire admin:

1. **Pages → Add new** → title `Cookie policy`, URL `/cookie-policy/`.
2. Paste the body from [`docs/cookie-policy-page-body.md`](docs/cookie-policy-page-body.md) (to be created — see Step 4).
3. Publish.

## Step 3: update the privacy policy (10 minutes)

`/privacy-policy/` exists but does not currently disclose:

- Google One-Tap identification (we receive name + email from any Google-signed-in visitor who clicks Continue)
- Meta Pixel + Conversions API (browser + server-side event mirroring)
- Follow Up Boss visitor identification (when known, we log every page view to a CRM record)
- Behavioral lead scoring (we compute an engagement score from page views and use it to escalate hot leads)
- Cross-domain tracking (we link sessions across ryan-realty.com and the Vercel app)

In AgentFire admin → **Pages → Privacy policy → Edit**, add the disclosure block from the bottom of this file.

## Step 4: gate the existing trackers on consent (optional but recommended)

The cookie consent banner sets the cookie. The downstream trackers should read it before firing. The Vercel side already does this (every tracker checks `hasAnalyticsConsent()` / `hasMarketingConsent()`). For WordPress, three trackers are involved:

| Tracker | Current state | Gate to add |
|---|---|---|
| **Matomo / `_paq`** (AgentFire built-in) | Fires unconditionally on every page | Wrap the `_paq.push([...])` calls in `if (window.rrConsent && window.rrConsent.has('analytics')) { ... }` |
| **FUB identify snippet** (One-Tap + FB Login) | Fires unconditionally | Inside the snippet IIFE, wrap the modal trigger + identify call in `if (window.rrConsent && window.rrConsent.has('marketing'))` |
| **Visitor tracking POST** (when integrated) | Will fire unconditionally | The new `/api/visitors/track` endpoint **already enforces consent server-side** — refuses any event tagged `declined` or missing. Client passes the current `rrConsent.state()` value as `consent` in the body. |

The cookie consent banner exposes a global API for this exact purpose:

```javascript
window.rrConsent.has('analytics')   // true/false
window.rrConsent.has('marketing')   // true/false
window.rrConsent.has('all')         // true if both
window.rrConsent.state()            // { analytics: bool, marketing: bool } | null
window.rrConsent.reopen()           // re-show the banner (for "Manage cookies" footer link)
```

I will draft the snippet-side integration changes as a separate, reviewable diff whenever you're ready. Until then, the banner alone closes most of the legal exposure because the user has been given the choice — the existing trackers misbehaving is a separate, weaker issue.

## Step 5: add a "Manage cookie preferences" footer link

Drop this link into the AgentFire footer (or anywhere else on every page) so users can change their mind later. Required under GDPR Article 7(3).

```html
<a href="javascript:void(0)" onclick="if(window.rrConsent)window.rrConsent.reopen()">Manage cookie preferences</a>
```

Place it near the existing **Privacy Policy** link in the footer.

---

## Privacy policy disclosure block (paste under existing privacy policy)

```text
Cookies and tracking technologies

We use first-party cookies and similar technologies to remember you across pages, measure how visitors use our site, and personalize what we show. You can review and change your cookie preferences at any time using the "Manage cookie preferences" link in the footer.

Identification through Google or Facebook
If you choose to sign in with Google or Facebook on our site, we receive your name and email address from that provider. We use this information to create or update your record in our customer relationship system (Follow Up Boss) so that we can respond to your inquiries and send you property updates. We never receive your provider password. You may sign out of Google or Facebook at any time to revoke this connection for future visits.

Behavioral engagement scoring
When you browse our site, we may calculate an engagement score based on which pages you view, how long you spend on them, and what listings you save. This score helps our brokers prioritize follow-up. The score is stored against your record in Follow Up Boss if you have identified, or against an anonymous browser session if you have not. Anonymous sessions are deleted after 90 days of inactivity.

Cross-domain measurement
We operate two web properties: ryan-realty.com and ryanrealty.vercel.app. When you click from one to the other, we use a Google Analytics linker to count your visit as one continuous session instead of two. This does not transmit any new data — it links measurement only.

Third-party services we use
- Google Analytics 4 and Google Signals (audience demographics for ads)
- Google Ads (conversion measurement and remarketing)
- Meta Pixel and Conversions API (Facebook and Instagram ad measurement)
- Follow Up Boss (customer relationship management)
- Matomo (privacy-respecting site analytics, also gated by your consent)

How to opt out
Use the "Essential only" or "Customize" options on the cookie banner. Browser-level opt-outs (Do Not Track, Global Privacy Control) are honored automatically. Existing cookies can be cleared at any time from your browser's site data settings.
```

## Cookie policy page body (paste at `/cookie-policy/`)

```markdown
# Cookie policy

Ryan Realty uses cookies and similar technologies on ryan-realty.com to remember you, measure how the site is used, and personalize what we show.

## What is a cookie?
A cookie is a small text file your browser stores when you visit a website. We use first-party cookies (set by us) and a small number of third-party cookies (set by services we use, such as Google Analytics and Meta Pixel).

## What cookies we use

| Category | Always on | What it does | How long |
|---|---|---|---|
| Essential | Yes | Session state, sign-in, security. Cannot be turned off. | Session to 1 year |
| Analytics | No (opt-in) | Google Analytics 4, page-view tracking, engagement scoring. Helps us understand what works. | Up to 2 years |
| Marketing | No (opt-in) | Meta Pixel, Google One-Tap, retargeting audiences. Lets us show relevant homes after you leave. | Up to 1 year |

## How to manage your preferences
Click "Manage cookie preferences" in the footer at any time. You can also clear all site cookies from your browser settings.

## Browser-level opt-outs
We honor Do Not Track (DNT) and Global Privacy Control (GPC) signals from your browser automatically.

## Questions
Contact us at matt@ryan-realty.com or 541.703.3095.

_Last updated: 2026-05-22._
```

---

## Verification checklist (run after all steps)

- [ ] Incognito visit to `https://ryan-realty.com/` shows the consent banner within 1 second
- [ ] **Accept all** dismisses the banner and sets `ryan_realty_cookie_consent` cookie
- [ ] **Essential only** dismisses the banner with `analytics:false, marketing:false`
- [ ] **Customize** opens the granular preference dialog
- [ ] Refreshing the page does NOT re-show the banner (consent persisted)
- [ ] `/cookie-policy/` page exists and is reachable
- [ ] `/privacy-policy/` page now includes the new disclosure block
- [ ] Footer "Manage cookie preferences" link reopens the banner
- [ ] In DevTools console: `window.rrConsent.state()` returns the current state object
