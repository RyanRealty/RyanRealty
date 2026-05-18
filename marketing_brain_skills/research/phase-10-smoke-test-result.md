# Phase 10 Smoke Test Result

**Date:** 2026-05-17
**Tester:** Autonomous pipeline agent (Sonnet 4.6)
**Scope:** End-to-end smoke test of the newsletter producer via synthetic action row. No real Resend send. No real Supabase write to marketing_brain_actions.

---

## Verdict: PASS (with expected blocker)

The pipeline executed correctly from brain emission through contact sheet render. The one send blocker (RESEND_FROM unset, mail.ryan-realty.com unverified) is the documented expected outcome per `social_media_skills/newsletter/SKILL.md` §11. All other steps completed without error.

---

## Artifact paths

| Artifact | Path |
|---|---|
| Contact sheet | `out/proof/2026-05-17/smoke-test/contact-sheet.html` |
| Newsletter HTML | `out/proof/2026-05-17/smoke-test/newsletter-2026-05.html` |
| Citations | `out/proof/2026-05-17/smoke-test/citations.json` |
| Synthetic action row | `out/proof/2026-05-17/smoke-test/synthetic-action-row.json` |

---

## Recipe step results

| Step | Result | Notes |
|---|---|---|
| 1. Read action row / transition to in_production | PASS (simulated) | No real Supabase write per smoke-test rules. Synthetic JSON written instead. |
| 2. Load mandatory references | PASS | SKILL.md, content_engine/SKILL.md, TEMPLATE.md, voice_guidelines.md, design_system/SKILL.md, bend-market-bible.md §1.10 all read. |
| 3. Pull market data | PASS | All three Supabase queries executed live. Median price $699,000 (758 rows), active count 922, closed last 6 months 1,012, MoS 5.47 (balanced), DOM 48 days (529 rows). |
| 4. Pull featured listing data | PARTIAL PASS | Only 2 active Tumalo SFR listings found (payload requested 3). Both listings embedded. Gap surfaced in contact sheet. |
| 5. Pull neighborhood spotlight | PARTIAL PASS | Tumalo not in neighborhood_subdivisions table; StreetName ILIKE fallback used for live listing query. Bible facts used for qualitative description. Not a blocking defect. |
| 6. Source community event | PASS | Payload provided "Bend Brewfest preview" as directive. Brewfest section written; specific 2026 dates not available, copy directs reader to official site. |
| 7. Draft newsletter copy | PASS | Voice self-check clean: zero em-dashes, zero en-dashes, zero semicolons, zero banned words (stunning/nestled/boasts/charming/pristine/gorgeous etc.), zero AI filler, zero exclamation marks in market sections, you/your subject throughout, 541.213.6706 and ryan-realty.com correctly formatted. |
| 8. Build HTML email | PASS | 600px max-width, navy #102742 + cream #faf8f4, Geist via web-safe fallback, stat cards with tabular numerals, listing cards with live Spark CDN photo URLs, CTA button, CAN-SPAM footer with physical address, unsubscribe link placeholder. |
| 9. Write citations.json | PASS | Seven citation entries. One entry per figure. All figures traced to live query or derived computation. Data gaps documented. |
| 10. Build contact sheet | PASS | Full contact sheet with pipeline status, iframe preview, verification trace table, gap callouts, UX assessment, approval prompt. |
| 11. Status transition to ready | PASS (simulated) | No real Supabase write per smoke-test rules. executor_response documented in contact sheet. |
| 12. Resend send | BLOCKED (expected) | RESEND_FROM unset. mail.ryan-realty.com not verified in Resend. This is the documented expected smoke-test outcome. |

---

## Data accuracy findings

- **CumulativeDaysOnMarket null issue:** The newsletter SKILL.md Step 3 references CumulativeDaysOnMarket for DOM. This column returns null for all Bend SFR closes in the 90-day window. DaysOnMarket (median 48 days, 529 rows) is the correct column. SKILL.md needs a correction.
- **All headline stats verified:** $699,000 median (758 rows YTD), 5.47 months of supply (balanced), 48 days DOM (529 rows). Math shown and traceable.
- **Market verdict correct:** 5.47 months falls in the 4-6 balanced range per CLAUDE.md thresholds. "Balanced market" verdict in the newsletter matches the data.

---

## UX assessment: auto-loaded vs. asked

| Category | Count |
|---|---|
| Auto-resolved (no Matt input needed) | 7 items: brand colors, broker signature, listing photos, voice/tone, phone/URL format, market stats, neighborhood facts |
| Provided in payload (expected inputs) | 3 items: edition month, neighborhood spotlight, community event |
| Asked of Matt unexpectedly | 0 |

Recipe fully meets the "auto-load, ask only essentials" standard. Zero unexpected asks.

---

## Recommended fixes (producer_change_requests)

**Priority: fix before first real send**

1. **SKILL.md Step 3 DOM column correction.** Replace CumulativeDaysOnMarket with DaysOnMarket as the primary DOM query column. Add a note that CumulativeDaysOnMarket is available but returns null for recent closes in this dataset.

**Priority: Phase 11.5 follow-up**

2. **Add Tumalo to neighborhood_subdivisions table.** No rows exist for neighborhood_slug='tumalo'. Add MLS subdivision aliases from bend-market-bible.md §1.10 buyer profile. Enables the Step 5 subdivision alias query.

3. **Brain payload key normalization.** Synthetic action row used edition_month and featured_neighborhood. SKILL.md schema expects month_label and neighborhood_slug. The brain or produce skill needs to normalize these keys before dispatch.

4. **Add newsletter to content_engine routing matrix.** content_engine/SKILL.md routing matrix does not contain a newsletter row. Add: "monthly newsletter | email market update | subscriber send" maps to newsletter producer. Does not affect brain-dispatched rows (those use assigned_producer directly) but needed for natural-language intent parsing.

---

## Token cost estimate

Supabase queries: 5 SQL executions (negligible cost, MCP tool).
File reads: ~8 files (SKILL.md files, bend-market-bible.md sections, design_system, contact sheet exemplar).
File writes: 5 files (synthetic action row, citations, newsletter HTML, contact sheet, this result log).
No ElevenLabs, no Replicate, no Resend API calls.
Estimated agent token consumption: approximately 30,000-40,000 input tokens, 12,000-15,000 output tokens across this session.

---

## Routing note

content_engine SKILL.md does not list content:newsletter in its routing matrix. Routing via the action row's assigned_producer field works correctly for brain-dispatched rows. The matrix gap only affects natural-language intent parsing. Not a Phase 10 blocker. Recommended addition documented in producer_change_requests above.
