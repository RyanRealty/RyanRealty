#!/usr/bin/env node
/**
 * The document is real, the plat is not its own — demote it.
 *
 * THE DEFECT. `foreign-association.mjs` catches a document whose FRONT MATTER
 * names only associations foreign to the plat. It is deliberately narrow and it
 * misses the larger shape of the same problem: the county title index is a
 * research bucket, so it files a whole instrument under a plat that instrument
 * has nothing to do with. The Holliday Park, Third Addition declaration chain —
 * six instruments — sat published across all five `hillside-park` phases. A
 * declaration titled GLACIER RIDGE sat on `gemstone-estates`. A First Amendment
 * to the Bylaws of The Falls Owners Association sat on 57 `ridge-at-eagle-crest`
 * plats. None of them is a lookalike or a misfiled deed: each is a genuine
 * governing document for SOMEBODY ELSE'S subdivision.
 *
 * WHY THIS IS A READING TASK AND NOT A PATTERN TASK. The obvious check — flag a
 * document whose title line names a different subdivision — was written and
 * measured, and three of its first four flags were CORRECT documents:
 *
 *   Southwest Pines    "...FOR QUAIL PINE ESTATES PHASE XI (PLATTED AS SOUTHWEST
 *                      PINES SUBDIVISION)" — the plat's PRIOR RECORDED NAME.
 *   Northside Terrace  "SUPPLEMENTAL DECLARATION FOR RIVER BEND [NORTHSIDE
 *                      TERRACE]" — River Bend is the MASTER.
 *   Tres Jolie         a "THIRD AMENDMENT ... FOR ANDERSON ACRES" regulating
 *                      "Lot 5 of TRES JOLIE" by name — a SHARED WELL.
 *
 * A recorded instrument names other subdivisions constantly and legitimately. A
 * document legitimately reaches a plat when it names the plat; names the plat's
 * prior recorded name; is a supplemental under a master that governs the plat;
 * recites an annexation bringing the plat in; or regulates named lots inside the
 * plat. It does NOT reach a plat by mentioning it in a legal description, a
 * boundary call or an adjacency. No regex separates those, so every candidate
 * was read: three screens over all 4,376 published links and the 1,550 distinct
 * documents behind them produced 132 documents to read, and all 132 were OCR'd
 * end to end from the hosted PDF — 1,836 pages — rather than from the two pages
 * `place_document.ocr_text` holds. The screens were deliberately different in
 * shape, because a null from one query shape is a fact about the query: does the
 * plat's name occur in the document at all; whose name sits in the document's
 * TITLE position; and what document type did the county clerk stamp on it.
 *
 * WHAT THE READING TURNED UP, and what it did NOT. 31 documents demote, off 130
 * published links across 95 plats. The
 * rest were CLEARED, and the CLEARED table below is the more useful half of the
 * output: `Ponderosa Pines` reads "Ponderous Pines" in the microfilm and the
 * plat name is genuinely absent; `Blakley South` is spelled "BLAKELY SOUTH" by
 * its own drafter; the WHISPER RIDGE declaration on Golf Townhomes at Broken Top
 * carries an exhibit headed "Golf Tracts at Broken Top, Phase 3" and is that
 * plat's own instrument under its marketing name; the SKYSTONE ESTATES bylaws on
 * North Mountain View Estates certify that they "have been adopted by the owners
 * of Lots in NMV Estates Subdivision". Every one of those would have been
 * destroyed by the pattern version, and destroying one takes a real CC&R off a
 * buyer's page.
 *
 * WHERE THIS SCRIPT STOPS, and why the line is where it is. A master-planned
 * community's neighbourhood documents are fanned across every plat in the
 * community by the same parent match: the Lewis and Clark Townhomes and Fremont
 * Place declarations sit on 21 NorthWest Crossing plats, six "DECLARATION
 * ANNEXING PHASE N OF <NEIGHBOURHOOD>" instruments sit on 57 Ridge plats, five
 * Quail Pine Estates phase supplementals sit on every Quail Pine phase. Those
 * are the class `phase-governance.mjs` owns, they are ruled one declaration
 * chain at a time, and splitting a chain across two ledgers would leave neither
 * readable — so they are reported there, not demoted here. The line this script
 * holds: the document never names the place AT ANY DEPTH, and its own subject is
 * a different association or a different plat. That is why the First Amendment
 * to the Bylaws of The Falls Owners Association comes off all 57 Ridge plats
 * (two pages, no plat named, another association's internal bylaws) while the
 * Falls ANNEXATION declarations stay (they recite "TO THE RIDGE AT EAGLE CREST"
 * and operate on the master); and why the Lewis and Clark amendment comes off
 * (two pages, no plat named) while the declaration it amends stays (it names
 * NorthWest Crossing throughout and constitutes the NorthWest Crossing Townhome
 * Association).
 *
 * EVIDENCE IS ASYMMETRIC, deliberately, and the asymmetry runs the OTHER way
 * from `phase-governance.mjs`. That script publishes and so its publishes carry
 * the burden. This script only demotes, so DEMOTIONS carry the burden: a plat
 * may only be demoted on a line that is verbatim in the cited instrument's own
 * text, and the check runs on every invocation against text re-derived from the
 * hosted PDF — never from this file. A keep needs nothing at all: everything not
 * named below stays exactly where the publish scripts left it.
 *
 * TEXT THE LEDGER IS CHECKED AGAINST. `place_document.ocr_text` is the front
 * two pages only, and most of these lines sit deeper than that, so the verifier
 * falls back to a full-text OCR of the hosted PDF, cached under
 * tmp/place-documents/fulltext/. If a document's text cannot be obtained the
 * script REFUSES to apply rather than trusting the ledger — a ruling that cannot
 * show its evidence is not a ruling.
 *
 * PIPELINE ORDER MATTERS, the same way it does for phase-governance.
 * `regate.mjs` promotes every pending EXACT match whose document is a governing
 * kind and names its plat, and `two-signal-publish.mjs` /
 * `book-page-stamp-publish.mjs` promote pending PARENT matches on two
 * confirmations. All three would re-publish what this demotes, because all three
 * are asking about identity and this script is asking about governance. So this
 * runs LAST. The pipeline is idempotent as a whole, not step by step.
 *
 * usage: node --env-file=.env.local scripts/place-documents/foreign-plat.mjs [--apply]
 *        --evidence  print every ruling's evidence line, verified against the text
 *        --cleared   print the documents that were read and left alone, and why
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const SHOW_EVIDENCE = process.argv.includes('--evidence')
const SHOW_CLEARED = process.argv.includes('--cleared')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const BUCKET = 'place-documents'
const CACHE = 'tmp/place-documents/fulltext'
const OCR_BIN = 'scripts/place-documents/ocr'

/**
 * One entry per document that is published on a plat it does not govern.
 *
 *   doc       place_document.id — the identity. Six of the Sunset West rows
 *             share an empty recording_ref and the same published_name, so
 *             (name, ref) is not a key in this corpus and the UUID is.
 *   name/ref  the index's published name and recording reference, for reading
 *   file      the source PDF's filename, which is what distinguishes those six
 *   demote    every published plat this document must come off
 *   subject   the place the instrument is actually about
 *   evidence  a line from the record that says so — verbatim in `cite`'s text
 *   cite      the document the evidence line comes from; defaults to `doc`, and
 *             is set to a sibling in the chain when the instrument's own scan is
 *             too damaged to quote (118-455's title is illegible even at 7x, so
 *             its own amendment, which names it by book and page, carries it)
 *   why       what makes `subject` a different place from `demote`
 */
