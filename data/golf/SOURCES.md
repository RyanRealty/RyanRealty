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

## Year opened

USGA publishes no opening year, and Central Oregon course sites overwhelmingly do not
either — of eleven checked directly, **two** stated one (Bend Golf Club, Awbrey Glen).
Cutting every unstated year would have emptied the column on roughly 22 of 26 rows, so
per Matt (2026-08-26) a **named archive** may carry the year where the course is silent.
Every year below names its source. Where sources conflict and none clearly wins, the
year is CUT rather than picked.

Convention: **`yearOpened` = the year the course FIRST opened for play**, which is how
golf archives use it. Several of these opened as nine holes and reached eighteen later;
that is noted rather than silently folded in.

Primary source used throughout for the courses it covers: The Bulletin (Bend), *How a
sleepy lumber town turned into a golf hotbed*, 2018-05-06 — a local-press history that
dates nineteen Central Oregon courses in one piece.

| slug | year | source |
|---|---|---|
| bend-golf-club | 1925 | bendgolfclub.com ("the heart of BGC since 1925"); The Bulletin gives May 3, 1925 |
| sunriver-meadows | 1968 | The Bulletin ("opened in 1968") |
| black-butte-big-meadow | 1970 | The Bulletin |
| crooked-river-ranch | 1979 | Where2Golf / PGA.com (Gene Mason 1979, Jim Ramey redesign 1996) |
| sunriver-woodlands | 1981 | The Bulletin ("opened in '81") |
| black-butte-glaze-meadow | 1982 | The Bulletin ("completed in '82"); reopened 2012 after the Fought renovation |
| eagle-crest-resort | 1986 | The Bulletin |
| rivers-edge | 1988 | The Bulletin |
| quail-run | 1991 | The Bulletin. Opened as NINE holes; the second nine came in 2006 |
| widgi-creek | 1991 | The Bulletin |
| broken-top-club | 1993 | brokentop.com/about-us/history-1 — grand opening July 4, 1993 |
| awbrey-glen | 1993 | awbreyglen.com/golf |
| meadow-lakes | 1993 | The Bulletin |
| crosswater | 1995 | The Bulletin |
| greens-at-redmond | 1995 | GolfPass / Albrecht Golf Guide. First nine 1995, second nine 1999 |
| lost-tracks | 1996 | AllTrips Bend ("built in 1996"), owner-architect Brian Whitcomb |
| aspen-lakes | 1997 | Cascade Business News. aspenlakes.com says the first nine were CONSTRUCTED in 1996; opened for play 1997, second nine 1999–2000 |
| pronghorn-nicklaus | 2004 | The Bulletin |
| juniper | 2005 | GolfPass / Golfing Oregon (new course 2005, Harbottle III) |
| brasada-canyons | 2006 | The Bulletin |
| caldera-links | 2007 | The Bulletin (par-3 Caldera Links and Golf Park, 2007) |
| pronghorn-fazio | 2007 | The Bulletin |
| tetherow-golf-club | 2008 | The Bulletin; GolfPass |

### Cut for want of a source

| slug | why |
|---|---|
| eagle-crest-ridge | Sources conflict — one has it BUILT in 1992, another OPENED in 1987, and the 1993 previously shipped matches neither |
| eagle-crest-challenge | No opening year found in any source |
| desert-peaks | Sources conflict badly — 1962, or first six holes 1958 plus three in 1960, or 1992 for the current configuration. The 1980 previously shipped matches none of them |

`yearOpened` is therefore OPTIONAL. Four render sites were rendering it
unconditionally — the LP card, the comparison-table cell, the map label, and the FAQ
answer "X was designed by Y and opened in Z" — and all now degrade instead.

### Corrected 2026-08-26

Eight years were wrong: pronghorn-nicklaus 2003 → 2004 · sunriver-meadows 1981 → 1968 ·
black-butte-big-meadow 1972 → 1970 · black-butte-glaze-meadow 1980 → 1982 ·
brasada-canyons 2007 → 2006 · aspen-lakes 1996 → 1997 · widgi-creek 1989 → 1991 ·
rivers-edge 1987 → 1988. With awbrey-glen (2003 → 1993, fixed 2026-08-25) and the three
cuts, **twelve of 26 rows carried a year that could not be supported.**

## Designer — partly audited

Confirmed against the course's own site:

| slug | designer | source |
|---|---|---|
| tetherow-golf-club | David McLay Kidd | tetherow.com/luxury-golf-resort/golf-course/ |
| broken-top-club | Tom Weiskopf & Jay Morrish | brokentop.com/golf |
| bend-golf-club | H. Chandler Egan | bendgolfclub.com ("Our Chandler Egan-designed course") |
| black-butte-big-meadow | Robert Muir Graves | blackbutteranch.com ("This straightforward Robert Muir Graves design") |
| black-butte-glaze-meadow | John Fought (2012 renovation) | blackbutteranch.com |
| aspen-lakes | William Overdorf | aspenlakes.com ("under the watchful eye of ... William Overdorf") |
| awbrey-glen | Gene "Bunny" Mason, updated by David McLay Kidd | awbreyglen.com/golf |
| eagle-crest-ridge | John Thronson | eagle-crest.com ("in-house architect John Thronson") |

Confirmed against a named archive: sunriver-meadows (John Fought), sunriver-woodlands
(Robert Trent Jones Jr.), eagle-crest-resort (Gene "Bunny" Mason), juniper (John F.
Harbottle III), lost-tracks (Brian Whitcomb), crooked-river-ranch (Gene Mason 1979, Jim
Ramey 1996), quail-run (Jim Ramey), pronghorn-nicklaus (Jack Nicklaus), pronghorn-fazio
(Tom Fazio) — all The Bulletin or GolfPass.

**Two open discrepancies, deliberately left rather than guessed:**

- **bend-golf-club** carries the composite "H. Chandler Egan & Bob Baldock", and it is
  RIGHT: `data/golf/architects.ts` records that Egan routed the back nine in 1925 and
  Bob Baldock added the front nine in 1973. That also explains why the club's own site
  and The Bulletin name only Egan — he is the 1925 credit, which is the year this file
  carries. The Bulletin additionally credits William Hanley alongside Egan. The Baldock
  1973 attribution comes from our own architects.ts bio and has NOT been traced to an
  outside source; it is coherent and load-bearing, so it stays, flagged.
- **eagle-crest-challenge** shipped "John Thronson". GolfPass credits **Robert Muir
  Graves**. Unresolved.

Still unverified: crosswater, brasada-canyons, widgi-creek, rivers-edge, meadow-lakes,
greens-at-redmond, desert-peaks, caldera-links.

## Naming

The Pronghorn resort now trades as **Juniper Preserve Golf & Wellness Resort**
(juniperpreserve.com). The golf operation still uses "Pronghorn" — Pronghorn Golf
Club, Pronghorn Golf Academy, Pronghorn Club Membership — and USGA still lists both
courses under "Pronghorn", so the course rows keep that name. Prose describing the
*resort* should say Juniper Preserve.
