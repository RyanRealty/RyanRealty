/**
 * Central Oregon schools registry.
 *
 * The source of truth for the /schools index + /schools/[slug] detail pages.
 * Each entry pairs a human-facing `name` with the MLS-exact `name` value the
 * `listings` table actually stores (verified 2026-06-03 against the live
 * `listings` table: distinct elementary_school / middle_school / high_school
 * values among Active, PropertyType='A' rows). Where the MLS label differs
 * from the everyday spelling (e.g. MLS "LaPine Sr High" vs "La Pine Sr High"),
 * `name` carries the MLS-exact value so the listings join matches.
 *
 * Academic stats (grades, enrollment, ratio, GreatSchools rating, address,
 * blurb, sourceUrl) are OPTIONAL and enriched from verified, cited web sources
 * (GreatSchools, NCES, district sites — captured in data/co-schools-research.json).
 * Per CLAUDE.md §0, none of these are invented — an undefined field renders
 * nothing rather than a guess, and every populated stat traces to `sourceUrl`.
 * Where the research did not find a school (e.g. Juniper Elem) the optional
 * fields stay undefined. The `district` display string is the authoritative
 * verified district name, normalized to the seven canonical district labels.
 *
 * District mapping by city (verified canonical district names + slugs):
 *   Bend / Tumalo / Sunriver / La Pine  → Bend-La Pine Schools (bend-la-pine)
 *   Redmond / Terrebonne                → Redmond School District 2J (redmond)
 *   Sisters                             → Sisters School District 6 (sisters)
 *   Prineville / Powell Butte           → Crook County School District (crook-county)
 *   Madras / Metolius                   → Jefferson County School District 509J (jefferson-509j)
 *   Culver                              → Culver School District (culver)
 *   Gilchrist                           → Gilchrist School District (gilchrist)
 */

export type SchoolLevel = 'elementary' | 'middle' | 'high'

export type CoSchool = {
  /** kebab-case slug derived from `name`. Stable, unique within the registry. */
  slug: string
  /** MLS-exact school name. Used verbatim for the case-insensitive listings join. */
  name: string
  level: SchoolLevel
  /** Primary city the school sits in (matches the listings "City" value). */
  city: string
  /** Human-facing district name. */
  district: string
  /** District slug — links to a district context line on the detail page. */
  districtSlug: string

  // ── Optional academic fields (verified + cited, never invented). ──
  /** Grade span, e.g. "9-12", "K-5", "K-8". */
  grades?: string
  /** Total student enrollment (whole students). */
  enrollment?: number
  /** Students per teacher, from the verified ratio (e.g. "21:1" → 21). */
  studentTeacherRatio?: number
  /** GreatSchools 1–10 rating (e.g. "7/10" → 7). */
  greatSchoolsRating?: number
  /** Street address of the school. */
  address?: string
  /** Short factual description, brand-voice sanitized. */
  blurb?: string
  /** Primary source URL the stats trace to (GreatSchools / NCES / district). */
  sourceUrl?: string
}

/**
 * District lookups by city. The detail-page home-feeding query restricts homes
 * to the cities that belong to a school's district, so a "Sisters Elem" page
 * never pulls in a same-named school's homes from another county.
 */
const DISTRICTS = {
  bendLaPine: { district: 'Bend-La Pine Schools', districtSlug: 'bend-la-pine' },
  redmond: { district: 'Redmond School District 2J', districtSlug: 'redmond' },
  sisters: { district: 'Sisters School District 6', districtSlug: 'sisters' },
  crookCounty: { district: 'Crook County School District', districtSlug: 'crook-county' },
  jefferson: { district: 'Jefferson County School District 509J', districtSlug: 'jefferson-509j' },
  culver: { district: 'Culver School District', districtSlug: 'culver' },
  gilchrist: { district: 'Gilchrist School District', districtSlug: 'gilchrist' },
} as const

/** kebab-case a school name for its slug. */
export function slugifySchoolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type SchoolSeed = Omit<CoSchool, 'slug' | 'district' | 'districtSlug'> & {
  d: { district: string; districtSlug: string }
}

function school(seed: SchoolSeed): CoSchool {
  const { d, ...rest } = seed
  return {
    ...rest,
    slug: slugifySchoolName(seed.name),
    district: d.district,
    districtSlug: d.districtSlug,
  }
}

