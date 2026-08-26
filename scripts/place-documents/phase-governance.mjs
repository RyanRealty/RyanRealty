#!/usr/bin/env node
/**
 * Identity is not governance — the per-chain ruling on parent matches whose
 * document names a different phase than the plat.
 *
 * THE DEFECT. `two-signal-publish.mjs` and `book-page-stamp-publish.mjs` clear a
 * parent match on two independent confirmations: the document's own text names
 * the place, and the county's recording mark says this IS the instrument the
 * index filed. Both signals prove the document's IDENTITY. Neither says a word
 * about which plats it GOVERNS. A declaration titled ROCKWOOD ESTATES PHASE IV
 * is genuinely the instrument the index filed under "Rockwood Estates" — and the
 * parent match still fans it across all four Rockwood phases.
 *
 * Measured 2026-08-26 over the 2,964 auto-published parent links and the 2,143
 * pending ones: 99 published links and 164 withheld links sit on a plat whose
 * phase their own document contradicts. 78 documents, 46 declaration chains.
 *
 * WHY NO BLANKET RULE WORKS. In an Oregon planned community (ORS 94.550-94.785)
 * the Phase 1 declaration is frequently the MASTER, with later phases brought in
 * by a Declaration of Annexation or a Supplemental Declaration. When that is
 * what happened, the Phase 1 document binds every phase and the fan-out is
 * CORRECT. When the declaration is phase-specific with no expansion mechanism,
 * it is not. Both patterns are in this corpus, sometimes in the same chain:
 *
 *   Stonebrook   263-2035 is the master; 387-887, 387-890, 483-2026 and 508-2611
 *                are four Supplemental Declarations that each annex ONE phase.
 *                Each governs only the phase it annexes.
 *   Providence   268-2080 is the declaration; 327-1627 adds Phases 4, 5, 5A, 6,
 *                7 and 8 to it. The association's Bylaws reach every phase.
 *   Yardley      2001-52446 is the Master Declaration; 2003-52944, 2005-00786,
 *                2005-56517 and 2006-47228 each annex one phase to it.
 *   Tollgate     183-556 declares a whole quarter-section tract and reserves the
 *                right to bring future stages within its scheme. Its Third
 *                Amendment names no phase and reaches every Addition.
 *
 * So the ruling is per document, not per rule, and every one of them was read.
 * The RULINGS table below is the evidence ledger: `governs` lists the plats the
 * document actually binds, `evidence` is a line from the record that says so,
 * and `cite` is the instrument that line comes from — sometimes a sibling in the
 * chain, because an annexation instrument is what proves the master's reach.
 *
 * EVIDENCE IS ASYMMETRIC, deliberately. A slug may only enter `governs` if its
 * evidence line is verbatim in the cited document's stored `ocr_text` — this
 * script re-checks that on every run and REFUSES to publish an unverifiable one.
 * Holding a link back needs no evidence at all: a hold sends it to a human, and
 * a human reading the PDF knows more than the OCR does. Three rulings quote a
 * page rendered at higher scale instead, because the microfilm OCR is wrong
 * about the one word that decides them (`renderPage`); they are printed in full
 * so the claim can be read against the PDF.
 *
 * WHAT THIS SCRIPT DOES NOT DO. It does not weaken the database trigger, and it
 * never publishes anything the trigger would refuse — every link it moves is
 * already a governing kind whose text names its place. It only decides WHICH of
 * the plats a document was fanned across it is allowed to sit on.
 *
 * PIPELINE ORDER MATTERS. `two-signal-publish.mjs` and `book-page-stamp-publish.mjs`
 * select on `status = 'pending_review' AND match_method = 'parent'`, so a re-run
 * of either would re-publish what this script demotes. That is why this step runs
 * AFTER both of them in scripts/place-documents/README.md. The pipeline is
 * idempotent as a whole, not step by step.
 *
 * usage: node --env-file=.env.local scripts/place-documents/phase-governance.mjs [--apply]
 *        --evidence  print every ruling's evidence line, verified against the OCR
 */
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const SHOW_EVIDENCE = process.argv.includes('--evidence')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/**
 * One entry per document whose own text names a phase the plat contradicts.
 *
 *   name      the index's published name — the declaration chain
 *   ref       the recording reference of the document that was read
 *   was       the status of these links at review time, 2026-08-26
 *   flagged   every plat this document was fanned onto and contradicted
 *   governs   the subset of `flagged` the document actually binds (publish/keep)
 *   evidence  a line from the record that says so — verbatim in `cite`'s OCR
 *   cite      the instrument the evidence line comes from
 *   renderPage  set when the line was read off a rendered page, because the
 *               microfilm OCR misreads it (Vision reads Plat III as Plat II)
 *   note      why the held plats are held, when it is not simply "another phase"
 */
