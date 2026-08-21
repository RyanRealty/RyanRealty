export function CityDPitch({
  heading,
  paragraphs,
}: {
  heading: string
  paragraphs: string[]
}) {
  if (paragraphs.length === 0) return null
  return (
    <section className="city-d-section" aria-labelledby="city-d-pitch">
      <div className="city-d-wrap">
        <h2 id="city-d-pitch" className="city-d-display">
          {heading}
        </h2>
        <div className="city-d-prose">
          {paragraphs.map((p) => (
            <p key={p.slice(0, 48)}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  )
}