// ── HIGH SCHOOLS ──────────────────────────────────────────────────────────
const HIGH: CoSchool[] = [
  school({
    name: 'Summit High',
    level: 'high',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: '9-12',
    enrollment: 1282,
    studentTeacherRatio: 26,
    greatSchoolsRating: 10,
    address: '2855 NW Clearwater Dr, Bend, OR 97701',
    blurb:
      'Summit High School is a public high school in Bend serving grades 9-12 as part of the Bend-La Pine Schools district. It offers AP courses, Project Lead The Way curriculum, and a Gifted & Talented program, and earns a perfect 10/10 rating from GreatSchools.',
    sourceUrl: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?ID=410198001451',
  }),
  school({
    name: 'Ridgeview High',
    level: 'high',
    city: 'Redmond',
    d: DISTRICTS.redmond,
    grades: '9-12',
    enrollment: 870,
    studentTeacherRatio: 21,
    greatSchoolsRating: 7,
    address: '4555 SW Elkhorn Ave, Redmond, OR 97756',
    blurb:
      'Ridgeview High School is a public high school serving grades 9-12 in the Redmond School District 2J, offering career and technical education, fine arts, and athletics alongside a college-prep curriculum. The school has an 86% graduation rate, above the Oregon state average, and emphasizes a schoolwide commitment to ensuring every student feels supported and challenged.',
    sourceUrl: 'https://www.greatschools.org/oregon/redmond/3241-Ridgeview-High-School/',
  }),
  school({
    name: 'Caldera High',
    level: 'high',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: '9-12',
    enrollment: 1247,
    greatSchoolsRating: 4,
    address: '60925 SE 15th St, Bend, OR 97702',
    blurb:
      'Caldera High School opened in 2021 as the newest high school in the Bend-La Pine School District, built following a $268.3 million bond. The school takes its name from the Newberry National Volcanic Monument and competes in the OSAA 5A-4 Intermountain Conference as the Wolfpack.',
    sourceUrl: 'https://www.greatschools.org/oregon/bend/4295-Caldera-High-School/',
  }),
  school({
    name: 'Crook County High',
    level: 'high',
    city: 'Prineville',
    d: DISTRICTS.crookCounty,
    grades: '9-12',
    enrollment: 877,
    studentTeacherRatio: 21,
    greatSchoolsRating: 6,
    address: '1100 SE Lynn Blvd, Prineville, OR 97754',
    blurb:
      'Crook County High School is the sole comprehensive public high school in the Crook County School District, serving grades 9-12 with AP courses and a Gifted and Talented program. The school stands out for its graduation rate of 95% or higher, placing it in the top 5% statewide.',
    sourceUrl: 'https://www.greatschools.org/oregon/prineville/335-Crook-County-High-School/',
  }),
  school({
    name: 'LaPine Sr High',
    level: 'high',
    city: 'La Pine',
    d: DISTRICTS.bendLaPine,
    grades: '9-12',
    enrollment: 440,
    studentTeacherRatio: 17,
    greatSchoolsRating: 2,
    address: '51633 Coach Rd, La Pine, OR 97739',
    blurb:
      'La Pine Senior High School is a public high school serving grades 9-12 in the Bend-La Pine Schools district, home to the Hawks who compete in OSAA 3A athletics. The baseball program won back-to-back Oregon 3A state championships in 2018 and 2019.',
    sourceUrl: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?ID=410198000272',
  }),
  school({
    name: 'Mountain View Sr High',
    level: 'high',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: '9-12',
    enrollment: 1221,
    studentTeacherRatio: 19,
    greatSchoolsRating: 7,
    address: '2755 NE 27th Street, Bend, OR 97701',
    blurb:
      'Mountain View Senior High School is a public high school in Bend serving grades 9-12, known for one of the largest selections of Career and Technical Education (CTE) courses in the district and a dual-enrollment partnership with Central Oregon Community College that allows students to earn an Associate of Arts Oregon Transfer degree alongside their high school diploma.',
    sourceUrl: 'https://www.greatschools.org/oregon/bend/204-Mountain-View-Senior-High-School/',
  }),
  school({
    name: 'Bend Sr High',
    level: 'high',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: '9-12',
    enrollment: 1204,
    studentTeacherRatio: 22,
    greatSchoolsRating: 5,
    address: '230 NE 6th St, Bend, OR 97701',
    blurb:
      'Bend Senior High School is a public 9-12 school in the Bend-La Pine Schools district offering AP courses, International Baccalaureate, and Project Lead The Way programs. It serves approximately 1,204 students and is one of the primary high schools serving the Bend area.',
    sourceUrl: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?Search=1&DistrictID=4101980&ID=410198000270',
  }),
  school({
    name: 'Sisters High',
    level: 'high',
    city: 'Sisters',
    d: DISTRICTS.sisters,
    grades: '9-12',
    enrollment: 419,
    studentTeacherRatio: 17,
    greatSchoolsRating: 8,
    address: '1700 W McKinney Butte Rd, Sisters, OR 97759',
    blurb:
      'Sisters High School is a public high school serving grades 9-12 in Sisters, Oregon, rated 8/10 by GreatSchools and performing above average compared to public and charter schools in Oregon. The school offers AP courses and a Gifted & Talented program, and maintains a student-teacher ratio lower than the state average.',
    sourceUrl: 'https://www.greatschools.org/oregon/sisters/1128-Sisters-High-School/',
  }),
  school({
    name: 'Redmond High',
    level: 'high',
    city: 'Redmond',
    d: DISTRICTS.redmond,
    grades: '9-12',
    enrollment: 896,
    studentTeacherRatio: 19,
    greatSchoolsRating: 4,
    address: '675 SW Rimrock Way, Redmond, OR 97756',
    blurb:
      'Redmond High School is a public 9-12 school serving approximately 896 students in the Redmond School District 2j. The school offers Advanced Placement courses and a Gifted & Talented program.',
    sourceUrl: 'https://www.greatschools.org/oregon/redmond/979-Redmond-High-School/',
  }),
  school({
    name: 'Madras High',
    level: 'high',
    city: 'Madras',
    d: DISTRICTS.jefferson,
    grades: '9-12',
    enrollment: 781,
    studentTeacherRatio: 24,
    greatSchoolsRating: 5,
    address: '390 SE 10th Street, Madras, OR 97741',
    blurb:
      'Madras High School is a public 9-12 school serving around 781 students in Jefferson County School District 509J, offering AP courses and a Gifted & Talented program. It is one of two high schools in the district.',
    sourceUrl: 'https://www.greatschools.org/oregon/madras/541-Madras-High-School/',
  }),
  school({
    name: 'Culver High',
    level: 'high',
    city: 'Culver',
    d: DISTRICTS.culver,
    grades: '9-12',
    enrollment: 229,
    studentTeacherRatio: 17,
    greatSchoolsRating: 5,
    address: '710 5th Ave, Culver, OR 97734',
    blurb:
      'Culver High School is the sole high school in Culver School District 4, serving grades 9-12 in a small rural community in Jefferson County, Central Oregon. The school offers AP courses and a Gifted and Talented program.',
    sourceUrl: 'https://www.greatschools.org/oregon/culver/342-Culver-High-School/',
  }),
  school({
    name: 'Gilchrist Jr/Sr High',
    level: 'high',
    city: 'Gilchrist',
    d: DISTRICTS.gilchrist,
    grades: '7-12',
    enrollment: 105,
    studentTeacherRatio: 8.91,
    greatSchoolsRating: 2,
    address: '201 Mountain View Dr, Gilchrist, OR 97737',
    blurb:
      'Gilchrist Junior/Senior High School is a small rural public school serving grades 7-12 in Klamath County, Oregon, with approximately 105 students and a student-teacher ratio well below the state average. The school, home to the Grizzlies, is part of the Klamath County School District.',
    sourceUrl: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?Search=1&ID=410702001467',
  }),
]