const RULINGS = [
  { name: 'Aspen Heights', ref: '278-2494', was: 'pending_review',
    flagged: 'aspen-heights-phase-2 aspen-heights-phase-iii aspen-heights-phase-iv',
    governs: '',
    evidence: 'PROTECTIVE COVENANTS, CONDITIONS AND RESTRICTIONS FOR ASPEN HEIGHTS Patrick M. Gisler, owner, of ASPEN HEIGHTS PHASE I, Lots 2,',
    cite: '278-2494' },

  { name: 'Awbrey Village', ref: '474-0866', was: 'pending_review',
    flagged: 'awbrey-village-phase-4 awbrey-village-phase-5 awbrey-village-phase-6',
    governs: '',
    // Phase II has its own declaration (1999-30008), and phases 3 through 6 are
    // governed by a separate declaration recorded at 2002-36911 — not by this one.
    evidence: 'the property shown on the official plat of AWBREY VILLAGE PHASE V (5), City of Bend, Deschutes County Oregon, shall be subject to the Declaration of Covenants, Conditions and Restrictions for AWBREY VILLAGE PHASES III (3) THROUGH VI (6)',
    cite: '2002-54483',
    note: 'phases 3-6 run under 2002-36911, a different declaration' },

  { name: 'Buck Run', ref: '361-1487', was: 'pending_review',
    flagged: 'buck-run-fourth-addition buck-run-second-addition buck-run-third-addition',
    governs: '',
    evidence: 'PROTECTIVE COVENANTS AND CONDITIONS FOR BUCK RUN FIRST ADDITION',
    cite: '361-1487' },

  { name: 'Buck Run', ref: '423-1393', was: 'pending_review',
    flagged: 'buck-run-first-addition buck-run-fourth-addition buck-run-third-addition',
    governs: '',
    evidence: 'PROTECTIVE COVENANTS AND CONDITIONS FOR BUCK RUN SECOND ADDITION',
    cite: '423-1393' },

  // Canyon Rim Village: seven declarations, one per phase, each subjecting only
  // the plat recorded for that phase. No annexation right is reserved anywhere;
  // the single "Annexation" heading is an assessment-reallocation clause.
  { name: 'Canyon Rim Village', ref: '2002-50105', was: 'published',
    flagged: 'canyon-rim-village-phase-1 canyon-rim-village-phase-10 canyon-rim-village-phase-2 canyon-rim-village-phase-4 canyon-rim-village-phase-5 canyon-rim-village-phase-6 canyon-rim-village-phase-7 canyon-rim-village-phase-8 canyon-rim-village-phase-9',
    governs: '',
    evidence: 'COVENANTS, CONDITIONS & RESTRICTIONS FOR CANYON RIM VILLAGE SUBDIVISION PHASE III',
    cite: '2002-50105' },

  { name: 'Canyon Rim Village', ref: '2003-50504', was: 'published',
    flagged: 'canyon-rim-village-phase-1 canyon-rim-village-phase-10 canyon-rim-village-phase-2 canyon-rim-village-phase-3 canyon-rim-village-phase-5 canyon-rim-village-phase-6 canyon-rim-village-phase-7 canyon-rim-village-phase-8 canyon-rim-village-phase-9',
    governs: '',
    evidence: 'COVENANTS, CONDITIONS & RESTRICTIONS FOR CANYON RIM VILLAGE SUBDIVISION PHASE IV',
    cite: '2003-50504' },

  { name: 'Canyon Rim Village', ref: '2004-18406', was: 'published',
    flagged: 'canyon-rim-village-phase-1 canyon-rim-village-phase-10 canyon-rim-village-phase-2 canyon-rim-village-phase-3 canyon-rim-village-phase-5 canyon-rim-village-phase-6 canyon-rim-village-phase-7 canyon-rim-village-phase-8 canyon-rim-village-phase-9',
    governs: '',
    evidence: 'AMENDMENT TO DECLARATION OF COVENANTS, CONDITIONS, AND RESTRICTIONS FOR CANYON RIM VILLAGE PHASE IV',
    cite: '2004-18406' },

  { name: 'Canyon Rim Village', ref: '2006-57947', was: 'published',
    flagged: 'canyon-rim-village-phase-1 canyon-rim-village-phase-10 canyon-rim-village-phase-2 canyon-rim-village-phase-3 canyon-rim-village-phase-4 canyon-rim-village-phase-5 canyon-rim-village-phase-6 canyon-rim-village-phase-8 canyon-rim-village-phase-9',
    governs: '',
    evidence: 'COVENANTS, CONDITIONS & RESTRICTIONS FOR CANYON RIM VILLAGE SUBDIVISION PHASE VII',
    cite: '2006-57947' },

  { name: 'Cascade Peaks', ref: '453-379', was: 'pending_review',
    flagged: 'cascade-peaks-phase-i',
    governs: '',
    evidence: 'Declarant now wishes to subject the area known as Cascade Peaks, Phase Il to the Declaration of Covenants, Conditions and Restrictions for Cascade Peaks, to annex such Property to Cascade Peaks',
    cite: '453-379',
    note: 'a supplemental declaration annexes Phase II; the master is 412-354' },

  // City View: the declaration is titled Phase I, but its own First Amendment
  // regulates Phase II lots by lot number — the scheme reaches Phase II.
  { name: 'City View', ref: '183-2688', was: 'pending_review',
    flagged: 'city-view-phase-ii',
    governs: 'city-view-phase-ii',
    evidence: 'Square Footage Minimun. Any single-family residence to be located on Lots 11 thru 34, City View, Phase II, shall be a minimun of',
    cite: '316-2690' },

  { name: 'Colvin Estates', ref: '256-2739', was: 'pending_review',
    flagged: 'colvin-estates-phase-2 colvin-estates-phase-3',
    governs: 'colvin-estates-phase-2 colvin-estates-phase-3',
    evidence: 'PROTECTIVE COVENANTS, RESTRICTIONS AND CONDITIONS FOR COLVIN ESTATES - PHASE I, II AND III',
    cite: '256-2739' },

  { name: 'East Villa', ref: '217-24', was: 'pending_review',
    flagged: 'east-villa-first-addition',
    governs: '',
    evidence: 'being the sate mmers of the subuivision known as East Villa, Seconú Addition',
    cite: '217-24' },

  { name: 'East Villa', ref: '233-767', was: 'pending_review',
    flagged: 'east-villa-first-addition',
    governs: '',
    evidence: 'being the sole amers of the subdiviston known as East Villa, Second Additton',
    cite: '233-767' },

  // Equestrian Meadows: the instrument is titled Phase I (its first page is
  // filed separately at 301-36) and binds every lot in that phase.
  { name: 'Equestrian Meadows', ref: '301-37', was: 'pending_review',
    flagged: 'equestrian-meadows-phase-1 equestrian-meadows-phase-2',
    governs: 'equestrian-meadows-phase-1',
    evidence: 'These restrictions are binding on all lots except Lot Number 2, Block 1 of Equestrian Meadows Phase I.',
    cite: '301-37' },

  { name: 'Harris Estates', ref: '302-731', was: 'pending_review',
    flagged: 'harris-estates-phase-2 harris-estates-phase-3',
    governs: '',
    evidence: 'are the sole owners and developers of a subdivision entitled "HARRIS ESTATES, PHASE I"',
    cite: '302-731' },

  // Hayden Village: nine phases, and every one of them has its own recorded
  // restrictions subjecting named lots and blocks in that phase alone.
  { name: 'Hayden Village', ref: '241-2974', was: 'pending_review',
    flagged: 'hayden-village-phase-i hayden-village-phase-iii hayden-village-phase-iii-07395 hayden-village-phase-iv hayden-village-phase-ix hayden-village-phase-v hayden-village-phase-vi hayden-village-phase-vii hayden-village-phase-viii',
    governs: '',
    evidence: 'being the owner of the subdivision HAYDEN VILLAGE PHASE II, Redmond, Oregon, in order to provide for development of said subdivision does hereby, by these presents, subject lots 1-26, Block 6',
    cite: '241-2974' },

  { name: 'Hayden Village', ref: '257-1375', was: 'pending_review',
    flagged: 'hayden-village-phase-i hayden-village-phase-ii hayden-village-phase-iv hayden-village-phase-ix hayden-village-phase-v hayden-village-phase-vi hayden-village-phase-vii hayden-village-phase-viii',
    governs: '',
    evidence: 'being the owner of the subdivision HAYDEN VILLAGE PHASE III, Redmond, Cregon, in order to provide for development of said subdivision does hereby, by these presents, subject Lots 1-19, Block 1',
    cite: '257-1375' },

  { name: 'Hayden Village', ref: '277-2423', was: 'pending_review',
    flagged: 'hayden-village-phase-i hayden-village-phase-ii hayden-village-phase-iii hayden-village-phase-iii-07395 hayden-village-phase-ix hayden-village-phase-v hayden-village-phase-vi hayden-village-phase-vii hayden-village-phase-viii',
    governs: '',
    evidence: 'being the owner of the subdivision HAYDEN VILLAGE PHASE IV. Redmond, Oregon, in order to provide for development of said subdivision does hereby, by presents presents, subject Lots 1-12, Block 9',
    cite: '277-2423' },

  // Hidden Glen: the association's Bylaws, and the declaration annexes later
  // phases into the same covenants and the same association.
  { name: 'Hidden Glen', ref: '243-2912', was: 'pending_review',
    flagged: 'hidden-glen-phase-ii hidden-glen-phase-iii hidden-glen-phase-iv hidden-glen-phase-v',
    governs: 'hidden-glen-phase-ii hidden-glen-phase-iii hidden-glen-phase-iv hidden-glen-phase-v',
    evidence: 'The property described herein is intended to be developed in two or more phases. Hidden Glen Partners may, but shall have no obligation to, annex additional property to the property described herein. After annexation, the property annexed shall constitute a part of the subdivision and shall be subje',
    cite: '287-84' },

  // Hillside Park: not a phase problem at all. The document is another
  // subdivision's declaration sitting in the Hillside Park bucket.
  { name: 'Hillside Park', ref: '2003-08854', was: 'published',
    flagged: 'hillside-park-phase-i hillside-park-phase-ii hillside-park-phase-iv hillside-park-phase-v',
    governs: '',
    evidence: 'HOLLIDAY PARK, THIRD ADDITION is hereby subject to these Covenants, Conditions and Restrictions',
    cite: '2003-08854',
    note: 'HOLLIDAY PARK is a different subdivision, not a Hillside Park phase' },

  { name: 'Lovestone Acres', ref: '348-532', was: 'pending_review',
    flagged: 'lovestone-acres-first-addition',
    governs: 'lovestone-acres-first-addition',
    evidence: 'the owner of LOVESTONE ACRES and LOVESTONE ACRES, Ist ADDITION A Subdivision of Deschutes County, Oregon, does hereby declare that said property and the whole thereof shall be subject to the following covenants',
    cite: '348-532' },

  { name: 'Miller Heights', ref: '436-1050', was: 'pending_review',
    flagged: 'miller-heights-phase-ii',
    governs: '',
    evidence: 'DECLARATION OF COVENANTS, CONDITIONS & RESTRICTIONS FOR MILLER HEIGHTS SUBDIVISION PHASE I',
    cite: '436-1050' },

  { name: 'Miller Heights', ref: '452-1581', was: 'pending_review',
    flagged: 'miller-heights-phase-i',
    governs: '',
    evidence: 'MILLER HEIGHTS PHASE II ARCHITECTURAL REVIEW COMMITTEE RULES & GUIDELINES',
    cite: '452-1581' },

  // North Brinson: the chain runs on annexation, one instrument per phase. This
  // one annexes Phase III; Phase II was annexed by 1999-14896.
  { name: 'North Brinson Business Park', ref: '2000-22821', was: 'published',
    flagged: 'north-brinson-business-park-phase-ii north-brinson-business-park-phase-iv',
    governs: '',
    evidence: 'DECLARATION OF INCLUSION OF ADDITIONAL LAND AS PHASE III OF NORTH BRINSON BUSINESS PARK',
    cite: '2000-22821' },

  // Oak Tree: a subdivision-wide amendment, but its consent clause names the
  // final plats of Phase I and Phase II only. Phase III postdates it.
  { name: 'Oak Tree', ref: '426-530', was: 'pending_review',
    flagged: 'oak-tree-phase-ii oak-tree-phase-iii',
    governs: 'oak-tree-phase-ii',
    evidence: 'all lots located within the Oak Tree Subdivision, Bend, Deschutes County, Oregon, are subject to protective covenants, conditions and restrictions',
    cite: '426-530',
    note: 'the amendment clause binds "the final plats of Oak Tree Subdivision, Phase I and Phase II" — Phase III is not named' },

  { name: 'Oregon Water Wonderland', ref: '216-2794', was: 'pending_review',
    flagged: 'oregon-water-wonderland-unit-2',
    governs: '',
    evidence: 'BYLAWS OF OREGON WATER WONDERLAND PROPERTY OWNERS ASSOCIATION, UNIT I',
    cite: '216-2794',
    note: 'Unit 2 has its own property owners association' },

  { name: 'Pinebrook', ref: '210-471', was: 'pending_review',
    flagged: 'pinebrook-phase-ii pinebrook-phase-iii',
    governs: '',
    evidence: 'hereby declare that all of the property known as PINEBROOK PHASE I is and shall be held and conveyed upon and subject to',
    cite: '210-471',
    note: 'phases II and III were declared separately at 246-115' },

  { name: 'Pinebrook', ref: '252-873', was: 'pending_review',
    flagged: 'pinebrook-phase-i pinebrook-phase-ii',
    governs: '',
    evidence: 'PINEBROOK PHASE III',
    cite: '252-873',
    note: 'this declaration supersedes the earlier ones as to Phase III only; the document says the prior declarations remain effective against Phase I and Phase II' },

  { name: 'Pinebrook', ref: '260-55', was: 'pending_review',
    flagged: 'pinebrook-phase-i pinebrook-phase-ii pinebrook-phase-iii',
    governs: 'pinebrook-phase-i pinebrook-phase-ii pinebrook-phase-iii',
    evidence: 'AMENDMENT TO Declaration of Covenants, Conditions and Restrictions for Pinebrook (LOTS), Phases I, II and III.',
    cite: '260-55' },

  { name: 'Ponderosa Estates', ref: '275-2527', was: 'pending_review',
    flagged: 'ponderosa-estates-first-addition',
    governs: '',
    evidence: 'PONDEROSA ESTATES SECOND ADDITION" A Subdivision of Deschutes County, Oregon PROTECTIVE COVENANTS, CONDITIONS and RESTRICTIONS',
    cite: '275-2527' },

  // Providence: one declaration, one association, eight phases. The 1994
  // amendment adds phases 4 through 8 to the declaration recorded at 268-2080.
  { name: 'Providence', ref: '274-1033', was: 'pending_review',
    flagged: 'providence-phase-2 providence-phase-3 providence-phase-4 providence-phase-5 providence-phase-6 providence-phase-7 providence-phase-8',
    governs: 'providence-phase-2 providence-phase-3 providence-phase-4 providence-phase-5 providence-phase-6 providence-phase-7 providence-phase-8',
    evidence: 'This Amendment is being recorded to add Phase 4, Phase 5, Phase 5A, Phase 6, Phase 7 and Phase 8 to the Covenants, Conditions and Restrictions of Providence Subdivision.',
    cite: '327-1627' },

  { name: 'Rockwood Estates', ref: '434-232', was: 'pending_review',
    flagged: 'rockwood-estates-phase-i rockwood-estates-phase-ii rockwood-estates-phase-iii',
    governs: '',
    evidence: 'will be known as Rockwood Estates, Phase IV, hereinafter referred to as Rockwood Estates, Phase IV.',
    cite: '434-232' },

  { name: 'Rockwood Estates', ref: '465-1554', was: 'pending_review',
    flagged: 'rockwood-estates-phase-i rockwood-estates-phase-ii rockwood-estates-phase-iii',
    governs: '',
    evidence: 'RELATING TO USE OF A JOINT DRIVEWAY FOR LOTS FIFTEEN (15) AND SIXTEEN (16), ROCKWOOD ESTATES, PHASE IV',
    cite: '465-1554',
    note: 'a two-lot driveway covenant, not the subdivision’s governing document' },

  // Shevlin Meadows: the OCR reads the title as PHASE I. The page says PHASE III,
  // which is the plat this link sits on. Vision misreading Plat III as Plat II is
  // the exact failure the render exists to catch.
  { name: 'Shevlin Meadows', ref: '2002-08038', was: 'published',
    flagged: 'shevlin-meadows-phase-3',
    governs: 'shevlin-meadows-phase-3',
    evidence: 'PLANNED COMMUNITY SUBDIVISION DECLARATION SHEVLIN MEADOWS PHASE III',
    cite: '2002-08038', renderPage: 1 },

  { name: 'Shevlin Ridge', ref: '2003-13217', was: 'published',
    flagged: 'shevlin-ridge-phase-2',
    governs: '',
    evidence: 'DECLARATION OF COVENANTS, CONDITIONS AND RESTRICTIONS FOR SHEVLIN RIDGE SUBDIVISION, PHASE 1',
    cite: '2003-13217' },

  { name: 'Shevlin Ridge', ref: '2003-76136', was: 'published',
    flagged: 'shevlin-ridge-phase-1',
    governs: '',
    evidence: 'DECLARATION OF COVENANTS, CONDITIONS AND RESTRICTIONS FOR SHEVLIN RIDGE SUBDIVISION, PHASE 2',
    cite: '2003-76136' },

  { name: 'Shevlin Ridge', ref: '2004-19569', was: 'published',
    flagged: 'shevlin-ridge-phase-1 shevlin-ridge-phase-2',
    governs: '',
    evidence: 'DECLARATION OF COVENANTS, CONDITIONS AND RESTRICTIONS FOR SHEVLIN RIDGE SUBDIVISION, PHASE 3',
    cite: '2004-19569' },

  { name: 'Sierra Vista', ref: '2005-69677', was: 'published',
    flagged: 'sierra-vista-phase-2',
    governs: 'sierra-vista-phase-2',
    evidence: 'FOR SIERRA VISTA PHASE 1 & Il',
    cite: '2005-69677' },

  // Spring River Acres: the association's architecture rules. They name no unit
  // anywhere; the flag came from the heading "SECTION 1.0".
  { name: 'Spring River Acres', ref: '177-2693', was: 'pending_review',
    flagged: 'spring-river-acres-unit-2 spring-river-acres-unit-3 spring-river-acres-unit-4 spring-river-acres-unit-5',
    governs: 'spring-river-acres-unit-2 spring-river-acres-unit-3 spring-river-acres-unit-4 spring-river-acres-unit-5',
    evidence: 'Board of Directors of the Spring River Acres Association shall have complete authority to serve as a pro tem Architecture Review Committee.',
    cite: '177-2693' },

  // Stonebrook: four supplemental declarations, each annexing one phase to the
  // master at 263-2035. The master governs all five; these govern one each.
  { name: 'Stonebrook', ref: '387-887', was: 'pending_review',
    flagged: 'stonebrook-phase-i stonebrook-phase-iii stonebrook-phase-iv stonebrook-phase-v',
    governs: '',
    evidence: 'Declarant now wishes to subject the area known as Stonebrook, Phase Il to the Declarations, Restrictions, Protective Covenants and Conditions for Stonebrook, to annex such Property to stonebrook',
    cite: '387-887' },

  { name: 'Stonebrook', ref: '387-890', was: 'pending_review',
    flagged: 'stonebrook-phase-i stonebrook-phase-ii stonebrook-phase-iv stonebrook-phase-v',
    governs: '',
    evidence: 'Declarant now wishes to subject the area known as Stonebrook, Phase III to the Declarations, Restrictions, Protective Covenants Conditions for stonebrook, to annex such Property to Stonebrook',
    cite: '387-890' },

  { name: 'Stonebrook', ref: '483-2026', was: 'pending_review',
    flagged: 'stonebrook-phase-i stonebrook-phase-ii stonebrook-phase-iii stonebrook-phase-v',
    governs: '',
    evidence: 'Declarant now wishes to subject the area known as Stonebrook, Phase IV to the Declarations, Restrictions, Protective Covenants and Conditions for Stonebrook, to annex such Property to Stonebrook',
    cite: '483-2026' },

  { name: 'Stonebrook', ref: '508-2611', was: 'pending_review',
    flagged: 'stonebrook-phase-i stonebrook-phase-ii stonebrook-phase-iii stonebrook-phase-iv stonebrook-phase-v',
    governs: '',
    evidence: 'Declarant now wishes to subject the area known as Stonebrook, Phase V to the Declarations, Restrictions, Protective Covenants and Conditions for Stonebrook, to annex such Property to Stonebrook',
    cite: '508-2611' },

  // Stonehedge West: the OCR reads "PHASE II!". The page reads PHASE III, which
  // is the plat this link sits on.
  { name: 'Stonehedge West', ref: '504-2718', was: 'pending_review',
    flagged: 'stonehedge-west-phase-3',
    governs: 'stonehedge-west-phase-3',
    evidence: 'DECLARATIONS OF COVENANTS, CONDITIONS & RESTRICTIONS STONEHEDGE WEST PHASE III REDMOND, OREGON',
    cite: '504-2718', renderPage: 1 },

  { name: 'Summer Creek', ref: '2001-54735', was: 'published',
    flagged: 'summer-creek-phase-1 summer-creek-phase-2',
    governs: 'summer-creek-phase-1',
    evidence: 'Oregon: SUMMER CREEK - PHASE 1 and to the Declaration of "SUMMER CREEK - PHASE 1"',
    cite: '2001-54735' },

  { name: 'Sundance East', ref: '187-154', was: 'pending_review',
    flagged: 'sundance-east-phase-ii sundance-east-phase-iii',
    governs: '',
    evidence: 'he is the owner of Sundance East Phase I as described in the official plat thereof and said property as platted shall be subject to the following',
    cite: '187-154' },

  // Sunpointe: the OCR reads PHASE I; the page reads PHASE II. Phase III is a
  // separate declaration at 479-1808.
  { name: 'Sunpointe', ref: '413-1710', was: 'pending_review',
    flagged: 'sunpointe-phase-ii sunpointe-phase-iii',
    governs: 'sunpointe-phase-ii',
    evidence: 'PROTECTIVE COVENANTS, CONDITIONS AND RESTRICTIONS FOR SUNPOINTE - PHASE II',
    cite: '413-1710', renderPage: 1 },

  { name: 'Sunpointe', ref: '479-1808', was: 'pending_review',
    flagged: 'sunpointe-phase-i sunpointe-phase-ii',
    governs: '',
    evidence: 'PROTECTIVE COVENANTS, CONDITIONS AND RESTRICTIONS FOR SUNPOINTE - PHASE III',
    cite: '479-1808' },

  // Sunset View Estates: the repealing instrument names Phases I, II and III.
  // III-A, III-B and III-C are separately recorded plats and are named nowhere
  // in the corpus, so they go to a human rather than onto an inference.
  { name: 'Sunset View Estates', ref: '2003-36439', was: 'published',
    flagged: 'sunset-view-estates-phase-i sunset-view-estates-phase-iii sunset-view-estates-phase-iii-a sunset-view-estates-phase-iii-b sunset-view-estates-phase-iii-c',
    governs: 'sunset-view-estates-phase-i sunset-view-estates-phase-iii',
    evidence: 'This instrument is to repeal Article VII, Section 9, page 13 of the Declarations, Restrictions, Prospective Covenants and Conditions of Sunset View Estates, Phases I, II and III.',
    cite: '2003-36439',
    note: 'Phases III-A, III-B and III-C are separate recorded plats and no instrument we hold names them' },

  { name: 'Sunset View Estates', ref: '517-1534', was: 'pending_review',
    flagged: 'sunset-view-estates-phase-iii sunset-view-estates-phase-iii-a sunset-view-estates-phase-iii-b sunset-view-estates-phase-iii-c',
    governs: 'sunset-view-estates-phase-iii',
    evidence: 'This instrument is to repeal Article VII, Section 9, page 13 of the Declarations, Restrictions, Prospective Covenants and Conditions of Sunset View Estates, Phases I, II and III.',
    cite: '2003-36439',
    note: 'the association bylaws reach the phases the declaration reaches; III-A, III-B and III-C are named nowhere' },

  { name: 'Tall Pines', ref: '172-2989', was: 'pending_review',
    flagged: 'tall-pines-fourth-addition tall-pines-second-addition tall-pines-third-addition',
    governs: '',
    evidence: 'AMENDED DECLARATIONS, COVENANTS, CONDITIONS AND RESTRICITIONS 88-24733F08 TALL PINES FIFTH ADDITION SUBDIVISION',
    cite: '172-2989' },

  { name: 'Tanglewood', ref: '274-300', was: 'pending_review',
    flagged: 'tanglewood-phase-ii tanglewood-phase-iv tanglewood-phase-v tanglewood-phase-vi tanglewood-phase-vii',
    governs: '',
    evidence: 'TANGLEWOOD SUBDIVISION, PHASE III',
    cite: '274-300' },

  { name: 'Tanglewood', ref: '337-247', was: 'pending_review',
    flagged: 'tanglewood-phase-ii tanglewood-phase-iii tanglewood-phase-v tanglewood-phase-vi tanglewood-phase-vii',
    governs: '',
    evidence: 'TANGLEWOOD SUBDIVISION, PHASE IV',
    cite: '337-247' },

  { name: 'Tanglewood', ref: '453-374', was: 'pending_review',
    flagged: 'tanglewood-phase-ii tanglewood-phase-iii tanglewood-phase-iv tanglewood-phase-v tanglewood-phase-vii',
    governs: '',
    evidence: 'TANGLEWOOD SUBDIVISION, PHASE SIX',
    cite: '453-374' },

  { name: 'Terrango Glen', ref: '2001-42027', was: 'published',
    flagged: 'terrango-glen-phase-6',
    governs: '',
    evidence: 'TERRANGO GLEN PHASE V',
    cite: '2001-42027' },

  { name: 'Terrango Glen', ref: '2005-12007', was: 'published',
    flagged: 'terrango-glen-phase-6',
    governs: '',
    evidence: 'TERRANGO GLEN EAST Phase 2',
    cite: '2005-12007',
    note: 'Terrango Glen East Phase 2 is its own plat; Terrango Glen Phase 6 is another' },

  // Tetherow Crossing: the association's bylaws bind every parcel in the
  // development, which is a 1,080-acre tract, not a phase.
  { name: 'Tetherow Crossing', ref: '2005-70574', was: 'published',
    flagged: 'tetherow-crossing-phase-ii tetherow-crossing-phase-iii tetherow-crossing-phase-iv tetherow-crossing-phase-v tetherow-crossing-phase-vi tetherow-crossing-phase-vii',
    governs: 'tetherow-crossing-phase-ii tetherow-crossing-phase-iii tetherow-crossing-phase-iv tetherow-crossing-phase-v tetherow-crossing-phase-vi tetherow-crossing-phase-vii',
    evidence: 'Purchase of any parcel within the Tetherow Crossing Development under an agreement of sale and/or land sales contract automatically entitles & assigns the owner',
    cite: '2005-70574' },

  { name: 'Tetherow Crossing', ref: '275-583', was: 'pending_review',
    flagged: 'tetherow-crossing-phase-iii tetherow-crossing-phase-iv tetherow-crossing-phase-v tetherow-crossing-phase-vi tetherow-crossing-phase-vii',
    governs: '',
    evidence: 'AMENDMENT OF RESERVATIONS AND RESTRICTIVE COVENANTS oF TETHEROW CROSSING, PHASE IT KNOW ALL MEN BY THESE PRESENTS, That the undersigned, being all of the ovners of the lots in the Subdivision of Tetherow Crossing, Phase II',
    cite: '275-583' },

  { name: 'Tillicum Village', ref: '210-875', was: 'pending_review',
    flagged: 'tillicum-village-first-addition tillicum-village-third-addition',
    governs: '',
    evidence: 'relating to TILLICUM VILLAGE, SECOND ADDITION, Deschutes County, Oregon, was duly recorded in Volume 184, at Page 359.',
    cite: '210-875',
    note: 'additional lots come in only by a per-lot Supplemental Declaration executed by that lot’s owner, and none is in the corpus' },

  // Tollgate: the declaration covers a whole quarter-section tract and reserves
  // the right to bring future stages within its scheme. The Third Amendment
  // names no phase — the flag came from the word THIRD.
  { name: 'Tollgate', ref: '242-1468', was: 'pending_review',
    flagged: 'tollgate-eighth-addition tollgate-fifth-addition tollgate-first-addition tollgate-fourth-addition tollgate-second-addition tollgate-seventh-addition tollgate-sixth-addition',
    governs: 'tollgate-eighth-addition tollgate-fifth-addition tollgate-first-addition tollgate-fourth-addition tollgate-second-addition tollgate-seventh-addition tollgate-sixth-addition',
    evidence: 'SUBJECTING ADDITIONAL PROPERTY TO THIS DECLARATION Section 1. At any time before January 31, 1999, Declarant, its successors and assigns, shall have the right to bring within the scheme of this declaration additional properties in future stages of development',
    cite: '184-253' },

  { name: 'Tuscany Pines', ref: '2010-51716', was: 'published',
    flagged: 'tuscany-pines-phase-2',
    governs: '',
    evidence: 'all Lots in the Tuscany Pine: Phase 1 subdivision as described on the Tuscany Pines Phase 1 subdivision plats',
    cite: '2010-51716' },

  { name: 'Tuscany Pines', ref: '2012-26008', was: 'published',
    flagged: 'tuscany-pines-phase-2',
    governs: '',
    evidence: 'all Lots in the Tuscany Pines Phase 1 subdivision as described on the Tuscany Pines Phase 1 subdivision plats',
    cite: '2012-26008' },

  // Vandevert Ranch: the OCR title reads PHASE I; the body and the rendered page
  // both read PHASE II, which is the plat these links sit on.
  { name: 'Vandevert Ranch', ref: '380-1198', was: 'pending_review',
    flagged: 'vandevert-ranch-phase-ii',
    governs: 'vandevert-ranch-phase-ii',
    evidence: 'Declarant now wishes to subject the area known as Vandevert Ranch, Phase II to the Declarations, Restrictions, Protective Covenants and Conditions for Vandevert Ranch, to annex such Property to Vandevert Ranch',
    cite: '380-1198' },

  { name: 'Vandevert Ranch', ref: '444-1385', was: 'pending_review',
    flagged: 'vandevert-ranch-phase-ii',
    governs: 'vandevert-ranch-phase-ii',
    evidence: 'recorded the Declarations, Restrictions, Protective Covenants and Conditions for Vandevert Ranch, Phase II, in Volume 380, Page 1198',
    cite: '444-1385' },

  { name: 'Vista Meadows', ref: '2004-52036', was: 'published',
    flagged: 'vista-meadows-phase-2 vista-meadows-phase-3 vista-meadows-phase-4',
    governs: '',
    evidence: 'Vista Meadows Subdivision Phase 1 as platted in Book 2004 Page 52035 Plat Records of Deschutes County, Oregon.',
    cite: '2004-52036' },

  { name: 'Vista Meadows', ref: '2005-67512', was: 'published',
    flagged: 'vista-meadows-phase-2 vista-meadows-phase-3 vista-meadows-phase-4',
    governs: '',
    evidence: 'Vista Meadows Subdivision Phase Il as platted in Book2005, Page 6751/Plat Records of Deschutes County, Oregon.',
    cite: '2005-67512' },

  { name: 'Willow Springs', ref: '2003-62955', was: 'published',
    flagged: 'willow-springs-phase-1 willow-springs-phase-3',
    governs: '',
    evidence: 'Willow Springs, Phase 2, Subdivision as recorded in Book 2003, Page 61531, Official Records of Deschutes County, Oregon.',
    cite: '2003-62955' },

  { name: 'Willow Springs', ref: '2004-371', was: 'published',
    flagged: 'willow-springs-phase-1 willow-springs-phase-2',
    governs: '',
    evidence: 'Willow Springs, Phase 3, Subdivision as recorded in Book 2004, Page 370.',
    cite: '2004-371' },

  // Windance Estates: Phase II was annexed to the Phase I declaration, so the
  // Phase I declaration reaches Phase II. The supplemental that annexed it does
  // not reach back to Phase I.
  { name: 'Windance Estates', ref: '283-79', was: 'pending_review',
    flagged: 'windance-estates-phase-ii',
    governs: 'windance-estates-phase-ii',
    evidence: 'Declarant now wishes to subject the area known as Windance Estates, Phase II to the Declaration of Covenants, Conditions and Restrictions for Windance Estates to annex such property to Windance Estates',
    cite: '337-1758' },

  { name: 'Windance Estates', ref: '337-1758', was: 'pending_review',
    flagged: 'windance-estates-phase-i',
    governs: '',
    evidence: 'Declarant now wishes to subject the area known as Windance Estates, Phase II to the Declaration of Covenants, Conditions and Restrictions for Windance Estates to annex such property to Windance Estates',
    cite: '337-1758' },

  { name: 'Woodland Park Homesites', ref: '148-553', was: 'pending_review',
    flagged: 'woodland-park-homesites-first-addition woodland-park-homesites-second-addition',
    governs: '',
    evidence: 'which has been platted and filed as "Woodland Park Homesites Third Addition"',
    cite: '148-553' },

  { name: 'Woodside Ranch', ref: '187-313', was: 'pending_review',
    flagged: 'woodside-ranch-phase-ii woodside-ranch-phase-iii woodside-ranch-phase-iv woodside-ranch-phase-v woodside-ranch-phase-vi',
    governs: '',
    evidence: 'PROTECTIVE COVERANTS FOR WOODSIDE RANCH PHASE I',
    cite: '187-313' },

  { name: 'Woodside Ranch', ref: '259-992', was: 'pending_review',
    flagged: 'woodside-ranch-phase-i woodside-ranch-phase-ii woodside-ranch-phase-iii woodside-ranch-phase-iv woodside-ranch-phase-vi',
    governs: '',
    evidence: 'the owner of Woodside Ranch Phase V',
    cite: '259-992' },

  { name: 'Woodside Ranch', ref: '273-751', was: 'pending_review',
    flagged: 'woodside-ranch-phase-i woodside-ranch-phase-ii woodside-ranch-phase-iii woodside-ranch-phase-iv woodside-ranch-phase-v',
    governs: '',
    evidence: 'PROTECTIVE COVENANTS FOR WOODSIDE RANCH PHASE VI',
    cite: '273-751' },

  // Yardley Estates: the Master Declaration is 2001-52446, which is not in this
  // corpus. Each of these is the annexation declaration for one phase, and the
  // 2012 instrument that annexes Phase 7 lists them by phase and document number.
  { name: 'Yardley Estates', ref: '2003-52944', was: 'published',
    flagged: 'yardley-estates-phase-1 yardley-estates-phase-iii yardley-estates-phase-iv yardley-estates-phase-v yardley-estates-phase-vi yardley-estates-phase-vii',
    governs: '',
    evidence: 'Declarant previously annexed certain real property described in the plat of Yardley Estates Subdivision, Phases 2 through 6. Said Declarations recorded in the records of Deschutes County, Oregon as follows: Phase 2, recorded',
    cite: '2012-51304' },

  { name: 'Yardley Estates', ref: '2005-00786', was: 'published',
    flagged: 'yardley-estates-phase-1 yardley-estates-phase-ii yardley-estates-phase-iii yardley-estates-phase-v yardley-estates-phase-vi yardley-estates-phase-vii',
    governs: '',
    evidence: 'DECLARATION OF COVENANTS, CONDITIONS & RESTRICTIONS FOR YARDLEY ESTATES SUBDIVISION PHASE 4',
    cite: '2005-00786' },

  { name: 'Yardley Estates', ref: '2005-56517', was: 'published',
    flagged: 'yardley-estates-phase-1 yardley-estates-phase-ii yardley-estates-phase-iii yardley-estates-phase-iv yardley-estates-phase-vi yardley-estates-phase-vii',
    governs: '',
    evidence: 'DECLARATION OF COVENANTS, CONDITIONS & RESTRICTIONS FOR YARDLEY ESTATES SUBDIVISION PHASE 5',
    cite: '2005-56517' },

  { name: 'Yardley Estates', ref: '2006-47228', was: 'published',
    flagged: 'yardley-estates-phase-1 yardley-estates-phase-ii yardley-estates-phase-iii yardley-estates-phase-iv yardley-estates-phase-v yardley-estates-phase-vii',
    governs: '',
    evidence: 'DECLARATION OF COVENANTS, CONDITIONS & RESTRICTIONS FOR YARDLEY ESTATES SUBDIVISION PHASE 6',
    cite: '2006-47228' },
]

