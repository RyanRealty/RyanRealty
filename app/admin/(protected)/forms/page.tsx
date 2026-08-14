// @no-parity — internal admin tool (TC forms library browser), no public mockup contract
//
// 11D: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md),
// worklist pattern (4). Presentation only.
//
// Catalog check (T2.1b, 2026-08-14): OREF / ODS / Oregon Realtors freshness
// lives on this page. Apply a published-form catalog (metadata only) to see
// updates, new forms, and forms the source retired.
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import {
  Button,
  HiddenField,
  ReportGrid,
  ReportNumbers,
  SectionHead,
  StateWord,
  TextField,
  VerdictLine,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import { getTcFormLibraryBoard, type FormFreshness } from '@/lib/data'
import { formatDateTime } from '@/lib/format/date'
import { buildFormCatalogCheckScript } from '@/lib/tc/form-catalog-script'
import { CheckFormCatalog } from './CheckFormCatalog'

export const dynamic = 'force-dynamic'

type FreshFilter = 'all' | FormFreshness

type Props = { searchParams: Promise<{ q?: string; lib?: string; fresh?: string }> }

const PREVIEW_COUNT = 6

const FORM_COLUMNS: ReportColumn[] = [
  { key: 'number', label: 'Form #' },
  { key: 'name', label: 'Name' },
  { key: 'pages', label: 'Pages', numeric: true },
  { key: 'fields', label: 'Fields', numeric: true },
  { key: 'signers', label: 'Signers' },
  { key: 'fresh', label: 'Library' },
  { key: 'status', label: 'Blank' },
  { key: 'open', label: 'Open' },
]

function parseFresh(raw: string | undefined): FreshFilter {
  if (
    raw === 'updated' ||
    raw === 'new' ||
    raw === 'retired' ||
    raw === 'current' ||
    raw === 'unchecked'
  ) {
    return raw
  }
  return 'all'
}

function freshnessWord(fresh: FormFreshness, pendingLabel: string | null) {
  if (fresh === 'updated') {
    return (
      <StateWord key="f" state="waiting">
        {pendingLabel ? `Update ${pendingLabel}` : 'Update available'}
      </StateWord>
    )
  }
  if (fresh === 'new') {
    return (
      <StateWord key="f" state="accent">
        New at source
      </StateWord>
    )
  }
  if (fresh === 'retired') {
    return (
      <StateWord key="f" state="slow">
        Retired at source
      </StateWord>
    )
  }
  if (fresh === 'current') {
    return (
      <StateWord key="f" state="ok">
        Current
      </StateWord>
    )
  }
  return (
    <StateWord key="f" state="slow">
      Not checked
    </StateWord>
  )
}

function formatCheckedAt(iso: string | null | undefined): string | null {
  if (!iso) return null
  const label = formatDateTime(iso)
  return label === '—' ? null : label
}

export default async function TcFormsPage({ searchParams }: Props) {
  await requireAdminPage('transactions.edit')
  const { q, lib: expanded, fresh: freshRaw } = await searchParams
  const fresh = parseFresh(freshRaw)
  const libraries = await getTcFormLibraryBoard(q)

  const populated = libraries.filter((l) => l.forms.length > 0)
  const total = libraries.reduce((s, l) => s + l.forms.length, 0)
  const sampleCount = libraries.reduce((s, l) => s + l.forms.filter((f) => f.isSample).length, 0)
  const productionCount = libraries.reduce((s, l) => s + l.forms.filter((f) => f.held && !f.isSample).length, 0)
  const updatedCount = libraries.reduce((s, l) => s + l.counts.updated, 0)
  const newCount = libraries.reduce((s, l) => s + l.counts.new, 0)
  const retiredCount = libraries.reduce((s, l) => s + l.counts.retired, 0)
  const lastCheck = libraries
    .map((l) => l.last_catalog_at)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1)
  const lastCheckLabel = formatCheckedAt(lastCheck)

  const allSampleLibs = populated.filter((l) => l.forms.every((f) => f.isSample)).map((l) => l.code)

  const buildHref = (next: { lib?: string | null; fresh?: FreshFilter | null }) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    const lib = next.lib === undefined ? expanded : next.lib
    if (lib) sp.set('lib', lib)
    const f = next.fresh === undefined ? fresh : next.fresh
    if (f && f !== 'all') sp.set('fresh', f)
    const qs = sp.toString()
    return `/admin/forms${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="av2-scope" style={{ maxWidth: 1024, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={total === 0 ? 'attention' : updatedCount + newCount > 0 ? 'attention' : 'ok'}>
          {total === 0 ? (
            <>
              <b>No form version came back{q ? ` for “${q}”` : ''}.</b> Envelopes are composed from
              these blanks only, so nothing can be drafted until the library loads.
            </>
          ) : (
            <>
              <b>
                {total.toLocaleString('en-US')} form{total === 1 ? '' : 's'}
                {q ? ` matching “${q}”` : ''} — {productionCount.toLocaleString('en-US')} production,{' '}
                {sampleCount.toLocaleString('en-US')} sample.
              </b>{' '}
              {lastCheckLabel
                ? `Last catalog check ${lastCheckLabel}. ${updatedCount} updated, ${newCount} new, ${retiredCount} retired at source.`
                : 'No catalog check yet. Run the check below to see updates and new forms from OREF, Oregon Data Share, and Oregon Realtors.'}{' '}
              {allSampleLibs.length ? `Every held form in ${allSampleLibs.join(', ')} is a sample.` : ''}
            </>
          )}
        </VerdictLine>
      </div>

      <ReportNumbers
        items={[
          { key: 'total', label: 'forms shown', value: total.toLocaleString('en-US') },
          { key: 'updated', label: 'updates', value: updatedCount.toLocaleString('en-US') },
          { key: 'new', label: 'new at source', value: newCount.toLocaleString('en-US') },
          { key: 'retired', label: 'retired at source', value: retiredCount.toLocaleString('en-US') },
        ]}
      />

      <CheckFormCatalog script={buildFormCatalogCheckScript()} />

      <form method="GET" className="av2-rfilters">
        <TextField
          label="Search forms"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search form number or name…"
        />
        {fresh !== 'all' ? <HiddenField name="fresh" value={fresh} /> : null}
        <Button type="submit" touch style={{ alignSelf: 'flex-end' }}>
          Search
        </Button>
      </form>

      <p style={{ fontSize: 'var(--a-text-sm)', margin: '0 0 14px' }}>
        <Link href={buildHref({ fresh: 'all' })} style={{ color: 'var(--a-accent)' }}>
          All
        </Link>
        {' · '}
        <Link href={buildHref({ fresh: 'updated' })} style={{ color: 'var(--a-accent)' }}>
          Updates ({updatedCount})
        </Link>
        {' · '}
        <Link href={buildHref({ fresh: 'new' })} style={{ color: 'var(--a-accent)' }}>
          New ({newCount})
        </Link>
        {' · '}
        <Link href={buildHref({ fresh: 'retired' })} style={{ color: 'var(--a-accent)' }}>
          Retired ({retiredCount})
        </Link>
      </p>

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
          const filtered =
            fresh === 'all' ? library.forms : library.forms.filter((f) => f.freshness === fresh)
          if (filtered.length === 0) return null
          const isExpanded = expanded === library.code
          const visible = isExpanded ? filtered : filtered.slice(0, PREVIEW_COUNT)
          const hiddenCount = filtered.length - visible.length
          const checked = formatCheckedAt(library.last_catalog_at)

          const rows: ReportGridRow[] = visible.map((f) => ({
            key: f.id,
            cells: [
              f.form_number ?? '—',
              f.name.replace(/\s*\(SAMPLE.*\)$/i, ''),
              f.page_count ?? '—',
              f.held
                ? f.fieldCount > 0
                  ? `${f.fieldCount} (${f.signatureFieldCount} sig)`
                  : 'not mapped yet'
                : 'not loaded',
              f.signer_profile
                ? f.signer_profile === 'single_party'
                  ? 'One side'
                  : 'Both sides'
                : '—',
              freshnessWord(f.freshness, f.pending_version_label),
              f.isSample ? (
                <StateWord key="s" state="slow">
                  Sample
                </StateWord>
              ) : f.held ? (
                <StateWord key="s" state="ok">
                  Production
                </StateWord>
              ) : (
                <StateWord key="s" state="waiting">
                  Not ingested
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
                {library.code} · {library.name} · {filtered.length} form
                {filtered.length === 1 ? '' : 's'}
                {checked ? ` · checked ${checked}` : ''}
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
                template="minmax(72px, 0.5fr) minmax(180px, 2fr) minmax(56px, 0.35fr) minmax(88px, 0.7fr) minmax(76px, 0.55fr) minmax(120px, 0.9fr) minmax(88px, 0.6fr) minmax(72px, 0.45fr)"
                minWidth={860}
                rows={rows}
                empty={<>This library holds no form in this filter.</>}
              />

              {hiddenCount > 0 ? (
                <p style={{ margin: '8px 0 0', fontSize: 'var(--a-text-sm)' }}>
                  <Link href={buildHref({ lib: library.code })} style={{ color: 'var(--a-accent)' }}>
                    See all {filtered.length} forms →
                  </Link>
                </p>
              ) : isExpanded && filtered.length > PREVIEW_COUNT ? (
                <p style={{ margin: '8px 0 0', fontSize: 'var(--a-text-sm)' }}>
                  <Link href={buildHref({ lib: null })} style={{ color: 'var(--a-accent)' }}>
                    Show less
                  </Link>
                </p>
              ) : null}
            </section>
          )
        })
      )}

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 20 }}>
        Field maps get placed once per form version. A newer published version is flagged here
        before anyone sends it. Load the new blank through the ingest path before composing.
      </p>
    </div>
  )
}
