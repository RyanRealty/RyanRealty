---
name: social-channel-audit
description: Systematic audit checklist for every Ryan Realty social channel profile. Produces a complete audit with zero blank fields. Use when Matt asks to audit channels, check profiles, verify consistency, or before any channel consolidation rollout. Covers all 14+ platforms. Invokes Chrome MCP to visit each live profile and capture current state. Cross-references against social-channel-specs.md targets. Outputs audit spreadsheet with current vs target values and gap analysis.
---

## Purpose

Audit every Ryan Realty social channel profile against brand targets. Capture current state by visiting live profiles via Chrome MCP. Compare against target values from `social-channel-specs.md` (fallback: targets embedded per platform below). Identify every gap. Output an xlsx spreadsheet with zero blank fields.

This skill does NOT cover content strategy or algorithm signals — those live in `platform-algorithm-brief.md` and `platform-publishing.md`. This skill covers profile setup only: handles, bios, photos, links, contact info, account types, and brand consistency.

---

## Brand Targets (Reference Defaults)

These are the authoritative target values. If `social-channel-specs.md` exists, load it first — it overrides these defaults.

| Field | Target Value |
|-------|-------------|
| Handle | @ryanrealtybend (all platforms where available) |
| Display Name | Matt Ryan \| Ryan Realty (variations allowed per platform) |
| Name Field (IG) | Matt Ryan \| Bend Realtor (searchable — keyword optimized) |
| Website / Bio Link | ryan-realty.com/connect |
| Phone | 541.213.6706 (marketing format) / (541) 213-6706 (GBP standard US format) |
| Email | matt@ryan-realty.com |
| Location | Bend, OR |
| Brand Colors | Navy blue (primary) + Gold (accent) |
| Profile Photo | Matt headshot (white background, professional) — NOT the logo |
| Logo Use | Dark navy on transparent — white version MISSING (known gap) |
| Primary CTA | "Send Message" / "DM me" direction |

---

## Audit Workflow

### Step 1: Load Target Specs

1. Check if `/sessions/practical-vigilant-pasteur/mnt/SOCIAL MEDIA MANAGER/.claude/skills/ryan-realty/social-channel-specs.md` exists.
2. If it exists, read it and use its target values for all comparisons.
3. If it does NOT exist, use the Brand Targets table above as the fallback reference.
4. Note in the audit output which spec source was used: "social-channel-specs.md" or "embedded defaults."

### Step 2: Visit Each Live Profile

Use Chrome MCP tools (`mcp__Claude_in_Chrome__navigate`, `mcp__Claude_in_Chrome__get_page_text`, `mcp__Claude_in_Chrome__read_page`) to visit each profile URL in the Platform Audit Order below.

For each platform:
- Navigate to the public profile URL.
- Capture all visible profile fields (name, handle, bio, photo, link, phone, category, etc.).
- Take note of missing, incorrect, or off-brand elements.
- If a profile cannot be found at the expected URL, record as "PROFILE NOT FOUND — [searched URL]."
- If a field is not publicly visible (requires login), record as "UNABLE TO VERIFY — requires authenticated access."
- Never leave a field blank. See Zero Blanks Rule below.

Capture screenshots where available using `mcp__Claude_in_Chrome__read_page` for the Screenshots sheet.

### Step 3: Record Current vs Target

For each platform, record the following fields. All field values must be present — never blank.

#### Instagram (instagram.com/ryanrealtybend)
| Audit Field | Current State | Target | Match? | Notes |
|---|---|---|---|---|
| Profile URL | | instagram.com/ryanrealtybend | | |
| Handle (@username) | | @ryanrealtybend | | |
| Name field (30 char max, searchable) | | Matt Ryan \| Bend Realtor | | |
| Bio (150 char hard limit) | | Service-oriented, authentic, includes DM CTA | | |
| Bio link (up to 5 native links) | | ryan-realty.com/connect | | |
| Profile photo | | Matt headshot (not logo), min 1080x1080 displayed as circle | | |
| Account type | | Business (not Personal or Creator) | | Required for scheduling, lead forms, contact buttons |
| Category | | Real Estate Agent | | |
| Contact email visible | | matt@ryan-realty.com | | |
| Contact phone visible | | 541.213.6706 | | |
| Action button configured | | "Send Message" or "Book Now" | | |
| Story highlights present | | Yes — organized by topic | | |
| Highlight covers on-brand | | Navy + gold or headshot | | |
| Grid visual (3:4 ratio, permanent 2025) | | Consistent, on-brand | | |
| Pinned posts configured | | Yes — top 3 posts pinned | | |
| Broadcast Channel set up | | Yes (or documented reason why not) | | |
| Collabs feature used | | Yes (or documented reason why not) | | |
| Link in bio tool | | Native IG links or approved tool | | |
| Brand consistency score (1-10) | | 8+ | | |