// --- sanity on the ledger itself ------------------------------------------
const set = (s) => new Set(String(s || '').split(/\s+/).filter(Boolean))
const ledgerErrors = []
for (const r of RULINGS) {
  const flagged = set(r.flagged)
  for (const g of set(r.governs)) {
    if (!flagged.has(g)) ledgerErrors.push(`${r.name} ${r.ref}: governs "${g}" is not in flagged`)
  }
  if (set(r.governs).size && !r.evidence) ledgerErrors.push(`${r.name} ${r.ref}: publishes with no evidence line`)
}
if (ledgerErrors.length) {
  console.error('the ruling table is inconsistent:')
  for (const e of ledgerErrors) console.error(`  ${e}`)
  process.exit(1)
}

// --- read ------------------------------------------------------------------
const flat = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase()

const docs = new Map() // "name|ref" -> document row
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from('place_document')
    .select('id, published_name, recording_ref, doc_kind, name_confirmed, ocr_text')
    .order('id', { ascending: true })
    .range(from, from + 999)
  if (error) throw new Error(error.message)
  for (const d of data) docs.set(`${d.published_name}|${d.recording_ref}`, d)
  if (data.length < 1000) break
}

const links = []
for (let last = '00000000-0000-0000-0000-000000000000'; ; ) {
  const { data, error } = await sb
    .from('place_document_link')
    .select('id, geo_slug, status, match_method, review_note, document_id, place_document!inner(published_name, recording_ref)')
    .eq('match_method', 'parent')
    .gt('id', last)
    .order('id', { ascending: true })
    .limit(1000)
  if (error) throw new Error(error.message)
  if (!data.length) break
  links.push(...data)
  last = data[data.length - 1].id
  if (data.length < 1000) break
}
console.log(`parent-match links: ${links.length}`)

