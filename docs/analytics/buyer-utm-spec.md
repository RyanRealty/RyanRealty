# Buyer UTM spec

Ad-manager and outbound buyer links use the #440 vocab in `lib/analytics/utm.ts`
and `.cursor/rules/utm-convention.mdc`. Every value is lowercase kebab. No street
addresses, person names, or per-property slugs in any `utm_*` field.

Stamp outbound ryan-realty.com links with `buildTrackedUrl`. Ad-manager URL
templates are typed by hand from this table.

## Channel table

| Channel | utm_source | utm_medium | utm_campaign | utm_content | utm_term |
|---|---|---|---|---|---|
| Meta paid (Facebook + Instagram ads) | `facebook` (one value for Facebook and Instagram ads) | `paid_social` | `buyer-<angle>` e.g. `buyer-leverage`, `buyer-price-drops`, `buyer-what-it-buys`, `buyer-relocate`, `buyer-first-home` | `<persona>-<hook>-<ver>` creative ID, e.g. `reloc-h3-v1` (or Meta macro `{{ad.id}}` in Ads Manager) | `{{adset.id}}` optional |
| Google Search | `google` | `cpc` | same `buyer-<angle>` slugs | `<adgroup>-<ad-ver>` or `{creative}` ValueTrack in Google Ads | `{keyword}` |
| Organic social (Matt posts) | `instagram` / `facebook` / `youtube` / `tiktok` | `social` | `buyer-<angle>` | `reel-<yyyymmdd>-<hook>` | none |
| Alert / deal-report emails | `crm` | `email` | `listing-alerts` / `buyer-deal-report` | `cta-top` and other allowed variants | none |

`cpc` and `paid_social` are the paid mediums. `utm_term` is allowed only on those
two. `listing-alerts` was already a program slug; `buyer-deal-report` is the
deal-report email campaign.

Named buyer slugs in the vocab: `buyer-leverage`, `buyer-price-drops`,
`buyer-what-it-buys`, `buyer-relocate`, `buyer-first-home`, `buyer-deal-report`.
A later `buyer-<angle>` kebab slug also matches (`buyer-${string}`), as long as
it is not an address or a given name.

## Mapping

Creative and hook IDs ride in **utm_content**. That becomes `lp_content` on
`generate_lead` and the `ad-content:<x>` CRM tag through
`resolvePaidAttributionTags`.

| UTM | First-party lead param |
|---|---|
| `utm_source` | `lp_source` |
| `utm_medium` | `lp_medium` |
| `utm_campaign` | `lp_campaign` |
| `utm_content` | `lp_content` |
| `utm_term` | `lp_term` (first-party only; not a GA4 event param) |

Click ids stay on the URL: Meta auto `fbclid` and Google auto-tagging `gclid`
stay on. Both are in `LEAD_ATTRIBUTION_QUERY_KEYS` in `lib/lead-tracking.ts`
alongside the five `utm_*` keys.

`buildTrackedUrl` lowercases and requires kebab slugs. Google ValueTrack tokens
(`{keyword}`, `{creative}`) and Meta macros (`{{ad.id}}`, `{{adset.id}}`) belong
in the ad-platform URL template. Do not pass those brace tokens through
`buildTrackedUrl`.

## First-touch CRM note

Admin Engineer's first-touch columns store source, medium, campaign, landing
page, gclid, fbclid, and session. They do not yet store content. Creative
attribution in the CRM today is the `ad-content:<x>` tag from
`utm_content`. Adding `first_touch_utm_content` is a follow-on on that PR.
