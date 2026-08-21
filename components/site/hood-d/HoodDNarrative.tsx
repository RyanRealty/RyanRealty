export function HoodDNarrative({
  name,
  paragraphs,
}: {
  name: string
  paragraphs: string[]
}) {
  const body = paragraphs.filter((p) => p.trim().length > 0).slice(0, 3)
  if (body.length === 0) return null

  return (
    <section className="hood-d-section hood-d-narrative" id="inside">
      <div className="hood-d-wrap">
        <div className="hood-d-section-head">
          <span className="hood-d-eyebrow">Inside the district</span>
          <h2 className="hood-d-display">Inside {name}</h2>
        </div>
        {body.map((p) => (
          <p key={p.slice(0, 48)}>{p}</p>
        ))}
      </div>
    </section>
  )
}