// --- verify the evidence ---------------------------------------------------
//
// A slug may only be published on a line that is actually in the record. The
// stored ocr_text is the record we hold; a ruling that quotes a rendered page
// says so and is printed instead, because Vision misreads microfilm and a human
// read that page at higher scale.
const unverified = []
const rendered = []
for (const r of RULINGS) {
  if (!set(r.governs).size) continue
  const cited = docs.get(`${r.name}|${r.cite}`)
  if (!cited) { unverified.push(`${r.name} ${r.ref}: cited instrument ${r.cite} is not in place_document`); continue }
  if (r.renderPage) { rendered.push(r); continue }
  if (!flat(cited.ocr_text).includes(flat(r.evidence))) {
    unverified.push(`${r.name} ${r.ref}: the evidence line is not in ${r.cite}'s stored OCR`)
  }
}
if (rendered.length) {
  console.log(`\nread off a rendered page rather than the stored OCR (${rendered.length}):`)
  for (const r of rendered) {
    console.log(`  ${r.name} ${r.cite} page ${r.renderPage}: "${r.evidence}"`)
  }
}
if (unverified.length) {
  console.error(`\nREFUSING TO PUBLISH — ${unverified.length} rulings cannot show their evidence:`)
  for (const u of unverified) console.error(`  ${u}`)
  process.exit(1)
}

