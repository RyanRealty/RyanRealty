import Link from 'next/link'
import type { CityDSchool } from './types'

const LEVEL_LABEL: Record<CityDSchool['level'], string> = {
  high: 'High',
  middle: 'Middle',
  elementary: 'Elementary',
}

export function CityDSchools({
  cityName,
  schools,
  district,
}: {
  cityName: string
  schools: CityDSchool[]
  district: string | null
}) {
  if (schools.length === 0) return null
  const highs = schools.filter((s) => s.level === 'high')
  return (
    <section className="city-d-section" aria-labelledby="city-d-schools">
      <div className="city-d-wrap">
        <h2 id="city-d-schools" className="city-d-display">
          Assigned schools
        </h2>
        <div className="city-d-schools">
          {schools.map((school) => (
            <Link key={school.href} href={school.href} className="city-d-school">
              <span className="city-d-school-name">{school.name}</span>
              <span className="city-d-school-grades">
                {school.grades ?? LEVEL_LABEL[school.level]}
              </span>
              <span className="city-d-school-district">{school.district}</span>
            </Link>
          ))}
        </div>
        <p className="city-d-schools-note">
          {district ? `${district}. ` : ''}
          {highs.length > 1
            ? `The ${highs.length} high schools are a ${cityName} fact. Elementary and middle depend on the house.`
            : `Confirm the assigned schools for the house with the district.`}
        </p>
      </div>
    </section>
  )
}