const RULINGS = [
  // ---- Holliday Park, Third Addition, filed under Hillside Park ------------
  // Six instruments, one chain. `hillside-park-phase-i` is section 30 of T17S
  // R12E; `holliday-park-third-addition-phase-i` is section 27, and it is a
  // plat of its own holding no documents at all. The word "Hillside" does not
  // occur in any of the six, at any depth.
  { doc: 'c44ffaca-2f84-4bdc-a494-18a6027f40ad', name: 'Hillside Park', ref: '2002-19981', file: '2002-19981.pdf',
    demote: 'hillside-park-phase-i hillside-park-phase-ii hillside-park-phase-iii hillside-park-phase-iv hillside-park-phase-v',
    subject: 'a City of Bend public facility improvement agreement for Holliday Park 3rd Addition, Phase 1',
    evidence: 'The CITY OF BEND, an Oregon municipal corporation, hereinafter referred to as "CITY" and Clyde W. and Mary Lou Purcell, hereinafter referred to as "USER" agree as follows',
    why: 'a licence agreement for public facility extension, not a governing document for any plat; its own footer reads "Holliday Park 3 Addn, Ph 1"' },

  { doc: 'f0a6a683-e55a-481a-95dd-a7eb50e25605', name: 'Hillside Park', ref: '2003-08854', file: '2003-08854.pdf',
    demote: 'hillside-park-phase-iii',
    subject: 'Holliday Park, Third Addition',
    evidence: 'The property described as HOLLIDAY PARK, THIRD ADDITION is hereby subject to these Covenants, Conditions and Restrictions',
    why: 'Holliday Park, Third Addition is three plats of its own' },

  { doc: '253bd5e6-e513-46b0-ac3f-43cc08e015b4', name: 'Hillside Park', ref: '2004-57182', file: '2004-57182.pdf',
    demote: 'hillside-park-phase-i hillside-park-phase-ii hillside-park-phase-iii hillside-park-phase-iv hillside-park-phase-v',
    subject: 'Holliday Park, Third Addition, Phase I',
    evidence: 'Re-recorded to correct Declaration of Covenants, Conditions and Restrictions for Holliday Park, Third Addition',
    why: 'the re-recording of 2003-08854, same chain, same plats' },

  { doc: '7e9ea811-4b0a-4ffc-9cdb-cdf8e0d9298a', name: 'Hillside Park', ref: '2004-57183', file: '2004-57183.pdf',
    demote: 'hillside-park-phase-i hillside-park-phase-ii hillside-park-phase-iii hillside-park-phase-iv hillside-park-phase-v',
    subject: 'Holliday Park, Third Addition, Phase I, Lots 1 through 20 — the Cottage Canyon over-55 community',
    evidence: 'is applicable only to Holliday Park, Third Addition, Phase I, Lots 1 through 20',
    why: 'the instrument states its own reach, and it is not this plat' },

  { doc: 'd4f05128-c0c3-4eab-ab0f-d9555cd2c076', name: 'Hillside Park', ref: '2007-46904', file: '2007-46904.pdf',
    demote: 'hillside-park-phase-i hillside-park-phase-ii hillside-park-phase-iii hillside-park-phase-iv hillside-park-phase-v',
    subject: 'Holliday Park, Third Addition, Phases II and III',
    evidence: 'DECLARATION FOR HOLLIDAY PARK, THIRD ADDITION, PHASES II and III',
    why: 'Holliday Park, Third Addition is three plats of its own' },

  { doc: 'a276a6ae-78c5-4820-8e23-b05feceb4363', name: 'Hillside Park', ref: '2014-29533', file: '2014-29533.pdf',
    demote: 'hillside-park-phase-i hillside-park-phase-ii hillside-park-phase-iii hillside-park-phase-iv hillside-park-phase-v',
    subject: 'Holliday Park, Third Addition, Phases II and III',
    evidence: 'Declaration for Holliday Park, Third Addition, Phases II and III, Codes, Covenants and Restrictions',
    why: 'the amendment to 2007-46904, same chain, same plats' },

  // ---- one Eagle Crest neighbourhood's bylaws, fanned across 57 plats ------
  { doc: '9a3531ff-3a12-47ea-ae8f-55e079c8eae1', name: 'Ridge at Eagle Crest', ref: '2005-87953', file: '2005-87953.pdf',
    demote: 'ridge-at-eagle-crest-5 ridge-at-eagle-crest-6 ridge-at-eagle-crest-7 ridge-at-eagle-crest-8 ridge-at-eagle-crest-9 ridge-at-eagle-crest-10 ridge-at-eagle-crest-11 ridge-at-eagle-crest-12 ridge-at-eagle-crest-13 ridge-at-eagle-crest-14 ridge-at-eagle-crest-15 ridge-at-eagle-crest-16 ridge-at-eagle-crest-17 ridge-at-eagle-crest-18 ridge-at-eagle-crest-19 ridge-at-eagle-crest-20 ridge-at-eagle-crest-21 ridge-at-eagle-crest-22 ridge-at-eagle-crest-23 ridge-at-eagle-crest-24 ridge-at-eagle-crest-25 ridge-at-eagle-crest-26 ridge-at-eagle-crest-27 ridge-at-eagle-crest-28 ridge-at-eagle-crest-29 ridge-at-eagle-crest-31 ridge-at-eagle-crest-32 ridge-at-eagle-crest-33 ridge-at-eagle-crest-34 ridge-at-eagle-crest-35 ridge-at-eagle-crest-36 ridge-at-eagle-crest-37 ridge-at-eagle-crest-38 ridge-at-eagle-crest-39 ridge-at-eagle-crest-40 ridge-at-eagle-crest-41 ridge-at-eagle-crest-42 ridge-at-eagle-crest-43 ridge-at-eagle-crest-44 ridge-at-eagle-crest-45 ridge-at-eagle-crest-46 ridge-at-eagle-crest-47 ridge-at-eagle-crest-48 ridge-at-eagle-crest-49 ridge-at-eagle-crest-50 ridge-at-eagle-crest-53 ridge-at-eagle-crest-54 ridge-at-eagle-crest-55 ridge-at-eagle-crest-56 ridge-at-eagle-crest-57 ridge-at-eagle-crest-58 ridge-at-eagle-crest-59 ridge-at-eagle-crest-60 ridge-at-eagle-crest-61 ridge-at-eagle-crest-ii ridge-at-eagle-crest-iii ridge-at-eagle-crest-iv',
    subject: 'The Falls Owners Association',
    evidence: 'FIRST AMENDMENT TO BYLAWS OF THE FALLS OWNERS ASSOCIATION',
    why: 'The Falls is one Neighborhood inside the Ridge master, with its own Project Declarant; the two-page instrument names no plat, and a Neighborhood association\'s bylaws bind that Neighborhood, not all 57 Ridge plats. The Ridge master declaration and bylaws (2005-01-28) stay published on every one of them' },

  // ---- an Eagle Crest annexation filed under a Bend subdivision -----------
  { doc: '1c4074d9-f95b-4339-8a38-b75e60466d0a', name: 'Shevlin Reserve', ref: '2005-63448', file: '2005-63448.pdf',
    demote: 'shevlin-reserve',
    subject: 'Phase 4 of the Highland Parks Neighborhood, The Ridge at Eagle Crest',
    evidence: 'The Additional Property is hereby annexed to The Ridge At Eagle Crest and made subject to the Master Declaration',
    why: 'Shevlin Reserve is section 25 of T17S R11E, in Bend; The Ridge at Eagle Crest is in Redmond. Six other Shevlin Reserve documents stay published' },

  // ---- a NorthWest Crossing townhome project's amendment, on 22 plats ------
  { doc: '1e89267c-3a7e-49d0-83fe-c3445f953d95', name: 'Northwest Crossing', ref: '2004-57290', file: '2004-57290.pdf',
    demote: 'northwest-crossing northwest-crossing-phase-1 northwest-crossing-phase-4 northwest-crossing-phase-5 northwest-crossing-phase-6 northwest-crossing-phase-8 northwest-crossing-phase-12 northwest-crossing-phase-13 northwest-crossing-phase-14 northwest-crossing-phase-15 northwest-crossing-phase-16 northwest-crossing-phase-17 northwest-crossing-phase-18 northwest-crossing-phase-19 northwest-crossing-phase-23 northwest-crossing-phase-24 northwest-crossing-phase-25 northwest-crossing-phase-26 northwest-crossing-phase-27 northwest-crossing-phase-29 northwest-crossing-phase-30',
    subject: 'Lewis and Clark Townhomes',
    evidence: 'hereby amends the Declaration of Covenants, Conditions and Restrictions for Lewis and Clark Townhomes recorded on March 11, 2004 at Volume 2004 page 13336',
    why: 'the underlying declaration (2004-13336) constitutes a "NorthWest Crossing Townhome Association of Owners", so the townhomes sit inside NorthWest Crossing — but they are one project, and this two-page amendment names no plat at any depth. It cannot be the governing document of 21 of them. 2004-13336 itself stays published: it names NorthWest Crossing throughout, and how far a neighbourhood declaration reaches inside its own master is phase-governance.mjs\'s question. The NorthWest Crossing master declaration, 2007-25377, is published on every one of these plats' },

  // ---- a ten-lot restatement for the plat next door -----------------------
  { doc: 'a49aa4d1-8c91-4851-b578-5928d001ef01', name: 'Southern Pines', ref: '2006-12928', file: '2006-12928.pdf',
    demote: 'southern-pines',
    subject: 'Ince Subdivision',
    evidence: 'this Declaration shall be binding upon Lots 1 through 10 in Ince Subdivision',
    why: 'Ince Subdivision is a plat of its own in the same section, holding no documents; this restatement is by the lot owners and reserves no right to annex anything. Three other Southern Pines documents stay published' },

  // ---- Deschutes River Recreation Homesites, filed under Water Wonderland --
  { doc: '380abf3f-8a18-4cd2-9c75-b3898c8f1935', name: 'Oregon Water Wonderland', ref: '1999-35277', file: '1999-35277.pdf',
    demote: 'oregon-water-wonderland-unit-1 oregon-water-wonderland-unit-2',
    subject: 'Deschutes River Recreation Homesites Unit 8 Part I, Blocks 85-88',
    evidence: 'AMENDMENT TO BUILDING AND USE RESTRICTIONS DESCHUTES RIVER RECREATION HOMESITES UNIT 8 PART I APPLICABLE TO BLOCKS 85, 86, 87 AND 88',
    why: 'Deschutes River Recreation Homesites is 26 plats of its own; "Water Wonderland" does not occur in the instrument. Four other Water Wonderland documents stay published on Unit 1' },

  // ---- Glacier Ridge, filed under Gemstone Estates ------------------------
  { doc: 'fb4f54d4-f2fe-4dc0-af5f-8f5bcd2c113c', name: 'Gemstone Estates', ref: '1999-37900', file: '1999-37900.pdf',
    demote: 'gemstone-estates',
    subject: 'Glacier Ridge',
    evidence: 'DECLARATION OF COVENANTS CONDITIONS & RESTRICTIONS GLACIER RIDGE',
    why: 'the same instrument is in the corpus a second time under the Glacier Ridge bucket and is published on glacier-ridge-phase-i, which is a different section. Six other Gemstone Estates documents stay published' },

  // ---- Silver Lake Estates, filed under Mill Ridge ------------------------
  { doc: 'a44ac232-3776-4a77-bf6f-d1498fc42720', name: 'Mill Ridge', ref: '412-2088', file: '412-2088.pdf',
    demote: 'mill-ridge',
    subject: 'Silver Lake Estates',
    evidence: 'known as Silver Lake Estates',
    why: 'the same instrument is in the corpus under the Silver Lake Estates bucket and is published on silver-lake-estates; it subjects "said subdivision, and the whole thereof" and reserves no annexation right' },

  // ---- West Hills, filed under Pine West ----------------------------------
  { doc: '01b718a6-d8c0-4ec4-afed-a1a055e07c24', name: 'Pine West', ref: '118-455', file: '118-455.pdf',
    demote: 'pine-west',
    subject: 'West Hills Subdivision',
    cite: '60716c0d-7866-4080-9d76-35c323f44297',
    evidence: 'at Book 118 Deeds, Page 455, recorded in the office of the County Clerk of Deschutes County, Oregon, certain "Building and Use Restrictions, West Hills Subdivision, Deschutes County, Oregon"',
    why: 'the 1958 West Hills building and use restrictions, present in the corpus a second time under the West Hills bucket and published on west-hills. The 1959 microfilm is unreadable even rendered at 7x — the title reads "MEST HILIS SUBDIVISICN" — so the evidence is cited from 120-667, its own amendment, which names the instrument by book and page and spells the subdivision out' },

  { doc: '60716c0d-7866-4080-9d76-35c323f44297', name: 'Pine West', ref: '120-667', file: '120-667.pdf',
    demote: 'pine-west',
    subject: 'West Hills Subdivision',
    evidence: 'AMENDMENT TO BUILDING AND USE RESTRICTIONS WEST HILLS SUBDIVISION',
    why: 'amends the West Hills restrictions at Book 118 Page 455 "without ... jeopardizing any existing rights of the property owners in the West Hills Subdivision". Also in the corpus under the West Hills bucket. Pine West is left with no documents, which is the correct answer: it has none' },

  // ---- Indian Ford Ranch Homes, filed under Indian Ford Meadows -----------
  { doc: '274ccb17-c041-4474-8e83-6c2115fe8ae3', name: 'Indian Ford Meadows', ref: '2015-27113', file: '2015-27113.pdf',
    demote: 'indian-ford-meadows',
    subject: 'Indian Ford Ranch Homes — Plat Number One',
    evidence: 'Amendment to the By Laws of the Indian Ford Ranch Homes Association Plat Number One',
    why: 'Indian Ford Ranch Homes is its own plat in section 27; Indian Ford Meadows is section 33' },

  { doc: 'd614a9af-b7b2-4b7b-a7af-876e21f417fe', name: 'Indian Ford Meadows', ref: '444-2995', file: '444-2995.pdf',
    demote: 'indian-ford-meadows',
    subject: 'High Meadow Addition to Indian Ford Ranch Homes, and First Addition to Indian Ford Ranch Homes',
    evidence: 'HIGH MEADOW ADDITION TO INDIAN FORD RANCH HOMES',
    why: 'both named plats exist in their own right (sections 21 and 27); Indian Ford Meadows is section 33 and is never named. The association is High Meadow Homeowners Association' },

  { doc: 'c521fd19-ece2-4f49-b0ef-e7774df35f6f', name: 'Indian Ford Meadows', ref: '448-360', file: '448-360.pdf',
    demote: 'indian-ford-meadows',
    subject: 'High Meadow Addition to Indian Ford Ranch Homes, and First Addition to Indian Ford Ranch Homes',
    evidence: 'HIGH MEADOW ADDITION TO INDIAN FORD RANCH HOMES',
    why: 're-recording of 444-2995, same chain, same plats' },

  // ---- a Sunriver condominium filed under two Bend/Redmond places ---------
  { doc: 'b8b5b22d-ac29-4528-b75e-48f2f492b4d0', name: 'Mountain View', ref: '172-1', file: '172-1.pdf',
    demote: 'mountain-view-addition bend-mountain-view',
    subject: 'Mountain View Lodges, Meadow Village, Sunriver',
    evidence: 'a condominium to be known as Mountain View Lodges which will be a part of Meadow Village, Sunriver',
    why: 'the land submitted is in section 32 of T19S R11E — Sunriver. Mountain View Addition is section 16 of T15S R13E, in Redmond; bend-mountain-view is a City of Bend neighbourhood district' },

  { doc: 'ca319214-c763-4109-82c1-7147d27bbf3a', name: 'Mountain View', ref: '2002-29556', file: '2002-29556.pdf',
    demote: 'bend-mountain-view',
    subject: 'the Stepping Stone HOME-assisted group home, City of Redmond',
    evidence: 'located on lands in the City of Redmond, County of Deschutes, State of Oregon',
    why: 'a Redmond project cannot sit in a City of Bend neighbourhood district. Its other link, to the Redmond plat mountain-view-addition, is left alone' },

  // ---- Bend's Mountain View Park, filed onto Redmond's Mountain View --------
  // `mountain-view-addition` is a Redmond plat; `mountain-view-park-phase-i`
  // and -ii sit inside the Bend Mountain View neighbourhood district and hold
  // no documents at all. Each of these three keeps its bend-mountain-view link.
  { doc: 'ce6e4c1b-59bd-48e9-9528-148b3ae3e9f0', name: 'Mountain View', ref: '327-2523', file: '327-2523.pdf',
    demote: 'mountain-view-addition',
    subject: 'Mountain View Park, a planned community in Bend',
    evidence: 'The name of the Planned Community shall be MOUNTAIN',
    why: 'Mountain View Park is two plats in the Bend Mountain View neighbourhood; Mountain View Addition is in Redmond' },

  { doc: 'b95b3b5f-06a5-456e-ae93-6217a06c67df', name: 'Mountain View', ref: '519-2448', file: '519-2448.pdf',
    demote: 'mountain-view-addition',
    subject: 'Mountain View Park, a planned community in Bend',
    evidence: 'AMENDMENT TO DECLARATION OF MOUNTAIN VIEW PARK',
    why: 'the amendment to 327-2523, same community, same plats' },

  { doc: '1bbe7805-81b5-4b70-8a2a-728de8d9c4c1', name: 'Mountain View', ref: '327-2533', file: '327-2533.pdf',
    demote: 'mountain-view-addition',
    subject: 'Mountain View Park Homeowners Association, Bend',
    evidence: 'BYLAWS FOR MOUNTAIN VIEW PARK HOMEOWNERS ASSOCIATION',
    why: 'the bylaws under 327-2523. It sat in review while this ledger was being written and regate.mjs promoted it — "Mountain View" is an exact bucket match on a Redmond plat and a Bend neighbourhood at once, which is precisely why this step runs after regate. Its bend-mountain-view link is left alone' },

  { doc: 'bb6cfb9a-63a7-4d70-b89d-a16b7c66b41f', name: 'Mountain View', ref: '2000-21083', file: '2000-21083.pdf',
    demote: 'mountain-view-addition',
    subject: 'Mountain View Park Homeowners Association, Bend',
    evidence: 'MOUNTAIN VIEW PARK HOMEOWNERS ASSOCIATIIN',
    why: 'its own attachment reads "Lots 1-48 Located in Mountain View Park (phase I)" and its address is 2650 NE Rosemary Dr, Bend; Mountain View Addition is in Redmond' },

  // ---- Sunset View Estates Phase II, filed six times under Sunset West ----
  // The source served the same instrument (491-1232) for six different index
  // rows, so the corpus holds six place_document rows whose text is identical
  // to the character. All six are published on sunset-west.
  { doc: '0725d44b-a30b-42a2-909a-3342a0b2b1bc', name: 'Sunset West', ref: '', file: '2008-15734.pdf',
    demote: 'sunset-west', subject: 'Sunset View Estates, Phase II',
    evidence: 'DECLARATIONS, RESTRICTIONS, PROTECTIVE COVENANTS AND CONDITIONS SUNSET VIEW ESTATES PHASE II',
    why: 'Sunset West is section 8 of T17S R12E; Sunset View Estates is section 20 of T18S R12E and has eight plats of its own. The instrument annexes "Sunset View Estates, Phase II" to the Sunset View Estates declarations and names Sunset West nowhere' },
  { doc: '010e5267-2bf7-424e-a616-32dd1d27b79c', name: 'Sunset West', ref: '', file: '2004-00584.pdf',
    demote: 'sunset-west', subject: 'Sunset View Estates, Phase II',
    evidence: 'DECLARATIONS, RESTRICTIONS, PROTECTIVE COVENANTS AND CONDITIONS SUNSET VIEW ESTATES PHASE II',
    why: 'Sunset West is section 8 of T17S R12E; Sunset View Estates is section 20 of T18S R12E and has eight plats of its own. The instrument annexes "Sunset View Estates, Phase II" to the Sunset View Estates declarations and names Sunset West nowhere' },
  { doc: '39059f0e-b314-44c1-b2d5-aba339f36690', name: 'Sunset West', ref: '', file: '207-2682.pdf',
    demote: 'sunset-west', subject: 'Sunset View Estates, Phase II',
    evidence: 'DECLARATIONS, RESTRICTIONS, PROTECTIVE COVENANTS AND CONDITIONS SUNSET VIEW ESTATES PHASE II',
    why: 'Sunset West is section 8 of T17S R12E; Sunset View Estates is section 20 of T18S R12E and has eight plats of its own. The instrument annexes "Sunset View Estates, Phase II" to the Sunset View Estates declarations and names Sunset West nowhere' },
  { doc: '34b25ada-3acd-41e5-9c72-bf6b23427ccc', name: 'Sunset West', ref: '', file: '2003-36439.pdf',
    demote: 'sunset-west', subject: 'Sunset View Estates, Phase II',
    evidence: 'DECLARATIONS, RESTRICTIONS, PROTECTIVE COVENANTS AND CONDITIONS SUNSET VIEW ESTATES PHASE II',
    why: 'Sunset West is section 8 of T17S R12E; Sunset View Estates is section 20 of T18S R12E and has eight plats of its own. The instrument annexes "Sunset View Estates, Phase II" to the Sunset View Estates declarations and names Sunset West nowhere' },
  { doc: '80764988-ae6a-4deb-ae58-0f4386c9d176', name: 'Sunset West', ref: '', file: '491-1232.pdf',
    demote: 'sunset-west', subject: 'Sunset View Estates, Phase II',
    evidence: 'DECLARATIONS, RESTRICTIONS, PROTECTIVE COVENANTS AND CONDITIONS SUNSET VIEW ESTATES PHASE II',
    why: 'Sunset West is section 8 of T17S R12E; Sunset View Estates is section 20 of T18S R12E and has eight plats of its own. The instrument annexes "Sunset View Estates, Phase II" to the Sunset View Estates declarations and names Sunset West nowhere' },
  { doc: '5a6cf253-e464-4c8e-968f-0338a741560c', name: 'Sunset West', ref: '', file: '2004-00585.pdf',
    demote: 'sunset-west', subject: 'Sunset View Estates, Phase II',
    evidence: 'DECLARATIONS, RESTRICTIONS, PROTECTIVE COVENANTS AND CONDITIONS SUNSET VIEW ESTATES PHASE II',
    why: 'Sunset West is section 8 of T17S R12E; Sunset View Estates is section 20 of T18S R12E and has eight plats of its own. The instrument annexes "Sunset View Estates, Phase II" to the Sunset View Estates declarations and names Sunset West nowhere' },

  // ---- a contract of sale for another subdivision -------------------------
  { doc: '92a9a6f2-ab5e-49d9-b9c8-6d5d562a3a8c', name: 'Timber Estates', ref: '178-927', file: '178-927.pdf',
    demote: 'timber-estates',
    subject: 'the West Half of Block 2, Metts Subdivision',
    evidence: 'of METTS SUBDIVISION, Deschutes County, Oregon',
    why: 'a CONTRACT OF SALE between two named parties, classified ccr from its covenant clauses. It is not a governing instrument for any plat, and the property it conveys is in Metts Subdivision. Timber Estates is left with no documents, which is the correct answer: it has none' },
]