// ── MIDDLE SCHOOLS ────────────────────────────────────────────────────────
const MIDDLE: CoSchool[] = [
  school({
    name: 'Pacific Crest Middle',
    level: 'middle',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: '6-8',
    enrollment: 609,
    studentTeacherRatio: 24,
    greatSchoolsRating: 6,
    address: '3030 NW Elwood Lane, Bend, OR 97701',
    blurb:
      'Pacific Crest Middle School serves grades 6-8 in northwest Bend and is known for its Gifted and Talented program and Project Lead The Way STEM curriculum. The school ranks in the top 10% of Oregon middle schools, with math and reading proficiency rates well above state averages.',
    sourceUrl: 'https://www.greatschools.org/oregon/bend/4174-Pacific-Crest-Middle-School/',
  }),
  school({
    name: 'Obsidian Middle',
    level: 'middle',
    city: 'Redmond',
    d: DISTRICTS.redmond,
    grades: '6-8',
    enrollment: 591,
    studentTeacherRatio: 18,
    greatSchoolsRating: 5,
    address: '1335 SW Obsidian Ave, Redmond, OR 97756',
    blurb:
      'Obsidian Middle School is a public school serving grades 6-8 in Redmond School District 2J, offering a Gifted and Talented program. It is one of five middle schools in the district.',
    sourceUrl: 'https://www.greatschools.org/oregon/redmond/978-Obsidian-Middle-School/',
  }),
  school({
    name: 'Crook County Middle',
    level: 'middle',
    city: 'Prineville',
    d: DISTRICTS.crookCounty,
    grades: '6-8',
    enrollment: 616,
    studentTeacherRatio: 15,
    greatSchoolsRating: 8,
    address: '100 NE Knowledge St, Prineville, OR 97754',
    blurb:
      'Crook County Middle School serves grades 6-8 and offers a Gifted and Talented program along with strong support for English language learners. The school maintains a student-teacher ratio below the state average and is rated above average compared to Oregon public schools at the same grade level.',
    sourceUrl: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?Search=1&DistrictID=4103720&ID=410372000243',
  }),
  school({
    name: 'Cascade Middle',
    level: 'middle',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: '6-8',
    enrollment: 614,
    studentTeacherRatio: 23,
    greatSchoolsRating: 10,
    address: '19619 Mountaineer Way, Bend, OR 97702',
    blurb:
      'Cascade Middle School is a public grades 6-8 school in Bend that ranks in the top 10% of Oregon middle schools and offers a Gifted and Talented program including advanced humanities classes across all three grade levels.',
    sourceUrl: 'https://www.greatschools.org/oregon/bend/193-Cascade-Middle-School/',
  }),
  school({
    name: 'LaPine Middle',
    level: 'middle',
    city: 'La Pine',
    d: DISTRICTS.bendLaPine,
    grades: '6-8',
    enrollment: 272,
    studentTeacherRatio: 17,
    greatSchoolsRating: 2,
    address: '16360 First St, La Pine, OR 97739',
    blurb:
      'La Pine Middle School serves grades 6-8 in the Bend-La Pine Schools district and offers a Gifted and Talented program. Approximately 65% of students qualify for free or reduced-price lunch.',
    sourceUrl: 'https://www.greatschools.org/oregon/lapine/198-Lapine-Middle-School/',
  }),
  school({
    name: 'Pilot Butte Middle',
    level: 'middle',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: '6-8',
    enrollment: 686,
    studentTeacherRatio: 19,
    greatSchoolsRating: 7,
    address: '1501 NE Neff Rd, Bend, OR 97701',
    blurb:
      'Pilot Butte Middle School is a public grades 6-8 school in the Bend-La Pine Schools district, offering a Gifted & Talented program and International Baccalaureate. It rates above average compared to Oregon middle schools with a 7/10 GreatSchools rating.',
    sourceUrl: 'https://www.greatschools.org/oregon/bend/202-Pilot-Butte-Middle-School/',
  }),
  school({
    name: 'High Desert Middle',
    level: 'middle',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: '6-8',
    enrollment: 677,
    studentTeacherRatio: 22,
    greatSchoolsRating: 5,
    address: '61000 Diamondback Lane, Bend, OR 97702',
    blurb:
      'High Desert Middle School serves grades 6-8 and hosts the Bend-La Pine Schools district\'s middle school Dual Immersion pathway, alongside a Gifted & Talented program and Project Lead The Way curriculum.',
    sourceUrl: 'https://www.greatschools.org/oregon/bend/197-High-Desert-Middle-School/',
  }),
  school({
    name: 'Sisters Middle',
    level: 'middle',
    city: 'Sisters',
    d: DISTRICTS.sisters,
    grades: '6-8',
    enrollment: 260,
    studentTeacherRatio: 13,
    greatSchoolsRating: 6,
    address: '15200 McKenzie Highway, Sisters, OR 97759',
    blurb:
      'Sisters Middle School is accredited by the Northwest Accreditation Association with Merit and serves grades 6-8 within Sisters School District 6. The school offers integrated arts education, a Gifted and Talented program, and experiential learning opportunities including sixth-grade farm-based education.',
    sourceUrl: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?Search=1&DistrictID=4111490&ID=411149000943',
  }),
  school({
    name: 'Sky View Middle',
    level: 'middle',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: '6-8',
    enrollment: 586,
    studentTeacherRatio: 20,
    greatSchoolsRating: 7,
    address: '63555 NE 18th Street, Bend, OR 97701',
    blurb:
      'Sky View Middle School serves grades 6-8 as part of Bend-La Pine Schools and offers a Gifted and Talented program along with strong support for English learners. The school performs above average compared to public and charter schools in Oregon at the same grade levels.',
    sourceUrl: 'https://www.greatschools.org/oregon/bend/1701-Sky-View-Middle-School/',
  }),
  school({
    name: 'Three Rivers',
    level: 'middle',
    city: 'Sunriver',
    d: DISTRICTS.bendLaPine,
    grades: 'K-8',
    enrollment: 421,
    studentTeacherRatio: 18.75,
    greatSchoolsRating: 4,
    address: '56900 Enterprise Drive, Sunriver, OR 97707',
    blurb:
      'Three Rivers K-8 School is a public K-8 school in Sunriver serving students from kindergarten through eighth grade as part of Bend-La Pine Schools. The school offers a Gifted and Talented program and is noted for strong support for students with IEPs.',
    sourceUrl: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?ID=410198001350',
  }),
  school({
    name: 'Elton Gregory Middle',
    level: 'middle',
    city: 'Redmond',
    d: DISTRICTS.redmond,
    grades: '6-8',
    enrollment: 679,
    studentTeacherRatio: 21,
    greatSchoolsRating: 4,
    address: '1220 NW Upas Ave, Redmond, OR 97756',
    blurb:
      'Elton Gregory Middle School serves grades 6-8 in the Redmond School District 2J and offers a Gifted and Talented program alongside standard middle school academics. The school\'s mascot is the Huskies and it emphasizes student responsibility, respect, and whole-child support.',
    sourceUrl: 'https://www.greatschools.org/oregon/redmond/980-Elton-Gregory-Middle-School/',
  }),
  school({
    name: 'Jefferson County Middle',
    level: 'middle',
    city: 'Madras',
    d: DISTRICTS.jefferson,
    grades: '6-8',
    enrollment: 426,
    studentTeacherRatio: 17,
    greatSchoolsRating: 5,
    address: '1180 SE Kemper Way, Madras, OR 97741',
    blurb:
      'Jefferson County Middle School serves grades 6-8 and offers a Gifted and Talented program. It performs at an average level compared to other Oregon public middle schools.',
    sourceUrl: 'https://www.greatschools.org/oregon/madras/543-Jefferson-County-Middle-School/',
  }),
  school({
    name: 'Culver Middle',
    level: 'middle',
    city: 'Culver',
    d: DISTRICTS.culver,
    grades: '6-8',
    enrollment: 162,
    studentTeacherRatio: 15,
    greatSchoolsRating: 8,
    address: '218 West F Street, Culver, OR 97734',
    blurb:
      'Culver Middle School is the only middle school in Culver School District #4, serving grades 6-8 with small class sizes and a Gifted and Talented program. The school performs above average compared to public and charter schools in Oregon at the same grade level.',
    sourceUrl: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?Search=1&DistrictID=4103840&ID=410384000119',
  }),
]

