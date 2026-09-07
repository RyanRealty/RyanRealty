/**
 * Detail-route loading shell. Prefer this over the parent admin skeleton so a
 * mid-nav Open shows "Opening prospect…" instead of an anonymous card grid.
 * Primary fix for stuck Open is ProspectDetailHardLink (document navigation).
 */
export default function ProspectDetailLoading() {
  return (
    <div className="av2-scope" style={{ maxWidth: 1024, margin: '0 auto', padding: 16 }} aria-busy>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 12px' }}>
        Opening prospect…
      </p>
      <div
        style={{
          height: 28,
          width: '55%',
          borderRadius: 8,
          background: 'var(--a-inset)',
          marginBottom: 16,
        }}
      />
      <div
        style={{
          height: 220,
          width: '100%',
          borderRadius: 12,
          background: 'var(--a-inset)',
          marginBottom: 12,
        }}
      />
      <div style={{ height: 120, width: '100%', borderRadius: 12, background: 'var(--a-inset)' }} />
    </div>
  )
}
