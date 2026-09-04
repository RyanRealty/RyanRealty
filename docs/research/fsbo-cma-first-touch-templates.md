# FSBO CMA First-Touch Research + Templates — Ryan Realty (Bend OR)

**North star:** Convert FSBO (and expired) into Ryan Realty listings. Templates are conversion tools: plain language → clear CTA to walk comps / book a listing conversation. Not education for its own sake. Not “hire us and you net more.” Zero mannered prose.

**Locked national facts (share/% only; no national median $ gap as proof):**
- 5% of sellers FSBO (all-time low)
- 91% of sellers used an agent/broker
- 88% of buyers purchased through an agent/broker
- 60% of FSBO sellers knew the buyer
  Source: NAR 2025 Profile of Home Buyers and Sellers
- 21% try FSBO then hire an agent
  Source: Zillow Group Consumer Housing Trends Report 2024 (stated on Zillow “How to Sell Your House For Sale By Owner”; Clever cites same page)
- Oregon Seller’s Property Disclosure Statement applies to most residential FSBO sales (ORS 105.464 / 105.465)

---

## Research summary (for engineers / copy owners)

### How top educators explain “what is a CMA” in plain English
Best first-mention replacements (avoid bare “CMA” in subject / first line):
- “a pricing report based on recent nearby sales”
- “a market snapshot of nearby sold and active homes”
- “how buyers will compare your price to recent sales”
- “pricing analysis based on comparable recent sales” (Arivana)
- Core idea (Keeping Equity): your home is worth roughly what similar homes nearby sold for recently; adjust for differences; arrive at a range — not an appraisal.

CMA ≠ appraisal: informal pricing research before listing vs. lender-ordered formal valuation after an offer.

### FSBO first-contact best practices (when attaching analysis)
- Subject: address/neighborhood-specific; avoid “CMA” acronym; under ~40 chars when possible
- Open: name the property; one useful observation; respect that they chose FSBO
- Explain in 1–2 lines what the PDF is; show numbers in PDF; keep email short
- CTA: walk through the comps together OR book a short listing conversation — not “let me list you”
- Lead with data they can use either way; conversion happens when they need help interpreting / acting on it

### Common mistakes
- Leading with “CMA” or “Comparative Market Analysis” unexplained
- Assuming they know comps / DOM / list-to-sale
- Condescending “good for you for trying” syrup
- Net-more / commission scare as headline
- Fake “I have a buyer” claims
- Education dump with no booking CTA

---

## A) Plain-language glossary (one line each)

| Term | FSBO-plain line |
|------|-----------------|
| **CMA** | A pricing report that compares your home to similar homes that sold nearby recently, then suggests a realistic asking-price range. |
| **Comps** | Those similar nearby sales (and often active listings) used as the comparison set. |
| **List price** | The public asking price you put on the home — not a guarantee of what you’ll get, and not the same as appraised value. |
| **Net sheet** | A worksheet that starts with a sale price and subtracts loan payoff, fees, and credits so you see estimated cash at closing. |

---

## B) Best-practice rules (conversion-oriented)

1. Never put bare “CMA” in the subject line; use “pricing report,” “market snapshot,” or “nearby sales.”
2. On first acronym use in body, define immediately — or skip the acronym and say “pricing report.”
3. Name {{property_address}} in subject and first sentence (proves not a blast).
4. One concrete observation from the report (range, a nearby sale, or how their ask sits vs. solds) — then attach PDF.
5. Email = what it is + why it matters for *their* ask + CTA. PDF = comps, adjustments, range, suggested list.
6. CTA = walk the comps OR book a listing conversation (calendar link). Not “call me sometime.”
7. Respect FSBO choice without praise theater; skip corporate empathy.
8. Use share/% national facts only in the bottom reasons block — never national median $ gap as “you’ll net more.”
9. Oregon note: disclosure still applies if selling FSBO (ORS 105.464/105.465) — one line, not a legal essay.
10. Frame professional help as marketing reach, pricing discipline, buyer-agent channel, paperwork/disclosure, negotiation — not “we make you richer.”
11. Soft close that still converts: “If you want, I’ll walk you through these comps in 15 minutes” + {{calendar_link}}.
12. Include identity: {{agent_name}}, Ryan Realty, {{agent_phone}}, {{agent_email}}, brokerage disclosure as required.

---

## C) FINAL first-touch email template

**Template ID:** `fsbo_cma_first_touch_v1`  
**Placement:** first email with CMA PDF attached  
**Tone:** plain prose, conversion CTA, no mannered filler

