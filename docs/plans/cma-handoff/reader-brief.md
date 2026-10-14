# CMA reader-review brief (one agent per letter, read-only)

Read one rebuilt home-value letter the way the homeowner would, and find every defect. Do not edit files, write to any database, or send anything.

## Pull the letter

- Use Supabase `execute_sql`, project `dwvlophlbvvygjfxcrhm`. Start every query with `-- audit: reader review of <slug>`.
- From table `cmas` where `slug = '<slug>'`, read `html_content`, `render_args`, `build_summary`, `recommended_list`, `value_low`, `value_high` and `comps_count`.
- Convert the HTML to plain text and read ALL of it.
- Confirm the cover names the right address and price before you start.

## Rules the letter must meet

**Numbers**
- Every number traces to stored data and agrees with every other mention.
- Recompute every percent, difference, weighted price and grid column:
  - sold plus every printed adjustment row equals the adjusted price;
  - net equals the sum of the rows.
- The printed price range is the lowest and highest adjusted price of the sales that set the price. A high and a low are the range. A letter already stored with sales set aside still prints that stored band. Check that the printed range matches the sales that set the price.
- Dates read as of the build date, Pacific.

**Text hygiene**
- No em dashes (U+2014) in visible text. CSS comments do not count.
- No owner, buyer or seller personal names. Google reviewer names on the closing page are allowed.
- No placeholders (undefined, NaN, null), no empty sections and no repeated sentences.

**Consistency**
- A sentence, chart, caption or pill never contradicts the number or chart beside it.
- Counts in prose equal what is shown.
- No pointers to maps or tables that are not on the page.

**Held letters** (`build_summary.hold_kind` set)
- Read as the price the broker is reviewing, never as a settled instruction.
- Never claim the ask was too high when it sits inside the range.
- The net column head reads "At the price on the cover"; on other letters it reads "At the list price".
- One fee: 3%.

**On-market letters** (rule 27)
- Read as an opinion of value. No pitch, and no net page.

**"What happened" page**
- The ask history matches the MLS price history; every price change is a step.
- Days above and days inside the range add up.
- "Without an offer" never appears.

**Map**
- The legend tells set-aside sales apart from the sales that set the price.

## Report back

- Numbered HARD defects. For each: exact quote, section, what is wrong, and your confidence.
- Reader-confusion notes, kept short.
- One line on what you checked and found clean.
