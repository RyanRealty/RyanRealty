import type { HoodDSchool } from './types'

export function HoodDSchools({ schools }: { schools: HoodDSchool[] }) {
  if (schools.length === 0) return null

  return (
    <section className="hood-d-section" id="schools">
      <div className="hood-d-wrap">
        <div className="hood-d-section-head">
          <span className="hood-d-eyebrow">Schools</span>
          <h2 className="hood-d-display">Assigned schools</h2>
          <p className="hood-d-kicker">Assignment is by address.</p>
        </div>
        <ul className="hood-d-schools">
          {schools.map((school) => (
            <li key={school.name}>
              <strong>{school.name}</strong>
              {school.detail ? <span className="hood-d-list-side">{school.detail}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
