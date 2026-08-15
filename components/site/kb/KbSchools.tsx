/**
 * KbSchools -- KB-register schools district section for community pages.
 *
 * DATA ACCURACY (ss0): This component receives ONLY the verified school district
 * name and slug, resolved from data/co-schools.ts getDistrictForCity(). It NEVER
 * lists specific school names or ratings for a community because attendance zones
 * vary by home address and that per-address mapping is not in the system. Showing
 * invented or wrong school assignments on a real estate page is a compliance risk.
 *
 * What this renders:
 *   - The verified district name (e.g. "Bend-La Pine Schools")
 *   - A link to /schools for the full school list
 *   - A factual note that specific school assignment depends on address
 *
 * Renders null when districtName or districtSlug is falsy (no data = no section).
 */

interface KbSchoolsProps {
  /** Community name -- used in heading and prose. */
  communityName: string
  /** Verified district name from data/co-schools.ts getDistrictForCity().
   *  MUST come from the registry -- never invented. Null = no section renders. */
  districtName: string | null | undefined
  /** District slug from the registry (e.g. "bend-la-pine"). Used to build
   *  an anchor link to /schools. MUST match a districtSlug in co-schools.ts. */
  districtSlug: string | null | undefined
}

export function KbSchools({ communityName, districtName, districtSlug }: KbSchoolsProps) {
  // ss0: no district data available -- silently omit the section rather than fabricate.
  if (!districtName || !districtSlug) return null

  // /schools links to the index page; district anchor scrolls to that district's
  // section (the schools index groups by district with id=districtSlug anchors).
  const schoolsHref = `/schools#${districtSlug}`

  return (
    <section className="section schools-district" id="schools" aria-label="Schools">
      <div className="wrap">
        <div className="sec-head" style={{ borderColor: 'var(--navy)' }}>
          <span className="sec-index">{communityName} {'·'} Schools</span>
          <h2 className="sec-title display">School district</h2>
        </div>

        <div className="schools-body">
          <p className="schools-district-name">
            Homes in {communityName} are served by{' '}
            <a href={schoolsHref} className="schools-district-link">
              {districtName}
            </a>
            .
          </p>
          <p className="schools-note">
            The specific school assigned to each home (elementary, middle, and high) depends on
            the address within the district. Confirm with the district before purchasing.
          </p>
          <a href={schoolsHref} className="schools-cta" aria-label={`See all schools in ${districtName}`}>
            See schools in this district
            <span className="schools-cta-arrow" aria-hidden="true"> {'→'}</span>
          </a>
        </div>
      </div>
    </section>
  )
}