/**
 * Documents read end to end and LEFT ALONE. This list is the point. Each of
 * these was flagged by one of the three screens, and each is where it belongs.
 */
const CLEARED = [
  ['Southwest Pines 2000-6864', 'the Quail Pine Estates declaration. Its own supplemental 2004-66923 is titled "FOR QUAIL PINE ESTATES PHASE XI (PLATTED AS SOUTHWEST PINES SUBDIVISION)" and annexes the plat to it. PRIOR NAME.'],
  ['Tres Jolie 524-2046', 'a Third Amendment for Anderson Acres that regulates a named lot in Tres Jolie. NAMED LOTS.'],
  ['Deschutes Landing 2001-38340', 'a Supplemental Declaration annexing River Bend expansion property, in section 5 of T18S R12E — the plat\'s own section. MASTER + ANNEXATION.'],
  ['Plaza Condominiums 2000-29857', 'withdraws lots of Upper Terrace Phase II from the Upper Terrace supplemental while keeping them under the River Bend master — the instrument a replat would need. Cannot be shown wrong.'],
  ['Golf Townhomes at Broken Top 2001-33259', 'titled "…OF WHISPER RIDGE", but its exhibit is headed "Golf Tracts at Broken Top, Phase 3" in section 1 of T18S R11E, which is this plat. Whisper Ridge is the Neighborhood name the declaration creates.'],
  ['North Mountain View Estates 2016-43208', 'titled "BYLAWS OF SKYSTONE ESTATES HOMEOWNERS\' ASSOCIATION", and certifies they "have been adopted by the owners of Lots in NMV Estates Subdivision". Association name, not a different place.'],
  ['Orion Estates 329-982', 'headed "ORION ESTATES SUBDIVISION"; the Desert Woods restrictions are attached to it as an ADDENDUM the Orion Estates owners adopt.'],
  ['Pine Street Commons 1999-41448 and 2005-23265', 'Pine Meadow Village instruments, same section, and the declaration expressly reserves the right to annex additional land. Cannot be shown wrong.'],
  ['Pioneer Business Park 2008-04511', 'a condominium declaration on "Lots 1 and 7 of Pioneer Business Park, Phase 1". NAMED LOTS.'],
  ['Indian Ford Meadows 2010-18975', 'the Crooked Horse Shoe association declaration, which recites owners "within Blocks 5, 6 and 7 of plat records designated as Indian Ford Meadows". Names the plat.'],
  ['Ponderosa Pines 2007-20414 and 2012-11462', 'the microfilm reads "Ponderous Pines" throughout. OCR, not a different place.'],
  ['Lavacrest 2000-15509', '"Lava Crest", spaced.'],
  ['Blakley South 2006-51389', 'the drafter spells it "BLAKELY SOUTH".'],
  ['Foxborough 2001-31137', 'Exhibit A Parcel 2 is Foxborough Phase 1 and Parcel 1 is the remainder excepting it; the OCR mangles the name to "FOXBOROUAK-INASE".'],
  ['Obsidian Meadows 2006-42825', 'the exhibit reads clean at 6x: "the duly recorded plat of Obsidian Meadows, index number 2006-04100".'],
  ['Sisters Park Place 1999-18249', 'a South Barclay Properties declaration. South Barclay is in no boundary the registry holds, so the relationship between the two plats cannot be established either way. Left published, and flagged for a human.'],
  ['Urban Acres 2007-30026', 'a Deschutes County EFU land-use covenant for an 8-lot subdivision on a 42-acre parcel. Names no plat; nothing shows it is not this one.'],
  ['Tetherow 1999-30341, 2005-83296, 2006-35886', 'Cascade Highlands instruments on the Westgate / CHLP parcel that became Tetherow. None names the plat; all burden the land.'],
  ['Broken Top and The Parks at Broken Top 1999-7067', 'an agreement deferring annexation of the Costa Pacific property to the Broken Top CCRs. Cannot be shown wrong.'],
  ['Redmond Town Center 1999-47388', 'the Fred Meyer declaration, exhibits "Lots 3, 4, 5, and 6 of Redmond Town Center".'],
  ['River Canyon Estates 2003-10645', 'a settlement agreement naming the River Canyon Estates PUD; the "Sunrise Village" hit is in a Windows file path.'],
  ['Heritage Place, Millcrest, Sunscape, Sunridge, Village Wiestoria, Maplewood', 'the "Mill View" hit in every one is the law firm\'s return address on Mill View Way.'],
  ['Westbrook Meadows 2002-57734', '"West Brook Meadows", spaced; the "Wall Street" hit is the firm\'s address.'],
  ['Crosswater 435-2295', 'a Crosswater supplemental annexing the Canoe Camp plat into the Crosswater declaration.'],
  ['Forest Park 267-354, SkyPark 193-651', 'Sunriver instruments annexing those plats to Meadow Village. Both name their own plat.'],
  ['Dobson Slocum Acreage 2001-14206', 'exhibits parcels in Lot 3 of Dobson-Slocum Acreage. NAMED LOTS.'],
  ['Deschutes River Homesites Rimrock Addition 128-465', 'titled "DESCHUTES RIVER TRACT-RIMROCK ADDITION"; OCR reads "RUMROCK".'],
  ['Poplar Park / Waywest Properties 2003-67768', 'declares the Poplar Subdivision on a parcel that is part of Tract One of Waywest Properties. Both links are right.'],
  ['Fall River Estates 356-2944', 'Exhibit A is lots in Fall River Estates and Fall River Estates First Addition.'],
  ['Mountain View 327-2533', 'Mountain View Park HOA bylaws; Mountain View Park is in section 27 of T17S R12E, inside the Bend Mountain View neighbourhood district.'],
  ['Oak Hills 2006-14445, Sisters View Estates 144-138, East Villa 189-101, Hollow Pine Estates 1999-49315, Tara View Estates 296-709, Clear Sky Estates 280-869, Squaw Back Woods 323-989, Whispering Pines 27-330, Hayden Village 218-1024, Eagle Crest 389-327 and 389-0338', 'singular/plural, "Extended", a roman numeral or plain OCR damage in the plat name. All name their own place.'],
  ['Caldera Springs, Eagle Crest and The Ridge at Eagle Crest association sets', 'master declarations, bylaws, articles, rules and design guidelines that name their resort. The "NO" on the tax-lot-suffixed phase slugs is the suffix, not the name.'],
  ['Redmond Town Center 1999-41922', 'the county typed it "Agreement", and it is one: an amendment to a City of Redmond land division improvement agreement. But it releases "Lot 2 of Redmond Town Center" by name, so the plat is right. Its doc_kind is a classify.mjs question, not this one.'],
  ['Park Place Estates 256-1054, River Meadows 292-629', 'both OCR to nothing at all — no text layer and no readable scan. An unreadable document is evidence of nothing, in either direction, so both stay exactly where they are. They are the corpus\'s two blind spots to this method.'],
  ['Hillside Park 181-853, 481-40, 1999-49290', 'the plat\'s OWN declaration, its architectural guidelines and the supplemental submitting Phase V. They stay published, so removing the six Holliday Park instruments leaves every Hillside Park phase with real governing documents rather than none.'],
  ['North Rim on Awbrey Butte 2004-41671', 'the declaration "for North Rim". The butte is in the registry label, not the instrument.'],
  ['Antler Ridge, Carly Meadows, Village at Cold Springs, Vista Dorado charitable-fee covenants', 'each names its own subdivision\'s plat and index number. Whether a covenant naming one phase\'s lots reaches the sibling phase is a PHASE question — see phase-governance.mjs.'],
  ['Highlands at Broken Top 2006-16453, Quail Pine Estates 2000-32246 / 2001-20917 / 2002-55972 / 2003-14037 / 2004-51151', 'phase-specific supplementals fanned across their sibling phases. Same subdivision, so this is phase-governance.mjs\'s class and its ledger, not this one\'s. Reported, not demoted.'],
]

