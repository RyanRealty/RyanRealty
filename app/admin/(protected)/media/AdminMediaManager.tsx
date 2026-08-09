'use client'

/**
 * AdminMediaManager — the /admin/media library island.
 *
 * 11F: taken off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — every server action,
 * every piece of state, the PAGE_SIZE window, the scope labels, the upload
 * FormData contract (`name="file"`), the window.confirm before a delete and
 * every user-visible string are untouched.
 *
 * Substitutions, and why each one:
 *   Card/CardHeader/…  -> .av2-pane (the language's bordered surface) + SectionHead.
 *   Tabs               -> quiet Buttons carrying aria-pressed. A dropdown would
 *                         have been fewer pixels but a different interaction,
 *                         and this unit does not change behaviour.
 *   Input + Label      -> TextField / SearchField, which own the label-above
 *                         pairing (pattern 6) and generate their own ids. No
 *                         test or script pins media-search / upload-prefix /
 *                         upload-file / force-unlink — checked before dropping
 *                         them, per the id-is-a-gate-handle rule.
 *   Checkbox + Label   -> ToolbarCheck (the <label> wraps its own input).
 *   Badge              -> StateWord for the "Unused" STATE, .av2-chip for the
 *                         linked COUNT and the bucket NAME — .av2-state
 *                         uppercases, so data never goes through it.
 *   Table              -> ReportGrid, the admin's one tabular reader.
 *   Skeleton           -> a local Shimmer on --a-inset, keeping animate-pulse
 *                         (a non-colour utility) so the loading motion survives.
 *
 * Surface stack, checked both ways in design_system/admin/tokens.css so nothing
 * is painted onto its own parent: the panes are --a-bg with a hairline, the
 * stat wells and shimmers are --a-inset, the quiet buttons and chips are
 * --a-surface.
 */

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  deleteAdminMediaAsset,
  listAdminMedia,
  uploadAdminMedia,
  type AdminMediaAsset,
  type AdminMediaScope,
} from '@/app/actions/admin-media'
import {
  Button,
  ReportGrid,
  SectionHead,
  StateWord,
  TextField,
  ToolbarCheck,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'

const PAGE_SIZE = 6

const SCOPE_LABELS: Record<AdminMediaScope, string> = {
  branding: 'Branding',
  brokers: 'Brokers',
  banners: 'Banners',
  reports: 'Reports',
}

const ALL_SCOPES = Object.keys(SCOPE_LABELS) as AdminMediaScope[]

const ASSET_COLUMNS: ReportColumn[] = [
  { key: 'file', label: 'File' },
  { key: 'size', label: 'Size' },
  { key: 'updated', label: 'Updated' },
  { key: 'usage', label: 'Usage' },
  { key: 'actions', label: 'Actions' },
]

function formatFileSize(sizeBytes: number | null) {
  if (sizeBytes == null || sizeBytes <= 0) return '—'
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTotalSize(sizeBytes: number) {
  if (sizeBytes <= 0) return '0 MB'
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(0)} KB`
  if (sizeBytes < 1024 * 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

/** Loading placeholder — the shadcn Skeleton's shape and pulse, on admin tokens. */
function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={className ? `animate-pulse rounded-md ${className}` : 'animate-pulse rounded-md'}
      style={{ background: 'var(--a-inset)' }}
    />
  )
}

/** A DATA chip (a count, a bucket name). Never StateWord — that uppercases. */
function DataChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="av2-chip" style={{ cursor: 'default' }}>
      {children}
    </span>
  )
}

function UsageCell({ asset }: { asset: AdminMediaAsset }) {
  if (asset.usages.length === 0) return <StateWord state="waiting">Unused</StateWord>
  return (
    <span style={{ display: 'block' }}>
      <DataChip>{asset.usages.length} linked</DataChip>
      <span
        style={{
          display: 'block',
          marginTop: 4,
          fontSize: 'var(--a-text-xs)',
          color: 'var(--a-text-2)',
        }}
      >
        {asset.usages.slice(0, 2).map((usage) => usage.label).join(' • ')}
        {asset.usages.length > 2 ? ' • …' : ''}
      </span>
    </span>
  )
}

export default function AdminMediaManager() {
  const [scope, setScope] = useState<AdminMediaScope>('branding')
  const [search, setSearch] = useState('')
  const [assets, setAssets] = useState<AdminMediaAsset[]>([])
  const [bucket, setBucket] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [uploadPathPrefix, setUploadPathPrefix] = useState('')
  const [forceUnlinkOnDelete, setForceUnlinkOnDelete] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [isMutating, startTransition] = useTransition()

  const summary = useMemo(() => {
    const total = assets.length
    let linked = 0
    let totalBytes = 0
    for (const asset of assets) {
      if (asset.usages.length > 0) linked += 1
      if (asset.sizeBytes && asset.sizeBytes > 0) totalBytes += asset.sizeBytes
    }
    return { total, linked, unused: total - linked, totalBytes }
  }, [assets])

  const visibleAssets = useMemo(() => assets.slice(0, visibleCount), [assets, visibleCount])
  const hasMore = assets.length > visibleAssets.length

  async function refreshData(activeScope: AdminMediaScope, activeSearch: string) {
    setLoading(true)
    const result = await listAdminMedia(activeScope, activeSearch)
    setLoading(false)
    if (!result.ok) {
      setMessage({ type: 'err', text: result.error })
      return
    }
    setAssets(result.assets)
    setBucket(result.bucket)
  }

  useEffect(() => {
    let cancelled = false
    setVisibleCount(PAGE_SIZE)
    listAdminMedia(scope, search).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (!result.ok) {
        setMessage({ type: 'err', text: result.error })
        return
      }
      setAssets(result.assets)
      setBucket(result.bucket)
    })
    return () => {
      cancelled = true
    }
  }, [scope, search])

  function handleUpload(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      const result = await uploadAdminMedia({
        scope,
        pathPrefix: uploadPathPrefix.trim() || undefined,
        formData,
      })
      if (!result.ok) {
        setMessage({ type: 'err', text: result.error })
        return
      }
      setMessage({ type: 'ok', text: `Uploaded ${result.path}` })
      await refreshData(scope, search)
    })
  }

  function handleDelete(asset: AdminMediaAsset) {
    const confirmed = window.confirm(`Delete ${asset.path}?`)
    if (!confirmed) return
    setMessage(null)
    startTransition(async () => {
      const result = await deleteAdminMediaAsset({
        bucket: asset.bucket,
        path: asset.path,
        forceUnlink: forceUnlinkOnDelete,
      })
      if (!result.ok) {
        setMessage({ type: 'err', text: result.error })
        return
      }
      setMessage({ type: 'ok', text: `Deleted ${asset.path}` })
      await refreshData(scope, search)
    })
  }

  const assetRows: ReportGridRow[] = visibleAssets.map((asset) => ({
    key: `${asset.bucket}:${asset.path}`,
    cells: [
      <span key="file" style={{ display: 'block' }}>
        <span style={{ display: 'block', fontWeight: 600, color: 'var(--a-text)' }}>{asset.name}</span>
        <span
          style={{
            display: 'block',
            marginTop: 2,
            fontSize: 'var(--a-text-xs)',
            color: 'var(--a-text-2)',
          }}
        >
          {asset.path}
        </span>
      </span>,
      <span key="size" className="a-num">
        {formatFileSize(asset.sizeBytes)}
      </span>,
      <span key="updated" className="a-num">
        {formatDate(asset.updatedAt)}
      </span>,
      <UsageCell key="usage" asset={asset} />,
      <span key="actions" className="flex flex-wrap gap-2">
        <Button
          variant="quiet"
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(asset.publicUrl)
            setMessage({ type: 'ok', text: 'Copied asset URL.' })
          }}
        >
          Copy URL
        </Button>
        <Button
          variant="danger"
          type="button"
          onClick={() => handleDelete(asset)}
          disabled={isMutating}
        >
          Delete
        </Button>
      </span>,
    ],
  }))

  return (
    <div className="space-y-6">
      <section className="av2-pane">
        <div>
          <SectionHead>Media library</SectionHead>
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: 0 }}>
            Centralized file management across storage buckets with usage references. Delete supports optional unlinking from related records.
          </p>
        </div>

        {/* role=group + a name: the Radix Tabs this replaced announced a
            tablist, and the sibling migrations in the same unit (StockPhotosPicker,
            PhotoCurationBoard) both added the grouping. Without it a screen
            reader hears four unrelated toggle buttons. */}
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Media scope">
          {ALL_SCOPES.map((s) => {
            const active = s === scope
            return (
              <Button
                key={s}
                variant="quiet"
                type="button"
                aria-pressed={active}
                onClick={() => setScope(s)}
                // The pressed look comes from
                // .av2-btn--quiet[aria-pressed="true"] in admin-v2.css, NOT from
                // an inline style: inline outranks the :hover rule, which froze
                // the selected tab while every inactive sibling still responded.
                style={active ? { fontWeight: 600 } : { color: 'var(--a-text-2)' }}
              >
                {SCOPE_LABELS[s]}
              </Button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(
            [
              { key: 'total', label: 'Files', value: summary.total, warn: false },
              { key: 'linked', label: 'Linked', value: summary.linked, warn: false },
              { key: 'unused', label: 'Unused', value: summary.unused, warn: summary.unused > 0 },
            ] as const
          ).map((tile) => (
            <div
              key={tile.key}
              className="p-3"
              style={{
                border: '1px solid var(--a-border)',
                borderRadius: 'var(--a-r-lg)',
                background: 'var(--a-inset)',
              }}
            >
              <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: 0 }}>
                {tile.label}
              </p>
              {loading ? (
                <Shimmer className="mt-1 h-7 w-10" />
              ) : (
                <p
                  className="a-num"
                  style={{
                    fontSize: 'var(--a-text-num)',
                    fontWeight: 600,
                    margin: 0,
                    color: tile.warn ? 'var(--a-warn)' : 'var(--a-text)',
                  }}
                >
                  {tile.value.toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>

        <div
          className="flex flex-wrap items-center gap-2"
          style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
        >
          <span>Bucket</span>
          <DataChip>{bucket || '—'}</DataChip>
          {!loading && summary.totalBytes > 0 && (
            <>
              <span aria-hidden>•</span>
              <span className="a-num">{formatTotalSize(summary.totalBytes)} total</span>
            </>
          )}
        </div>

        <TextField
          label={`Search in ${SCOPE_LABELS[scope]}`}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by file path or usage label"
        />

        <form
          action={handleUpload}
          className="grid gap-3 p-4"
          style={{ border: '1px solid var(--a-border)', borderRadius: 'var(--a-r-md)' }}
        >
          <p style={{ fontSize: 'var(--a-text-md)', fontWeight: 600, color: 'var(--a-text)', margin: 0 }}>
            Upload media
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label="Optional folder path"
              value={uploadPathPrefix}
              onChange={(event) => setUploadPathPrefix(event.target.value)}
              placeholder={scope === 'brokers' ? 'broker-id' : 'optional/subfolder'}
            />
            <TextField label="File" name="file" type="file" required />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isMutating}>
              {isMutating ? 'Working…' : 'Upload file'}
            </Button>
            <Button
              type="button"
              variant="quiet"
              onClick={() => refreshData(scope, search)}
              disabled={loading || isMutating}
            >
              Refresh
            </Button>
          </div>
        </form>

        <ToolbarCheck
          label="Force unlink references before delete"
          checked={forceUnlinkOnDelete}
          onChange={(event) => setForceUnlinkOnDelete(event.target.checked)}
        />

        {message && (
          <p
            style={{
              fontSize: 'var(--a-text-sm)',
              margin: 0,
              color: message.type === 'ok' ? 'var(--a-ok)' : 'var(--a-danger)',
            }}
          >
            {message.text}
          </p>
        )}
      </section>

      <section className="av2-pane">
        <div>
          <SectionHead>Assets</SectionHead>
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: 0 }}>
            {loading
              ? 'Loading assets…'
              : assets.length === 0
                ? `No files in ${SCOPE_LABELS[scope]}`
                : hasMore
                  ? `Showing ${visibleAssets.length} of ${assets.length.toLocaleString()}`
                  : `${assets.length.toLocaleString()} file${assets.length === 1 ? '' : 's'}`}
          </p>
        </div>

        <div>
          {/* Loading state */}
          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="p-4"
                  style={{ border: '1px solid var(--a-border)', borderRadius: 'var(--a-r-md)' }}
                >
                  <Shimmer className="h-4 w-2/3" />
                  <Shimmer className="mt-2 h-3 w-1/2" />
                  <div className="mt-3 flex gap-2">
                    <Shimmer className="h-11 flex-1" />
                    <Shimmer className="h-11 flex-1" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && assets.length === 0 && (
            <div
              className="flex flex-col items-center px-6 py-10 text-center"
              style={{ border: '1px dashed var(--a-border)', borderRadius: 'var(--a-r-md)' }}
            >
              <p style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)', margin: 0 }}>
                {search ? 'No matches found' : `No media in ${SCOPE_LABELS[scope]} yet`}
              </p>
              <p
                className="mt-1 max-w-xs"
                style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}
              >
                {search
                  ? 'Try a different file path or usage label.'
                  : 'Use the upload form above to add the first file to this bucket.'}
              </p>
            </div>
          )}

          {/* Asset cards — phones (one tap-target per file) */}
          {!loading && assets.length > 0 && (
            <div className="av2-cardlist">
              {visibleAssets.map((asset) => (
                <div
                  key={`${asset.bucket}:${asset.path}`}
                  className="p-4"
                  style={{ border: '1px solid var(--a-border)', borderRadius: 'var(--a-r-md)' }}
                >
                  <div className="min-w-0 space-y-1">
                    <p
                      className="truncate"
                      style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)', margin: 0 }}
                    >
                      {asset.name}
                    </p>
                    <p
                      className="truncate"
                      style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: 0 }}
                    >
                      {asset.path}
                    </p>
                  </div>
                  <div
                    className="mt-2 flex flex-wrap items-center gap-2"
                    style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
                  >
                    <span className="a-num">{formatFileSize(asset.sizeBytes)}</span>
                    <span aria-hidden>•</span>
                    <span className="a-num">{formatDate(asset.updatedAt)}</span>
                  </div>
                  <div className="mt-2">
                    <UsageCell asset={asset} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="quiet"
                      touch
                      className="flex-1"
                      onClick={async () => {
                        await navigator.clipboard.writeText(asset.publicUrl)
                        setMessage({ type: 'ok', text: 'Copied asset URL.' })
                      }}
                    >
                      Copy URL
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      touch
                      className="flex-1"
                      onClick={() => handleDelete(asset)}
                      disabled={isMutating}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Asset table — desktop */}
          {!loading && assets.length > 0 && (
            <div className="hidden md:block">
              <ReportGrid
                label="Media assets"
                columns={ASSET_COLUMNS}
                template="minmax(200px, 2fr) minmax(72px, 0.5fr) minmax(150px, 1fr) minmax(150px, 1.1fr) minmax(190px, 0.9fr)"
                minWidth={880}
                rows={assetRows}
                empty={<>No files in {SCOPE_LABELS[scope]}</>}
              />
            </div>
          )}

          {/* Show more — keeps the list from dumping every row at once */}
          {!loading && hasMore && (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="quiet"
                touch
                className="w-full sm:w-auto"
                onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
              >
                Show more ({(assets.length - visibleAssets.length).toLocaleString()} more)
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