// --- decide ----------------------------------------------------------------
const byDoc = new Map()
for (const r of RULINGS) byDoc.set(`${r.name}|${r.ref}`, r)

const publish = []   // pending -> published
const demote = []    // published -> pending_review
const keep = []      // published, and it belongs there
const hold = []      // pending, and it stays there
const unreviewed = [] // a contradicted link that appeared after the review

for (const l of links) {
  const d = l.place_document
  const r = byDoc.get(`${d.published_name}|${d.recording_ref}`)
  if (!r) continue
  const flagged = set(r.flagged)
  if (!flagged.has(l.geo_slug)) {
    // This document has other links that were never contradicted — leave them
    // exactly as the two publish scripts left them.
    continue
  }
  const governs = set(r.governs).has(l.geo_slug)
  if (governs && l.status === 'published') keep.push({ l, r })
  else if (governs) publish.push({ l, r })
  else if (l.status === 'published') demote.push({ l, r })
  else hold.push({ l, r })
}

// Anything the ledger names but the database no longer has, and anything the
// ledger does not name — both are drift, and both are reported rather than
// silently ignored.
const seen = new Set()
for (const x of [...publish, ...demote, ...keep, ...hold]) seen.add(`${x.r.name}|${x.r.ref}|${x.l.geo_slug}`)
for (const r of RULINGS) {
  for (const s of set(r.flagged)) {
    if (!seen.has(`${r.name}|${r.ref}|${s}`)) unreviewed.push(`${r.name} ${r.ref} -> ${s}: no such link any more`)
  }
}

