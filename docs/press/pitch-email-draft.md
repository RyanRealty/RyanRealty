# Pitch email draft: Central Oregon weekly market report

**STATUS: DRAFT ONLY. NOT SENT. No send tool was used to produce or deliver this file.**

Per CLAUDE.md §1, an outbound message to a real person (a reporter, in this case) requires
Matt's per-action approval in chat before it goes out. This file is the draft sitting in the
repo for Matt to review, edit, and send himself (or approve for the CRM/email tool to send).

## Contact status: NOT VERIFIED

No verified reporter name or email address exists in this repo for Bend Source or Central
Oregon Daily. The subject line below uses a placeholder. Do not fill in a name or address from
memory or a guess. Look up the outlet's current real-estate or business reporter (their
masthead/staff page or a recent byline) and confirm the address before this draft is usable.

- Bend Source: bendsource.com. Masthead / staff directory has current bylines and contact info.
- Central Oregon Daily: centraloregondaily.com. Has an on-air/digital news team with public
  contact info, typically a shared newsroom address plus individual reporter emails on stories.

Placeholders in this draft: `[REPORTER NAME]`, `[REPORTER EMAIL]`, `[OUTLET NAME]`.

---

## Draft

**To:** [REPORTER EMAIL]
**From:** matt@ryan-realty.com
**Subject:** Weekly Central Oregon housing numbers, ready to quote

[REPORTER NAME],

I put together a weekly Central Oregon housing data sheet built for exactly this: numbers a
reporter can quote without having to call anyone first.

Every figure traces to a live query against Oregon Data Share (the regional MLS), refreshed
every 10 to 15 minutes for active inventory and every 6 hours for closed sales. It covers
Central Oregon overall plus Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Median
list price, months of supply, closed sales, and median days on market for each, plus the exact
formula behind the months-of-supply verdict so it never gets misquoted.

This week's headline: Central Oregon posted 1,838 active single-family listings at a $739,500
median list price, with 5.9 months of supply (a balanced market by the standard active listings
divided by 6-month average monthly closings formula). Bend itself is tighter, 3.7 months of
supply, a seller's market by the same formula.

Full sheet attached, with a per-figure source trace so anyone on your team can check the math.
Happy to be a source for a market story or to run these same numbers for a different city or
time window if that is more useful.

Matt Ryan
Principal Broker, Ryan Realty
Oregon License #201206613
541.213.6706
matt@ryan-realty.com
ryan-realty.com

---

## Attachment

`docs/press/weekly-market-report-<date>.md` (the generated artifact) and, if the outlet wants
raw numbers, `docs/press/weekly-market-report-<date>.citations.json`.

## Before sending (Matt only)

1. Confirm a real reporter name and email at the outlet. Do not guess.
2. Regenerate the report same-day so the figures are current: `node scripts/generate-press-market-report.mjs`.
3. Read the generated `.md` once more for accuracy against `docs/DATABASE_FOR_AI_AGENTS.md` §0 discipline.
4. Send from Matt's own email, or explicitly approve a send in chat per CLAUDE.md §1 class 1
   (outbound messages to real people require Matt's yes, every time).
