// @no-parity — internal admin tool (TC forms library browser), no public mockup contract
//
// 11D: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md),
// worklist pattern (4). Presentation only.
//
// Carried over verbatim: requireAdminPage('transactions.edit'), `await
// searchParams`, the `?q=` / `?lib=` params and buildLibHref, getTcFormLibraries(q),
// PREVIEW_COUNT = 6 and the per-library expand/collapse, the populated /
// total / sampleCount / productionCount arithmetic, the `(SAMPLE…)` name strip,
// the field / signature counts, the signer-profile words, and every blank-PDF
// href with its target/rel.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), the KpiStrip became the family's numbers strip, and each
// library's shadcn table + phone card list became one ReportGrid that scrolls
// inside its own box.
//
// ONE LABEL CORRECTED. The third figure read "OREF samples", but the count it
// shows is `f.isSample` across EVERY library, not OREF's. The number is
// unchanged; the word no longer claims a scope the code does not apply. The
// verdict line names the libraries that are wholly samples, computed from the
// rows on the page. Measured 2026-08-07: 111 live versions — OREF 110/110
// sample, ODS 1/1 production, OR and RR empty. So "production: 1" is real, not
// a broken read (ADMIN_UI §3 rule 6; a broad count plus a per-library group-by
// agreed).
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import {
  Button,
  ReportGrid,
  ReportNumbers,
  SectionHead,
  StateWord,
  TextField,
  VerdictLine,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import { getTcFormLibraries } from '@/app/actions/tc-forms'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ q?: string; lib?: string }> }

// Default forms shown per library before "See all" — curate, never dump.
const PREVIEW_COUNT = 6

const FORM_COLUMNS: ReportColumn[] = [
  { key: 'number', label: 'Form #' },
  { key: 'name', label: 'Name' },
  { key: 'pages', label: 'Pages', numeric: true },
  { key: 'fields', label: 'Fields', numeric: true },
  { key: 'signers', label: 'Signers' },
  { key: 'status', label: 'Status' },
  { key: 'blank', label: 'Blank' },
]