#### Facebook (facebook.com/ryanrealtybend)
| Audit Field | Current State | Target | Match? | Notes |
|---|---|---|---|---|
| Profile URL | | facebook.com/ryanrealtybend | | |
| Page username (max 50 chars) | | ryanrealtybend | | |
| Page name (max 75 chars) | | Ryan Realty | | |
| Short description (255 char max) | | Present, service-oriented, no hype | | |
| Long description (2500 char max) | | Present, brand voice compliant | | |
| Profile photo (720x720 rec) | | Matt headshot | | |
| Cover photo (851x315, safe zone 820x360) | | On-brand navy/gold | | |
| CTA button | | "Send Message" | | |
| Page category (up to 3) | | Real Estate Agent (primary) | | |
| Website link | | ryan-realty.com/connect | | |
| Phone number | | (541) 213-6706 | | |
| Email address | | matt@ryan-realty.com | | |
| Location address | | Bend, OR | | |
| Account type | | Page (not Personal profile) | | |
| New Pages Experience enabled | | Yes (Full Control) | | |
| Services tab configured | | Yes | | |
| Reviews/Recommendations enabled | | Yes | | |
| Messenger auto-reply configured | | Yes | | |
| Pinned post present | | Yes | | |
| Brand consistency score (1-10) | | 8+ | | |

#### TikTok (tiktok.com/@ryanrealtybend)
| Audit Field | Current State | Target | Match? | Notes |
|---|---|---|---|---|
| Profile URL | | tiktok.com/@ryanrealtybend | | |
| Username (max 24 chars, 1 change per 30 days) | | @ryanrealtybend | | |
| Display name (max 30 chars) | | Matt Ryan \| Ryan Realty | | |
| Bio (80-160 chars — expanded late 2025) | | Present, authentic, no hype | | |
| Link in bio | | ryan-realty.com/connect | | Note: Business account = immediate link, no follower threshold |
| Profile photo | | Matt headshot | | |
| Account type | | Business | | Required for immediate link + contact buttons + analytics |
| Category | | Real Estate | | |
| Email contact button | | matt@ryan-realty.com | | |
| Phone contact button | | 541.213.6706 | | |
| Playlists configured | | Yes (requires 10K followers) or N/A | | |
| LIVE access | | Yes (requires 1K followers + age 18+) or N/A | | |
| Pinned videos | | Yes — top 3 pinned | | |
| Brand consistency score (1-10) | | 8+ | | |

#### YouTube (youtube.com/@ryanrealtybend)
| Audit Field | Current State | Target | Match? | Notes |
|---|---|---|---|---|
| Channel URL / handle | | youtube.com/@ryanrealtybend | | Custom URL requires 100 subs + 30 days |
| Channel name | | Ryan Realty | | |
| Handle (@username, max 30 chars) | | @ryanrealtybend | | |
| Channel description (1000 char max) | | Present, keyword-rich, brand voice | | |
| Profile photo (800x800) | | Matt headshot | | |
| Banner (2560x1440, safe zone 1235x338 center) | | On-brand navy/gold | | |
| Business email (via Studio Settings) | | matt@ryan-realty.com | | |
| Channel keywords (Studio Settings) | | Present — Bend OR, real estate, etc. | | |
| Website link | | ryan-realty.com/connect | | |
| Watermark (150x150 transparent PNG) | | Ryan Realty logo or Matt headshot | | |
| Channel trailer set | | Yes | | |
| Sections/playlists organized | | Yes | | |
| Video thumbnail template consistent | | Yes — 1280x720, brand colors | | |
| Brand consistency score (1-10) | | 8+ | | |

