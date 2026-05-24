# Ryan Realty — UTM tracking convention (every channel)

**Last updated:** 2026-05-24
**Owner:** Matt Ryan
**Companion to:** `docs/GA4_USER_TRACKING_SETUP.md` · `docs/MARKETING_LEAD_FLOW.md` · `docs/MARKETING_ANALYTICS_PLAYBOOK.md`

This is the single source of truth for **what UTM string to put on every link you publish from Ryan Realty**. If a link goes out to the public and you want to see its results in GA4, it needs to be on this page. The canonical pattern is enforced by `components/GoogleAnalytics.tsx` (auto-detects `fbclid`, `gclid`, `ttclid`, `msclkid` but cannot separate organic-search channels without explicit UTMs) and surfaced in the `/admin/reports/traffic-sources` report.

---

## The five UTM parameters

| Parameter | What it means | Convention |
|---|---|---|
| `utm_source` | **Where** the click came from | Lowercase platform name: `google`, `facebook`, `instagram`, `tiktok`, `youtube`, `linkedin`, `nextdoor`, `email`, `bing`, `mail-signature`, `mls` |
| `utm_medium` | **How** it was delivered | Lowercase channel type: `organic`, `paid_social`, `cpc`, `email`, `referral`, `social`, `qrcode`, `display`, `sms` |
| `utm_campaign` | The named campaign | Kebab-case, unique enough to identify it 6 months later: `seller-funnel-may-2026`, `cma-promo-fall`, `gbp-profile`, `weekly-newsletter-2026-05-24` |
| `utm_content` | The specific creative or placement | Kebab-case: `lookalike-1pct`, `hero-video-30s`, `bio-link`, `knowledge-panel`, `headshot-card` |
| `utm_term` | Targeting / keyword bucket (paid only) | Kebab-case: `bend-sellers-55plus`, `tetherow-homeowners`, `cma-keyword-broad` |

**Hard rules:**

1. **All lowercase, kebab-case.** GA4 is case-sensitive — `Facebook` and `facebook` show as two different rows.
2. **No spaces, no underscores in identifiers** (`utm_source` etc. carry their literal name).
3. **`utm_source` is required.** Everything else falls back to sensible defaults if missing.
4. **Pick one canonical value per concept.** Never use `fb`, `facebook`, and `facebook-ads` interchangeably — pick one (`facebook`) and stick with it.

---

## 1. Paid social — Facebook + Instagram Ads

Already documented in `docs/MARKETING_ANALYTICS_PLAYBOOK.md` §4. Reproduced here for completeness because it's the highest-spend channel.

```
?utm_source=facebook
&utm_medium=paid_social
&utm_campaign=<campaign-slug>
&utm_content=<ad-set-slug>
&utm_term=<targeting-slug>
```

**Concrete example** for an ad in the May 2026 seller funnel, using a Lookalike-1% audience and a 30s hero video:

```
https://ryan-realty.com/lp/seller-home-value?utm_source=facebook&utm_medium=paid_social&utm_campaign=seller-funnel-may-2026&utm_content=lookalike-1pct&utm_term=hero-video-30s
```

For Instagram-specific placements (Reels, Stories), use `utm_source=instagram` so you can break the two apart in reports.

**Apply in:** Ads Manager → Ad level → Website URL field.

---

## 2. Google Business Profile (GBP) — the one that's currently invisible

**Today:** GBP traffic gets lumped into `google / organic` along with regular search. GBP says you got X website clicks but GA4 only shows the aggregate organic-Google number — you can't tell them apart.

**Fix:** change the GBP "Website" link to include UTMs.

```
https://ryan-realty.com/?utm_source=google&utm_medium=organic&utm_campaign=gbp-profile&utm_content=knowledge-panel
```

**Worth distinguishing:**

