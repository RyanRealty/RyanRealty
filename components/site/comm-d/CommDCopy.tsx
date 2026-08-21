export function CommDCopy({
  name,
  paragraphs,
}: {
  name: string
  paragraphs: readonly string[]
}) {
  if (paragraphs.length === 0) return null
  return (
    <section className="comm-d-section comm-d-copy" aria-labelledby="comm-d-copy">
      <div className="comm-d-wrap">
        <h2 id="comm-d-copy" className="comm-d-display">
          {name}
        </h2>
        {paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 48)}>{paragraph}</p>
        ))}
      </div>
    </section>
  )
}
