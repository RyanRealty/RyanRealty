# Central Oregon golf data — source of record

`data/golf/courses.ts` feeds public surfaces: the `/lp/central-oregon-golf` landing
page (cards, comparison table, map), the 26 **sitemap-submitted** detail pages at
`/central-oregon/golf/{slug}`, and the FAQ + JSON-LD built in `lib/golf-format.ts`.
CLAUDE.md §0 therefore applies to every figure in it.

## Why this file exists

Until 2026-08-26 the header of `courses.ts` cited
`out/golf-lp-research/research-notes.md` as its source. `out/` is gitignored scratch
and **that file no longer existed**, so no figure on those pages had a retrievable
trace. The audit that followed found errors in 13 of 26 rows.

Provenance now lives here, in the repo, next to the data.

## Par, yardage, course rating, slope

**Source: the USGA National Course Rating Database** (`https://ncrdb.usga.org/`),
the governing body's official rating record — "official agency data" under §0.
Verified course-by-course on **2026-08-26**.

Convention: **`yardsBackTees` = the longest rated men's tee.** All tees were listed
and sorted by length before taking the maximum, so a scorecard that lists a
combination tee first cannot be mistaken for the back tee.

Look a course up as `https://ncrdb.usga.org/courseTeeInfo?CourseID={id}`. The site is
Akamai-protected and refuses non-browser clients — a scripted `curl` returns 403, so
re-verification has to run through a real browser.

| slug | USGA CourseID | tee | par | yards | rating / slope |
|---|---|---|---|---|---|
| tetherow-golf-club | 5812 | KIDD | 72 | 7,298 | 75.2 / 150 |
| pronghorn-nicklaus | 5779 | TIPS | 72 | 7,379 | 75.9 / 155 |
| pronghorn-fazio | 5780 | TIPS | 72 | 7,456 | 75.1 / 143 |
| crosswater | 5844 | CHAMPIONSHIP | 72 | 7,683 | 76.8 / 147 |
| sunriver-meadows | 5966 | BLACK | 71 | 7,012 | 73.5 / 141 |
| sunriver-woodlands | 5871 | BLACK | 72 | 6,947 | 73.9 / 144 |
| caldera-links | 34001 | WHITE | 27 | 1,142 | 26.7 / 87 |
| black-butte-big-meadow | 5860 | BLACK | 72 | 6,946 | 73.4 / 131 |
| black-butte-glaze-meadow | 5859 | BLACK | 72 | 6,903 | 73.2 / 137 |
| brasada-canyons | 5882 | Jake | 72 | 7,295 | 74.3 / 145 |
| eagle-crest-resort | 5838 | Championship | 72 | 6,672 | 72.3 / 137 |
| eagle-crest-ridge | 5839 | Professional | 72 | 6,965 | 73.9 / 143 |
| eagle-crest-challenge | 5841 | Challenge | 63 | 4,187 | 61.2 / 115 |
| aspen-lakes | 5802 | BLACK | 72 | 7,302 | 75.0 / 140 |
| widgi-creek | 5922 | BLACK | 72 | 6,763 | 72.5 / 140 |
| rivers-edge | 5909 | BLACK 25 | 72 | 6,562 | 72.8 / 141 |
| lost-tracks | 5806 | ONE | 72 | 7,003 | 73.5 / 135 |
| juniper | 5820 | BLACK | 72 | 7,186 | 74.3 / 137 |
| quail-run | 5801 | BLUE | 72 | 6,897 | 73.0 / 137 |
| meadow-lakes | 5939 | BLACK | 72 | 6,783 | 71.9 / 131 |
| crooked-river-ranch | 5781 | BACK BLUE | 71 | 5,818 | 68.0 / 119 |
| greens-at-redmond | 5961 | Original BLUE | 58 | 3,426 | 58.8 / 99 |
| desert-peaks | 5843 | BLACK | 72 | 6,470 | 69.0 / 107 |
| bend-golf-club | 5863 | BLACK | 72 | 7,010 | 73.4 / 137 |
| broken-top-club | 5858 | BLACK | 72 | 7,161 | 74.0 / 143 |
| awbrey-glen | 5868 | BLACK | 72 | 7,007 | 73.4 / 136 |

**desert-peaks** is a 9-hole course. USGA rates the twice-round 18 at 6,470 / par 72;
`courses.ts` carries the 9-hole halves (3,231 / par 36), which is the correct shape
for a `holes: 9` row.

### Corrected on 2026-08-26

Thirteen rows disagreed with the USGA record. Yardage: pronghorn-fazio 7,470 →
7,456 · sunriver-woodlands 6,932 → 6,947 · black-butte-big-meadow 7,002 → 6,946 ·
black-butte-glaze-meadow 7,007 → 6,903 · eagle-crest-resort 6,673 → 6,672 ·
eagle-crest-ridge 6,927 → 6,965 · widgi-creek 6,905 → 6,763 · rivers-edge 6,647 →
6,562 · juniper 7,200 → 7,186 · quail-run 6,859 → 6,897 · meadow-lakes 6,841 →
6,783 · bend-golf-club 7,000 → 7,010. Par: **eagle-crest-ridge 71 → 72**. Three rows
that carried no yardage gained one (caldera-links, eagle-crest-challenge,
greens-at-redmond). awbrey-glen had already been corrected to 7,007 the day before
from the club's own site; USGA independently confirms it.

**Where an operator's marketing disagrees with USGA, USGA wins here.** Black Butte
Ranch's own site says Glaze Meadow "plays 7,007 yards from the back tees"; the USGA
rating record measures the BLACK tee at 6,903. Rating and slope are measured against
the played course for handicap purposes, so that record is the one to publish.

## Designer and year opened — NOT yet audited

USGA publishes neither. These were verified against the course's own site on
2026-08-26 and are sourced:

| slug | verified | source |
|---|---|---|
| tetherow-golf-club | David McLay Kidd | tetherow.com/luxury-golf-resort/golf-course/ — "par 72 course layout that was designed by award-winning architect David McLay Kidd" |
| broken-top-club | Tom Weiskopf & Jay Morrish | brokentop.com/golf — "designed by the team of Tom Weiskopf and Jay Morrish", "The par 72, 7,161-yard course" |
| bend-golf-club | H. Chandler Egan, 1925 | bendgolfclub.com — "Our Chandler Egan-designed course has been the heart of BGC since 1925" |
| black-butte-glaze-meadow | John Fought, 2012 renovation | blackbutteranch.com/golf/golf-courses/ — "reopened in 2012 after an extensive renovation by architect John Fought" |
| awbrey-glen | Gene "Bunny" Mason 1993, updated by David McLay Kidd | awbreyglen.com/golf — quoted verbatim in `data/resort-community-awbrey-glen.json` |

**The other 21 rows' `designer` and `yearOpened` values remain unverified** and still
trace only to the lost research file. `awbrey-glen` shipped `yearOpened: 2003` for a
course that opened in 1993 until 2026-08-25, so this field has a demonstrated error
rate. Treat it as unaudited until this table covers every slug.

## Naming

The Pronghorn resort now trades as **Juniper Preserve Golf & Wellness Resort**
(juniperpreserve.com). The golf operation still uses "Pronghorn" — Pronghorn Golf
Club, Pronghorn Golf Academy, Pronghorn Club Membership — and USGA still lists both
courses under "Pronghorn", so the course rows keep that name. Prose describing the
*resort* should say Juniper Preserve.
