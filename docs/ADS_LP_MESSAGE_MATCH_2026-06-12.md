# Ads ↔ LP message match (locked to the Figma-design landing pages)

Rule (Matt directive 2026-06-12): every ad must show what the visitor sees on the
landing page — same promise, same words, same imagery. An ad that says one thing
and lands on another page is a wasted click. Apply when the redesigned LPs ship;
ad creative uses the SAME hero asset the page uses (export crop from the live page
asset, not a different stock photo).

Compliance on every ad + form: no fabricated stats, no banned vocabulary, fair
housing clean, and the LP carries the SMS consent disclosure (already live).
Phone for ad surfaces: 541.703.3095 (FUB-tracked).

## 1. Sellers — destination https://ryan-realty.com/lp/seller-home-value
- Hook (mirrors hero H1): "What Would Your Home Bring Today?"
- Primary text: "See what buyers are paying for homes like yours, from recent
  Central Oregon sales. A real number from a local broker, not an algorithm.
  Your report lands within one business day."
- Headline: "Get my home value"  · CTA button: Learn More / Get Quote
- Creative: the page's hero photo (Deschutes/Old Mill aerial), navy scrim, white text.
- Lead lands: FUB + CRM instantly, CMA queued, first text prepared for broker approval.

## 2. Expired — destination https://ryan-realty.com/lp/expired-listing
- Hook: "Your Listing Expired. Here Is the Honest Read."
- Primary text: "A free written audit of your prior listing. Pricing, photos,
  syndication, agent responsiveness. You get it either way, no listing agreement
  required."
- Headline: "Get my free audit" · CTA: Learn More
- Creative: the page's darker hero treatment. No urgency framing, no "act now."
- Note: cold-audience targeting only — detection-cron leads come from MLS, not ads.

## 3. FSBO — destination https://ryan-realty.com/lp/fsbo
- Hook: "Selling It Yourself? Smart. Here Is Backup."
- Primary text: "Keep the sale yours. We will tell you what your home should bring,
  who the buyer pool is, and where for-sale-by-owner deals lose money. Free, and
  you owe us nothing."
- Headline: "Get my pricing report" · CTA: Learn More
- Creative: the page's ranch-home hero. Respectful tone — never mock the FSBO choice.

## 4. Buyers — destination https://ryan-realty.com/lp/buyer-listing-alerts
- Hook: "First Matches in 30 Minutes."
- Primary text: "Tell us what you are looking for. A Ryan Realty broker pulls
  listings that match, within 30 minutes, not the next business day."
- Headline: "Start my listing alerts" · CTA: Sign Up
- Creative: the page's Cascade hero. Optional carousel variant: the six community
  tiles (Tetherow, Caldera Springs, Crosswater, Sunriver, Vandevert Ranch,
  Broken Top) exactly as they appear on the page.

## Execution order (after Matt approves the redesigned LPs to prod)
1. Export each LP's actual hero asset at ad aspect ratios (1080x1080, 1200x628).
2. Update/create the Meta ad sets per docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md flow —
   ops:meta_ads change, Matt-explicit approval per action (he directed the match
   2026-06-12; confirm per campaign before mutation).
3. UTM per LP (utm_campaign=lp-<audience>-match) so GA4 + marketing_channel_daily
   attribute cleanly; ad-click visitors suppress the sign-in modal automatically.
4. 48h after live: verify message-match CTR vs prior creative in the weekly
   growth packet; iterate copy only in lockstep with the LP (change both or neither).