#### LinkedIn Personal (Matt Ryan)
| Audit Field | Current State | Target | Match? | Notes |
|---|---|---|---|---|
| Profile URL | | linkedin.com/in/[matt-ryan-handle] | | |
| Custom URL (3-100 chars, 5 changes per 6 months) | | linkedin.com/in/mattryan-ryanrealty or similar | | |
| Profile photo (640x640) | | Matt headshot (professional) | | |
| Banner (1584x396, safe zone 1350x220 center) | | On-brand navy/gold | | |
| Headline (220 chars, 60-70 show in search) | | "Principal Broker \| Ryan Realty \| Bend, OR Real Estate" or similar | | |
| About section (2600 chars) | | Present, brand voice compliant, keyword-rich | | |
| Location | | Bend, Oregon | | |
| Contact info — website | | ryan-realty.com | | |
| Contact info — email | | matt@ryan-realty.com | | |
| Contact info — phone | | 541.213.6706 | | |
| "Follow" as primary action (via Settings) | | Yes — Creator Mode removed March 2024; enable via Settings > Visibility > Followers | | |
| Featured section populated | | Yes — key listings, articles, or links | | |
| Experience — Ryan Realty entry | | Yes, current, accurate | | |
| Skills populated | | Yes, real estate relevant | | |
| Recommendations present | | Yes (or actively requesting) | | |
| Brand consistency score (1-10) | | 8+ | | |

#### LinkedIn Company (Ryan Realty)
| Audit Field | Current State | Target | Match? | Notes |
|---|---|---|---|---|
| Company page URL | | linkedin.com/company/ryan-realty | | |
| Company name | | Ryan Realty | | |
| Logo (400x400) | | Ryan Realty logo — NOTE: dark navy on transparent; may not render on dark LI backgrounds | | Known brand gap: white version needed |
| Cover image (4200x700) | | On-brand navy/gold | | |
| Tagline (120 chars) | | Present, authentic, no hype | | |
| Description (2000 chars, first 156 in search) | | Present, keyword-rich first 156 chars | | |
| Website | | ryan-realty.com | | |
| Phone | | (541) 213-6706 | | |
| Industry | | Real Estate | | |
| Company size | | 1-10 employees | | |
| Location | | Bend, OR | | |
| Specialties (up to 20) | | Present — Bend real estate, Central Oregon, etc. | | |
| Brand consistency score (1-10) | | 8+ | | |

#### Google Business Profile
| Audit Field | Current State | Target | Match? | Notes |
|---|---|---|---|---|
| GBP URL / Place ID | | Business name "Ryan Realty" — verify via Google Maps | | |
| Business name (exact legal name, no keyword stuffing) | | Ryan Realty | | Google enforces exact legal name |
| Primary category | | Real estate agency (NOT "Real estate agent" — correct for a brokerage) | | |
| Additional categories (up to 9) | | Present | | |
| Description (750 chars) | | Present, first 244 chars most visible | | |
| Phone (standard US format for GBP) | | (541) 213-6706 | | Note: GBP uses US format, not period-separated |
| Website | | ryan-realty.com | | |
| Appointment URL | | ryan-realty.com/connect | | Drives ~20% of listing clicks |
| Address / service area | | Bend, OR + service areas configured (up to 20 ZIPs) | | |
| Logo (720x720 rec: 1200x1200) | | Ryan Realty logo | | |
| Cover photo (1024x575) | | On-brand, professional | | |
| Additional photos present | | Yes, 1200x900 | | |
| Hours set | | Yes | | |
| Attributes configured | | Yes — relevant service attributes | | |
| Services listed | | Yes | | |
| Q&A section | | NOTE: Q&A API discontinued Nov 3 2025 — monitor for full retirement | | |
| Posts active (within 30 days) | | Yes | | |
| Reviews responding | | Yes — every review has a response | | |
| Messaging enabled | | Yes | | |
| AI Overviews presence (67% of local searches post-March 2026) | | Optimized (schema markup + accurate NAP) | | |
| NAP consistency (matches all other platforms) | | Yes | | Critical for local SEO |
| Brand consistency score (1-10) | | 8+ | | |

#### Zillow (zillow.com/profile/ryanrealtybend or by name)
| Audit Field | Current State | Target | Match? | Notes |
|---|---|---|---|---|
| Profile URL | | zillow.com/profile/[handle] | | |
| Agent name | | Matt Ryan | | |
| Brokerage | | Ryan Realty | | |
| Headshot (min 330x220px JPEG under 25MB) | | Matt headshot, professional | | |
| Bio present | | Yes, 300-500 words | | |
| Phone | | (541) 213-6706 | | |
| Email | | matt@ryan-realty.com | | |
| Website | | ryan-realty.com | | |
| Service areas / ZIPs | | Bend + Central Oregon ZIPs | | |
| Specialties (max 10) | | Present, relevant | | |
| MLS Agent ID connected | | Yes (or N/A if not applicable) | | |
| Reviews/ratings present | | Yes (or documented baseline) | | |
| Best of Zillow badge | | Yes (requires 90+ CSAT) or documented gap | | |
| Zillow Pro status (launching mid-2026, $138/mo) | | Evaluate when available | | |
| Brand consistency score (1-10) | | 8+ | | |

