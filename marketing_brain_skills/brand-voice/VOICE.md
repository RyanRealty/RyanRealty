# Ryan Realty — The Voice (canonical, 2026-06-13)

This is the **single source of truth** for how Ryan Realty sounds, everywhere:
site, app, email, ads, social, listing copy, video VO, review replies. It
replaces the retired `voice_system_v2.md`. There is one voice doc now, on
purpose — every duplicate is a place the rules can drift.

The voice is built from the brands that are universally cited as the best at
this — Apple ("40mm stainless steel case," never "beautifully crafted"),
Basecamp (no fluff, smart-to-smart), Patagonia (message over sales), Aesop
(confidence held quietly), Stripe (respect the reader's intelligence). They all
do the same thing: **they never describe themselves. They show the thing and
let you decide.**

---

## Scope — our language only

The laws govern **Ryan Realty's own authored marketing copy, and only that.**
They never apply to, and we never rewrite:

- **Reviews and testimonials** — real people's words (`lib/testimonials.ts`,
  pulled from the Google Business Profile). Quoted verbatim, always.
- **Listing remarks** — the public remarks / description the listing broker
  wrote about a property (ours or another brokerage's), and any MLS-sourced
  field. That is the broker's language, not ours.
- **External sources** — anything quoted or syndicated from a third party.

Mechanically this holds by construction: reviews and listing text render from
data (the reviews file and the MLS feed via the DAL) as variables, never as
hardcoded string literals, so the gate — which scans only literal strings in
`app/` and `components/` public surfaces — cannot see them. The laws bind the
sentences we type into the site; they leave quoted material alone.

## The Five Laws

Every sentence obeys all five. Each law is enforced by a gate
(`scripts/check-brand-voice.mjs` + `brand-voice-vocabulary.cjs`) — not by
memory. A sentence that breaks a law fails the commit, the same way a wrong
number does.

### Law 1 — Show it, don't say it.
Never name a virtue you could demonstrate. Trust, honesty, expertise, care,
local knowledge — those are conclusions the reader reaches from evidence, never
labels you stick on yourself. A business praising itself is discounted to zero.
**Banned move:** "we're honest / trusted / experts / dedicated / professional,"
"honest guidance," "trusted local," "experts you can trust."
**Instead:** show the receipt in the same breath — the 24 five-star reviews, the
comps behind a price, the named process. The fact carries the claim.

### Law 2 — A number beats an adjective.
When a sentence feels weak, the fix is never a bigger adjective. It is a more
specific noun, a real figure, a named thing: the street, the date, the brand,
the count. "Stunning kitchen" is your opinion; "kitchen renovated 2022, Wolf
range" is the house. **Banned move:** empty superlatives and editorial
adjectives (stunning, exceptional, gorgeous, premier, charming, luxurious).
**Instead:** the noun, date, dimension, or live number that made you want the
adjective. The reader supplies the adjective themselves, and that's the only
kind they keep.

### Law 3 — Talk to a smart adult.
The reader is deciding the largest purchase of their life. Give them
information, not reassurance. No warmth for its own sake, no comfort copy, no
explaining the obvious. **Banned move:** "we're here to help," "we'd love to,"
"don't hesitate to reach out," "happy to help," "buying a home is a big
decision," "let me explain in simple terms." **Instead:** the useful fact. If
the page then feels cold, the fix is a better fact, never a warmer sentence.
Warmth that survives is a byproduct of usefulness.

### Law 4 — The category is not a claim.
Being a licensed brokerage is the baseline, not a selling point. Never name the
category, the credential, or the headcount as if it positioned you. **Banned
move:** "independent brokerage serving," "licensed and active brokers," "full-
service brokerage," "three brokers," "small brokerage / team," "boutique."
**Instead:** the work. What every listing actually gets, what the broker
actually does, the number on the board. The position is the standard, never the
org chart.

### Law 5 — Every number is live and true.
Figures come from the source of truth, wired to live data (the DAL), traced per
CLAUDE.md §0. A specific number that is wrong is worse than no number. **Banned
move:** a hardcoded stat on an evergreen surface, a figure with no trace, "about
/ roughly" standing in for a number you can pull. **Instead:** the live figure,
or write the sentence without it.

---

## The two tests (run on every sentence, by writer and AI alike)

1. **The competitor test.** Could any brokerage in Bend paste this sentence on
   their site, verbatim, and have it be just as true? Then it says nothing. Cut
   it, or make it specific enough that only Ryan Realty could have written it.
2. **The receipt test.** Does the sentence claim a virtue, skill, or character
   trait? Show the receipt in the same breath (a number, a comp, a timeline, a
   named process, the reviews) or cut the claim. No receipt, no claim.

If a sentence passes both, ship it. If it fails either, rewrite or cut — never
excuse.

---

## The register (NN/g dimensions — where we sit)

| Dimension | Position | In practice |
|---|---|---|
| Formal ↔ Casual | Plain, leaning casual | A competent person talking, not a brochure. Full sentences, no slang, no stiffness. |
| Funny ↔ Serious | Serious | Biggest transaction of their life. Dry warmth allowed rarely; never jokes about money or the market. |
| Respectful ↔ Irreverent | Respectful, never deferential | We don't flatter, we don't grovel, we don't punch at competitors. |
| Enthusiastic ↔ Matter-of-fact | Matter-of-fact (the signature dial) | Excitement is the reader's job. Ours is the fact that produces it. Reads like The Economist, not a flyer. |

---

## The mechanical floor (enforced by gates; details in `brand-voice-vocabulary.cjs`)

- **Punctuation:** no em-dash or en-dash as punctuation, no semicolons, no
  dramatic colons, one exclamation max per piece and zero in market-data copy.
  Em-dash allowed only as a data placeholder for "unavailable."
- **Banned vocabulary + banned moves:** the category lists and Law-1–4 patterns
  in `scripts/brand-voice-vocabulary.cjs` are the enforced source.
- **Formatting:** phone `541.213.6706` (FUB-tracked `541.703.3095` on lead-
  capture surfaces), `ryan-realty.com`, `BEND · OREGON`, currency to the nearest
  thousand, integer days, signed one-decimal YoY percents, tabular numerals,
  sentence-case body headlines.
- **Data accuracy (CLAUDE.md §0) and fair housing** outrank everything here and
  are hard ship-blockers.

---

## The one exception — Matt's 1:1 correspondence

Personal review replies and letters from Matt may use first-person warmth and a
small phrase bank ("genuinely," "honored," "a small business like ours," "the
finish line"). This is the ONLY surface where that voice lives. It never appears
in site, app, ad, or marketing copy. See `voice_guidelines.md` appendix for the
phrase bank.
