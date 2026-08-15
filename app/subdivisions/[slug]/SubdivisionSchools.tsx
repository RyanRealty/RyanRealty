/**
 * SubdivisionSchools — the assigned-schools section on /subdivisions/[slug]
 * (W2.4 MPC parity). Renders the §0-thresholded school claims from
 * getSubdivisionSchools: each level shows only when >=70% of >=10 of the
 * subdivision's own listings agree on the school (the counts render as the
 * §0 trace). Cross-links to /schools/[slug] when the curated co-schools
 * registry resolves the MLS name; otherwise plain text.
 *
 * Renders null when no level clears the threshold (fails soft, mirrors
 * SubdivisionSalesHistory).
 */

import Link from 'next/link'
import { findSchoolByName } from '@/data/co-schools'
import {
  SCHOOL_MIN_AGREEMENT,
  SCHOOL_MIN_SAMPLES,
  type SubdivisionSchool,
} from '@/lib/data/subdivisions/getSubdivisionSchools'

const LEVEL_LABEL: Record<SubdivisionSchool['level'], string> = {
  elementary: 'Elementary',
  middle: 'Middle',
  high: 'High school',
  district: 'District',
}

interface Props {
  displayName: string
  schools: SubdivisionSchool[]
}

export function SubdivisionSchools({ displayName, schools }: Props) {
  if (schools.length === 0) return null

  return (
    <section className="section" id="schools" aria-label="Schools">
      <div className="wrap">
        <div className="sec-head" style={{ borderColor: 'var(--navy)' }}>
          <span className="sec-index">{displayName} {'·'} Schools</span>
          <h2 className="sec-title display">Assigned schools</h2>
        </div>

        <dl style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', margin: '0 0 1.25rem' }}>
          {schools.map((s) => {
            const registered = findSchoolByName(s.name)
            return (
              <div key={s.level}>
                <dt
                  style={{
                    fontSize: '.72rem',
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                    color: 'var(--navy-70)',
                  }}
                >
                  {LEVEL_LABEL[s.level]}
                </dt>
                <dd style={{ margin: '.25rem 0 0', fontSize: '1.15rem' }}>
                  {registered ? (
                    <Link
                      href={`/schools/${registered.slug}`}
                      style={{ color: 'var(--navy)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '3px' }}
                    >
                      {registered.name}
                    </Link>
                  ) : (
                    s.name
                  )}
                </dd>
              </div>
            )
          })}
        </dl>

        <p style={{ fontSize: '.8rem', color: 'var(--navy-70)', margin: 0, maxWidth: '44rem' }}>
          School assignments reflect the listings recorded in {displayName}. A school appears only
          when at least {Math.round(SCHOOL_MIN_AGREEMENT * 100)} percent of at least {SCHOOL_MIN_SAMPLES}{' '}
          of those listings name it. Confirm enrollment and boundaries with the district. Source:
          Oregon Data Share via Ryan Realty.
        </p>
      </div>
    </section>
  )
}