#### Realtor.com (realtor.com/realestateagents/[name])
| Audit Field | Current State | Target | Match? | Notes |
|---|---|---|---|---|
| Profile URL | | realtor.com/realestateagents/[matt-ryan] | | |
| Agent name | | Matt Ryan | | |
| Brokerage | | Ryan Realty | | |
| Profile photo | | Matt headshot, professional | | |
| Bio (target: 300-500 words) | | Present, brand voice compliant | | |
| Phone | | (541) 213-6706 | | |
| Email | | matt@ryan-realty.com | | |
| Website | | ryan-realty.com | | |
| NRDS ID connected | | Yes — auto-populates designations | | |
| Designations populated | | Yes | | |
| Service areas | | Bend + Central Oregon | | |
| Reviews present | | Yes | | |
| RateMyAgent integration | | Yes (or N/A) | | Review syncing |
| Local Expert tier | | Evaluate (paid tier launched Sept 2025) | | |
| Brand consistency score (1-10) | | 8+ | | |

#### Homes.com (homes.com/real-estate-agents/[name])
| Audit Field | Current State | Target | Match? | Notes |
|---|---|---|---|---|
| Profile URL | | homes.com/real-estate-agents/[matt-ryan] | | |
| Agent name | | Matt Ryan | | |
| Brokerage | | Ryan Realty | | |
| Profile photo | | Matt headshot | | |
| Bio present | | Yes | | |
| Phone | | (541) 213-6706 | | |
| Email | | matt@ryan-realty.com | | |
| Homes Pro dashboard access | | Yes (free tier) | | |
| 3D tours / listing retargeting enabled | | Yes (included in Membership) | | |
| Boost option status | | Evaluated ($149-699 per listing) | | |
| Auto-renewal contract terms reviewed | | Yes — caution flag | | |
| AI experience presence (launched Feb 2026) | | Verified | | |
| Brand consistency score (1-10) | | 8+ | | |

#### Redfin (redfin.com/agent/[name])
| Audit Field | Current State | Target | Match? | Notes |
|---|---|---|---|---|
| Profile URL | | redfin.com/agent/[matt-ryan] or N/A | | |
| Partner Agent Program status | | Active / Not enrolled / Evaluating | | 30% referral fee; 15 closed txns minimum; 5-min lead response required; 4.0+ star to stay |
| Profile photo | | Matt headshot | | |
| Bio present | | Yes | | |
| Phone | | (541) 213-6706 | | |
| Reviews/rating | | 4.0+ or documented gap | | |
| Brand consistency score (1-10) | | 8+ or N/A | | |

#### X / Twitter (x.com/ryanrealtybend)
| Audit Field | Current State | Target | Match? | Notes |
|---|---|---|---|---|
| Profile URL | | x.com/ryanrealtybend | | |
| Username (max 15 chars) | | @ryanrealtybend | | NOTE: 15-char limit may require truncation |
| Display name | | Matt Ryan \| Ryan Realty | | |
| Bio (160 chars) | | Present, authentic | | |
| Profile photo (400x400) | | Matt headshot | | |
| Header image (1500x500) | | On-brand navy/gold | | |
| Website link | | ryan-realty.com/connect | | |
| Location | | Bend, OR | | |
| Account type | | Personal or Premium ($8-40/mo) | | |
| Activity level | | Active or documented low-priority status | | |
| Brand consistency score (1-10) | | 7+ (tier 3 platform) | | |

#### Pinterest (pinterest.com/ryanrealtybend)
| Audit Field | Current State | Target | Match? | Notes |
|---|---|---|---|---|
| Profile URL | | pinterest.com/ryanrealtybend | | |
| Display name (65 chars max) | | Ryan Realty | | |
| Bio (500 chars) | | Present | | |
| Profile photo (min 165x165, rec 600+) | | Matt headshot or logo | | |
| Website claimed | | ryan-realty.com (claimed for Rich Pins) | | |
| Account type | | Business (free, required for analytics) | | |
| Boards organized | | Yes — Bend, listings, home tips, etc. | | |
| Rich Pins enabled | | Yes | | Requires website claim |
| Standard pin format (1000x1500, 2:3) | | Consistent | | |
| Brand consistency score (1-10) | | 7+ (tier 3 platform) | | |

