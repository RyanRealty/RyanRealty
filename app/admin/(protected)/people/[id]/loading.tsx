import '@/components/admin/v2/admin-v2.css'

/** Person detail first paint. Identity chrome, not a hanging skeleton. */
export default function PersonLoading() {
  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }} aria-busy>
      <h1 className="av2-lane-head" style={{ marginTop: 0 }}>Person</h1>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        Opening this person. Name, phone, email, and address land first.
      </p>
    </div>
  )
}