// ── ELEMENTARY SCHOOLS ────────────────────────────────────────────────────
const ELEMENTARY: CoSchool[] = [
  school({
    name: 'William E Miller Elem',
    level: 'elementary',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: 'K-5',
    enrollment: 509,
    studentTeacherRatio: 21,
    greatSchoolsRating: 8,
    address: '300 NW Crosby Dr, Bend, OR 97701',
    blurb:
      'William E. Miller Elementary is a K-5 public school in Bend that consistently ranks among the top 5% of Oregon elementary schools. The school is housed in a LEED Gold certified building and offers a Gifted and Talented program.',
    sourceUrl: 'https://www.greatschools.org/oregon/bend/3101-William-E-Miller-Elementary/',
  }),
  school({
    name: 'LaPine Elem',
    level: 'elementary',
    city: 'La Pine',
    d: DISTRICTS.bendLaPine,
    grades: 'K-5',
    enrollment: 415,
    studentTeacherRatio: 17,
    greatSchoolsRating: 4,
    address: '51615 Coach Rd, La Pine, OR 97739',
    blurb:
      'La Pine Elementary is a public K-5 school in the Bend-La Pine Schools district serving approximately 415 students. The school offers a Gifted and Talented program and has a student-teacher ratio of 17:1.',
    sourceUrl: 'https://www.greatschools.org/oregon/la-pine/196-Lapine-Elementary-School/',
  }),
  school({
    name: 'Sisters Elem',
    level: 'elementary',
    city: 'Sisters',
    d: DISTRICTS.sisters,
    grades: 'K-5',
    enrollment: 491,
    studentTeacherRatio: 15,
    greatSchoolsRating: 8,
    address: '2155 W McKinney Butte Rd, Sisters, OR 97759',
    blurb:
      'Sisters Elementary School is a public K-5 school in Sisters School District 6, performing above average compared to Oregon public schools with the same grade span. The school offers a Gifted and Talented program and maintains smaller class sizes relative to the state average.',
    sourceUrl: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?Search=1&ID=411149000283',
  }),
  school({
    name: 'Three Rivers Elem',
    level: 'elementary',
    city: 'Sunriver',
    d: DISTRICTS.bendLaPine,
    grades: 'K-8',
    enrollment: 409,
    studentTeacherRatio: 17,
    greatSchoolsRating: 4,
    address: '56900 Enterprise Drive, Sunriver, OR 97707',
    blurb:
      'Three Rivers School is a public K-8 school in Sunriver serving around 409 students as part of the Bend-La Pine Schools district. The school offers a Gifted and Talented program and consistently ranks in the top half of Oregon elementary schools.',
    sourceUrl: 'https://www.greatschools.org/oregon/sunriver/210-Three-Rivers-K-8-School/',
  }),
  school({
    name: 'Silver Rail Elem',
    level: 'elementary',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: 'K-5',
    enrollment: 440,
    studentTeacherRatio: 18,
    greatSchoolsRating: 6,
    address: '61530 SE Stone Creek Lane, Bend, OR 97702',
    blurb:
      'Silver Rail Elementary serves grades K-5 and offers a Gifted and Talented program. It is notable as the first all-LED lighted elementary school in Oregon.',
    sourceUrl: 'https://www.greatschools.org/oregon/bend/4173-Silver-Rail-Elementary-School/',
  }),
  school({
    name: 'Tumalo Community School',
    level: 'elementary',
    city: 'Tumalo',
    d: DISTRICTS.bendLaPine,
    grades: 'K-5',
    enrollment: 266,
    studentTeacherRatio: 18,
    greatSchoolsRating: 8,
    address: '19835 2nd St, Bend, OR 97703',
    blurb:
      'Tumalo Community School is a K-5 public elementary school serving the Tumalo community as part of Redmond School District 2J, known for small class sizes and a Gifted and Talented program. The school performs above average compared to Oregon public elementary schools and maintains a student-teacher ratio well below the state average.',
    sourceUrl: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?Search=1&SchoolID=411035000280&ID=411035000280',
  }),
  school({
    name: 'High Lakes Elem',
    level: 'elementary',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: 'K-5',
    enrollment: 449,
    studentTeacherRatio: 20,
    greatSchoolsRating: 9,
    address: '2500 Northwest High Lakes Loop, Bend, OR 97701',
    blurb:
      'High Lakes Elementary is a top-performing K-5 school in the Bend-La Pine Schools district, ranking in Oregon\'s top 5% for math and reading proficiency. The school\'s motto is "Individually Focused. Committed to All."',
    sourceUrl: 'https://www.greatschools.org/oregon/bend/1700-High-Lakes-Elementary-School/',
  }),
  school({
    name: 'Barnes Butte Elem',
    level: 'elementary',
    city: 'Prineville',
    d: DISTRICTS.crookCounty,
    grades: 'K-5',
    enrollment: 516,
    studentTeacherRatio: 15.5,
    greatSchoolsRating: 8,
    address: '1875 NE Ironhorse Drive, Prineville, OR 97754',
    blurb:
      'Barnes Butte Elementary serves grades K-5 in the Crook County School District, featuring a distinctive pod-configuration campus with seven classroom pods named after local geographic landmarks. The school offers a Gifted & Talented program, Title 1A Reading Services, and a Kindergarten Language Enhancement Option.',
    sourceUrl: 'https://www.greatschools.org/oregon/prineville/4186-Barnes-Butte-Elementary/',
  }),
  school({
    name: 'Sage Elem',
    level: 'elementary',
    city: 'Redmond',
    d: DISTRICTS.redmond,
    grades: 'K-5',
    enrollment: 493,
    studentTeacherRatio: 19,
    greatSchoolsRating: 8,
    address: '2790 SW Wickiup Avenue, Redmond, OR 97756',
    blurb:
      'Sage Elementary serves grades K-5 and offers a Gifted and Talented program, ranking among the top elementary schools in the Redmond School District. The school performs above average compared to Oregon public schools at the same grade levels, with strong academic outcomes in both math and reading.',
    sourceUrl: 'https://www.greatschools.org/oregon/redmond/983-Sage-Elementary-School/',
  }),
  school({
    name: 'North Star Elementary',
    level: 'elementary',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: 'K-5',
    enrollment: 319,
    studentTeacherRatio: 17,
    greatSchoolsRating: 8,
    address: '63567 NW Brownrigg Ln, Bend, OR 97703',
    blurb:
      'North Star Elementary opened in fall 2019 to serve north-central Bend and is part of Bend-La Pine Schools. The school performs above average compared to public and charter schools in Oregon at the same grade levels.',
    sourceUrl: 'https://www.greatschools.org/oregon/bend/4297-North-Star-Elementary/',
  }),
  school({
    name: 'Tom McCall Elem',
    level: 'elementary',
    city: 'Redmond',
    d: DISTRICTS.redmond,
    grades: 'K-5',
    enrollment: 463,
    studentTeacherRatio: 18,
    greatSchoolsRating: 5,
    address: '1200 NW Upas Ave, Redmond, OR 97756',
    blurb:
      'Tom McCall Elementary is a public K-5 school in Redmond School District 2J offering a Gifted and Talented program. The school emphasizes building a strong academic and character foundation while encouraging student curiosity and independent thinking.',
    sourceUrl: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?Search=1&DistrictID=4110350&ID=411035001645',
  }),
  school({
    name: 'Ponderosa Elem',
    level: 'elementary',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: 'K-5',
    enrollment: 471,
    studentTeacherRatio: 20,
    greatSchoolsRating: 7,
    address: '63100 NE Purcell Boulevard, Bend, OR 97701',
    blurb:
      'Ponderosa Elementary serves grades K-5 in northeast Bend and is part of the Bend-La Pine Schools district. The school offers a Gifted and Talented program and consistently performs above state and district averages in English Language Arts and Mathematics proficiency.',
    sourceUrl: 'https://www.greatschools.org/oregon/bend/3094-Ponderosa-Elementary/',
  }),
  school({
    name: 'Terrebonne Community School',
    level: 'elementary',
    city: 'Terrebonne',
    d: DISTRICTS.redmond,
    grades: 'K-5',
    enrollment: 315,
    studentTeacherRatio: 18,
    greatSchoolsRating: 6,
    address: '1199 B Avenue, Terrebonne, OR 97760',
    blurb:
      'Terrebonne Community School is a public K-5 elementary school serving approximately 315 students in the rural Terrebonne community, part of Redmond School District 2J. The school offers a Gifted & Talented program and is a Title I school, with core values centered on purpose, respect, inspiration, determination, and empathy.',
    sourceUrl: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?Search=1&DistrictID=4110350&ID=411035000279',
  }),
  school({
    name: 'Buckingham Elem',
    level: 'elementary',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: 'K-5',
    enrollment: 369,
    studentTeacherRatio: 16,
    greatSchoolsRating: 5,
    address: '62560 Hamby Road, Bend, OR 97701',
    blurb:
      'Buckingham Elementary serves kindergarten through 5th grade students and offers a Gifted & Talented program along with Project Lead The Way, featuring an integrated STEM focus. The school ranks among the top 20% of public elementary schools in Oregon.',
    sourceUrl: 'https://www.bend.k12.or.us/buckingham',
  }),
  school({
    name: 'Madras Elementary',
    level: 'elementary',
    city: 'Madras',
    d: DISTRICTS.jefferson,
    grades: 'K-5',
    enrollment: 384,
    studentTeacherRatio: 15,
    greatSchoolsRating: 2,
    address: '215 SE 10th St, Madras, OR 97741',
    blurb:
      'Madras Elementary School serves grades K-5 and is one of six elementary schools in Jefferson County School District 509J. The school offers a Gifted and Talented program and is part of the district\'s Spanish Dual Language initiative.',
    sourceUrl: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?ID=410674000451',
  }),
  school({
    name: 'Crooked River Elem',
    level: 'elementary',
    city: 'Prineville',
    d: DISTRICTS.crookCounty,
    grades: 'K-5',
    enrollment: 553,
    studentTeacherRatio: 16,
    greatSchoolsRating: 6,
    address: '1400 SE 2nd St, Prineville, OR 97754',
    blurb:
      'Crooked River Elementary is a K-5 public school in Prineville serving over 550 students, known as "The Home of the Mustangs." The school offers a Gifted and Talented program, Title 1A reading support, and an Oregon English Language Learner program.',
    sourceUrl: 'https://www.greatschools.org/oregon/prineville/330-Crooked-River-Elementary-School/',
  }),
  school({
    name: 'R E Jewell Elem',
    level: 'elementary',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: 'K-5',
    enrollment: 435,
    studentTeacherRatio: 17,
    greatSchoolsRating: 7,
    address: '20550 Murphy Road, Bend, OR 97702',
    blurb:
      'R. E. Jewell Elementary is a public K-5 school in south Bend, part of Bend-La Pine Schools, and is home to one of the district\'s Dual Immersion Program options. The school also offers a Gifted & Talented program.',
    sourceUrl: 'https://www.greatschools.org/oregon/bend/200-R-E-Jewell-Elementary-School/',
  }),
  school({
    name: 'Powell Butte Elementary',
    level: 'elementary',
    city: 'Powell Butte',
    d: DISTRICTS.crookCounty,
    grades: 'K-8',
    enrollment: 212,
    studentTeacherRatio: 16,
    address: '13650 SW Hwy 126, Powell Butte, OR 97753',
    blurb:
      'Powell Butte Community Charter School is a K-8 public charter school founded in 2010 when the community organized to save the original Powell Butte Elementary from closure. The school uses a place-based, experiential learning model that integrates environmental stewardship and community service with a standards-based core curriculum.',
    sourceUrl: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?Search=1&DistrictID=4103720&ID=410372000242',
  }),
  school({
    name: 'Elk Meadow Elem',
    level: 'elementary',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: 'K-5',
    enrollment: 459,
    studentTeacherRatio: 18,
    greatSchoolsRating: 4,
    address: '60880 Brookswood Blvd, Bend, OR 97702',
    blurb:
      'Elk Meadow Elementary is a public K-5 school in the Bend-La Pine Schools district serving approximately 459 students. The school offers a Gifted and Talented program and is one of 21 elementary schools in the district.',
    sourceUrl: 'https://www.greatschools.org/oregon/bend/191-Elk-Meadow-Elementary-School/',
  }),
  school({
    name: 'Lava Ridge Elem',
    level: 'elementary',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: 'K-5',
    enrollment: 434,
    studentTeacherRatio: 19,
    greatSchoolsRating: 6,
    address: '20805 Cooley Road, Bend, OR 97701',
    blurb:
      'Lava Ridge Elementary serves kindergarten through fifth grade on the east side of Bend as part of Bend-La Pine Schools. The school uses the PBIS (Positive Behavioral Interventions and Supports) framework and offers a Gifted and Talented program.',
    sourceUrl: 'https://www.greatschools.org/oregon/bend/206-Lava-Ridge-Elementary-School/',
  }),
  school({
    name: 'Pine Ridge Elem',
    level: 'elementary',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: 'K-5',
    enrollment: 528,
    studentTeacherRatio: 19,
    greatSchoolsRating: 7,
    address: '19840 Hollygrape Street, Bend, OR 97702',
    blurb:
      'Pine Ridge Elementary serves kindergarten through 5th grade in southeast Bend and is part of the Bend-La Pine Schools district. The school offers a Gifted and Talented program and ranks among the top elementary schools in the district, with student proficiency rates in reading and math that exceed Oregon state averages.',
    sourceUrl: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?Search=1&SchoolID=410198001576&ID=410198001576',
  }),
  school({
    name: 'Vern Patrick Elem',
    level: 'elementary',
    city: 'Redmond',
    d: DISTRICTS.redmond,
    grades: 'K-5',
    enrollment: 331,
    studentTeacherRatio: 15,
    greatSchoolsRating: 7,
    address: '3001 SW Obsidian Ave, Redmond, OR 97756',
    blurb:
      'Vern Patrick Elementary serves grades K-5 and is home to the district\'s Dual Language Program. The school also provides Reading Support and Title 1A services, with a mission centered on ensuring every student is valued, supported, and empowered.',
    sourceUrl: 'https://www.greatschools.org/oregon/redmond/981-Vern-Patrick-Elementary-School/',
  }),
  school({
    name: 'Juniper Elem',
    level: 'elementary',
    city: 'Redmond',
    d: DISTRICTS.redmond,
  }),
  school({
    name: 'Rosland Elem',
    level: 'elementary',
    city: 'La Pine',
    d: DISTRICTS.bendLaPine,
    grades: 'K-5',
    enrollment: 237,
    studentTeacherRatio: 13,
    greatSchoolsRating: 1,
    address: '52350 Rease Dr, La Pine, OR 97739',
    blurb:
      'Rosland Elementary is a public K-5 school in La Pine serving the rural Deschutes County community as part of the Bend-La Pine Schools district. The school offers a Gifted and Talented program and special education services for students with IEPs.',
    sourceUrl: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?Search=1&DistrictID=4101980&SchoolPageNum=2&ID=410198001794',
  }),
  school({
    name: 'Culver Elem',
    level: 'elementary',
    city: 'Culver',
    d: DISTRICTS.culver,
    grades: 'K-5',
    enrollment: 262,
    studentTeacherRatio: 16,
    greatSchoolsRating: 6,
    address: '310 West E Street, Culver, OR 97734',
    blurb:
      'Culver Elementary is the only elementary school in Culver School District 4, serving grades K-5. The school offers a Gifted and Talented program and is located in the small Central Oregon community of Culver.',
    sourceUrl: 'https://www.greatschools.org/oregon/culver/341-Culver-Elementary-School/',
  }),
  school({
    name: 'John Tuck Elem',
    level: 'elementary',
    city: 'Redmond',
    d: DISTRICTS.redmond,
    grades: 'K-5',
    enrollment: 382,
    studentTeacherRatio: 17,
    greatSchoolsRating: 9,
    address: '209 NW 10th St, Redmond, OR 97756',
    blurb:
      'John Tuck Elementary is a public K-5 school in the Redmond School District 2J, named after one of Redmond\'s earliest teachers. The school offers a Gifted & Talented program and is rated above average compared to Oregon public elementary schools.',
    sourceUrl: 'https://www.greatschools.org/oregon/redmond/974-John-Tuck-Elementary-School/',
  }),
  school({
    name: 'Bear Creek Elem',
    level: 'elementary',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: 'K-5',
    enrollment: 521,
    studentTeacherRatio: 17,
    greatSchoolsRating: 5,
    address: '51 SE 13th St, Bend, OR 97702',
    blurb:
      'Bear Creek Elementary is a K-5 public school in the Bend-La Pine Schools district offering a Spanish-English Dual Language Immersion program and a Gifted & Talented program. It is one of the district\'s neighborhood elementary schools and was recognized with a 2024 OnPoint Prize for Excellence in Education Community Builder award.',
    sourceUrl: 'https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?Search=1&DistrictID=4101980&ID=410198000258',
  }),
  school({
    name: 'Ensworth Elem',
    level: 'elementary',
    city: 'Bend',
    d: DISTRICTS.bendLaPine,
    grades: 'K-5',
    enrollment: 151,
    studentTeacherRatio: 13,
    greatSchoolsRating: 1,
    address: '2150 NE Daggett Ln, Bend, OR 97701',
    blurb:
      'Ensworth Elementary is a small public neighborhood school in northeast Bend serving students in grades K-5. The school offers a Gifted and Talented program and features smaller-than-average class sizes for the district.',
    sourceUrl: 'https://www.greatschools.org/oregon/bend/1846-Ensworth-Elementary-School/',
  }),
  school({
    name: 'M A Lynch Elem',
    level: 'elementary',
    city: 'Redmond',
    d: DISTRICTS.redmond,
    grades: 'K-5',
    enrollment: 352,
    studentTeacherRatio: 15,
    greatSchoolsRating: 5,
    address: '1314 SW Kalama Ave, Redmond, OR 97756',
    blurb:
      'M.A. Lynch Elementary serves kindergarten through fifth grade in Redmond and is part of Redmond School District 2J. The school emphasizes a supportive community culture through its "Empower ALL" mission and offers a positive behavior reinforcement program alongside counseling and student support services.',
    sourceUrl: 'https://lynch.redmondschools.org/',
  }),
  school({
    name: 'Metolius Elem',
    level: 'elementary',
    city: 'Madras',
    d: DISTRICTS.jefferson,
    grades: 'K-5',
    enrollment: 230,
    studentTeacherRatio: 13,
    greatSchoolsRating: 2,
    address: '420 Butte Ave SW, Madras, OR 97741',
    blurb:
      'Metolius Elementary serves grades K-5 in Madras as part of Jefferson County School District 509J, offering a Gifted and Talented program and a 21st Century Before and After School Program. The school\'s motto is "Students Flourish Here. We Care for Each Other. Better Every Day."',
    sourceUrl: 'https://www.greatschools.org/oregon/metolius/539-Metolius-Elementary-School/',
  }),
]