#### Threads (threads.net/@ryanrealtybend)
| Audit Field | Current State | Target | Match? | Notes |
|---|---|---|---|---|
| Profile URL | | threads.net/@ryanrealtybend | | Username = Instagram handle, cannot change independently |
| Username | | @ryanrealtybend | | Mirrors IG handle |
| Bio (150 chars — separate from IG bio) | | Present, authentic | | NOTE: This bio is independent of Instagram bio |
| Profile photo | | Matt headshot (shared with IG) | | |
| Link in profile | | ryan-realty.com/connect | | |
| Activity level | | Active or documented low-priority status | | |
| Fediverse integration (June 2025) | | Enabled or documented decision | | |
| Follower count | | Documented | | |
| Brand consistency score (1-10) | | 7+ (tier 3 platform) | | |

#### Nextdoor (nextdoor.com/pages/[ryan-realty])
| Audit Field | Current State | Target | Match? | Notes |
|---|---|---|---|---|
| Business page URL | | nextdoor.com/pages/[ryan-realty] | | |
| Business name | | Ryan Realty | | |
| Category | | Real Estate Agent or Real Estate Agency | | |
| Logo (500x500) | | Ryan Realty logo | | |
| Banner (1156x650) | | On-brand navy/gold | | |
| Description present | | Yes | | |
| Phone | | (541) 213-6706 | | |
| Website | | ryan-realty.com | | |
| Neighborhood Sponsorship status | | Active / Not enrolled / Evaluating ($30-150/mo per ZIP) | | 2 guaranteed reach-extended posts per sponsored ZIP per month |
| Recommendations present | | Yes (verified homeowner trust signals) | | |
| Brand consistency score (1-10) | | 7+ (tier 3 platform) | | |

### Step 4: Generate Gap Analysis

After completing all 15 platform audits:

1. **Count total fields audited** across all platforms.
2. **Count fields with mismatches** (Current State does not match Target).
3. **Categorize gaps by severity:**
   - **Critical:** Handle wrong, phone missing, website link broken, wrong account type, NAP inconsistency across GBP/Zillow/Realtor.com
   - **High:** Bio missing or off-brand, profile photo missing or wrong, CTA button not configured, link in bio wrong
   - **Medium:** Cover/header image missing or off-brand, highlights not organized, pinned posts missing
   - **Low:** Optional features not enabled, minor wording differences, low follower counts

4. **NAP Consistency Check:** Compare Name/Address/Phone across ALL platforms. Any variation is a Critical gap (impacts Google local SEO directly). Document every discrepancy.

5. **Brand Voice Spot-Check:** For each bio captured, run a quick brand voice check:
   - Pass: Authentic, genuine, service-oriented, no hype
   - Fail: "Dream home," "luxury lifestyle," "best in class," hollow buzzwords, salesy language
   - Document any failing bios as High priority gaps.

6. **White Logo Gap Reminder:** Note on all platforms where the Ryan Realty logo appears on a dark background — the white version is currently missing. Flag as a persistent brand gap until resolved.

### Step 5: Output

Generate an xlsx spreadsheet with three sheets:

**Sheet 1: Audit Summary**
- Columns: Platform | Field | Current State | Target | Match (Y/N) | Severity | Notes
- One row per audited field across all 15 platforms
- No blank cells — every cell has a value per Zero Blanks Rule
- Sort: Critical gaps first, then High, Medium, Low

**Sheet 2: Action Items**
- Columns: Priority | Platform | Action Required | Owner | Est. Time | Status
- Priority: Critical / High / Medium / Low
- Owner: Default "Agent" (can be automated via API) or "Matt" (requires account access)
- Est. Time: Rough effort estimate (e.g., "5 min," "30 min," "requires new asset")
- Status: Open (default at audit time)
- Pre-populate with all identified gaps from Step 4

**Sheet 3: Screenshots**
- Columns: Platform | URL Visited | Date/Time | Screenshot Capture | Notes
- Record every URL visited and whether a screenshot was captured
- If Chrome MCP screenshot unavailable: document as "UNABLE TO CAPTURE — [reason]"