// --- sanity on the ledger itself ------------------------------------------
const set = (s) => new Set(String(s || '').split(/\s+/).filter(Boolean))
const ledgerErrors = []
const seenDoc = new Set()
for (const r of RULINGS) {
  if (!r.doc || !/^[0-9a-f-]{36}$/.test(r.doc)) ledgerErrors.push(`${r.name} ${r.ref}: not a document id`)
  if (seenDoc.has(r.doc)) ledgerErrors.push(`${r.name} ${r.ref}: document listed twice`)
  seenDoc.add(r.doc)
  if (!set(r.demote).size) ledgerErrors.push(`${r.name} ${r.ref}: demotes nothing`)
  if (!r.evidence || r.evidence.trim().length < 8) ledgerErrors.push(`${r.name} ${r.ref}: no evidence line`)
  if (!r.why) ledgerErrors.push(`${r.name} ${r.ref}: no reason`)
}
if (ledgerErrors.length) {
  console.error('the ruling table is inconsistent:')
  for (const e of ledgerErrors) console.error(`  ${e}`)
  process.exit(1)
}

// --- the text a ruling is checked against ---------------------------------
//
// ocr_text is the front two pages. Most of these lines are deeper than that, so
// fall through to a full-text OCR of the hosted PDF, cached on disk. Nothing is
// read from this file.
const flat = (s) => String(s || '').replace(/<<<PAGE \d+>>>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()

fs.mkdirSync(CACHE, { recursive: true })
const fullTextCache = new Map()
async function fullText(doc) {
  if (fullTextCache.has(doc.id)) return fullTextCache.get(doc.id)
  const cached = path.join(CACHE, `${doc.id}.txt`)
  if (fs.existsSync(cached) && fs.statSync(cached).size > 0) {
    const t = fs.readFileSync(cached, 'utf8')
    fullTextCache.set(doc.id, t)
    return t
  }
  if (!fs.existsSync(OCR_BIN)) {
    fullTextCache.set(doc.id, null)
    return null
  }
  const pdf = path.join(CACHE, `${doc.id}.pdf`)
  if (!fs.existsSync(pdf)) {
    const { data, error } = await sb.storage.from(BUCKET).download(doc.storage_path)
    if (error || !data) { fullTextCache.set(doc.id, null); return null }
    const buf = Buffer.from(await data.arrayBuffer())
    if (buf.subarray(0, 5).toString() !== '%PDF-') { fullTextCache.set(doc.id, null); return null }
    fs.writeFileSync(pdf, buf)
  }
  let text = null
  try {
    text = execFileSync(OCR_BIN, [pdf, '500'], { maxBuffer: 64 * 1024 * 1024, timeout: 600_000 }).toString()
    fs.writeFileSync(cached, text)
  } catch { text = null }
  fs.rmSync(pdf, { force: true })
  fullTextCache.set(doc.id, text)
  return text
}

// --- read ------------------------------------------------------------------
const wanted = RULINGS.map((r) => r.doc)
const needed = [...new Set([...wanted, ...RULINGS.map((r) => r.cite || r.doc)])]
const docs = new Map()
for (let i = 0; i < needed.length; i += 100) {
  const { data, error } = await sb
    .from('place_document')
    .select('id, published_name, recording_ref, doc_kind, source_url, storage_path, ocr_text')
    .in('id', needed.slice(i, i + 100))
  if (error) throw new Error(error.message)
  for (const d of data) docs.set(d.id, d)
}

const links = []
for (let last = '00000000-0000-0000-0000-000000000000'; ; ) {
  const { data, error } = await sb
    .from('place_document_link')
    .select('id, geo_slug, status, match_method, document_id')
    .in('document_id', wanted)
    .gt('id', last)
    .order('id', { ascending: true })
    .limit(1000)
  if (error) throw new Error(error.message)
  if (!data.length) break
  links.push(...data)
  last = data[data.length - 1].id
  if (data.length < 1000) break
}
console.log(`rulings: ${RULINGS.length} documents   links on them: ${links.length}`)

// --- verify the evidence, every run ---------------------------------------
const unverified = []
const verifiedIn = new Map()
for (const r of RULINGS) {
  if (!docs.get(r.doc)) { unverified.push(`${r.name} ${r.ref} (${r.file}): no such document in place_document`); continue }
  const d = docs.get(r.cite || r.doc)
  if (!d) { unverified.push(`${r.name} ${r.ref} (${r.file}): cited instrument ${r.cite} is not in place_document`); continue }
  const from = r.cite ? `${d.recording_ref}` : 'its own'
  const needle = flat(r.evidence)
  if (flat(d.ocr_text).includes(needle)) { verifiedIn.set(r.doc, `${from} front matter`); continue }
  const t = await fullText(d)
  if (t === null) {
    unverified.push(`${r.name} ${r.ref} (${r.file}): evidence is not in the front matter and the full text could not be derived (build ${OCR_BIN}, and check the hosted PDF)`)
    continue
  }
  if (flat(t).includes(needle)) { verifiedIn.set(r.doc, `${from} full text`); continue }
  unverified.push(`${r.name} ${r.ref} (${r.file}): the evidence line is in neither the front matter nor the full text of ${d.recording_ref || d.source_url}`)
}
if (unverified.length) {
  console.error(`\nREFUSING TO DEMOTE — ${unverified.length} rulings cannot show their evidence:`)
  for (const u of unverified) console.error(`  ${u}`)
  process.exit(1)
}
const vals = [...verifiedIn.values()]
console.log(`evidence verified: ${vals.filter((v) => v.endsWith('front matter')).length} in a front matter, ${vals.filter((v) => v.endsWith('full text')).length} in a full text; ${vals.filter((v) => !v.startsWith('its own')).length} quoted from a sibling instrument`)

// --- decide ----------------------------------------------------------------
const byDoc = new Map(RULINGS.map((r) => [r.doc, r]))
const demote = []   // published -> pending_review
const already = []  // named, and already out of the way
const untouched = [] // this document's other links, left exactly as they are
const drift = []

for (const l of links) {
  const r = byDoc.get(l.document_id)
  if (!set(r.demote).has(l.geo_slug)) { untouched.push(l); continue }
  if (l.status === 'published') demote.push({ l, r })
  else already.push({ l, r })
}
const seen = new Set(links.map((l) => `${l.document_id}|${l.geo_slug}`))
for (const r of RULINGS) for (const s of set(r.demote)) {
  if (!seen.has(`${r.doc}|${s}`)) drift.push(`${r.name} ${r.ref} -> ${s}: no such link any more`)
}

console.log(`\n  demote (published -> review): ${demote.length}`)
console.log(`  already in review:            ${already.length}`)
console.log(`  other links, left alone:      ${untouched.length}`)
if (drift.length) {
  console.log(`\n  ${drift.length} ledger rows no longer match a link:`)
  for (const d of drift.slice(0, 20)) console.log(`    ${d}`)
}

const byRuling = new Map()
for (const { r } of demote) byRuling.set(r.doc, (byRuling.get(r.doc) || 0) + 1)
console.log(`\n${'document'.padEnd(44)} plats`)
for (const r of RULINGS) {
  const n = byRuling.get(r.doc) || 0
  console.log(`${`${r.name} ${r.ref || r.file}`.slice(0, 43).padEnd(44)} ${String(n).padStart(4)}   -> ${r.subject}`)
}

if (SHOW_EVIDENCE) {
  console.log(`\n=== evidence ===`)
  for (const r of RULINGS) {
    console.log(`\n${r.name} ${r.ref || ''} [${r.file}] — the instrument is about ${r.subject}`)
    console.log(`  verbatim in ${verifiedIn.get(r.doc)}: "${r.evidence}"`)
    console.log(`  why: ${r.why}`)
    console.log(`  off: ${[...set(r.demote)].join(' ')}`)
  }
}
if (SHOW_CLEARED) {
  console.log(`\n=== read and left alone (${CLEARED.length} entries) ===`)
  for (const [what, why] of CLEARED) console.log(`\n  ${what}\n    ${why}`)
}

if (!APPLY) {
  console.log('\n(dry run — pass --apply)')
  process.exit(0)
}

// --- apply -----------------------------------------------------------------
const note = (r) =>
  `foreign-plat: this instrument is about ${r.subject}, not this plat — "${r.evidence}" (${r.cite ? `cited from ${docs.get(r.cite)?.recording_ref}` : r.file}). ${r.why}`
    .replace(/\s+/g, ' ')
    .slice(0, 500)

let n = 0
const byNote = new Map()
for (const { l, r } of demote) {
  const t = note(r)
  if (!byNote.has(t)) byNote.set(t, [])
  byNote.get(t).push(l.id)
}
for (const [t, ids] of byNote) {
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    const { error } = await sb
      .from('place_document_link')
      .update({ status: 'pending_review', review_note: t })
      .in('id', chunk)
    if (error) console.error(`  FAIL chunk: ${error.message}`)
    else n += chunk.length
  }
}
console.log(`\ndemoted ${n}`)

// --- re-read and assert ----------------------------------------------------
const after = []
for (let last = '00000000-0000-0000-0000-000000000000'; ; ) {
  const { data, error } = await sb
    .from('place_document_link')
    .select('id, geo_slug, status, document_id')
    .in('document_id', wanted)
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
  const r = byDoc.get(l.document_id)
  if (!set(r.demote).has(l.geo_slug)) continue
  if (l.status === 'published') wrong.push(`${r.name} ${r.ref} -> ${l.geo_slug}: still published`)
}
console.log('')
console.log('=== POST-RULING STATE ===')
console.log(`links the ledger names: ${demote.length + already.length}`)
console.log(`in review among them:   ${demote.length + already.length - wrong.length}`)
console.log(`STILL PUBLISHED:        ${wrong.length}`)
for (const w of wrong.slice(0, 20)) console.log(`   ${w}`)
process.exit(wrong.length ? 1 : 0)