/** The full registry, ordered high → middle → elementary. */
export const CO_SCHOOLS: ReadonlyArray<CoSchool> = [...HIGH, ...MIDDLE, ...ELEMENTARY]

/** Cities that belong to a district — used to scope a school's home-feeding query. */
export const DISTRICT_CITIES: Record<string, string[]> = {
  'bend-la-pine': ['Bend', 'Tumalo', 'Sunriver', 'La Pine'],
  redmond: ['Redmond', 'Terrebonne'],
  sisters: ['Sisters'],
  'crook-county': ['Prineville', 'Powell Butte'],
  'jefferson-509j': ['Madras', 'Metolius'],
  culver: ['Culver'],
  gilchrist: ['Gilchrist'],
}

const BY_SLUG: ReadonlyMap<string, CoSchool> = new Map(CO_SCHOOLS.map((s) => [s.slug, s]))

/** Look up a registry entry by slug. Returns undefined when absent. */
export function getSchoolBySlug(slug: string): CoSchool | undefined {
  return BY_SLUG.get(slug)
}

/**
 * Resolve a raw MLS school name (any level) to its registry entry by slugifying
 * + lookup. Used by SchoolsBlock to decide whether to link a school name.
 * Returns undefined when the school is outside the registry.
 */
export function findSchoolByName(name: string | null | undefined): CoSchool | undefined {
  if (!name) return undefined
  return BY_SLUG.get(slugifySchoolName(name.trim()))
}

/** Cities that feed a school (its district's cities). Falls back to the school's own city. */
export function citiesForSchool(school: CoSchool): string[] {
  return DISTRICT_CITIES[school.districtSlug] ?? [school.city]
}