### Subject options (pick one; A/B later)
1. `Pricing report for {{property_address}}`
2. `Nearby sales vs your ask — {{property_street}}`
3. `Market snapshot: {{property_address}}`

### Body

```
Hi {{owner_first_name}},

I put together a pricing report for {{property_address}} — a side-by-side of recent nearby sales and current competition, with a suggested asking range.

Attached PDF. Short version: based on those comps, a realistic list range looks like {{price_range_low}}–{{price_range_high}}. Suggested list: {{suggested_list_price}}.

Most buyers shopping {{property_city}} work with an agent and compare every listing against recent solds. If your ask sits outside what those solds support, showings and offers usually stall.

If you want, I can walk you through the comps on a short call and talk through what a Ryan Realty listing would look like for this address — MLS exposure, buyer outreach, and the Oregon disclosure/paperwork side.

Book here: {{calendar_link}}
Or reply with a time that works. {{agent_phone}} · {{agent_email}}

{{agent_name}}
Ryan Realty
{{agent_phone}}
{{agent_email}}
{{brokerage_disclosure_line}}
```

**Notes for coders:**
- If {{suggested_list_price}} empty, drop that sentence fragment; keep range.
- Never send without PDF attachment when this template fires.
- Do not auto-insert “CMA” in subject.

---

## D) Short CMA cover / intro blurb template

**Template ID:** `cma_cover_intro_v1`  
**Placement:** PDF top, web CMA page hero, or email preamble above fold

```
Pricing report for {{property_address}}
Prepared for {{owner_full_name}} · {{report_date}}
{{property_city}}, Oregon

This is a comparative market analysis — a pricing report based on recent nearby sales and active listings similar to your home. It is not an appraisal. Lenders order appraisals after an offer; this report is for setting an asking price that matches what buyers in {{property_city}} are actually paying.

Suggested list price: {{suggested_list_price}}
Suggested range: {{price_range_low}} – {{price_range_high}}

Inside: sold comps, active competition, adjustments for differences, and how your current ask ({{current_ask_price}}) sits against the set.

Questions on any line? {{agent_name}} · {{agent_phone}} · {{calendar_link}}
```

**If current ask unknown**, omit the “current ask” sentence.

---

## E) CMA bottom “why list with a realtor” block

**Template ID:** `cma_bottom_why_list_v1`  
**Placement:** last page of CMA PDF / bottom of web CMA / optional email PS after attachment note  
**Frame:** researched case for hiring a professional — not “net more with us”

```
Why most sellers list with a realtor

Pricing is one job. Getting the home in front of the buyers who can close — and managing offers, inspections, and Oregon disclosures — is the rest.

National picture (shares only):
• {{stat_fsbo_share}} of recent sellers sold FSBO — an all-time low.¹
• {{stat_seller_agent_share}} of sellers used a real estate agent or broker.¹
• {{stat_buyer_agent_share}} of buyers purchased through an agent or broker.¹
• {{stat_fsbo_knew_buyer_share}} of FSBO sellers already knew their buyer (friend, relative, neighbor, tenant).¹ If you don’t already have that buyer, you are competing for the other group.
• {{stat_try_then_hire_share}} of sellers who start on their own later hire an agent.²

Oregon note: selling FSBO does not remove the Seller’s Property Disclosure Statement requirement for most 1–4 unit residential sales. You still complete and deliver it to each buyer who makes a written offer (ORS 105.464, 105.465).

What a Ryan Realty listing adds for {{property_address}}:
• MLS + portal distribution so agent-represented buyers can find the home
• Pricing and repositioning against live comps (not a one-time PDF)
• Showing coordination and offer management
• Contract, disclosure, and closing coordination with your escrow/title team

Next step: walk these comps together and decide if listing with Ryan Realty is the better path for this sale.
{{calendar_link}} · {{agent_phone}} · {{agent_email}}
{{agent_name}}, Ryan Realty
```

### Static copy vs sourced footnotes

| Fact | Default static copy (merge or hardcode) | Source | Footnote |
|------|----------------------------------------|--------|----------|
| 5% FSBO | `5%` → `{{stat_fsbo_share}}` | NAR 2025 Profile | ¹ |
| 91% sellers with agent | `91%` | NAR 2025 Profile | ¹ |
| 88% buyers with agent | `88%` | NAR 2025 Profile | ¹ |
| 60% FSBO knew buyer | `60%` | NAR 2025 Profile (Top 10 Takeaways) | ¹ |
| 21% try-then-hire | `21%` | Zillow Group Consumer Housing Trends Report 2024 | ² |
| OR disclosure | static legal sentence (no %) | ORS 105.464 / 105.465 | inline cite OK |

