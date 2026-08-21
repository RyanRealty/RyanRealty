export function CommDIdentity({
  name,
  asks,
}: {
  name: string
  asks: Array<{ kicker: string; value: string }>
}) {
  return (
    <section className="comm-d-section comm-d-identity" aria-labelledby="comm-d-h1">
      <div className="comm-d-wrap">
        <h1 id="comm-d-h1" className="comm-d-display" aria-label={`${name} homes for sale`}>
          <span>{name}</span>
          <span>homes for sale</span>
        </h1>
        {asks.length > 0 ? (
          <dl className="comm-d-asks">
            {asks.map((ask) => (
              <div key={ask.kicker}>
                <dt className="comm-d-ask-kicker">{ask.kicker}</dt>
                <dd className="comm-d-ask-value">{ask.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  )
}