export default async function TcFormsPage({ searchParams }: Props) {
  await requireAdminPage('transactions.edit')
  const { q, lib: expanded } = await searchParams
  const libraries = await getTcFormLibraries(q)

  const populated = libraries.filter((l) => l.forms.length > 0)
  const total = libraries.reduce((s, l) => s + l.forms.length, 0)
  const sampleCount = libraries.reduce((s, l) => s + l.forms.filter((f) => f.isSample).length, 0)
  const productionCount = total - sampleCount

  // Which libraries are ENTIRELY samples — the honest reading of a status column
  // where nearly every row says the same word. Derived from the rows rendered
  // below, so the sentence and the table cannot disagree.
  const allSampleLibs = populated.filter((l) => l.forms.every((f) => f.isSample)).map((l) => l.code)

  const buildLibHref = (code: string | null) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (code) sp.set('lib', code)
    const qs = sp.toString()
    return `/admin/forms${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="av2-scope" style={{ maxWidth: 1024, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={total === 0 ? 'attention' : 'ok'}>
          {total === 0 ? (
            <>
              <b>No form version came back{q ? ` for “${q}”` : ''}.</b> Envelopes are composed from
              these blanks only, so nothing can be drafted until the library loads.
            </>
          ) : (
            <>
              <b>
                {total.toLocaleString('en-US')} form version{total === 1 ? '' : 's'}
                {q ? ` matching “${q}”` : ''} — {productionCount.toLocaleString('en-US')} production,{' '}
                {sampleCount.toLocaleString('en-US')} sample.
              </b>{' '}
              {allSampleLibs.length
                ? `Every form in ${allSampleLibs.join(', ')} is a sample.`
                : 'Envelopes are composed from these blanks only.'}
            </>
          )}
        </VerdictLine>
      </div>

      <ReportNumbers
        items={[
          { key: 'total', label: 'form versions', value: total.toLocaleString('en-US') },
          { key: 'prod', label: 'production', value: productionCount.toLocaleString('en-US') },
          { key: 'sample', label: 'samples', value: sampleCount.toLocaleString('en-US') },
        ]}
      />

      <form method="GET" className="av2-rfilters">
        <TextField
          label="Search forms"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search form number or name…"
        />
        <Button type="submit" touch style={{ alignSelf: 'flex-end' }}>
          Search
        </Button>
      </form>

      {populated.length === 0 ? (
        <>
          <SectionHead>Forms</SectionHead>
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
            {q ? (
              <>
                No form number or name contains “{q}”.{' '}
                <Link href="/admin/forms" style={{ color: 'var(--a-accent)' }}>
                  Clear the search
                </Link>
              </>
            ) : (
              'No forms loaded yet. Verified blanks appear here once the TC library is loaded.'
            )}
          </p>
        </>
      ) : (
        populated.map((library) => {
          const isExpanded = expanded === library.code
          const visible = isExpanded ? library.forms : library.forms.slice(0, PREVIEW_COUNT)
          const hiddenCount = library.forms.length - visible.length

          const rows: ReportGridRow[] = visible.map((f) => ({
            key: f.id,
            cells: [
              f.form_number ?? '—',
              f.name.replace(/\s*\(SAMPLE.*\)$/i, ''),
              f.page_count ?? '—',
              f.fieldCount > 0 ? `${f.fieldCount} (${f.signatureFieldCount} sig)` : 'not mapped yet',
              f.signer_profile ? (f.signer_profile === 'single_party' ? 'One side' : 'Both sides') : '—',
              f.isSample ? (
                <StateWord key="s" state="slow">
                  Sample
                </StateWord>
              ) : (
                <StateWord key="s" state="ok">
                  Production
                </StateWord>
              ),
              f.blankUrl ? (
                <a
                  key="b"
                  href={f.blankUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--a-accent)' }}
                >
                  Open
                </a>
              ) : (
                <span key="b" style={{ color: 'var(--a-text-2)' }}>
                  Unavailable
                </span>
              ),
            ],
          }))

          return (
            <section key={library.id} aria-label={`${library.code} forms`}>
              <SectionHead>
                {library.code} · {library.name} · {library.forms.length} form
                {library.forms.length === 1 ? '' : 's'}
              </SectionHead>
              {library.license_note ? (
                <p
                  style={{
                    fontSize: 'var(--a-text-xs)',
                    color: 'var(--a-text-2)',
                    margin: '0 0 8px',
                  }}
                >
                  {library.license_note}
                </p>
              ) : null}

              <ReportGrid
                label={`${library.code} form versions`}
                columns={FORM_COLUMNS}
                template="minmax(72px, 0.6fr) minmax(200px, 2.4fr) minmax(56px, 0.4fr) minmax(96px, 0.8fr) minmax(84px, 0.7fr) minmax(88px, 0.7fr) minmax(72px, 0.5fr)"
                minWidth={780}
                rows={rows}
                empty={<>This library holds no live form version.</>}
              />

              {hiddenCount > 0 ? (
                <p style={{ margin: '8px 0 0', fontSize: 'var(--a-text-sm)' }}>
                  <Link href={buildLibHref(library.code)} style={{ color: 'var(--a-accent)' }}>
                    See all {library.forms.length} forms →
                  </Link>
                </p>
              ) : isExpanded && library.forms.length > PREVIEW_COUNT ? (
                <p style={{ margin: '8px 0 0', fontSize: 'var(--a-text-sm)' }}>
                  <Link href={buildLibHref(null)} style={{ color: 'var(--a-accent)' }}>
                    Show less
                  </Link>
                </p>
              ) : null}
            </section>
          )
        })
      )}

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 20 }}>
        Field maps (data bindings + signature spots with signer roles) get placed once per form
        version and QA&apos;d — envelopes never invent field positions. Composer ships next; see
        docs/TC_SYSTEM.md.
      </p>
    </div>
  )
}