const chains = new Set(RULINGS.map((r) => r.name))
console.log(`\nrulings: ${RULINGS.length} documents across ${chains.size} declaration chains`)
console.log(`  publish  (pending -> published):  ${publish.length}`)
console.log(`  keep     (published, correct):    ${keep.length}`)
console.log(`  demote   (published -> review):   ${demote.length}`)
console.log(`  hold     (stays in review):       ${hold.length}`)
if (unreviewed.length) {
  console.log(`\n  ${unreviewed.length} ledger rows no longer match a link:`)
  for (const u of unreviewed.slice(0, 20)) console.log(`    ${u}`)
}

const byChain = new Map()
for (const x of [...publish, ...keep, ...demote, ...hold]) {
  const k = x.r.name
  if (!byChain.has(k)) byChain.set(k, { publish: 0, keep: 0, demote: 0, hold: 0 })
}
for (const x of publish) byChain.get(x.r.name).publish++
for (const x of keep) byChain.get(x.r.name).keep++
for (const x of demote) byChain.get(x.r.name).demote++
for (const x of hold) byChain.get(x.r.name).hold++
console.log(`\n${'chain'.padEnd(30)} pub keep dem hold`)
for (const [name, c] of [...byChain].sort()) {
  console.log(`${name.padEnd(30)} ${String(c.publish).padStart(3)} ${String(c.keep).padStart(4)} ${String(c.demote).padStart(3)} ${String(c.hold).padStart(4)}`)
}

