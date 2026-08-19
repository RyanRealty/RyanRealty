import '@/components/admin/v2/admin-v2.css'

/**
 * People first paint. The add form chrome is visible immediately so a broker
 * never sits on a blank white page while recently-touched loads.
 */
export default function PeopleLoading() {
  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }} aria-busy>
      <section
        id="add-person"
        aria-label="New contact"
        style={{
          border: '1px solid var(--a-border)',
          borderRadius: 'var(--a-r-lg)',
          background: 'var(--a-surface)',
          padding: 16,
          marginBottom: 20,
        }}
      >
        <h2 className="av2-lane-head" style={{ marginTop: 0 }}>New contact</h2>
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          Opening the add form.
        </p>
      </section>
      <div className="av2-input" style={{ height: 36, marginBottom: 20 }} />
      <h2 className="av2-lane-head">Recently touched</h2>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>Loading recent people.</p>
    </div>
  )
}