Use the `xlsx` skill (or Python openpyxl if skill unavailable) to produce the file. Save to:
`/sessions/practical-vigilant-pasteur/mnt/SOCIAL MEDIA MANAGER/audits/social-channel-audit-YYYY-MM-DD.xlsx`

---

## Platform Audit Order

Execute in this priority sequence. Tier 1 platforms first (highest brand impact), then Tier 2, then Tier 3.

| Priority | Platform | URL to Visit | Tier |
|----------|----------|-------------|------|
| 1 | Instagram | instagram.com/ryanrealtybend | 1 |
| 2 | Facebook | facebook.com/ryanrealtybend | 1 |
| 3 | TikTok | tiktok.com/@ryanrealtybend | 1 |
| 4 | Google Business Profile | Search "Ryan Realty Bend OR" on Google Maps | 1 |
| 5 | YouTube | youtube.com/@ryanrealtybend | 1 |
| 6 | Zillow | zillow.com/profile/ (search by name) | 2 |
| 7 | Realtor.com | realtor.com/realestateagents/ (search by name) | 2 |
| 8 | LinkedIn Personal | linkedin.com/in/ (search Matt Ryan) | 2 |
| 9 | LinkedIn Company | linkedin.com/company/ryan-realty | 2 |
| 10 | Homes.com | homes.com/real-estate-agents/ (search by name) | 2 |
| 11 | Redfin | redfin.com/agent/ (search by name) | 2 |
| 12 | Threads | threads.net/@ryanrealtybend | 3 |
| 13 | X / Twitter | x.com/ryanrealtybend | 3 |
| 14 | Pinterest | pinterest.com/ryanrealtybend | 3 |
| 15 | Nextdoor | nextdoor.com/pages/ (search Ryan Realty) | 3 |

---

## Handling "Not Found" Channels

If a platform profile is not found at the expected URL:

1. Try alternate search methods (search by name, by email, by phone).
2. If still not found, record as "PROFILE NOT FOUND — searched [URLs attempted]."
3. Add an Action Item: "Create [Platform] profile" with Priority = High (Tier 1-2) or Medium (Tier 3).
4. Do not skip the platform row — fill every field with "N/A — PROFILE NOT FOUND."

If a profile exists but is a personal profile instead of a business account:
- Record account type mismatch as a Critical gap.
- Add Action Item: "Convert to Business account on [Platform]."

---

## Zero Blanks Rule

**Every cell in the xlsx output must contain a value.** No empty cells, ever.

Allowed fill values when data is unavailable:
- `NOT SET` — field exists on the platform but Matt has not configured it
- `MISSING` — field is required but absent (e.g., no profile photo)
- `N/A` — field does not apply to this platform or account type
- `UNABLE TO VERIFY — [reason]` — field exists but Chrome MCP could not access it (e.g., requires login, geo-blocked, page load error)
- `PROFILE NOT FOUND — [searched URL]` — the entire profile could not be located

Do not use blanks as a proxy for "unknown." If you don't know, say so explicitly with one of the above values and a reason.

---

## Verification

Before marking the audit complete:

- [ ] All 15 platforms attempted (no skipped rows)
- [ ] Zero blank cells in Audit Summary sheet
- [ ] Zero blank cells in Action Items sheet
- [ ] Zero blank cells in Screenshots sheet
- [ ] NAP consistency check completed and documented
- [ ] Brand voice spot-check completed on all bios
- [ ] White logo gap noted where applicable
- [ ] All Critical gaps listed first in Action Items sorted by severity
- [ ] xlsx file saved to `/sessions/practical-vigilant-pasteur/mnt/SOCIAL MEDIA MANAGER/audits/social-channel-audit-YYYY-MM-DD.xlsx`
- [ ] Report total fields audited, total gaps found, breakdown by severity

Report format on completion:
```
Audit complete. [DATE]
Platforms audited: 15 / 15
Total fields audited: [N]
Gaps found: [N] ([N] Critical / [N] High / [N] Medium / [N] Low)
Spec source: social-channel-specs.md / embedded defaults
NAP consistency: PASS / FAIL ([N] discrepancies)
Output: /sessions/practical-vigilant-pasteur/mnt/SOCIAL MEDIA MANAGER/audits/social-channel-audit-[DATE].xlsx
```