if (SHOW_EVIDENCE) {
  console.log(`\n=== evidence ===`)
  for (const r of [...RULINGS].sort((a, b) => a.name.localeCompare(b.name))) {
    const verdict = set(r.governs).size
      ? (set(r.governs).size === set(r.flagged).size ? 'binds every flagged plat' : `binds ${set(r.governs).size} of ${set(r.flagged).size}`)
      : 'binds none of them'
    console.log(`\n${r.name} ${r.ref} — ${verdict}${r.renderPage ? ` (page ${r.renderPage}, rendered)` : ''}`)
    console.log(`  cite ${r.cite}: "${r.evidence}"`)
    if (r.note) console.log(`  note: ${r.note}`)
  }
}

if (!APPLY) {
  console.log('\n(dry run — pass --apply)')
  process.exit(0)
}

// --- apply -----------------------------------------------------------------
const short = (r) => `${r.cite}: ${r.evidence}`.replace(/\s+/g, ' ').slice(0, 400)

async function write(rows, status, prefix) {
  // One note per ruling, so the row carries the line that decided it.
  const byNote = new Map()
  for (const { l, r } of rows) {
    const note = `${prefix} — ${short(r)}`
    if (!byNote.has(note)) byNote.set(note, [])
    byNote.get(note).push(l.id)
  }
  let n = 0
  for (const [note, ids] of byNote) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200)
      const { error } = await sb.from('place_document_link').update({ status, review_note: note }).in('id', chunk)
      if (error) console.error(`  FAIL ${status} chunk: ${error.message}`)
      else n += chunk.length
    }
  }
  return n
}