| Element | utm_content suggestion |
|---|---|
| Main Website link in knowledge panel | `knowledge-panel` |
| Appointment / Booking URL | `booking-url` |
| Menu URL (we don't use this — restaurant feature) | n/a |
| Individual posts you publish | `post-<post-id>` or `post-<topic>` |

**Apply in:** Google Business Profile → Edit profile → Website. Save. Allow 24 hours for GBP to start sending the new URL.

**Verify:** within 48 hours, `/admin/reports/traffic-sources` should show a new row `google / organic / gbp-profile` in the first-touch UTM table.

**Note:** Google may occasionally strip UTMs from GBP links in specific surfaces. If you see your `gbp-profile` campaign disappear from reports, check that the link in GBP still has the parameters intact.

---

## 3. Organic social — Instagram, TikTok, YouTube, LinkedIn, Facebook (non-paid)

The link in your IG bio (or YouTube description, or LinkedIn About section) is the most common organic-social hook. Use this:

```
?utm_source=<platform>&utm_medium=social&utm_campaign=organic&utm_content=bio-link
```

**Per-platform recommended:**

| Platform | utm_source | utm_content variations |
|---|---|---|
| Instagram | `instagram` | `bio-link`, `story-<topic>`, `reel-<topic>` |
| TikTok | `tiktok` | `bio-link`, `video-<topic>` |
| YouTube | `youtube` | `bio-link`, `description-<video-slug>`, `pinned-comment` |
| LinkedIn | `linkedin` | `bio-link`, `post-<topic>`, `article-<slug>` |
| Facebook page | `facebook` | `bio-link`, `post-<topic>`, `pinned-post` |
| Nextdoor | `nextdoor` | `bio-link`, `post-<topic>` |

**Apply in:** the bio / link-in-bio editor on each platform. Use a URL shortener (bit.ly or your own) if the platform truncates display — the underlying redirect can carry the full UTMs.

---

## 4. Email — every type

| Email type | Suggested string |
|---|---|
| Weekly newsletter | `?utm_source=email&utm_medium=newsletter&utm_campaign=weekly-newsletter-<YYYY-MM-DD>` |
| Drip emails (FUB automation) | `?utm_source=fub&utm_medium=email&utm_campaign=<workflow-name>` |
| One-off broadcast | `?utm_source=email&utm_medium=broadcast&utm_campaign=<broadcast-slug>` |
| Email signature (Matt) | `?utm_source=email&utm_medium=signature&utm_campaign=matt-signature` |
| Cold outreach | `?utm_source=email&utm_medium=outreach&utm_campaign=<list-slug>` |
| Transactional (CMA delivery, valuation reports) | `?utm_source=email&utm_medium=transactional&utm_campaign=cma-delivery` |

**Apply in:** every email template + your personal email signature. The signature one is non-obvious but adds up — every reply you send becomes a tracked click if a recipient clicks through.

---

## 5. SMS / iMessage

```
?utm_source=sms&utm_medium=text&utm_campaign=<campaign-slug>
```

**Apply in:** any time you text a client a link. Make it part of your follow-up template so you don't forget.

---

## 6. Print & QR codes — yard signs, postcards, flyers

Yard sign QR codes are GOLD for attribution because there's literally no other way to know that QR drove the visit.

```
?utm_source=yard-sign&utm_medium=qrcode&utm_campaign=<listing-mls>&utm_content=qr-front
```

For postcards / flyers:

```
?utm_source=postcard&utm_medium=print&utm_campaign=<mailing-name>
```

For broker brag flyers handed out in person:

```
?utm_source=brag-flyer&utm_medium=print&utm_campaign=<event-or-context>
```

**Apply in:** every printed asset before sending to the printer. The QR code generator should bake the full URL with UTMs into the QR image.

---

## 7. MLS, Zillow, Realtor.com — third-party listing sites

When your MLS export or third-party portal lets you add a custom URL (often the "agent website" field):

```
?utm_source=<platform>&utm_medium=referral&utm_campaign=listing-agent-link
```

| Platform | utm_source |
|---|---|
| Spark MLS | `mls` |
| Zillow | `zillow` |
| Realtor.com | `realtor-com` |
| Redfin | `redfin` |
| Compass | `compass` |

---

## 8. Affiliate / partner links — lender, title, inspector referrals

```
?utm_source=<partner-slug>&utm_medium=partner&utm_campaign=<partner-name>
```

This pairs with the existing partner-referral tracking in `app/actions/partnership-revenue.ts`.

---

## 9. Direct mail — postcard with handwritten URL

If you're going to write a URL on a piece of paper, use a vanity short URL like:

```
ryan-realty.com/h
```

That redirects (server-side) to:

```
https://ryan-realty.com/home-valuation?utm_source=postcard&utm_medium=direct-mail&utm_campaign=<mailing-name>
```

Keep a list of the vanity slugs you use in `lib/redirects.ts` (already exists for some) so you don't forget.

---

## 10. UTM builder script (optional, for power users)

If you find yourself writing UTMs by hand often, add a builder to `scripts/utm-builder.mjs`:

```bash
node scripts/utm-builder.mjs --base https://ryan-realty.com/lp/seller-home-value \
  --source facebook --medium paid_social --campaign seller-funnel-may-2026 \
  --content lookalike-1pct --term hero-video-30s
```

Output:

```
https://ryan-realty.com/lp/seller-home-value?utm_source=facebook&utm_medium=paid_social&utm_campaign=seller-funnel-may-2026&utm_content=lookalike-1pct&utm_term=hero-video-30s
```

(Not built yet — only build when the manual approach becomes painful.)

---

## What's already auto-detected (no UTM needed)

`components/GoogleAnalytics.tsx` already infers source/medium from these click-id parameters that the ad platforms auto-add:

| Click-id param | Auto-attributed as |
|---|---|
| `fbclid` | source=facebook, medium=paid_social |
| `gclid` | source=google, medium=cpc |
| `ttclid` | source=tiktok, medium=paid_social |
| `msclkid` | source=bing, medium=cpc |

So you can run paid ads on those platforms even WITHOUT setting UTMs and still get source/medium right. But you'll lose `utm_campaign` (which campaign name) and `utm_content` (which ad). For full campaign-level reporting in GA4, **always set utm_campaign + utm_content explicitly** even when the click-id param exists.

---

## Verification

After adding UTMs to any channel:

1. Click your own link in a fresh incognito window
2. Within 30 seconds open GA4 → Reports → Realtime → User snapshot
3. Confirm `Session source / medium` and `Session campaign` show the values you set
4. Within 24 hours, the same UTM combination should appear in `/admin/reports/traffic-sources` under "First-touch UTM attribution"

If a UTM-tagged link is showing up as `(direct)` or `(no utm)` in the admin report, the most common causes are:
- The link was opened in an app webview that strips query params (some IG / FB in-app browsers do this)
- A redirect in the middle of the chain dropped the params (check `lib/redirects.ts`)
- The tracking snippet didn't fire (consent declined, ad-blocker, or the snippet failed to load)

---

## Cross-references

- `docs/GA4_USER_TRACKING_SETUP.md` — GA4 Admin clicks to make these UTMs actually surface as dimensions
- `docs/MARKETING_LEAD_FLOW.md` — how each tagged session becomes an attributed lead in FUB
- `docs/MARKETING_ANALYTICS_PLAYBOOK.md` — the why behind UTMs + LP convention
- `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md` — full Meta-side flow
- `/admin/reports/traffic-sources` — the dashboard that proves the UTMs are working