**Footnote block (PDF footer):**
```
¹ National Association of REALTORS®, 2025 Profile of Home Buyers and Sellers.
² Zillow Group Consumer Housing Trends Report 2024 (as reported in Zillow’s FSBO seller guide).
```

**Do NOT include** national median FSBO vs agent-assisted sale price gap in this block (Matt lock).

---

## F) Recommended merge field list for engineers

| Merge field | Example | CRM / system source |
|-------------|---------|---------------------|
| `{{owner_first_name}}` | Sarah | Contact.first_name |
| `{{owner_full_name}}` | Sarah Nguyen | Contact.full_name |
| `{{property_address}}` | 123 NW Cascade Ave, Bend, OR 97703 | Listing/Property.full_address |
| `{{property_street}}` | 123 NW Cascade Ave | Property.street_line |
| `{{property_city}}` | Bend | Property.city |
| `{{price_range_low}}` | $625,000 | CMA.range_low (formatted currency) |
| `{{price_range_high}}` | $655,000 | CMA.range_high |
| `{{suggested_list_price}}` | $649,000 | CMA.suggested_list |
| `{{current_ask_price}}` | $679,000 | FSBO.ask or Property.list_price (nullable) |
| `{{report_date}}` | September 3, 2026 | CMA.generated_at (PT display) |
| `{{calendar_link}}` | https://… | Agent.calendar_url |
| `{{agent_name}}` | Matt Ryan | Agent.display_name |
| `{{agent_phone}}` | (541) … | Agent.phone |
| `{{agent_email}}` | …@ryanrealty.com | Agent.email |
| `{{brokerage_disclosure_line}}` | Licensed in Oregon · Ryan Realty | Org.email_footer / compliance string |
| `{{stat_fsbo_share}}` | 5% | Config.stats.nar_2025.fsbo_share (static until refresh) |
| `{{stat_seller_agent_share}}` | 91% | Config.stats.nar_2025.seller_agent_share |
| `{{stat_buyer_agent_share}}` | 88% | Config.stats.nar_2025.buyer_agent_share |
| `{{stat_fsbo_knew_buyer_share}}` | 60% | Config.stats.nar_2025.fsbo_knew_buyer |
| `{{stat_try_then_hire_share}}` | 21% | Config.stats.zillow_2024.try_then_hire |
| `{{cma_pdf_url}}` | https://…/cma/… | CMA.artifact_url (attach or link) |
| `{{lead_type}}` | fsbo \| expired | Lead.source_type (routing only) |

**Refresh policy:** NAR Profile annual; Zillow CHTR when report year updates. Store source_url + retrieved_on on Config.stats.

---

## G) Open questions (non-blocking unless product needs them)

1. Exact brokerage disclosure / OR advertising line required on prospecting email (broker-approved string).
2. Whether expired-listing first-touch shares this template or needs a separate subject/observation line (“back on market” vs FSBO).
3. Confirm Zillow 21% remains the preferred cite vs Clever’s “about one in five” paraphrase when legal/compliance reviews footnotes (primary: Zillow Group CHTR 2024; Zillow FSBO guide restates it — fetch was bot-walled at research time; Clever footnote points to same Zillow URL).

---

## Sources cited

1. NAR — Top 10 Takeaways from 2025 Profile: https://www.nar.realtor/news/economists-outlook/top-10-takeaways-from-nars-2025-profile-of-home-buyers-and-sellers (5%, 91%, 88%, 60%)
2. NAR 2025 Profile Highlights PDF: https://www.nar.realtor/sites/default/files/2025-11/2025-profile-of-home-buyers-and-sellers-highlights-11-04-2025.pdf
3. Zillow — How to Sell Your House For Sale By Owner (cites Zillow Group Consumer Housing Trends Report 2024: 7% complete FSBO; 21% try then hire): https://www.zillow.com/learn/how-to-sell-your-house-for-sale-by-owner/
4. Clever FSBO statistics (attributes 21% to Zillow FSBO guide): https://listwithclever.com/real-estate-blog/fsbo-statistics/
5. ORS 105.465 / 105.464 — seller disclosure applies to covered residential sales (FSBO included): https://oregon.public.law/statutes/ors_105.465
6. Plain-language CMA framing: Keeping Equity CMA explainer; Arivana FSBO scripts (“pricing analysis” / “market snapshot”); Barnes Walker legal glossary (CMA ≠ binding appraisal)