const publishedN = await write(publish, 'published', 'phase-governance: the document binds this plat')
const demotedN = await write(demote, 'pending_review', 'phase-governance: the document names a different phase than this plat, and nothing in the chain extends it here')
const heldN = await write(hold, 'pending_review', 'phase-governance: the document names a different phase than this plat, and nothing in the chain extends it here')

console.log(`\npublished ${publishedN}   demoted ${demotedN}   re-noted while held ${heldN}`)

// --- re-read and assert ----------------------------------------------------
const after = []
for (let last = '00000000-0000-0000-0000-000000000000'; ; ) {
  const { data, error } = await sb
    .from('place_document_link')
    .select('id, geo_slug, status, place_document!inner(published_name, recording_ref)')
    .eq('match_method', 'parent')
    .gt('id', last)
    .order('id', { ascending: true })
    .limit(1000)
  if (error) throw new Error(error.message)
  if (!data.length) break
  after.push(...data)
  last = data[data.length - 1].id
  if (data.length < 1000) break
}
const wrong = []
for (const l of after) {
  const d = l.place_document
  const r = byDoc.get(`${d.published_name}|${d.recording_ref}`)
  if (!r || !set(r.flagged).has(l.geo_slug)) continue
  const want = set(r.governs).has(l.geo_slug) ? 'published' : 'pending_review'
  if (l.status !== want) wrong.push(`${d.recording_ref} -> ${l.geo_slug}: ${l.status}, wanted ${want}`)
}
console.log('')
console.log('=== POST-RULING STATE ===')
console.log(`links the ledger governs: ${publish.length + keep.length + demote.length + hold.length}`)
console.log(`published among them:     ${publish.length + keep.length}`)
console.log(`in review among them:     ${demote.length + hold.length}`)
console.log(`MISMATCHED:               ${wrong.length}`)
for (const w of wrong.slice(0, 20)) console.log(`   ${w}`)
process.exit(wrong.length ? 1 : 0)
