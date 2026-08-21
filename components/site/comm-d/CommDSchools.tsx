export function CommDSchools({
  name,
  districtName,
  districtSlug,
}: {
  name: string
  districtName: string | null
  districtSlug: string | null
}) {
  if (!districtName || !districtSlug) return null
  const href = `/schools#${districtSlug}`
  return (
    <section className="comm-d-section comm-d-schools" id="schools" aria-labelledby="comm-d-schools">
      <div className="comm-d-wrap">
        <div className="comm-d-section-head">
          <span className="comm-d-eyebrow">Assigned schools</span>
          <h2 id="comm-d-schools" className="comm-d-display">
            School district
          </h2>
        </div>
        <p>
          Homes in {name} are served by <a href={href}>{districtName}</a>.
        </p>
        <p>
          The school assigned to a home depends on the address. Confirm with the district before you
          buy.
        </p>
        <p>
          <a className="comm-d-text-link" href={href}>
            See schools in this district
          </a>
        </p>
      </div>
    </section>
  )
}
