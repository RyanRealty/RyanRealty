'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  deleteAdminMediaAsset,
  listAdminMedia,
  uploadAdminMedia,
  type AdminMediaAsset,
  type AdminMediaScope,
} from '@/app/actions/admin-media'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const SCOPE_LABELS: Record<AdminMediaScope, string> = {
  branding: 'Branding',
  brokers: 'Brokers',
  banners: 'Banners',
  reports: 'Reports',
}

const ALL_SCOPES = Object.keys(SCOPE_LABELS) as AdminMediaScope[]

function formatFileSize(sizeBytes: number | null) {
  if (sizeBytes == null || sizeBytes <= 0) return '—'
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
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
  const [isMutating, startTransition] = useTransition()

  const scopedCountLabel = useMemo(() => `${assets.length.toLocaleString()} file(s)`, [assets.length])

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Media library</CardTitle>
          <CardDescription>
            Centralized file management across storage buckets with usage references. Delete supports optional unlinking from related records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={scope} onValueChange={(value) => setScope(value as AdminMediaScope)}>
            <TabsList>
              {ALL_SCOPES.map((s) => (
                <TabsTrigger key={s} value={s}>
                  {SCOPE_LABELS[s]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label htmlFor="media-search">Search in {SCOPE_LABELS[scope]}</Label>
              <Input
                id="media-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by file path or usage label"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Bucket</Label>
              <div className="mt-2">
                <Badge variant="secondary">{bucket || '—'}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{scopedCountLabel}</p>
            </div>
          </div>

          <form action={handleUpload} className="grid gap-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-foreground">Upload media</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="upload-prefix">Optional folder path</Label>
                <Input
                  id="upload-prefix"
                  value={uploadPathPrefix}
                  onChange={(event) => setUploadPathPrefix(event.target.value)}
                  placeholder={scope === 'brokers' ? 'broker-id' : 'optional/subfolder'}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="upload-file">File</Label>
                <Input id="upload-file" name="file" type="file" required className="mt-2" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isMutating}>
                {isMutating ? 'Working…' : 'Upload file'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => refreshData(scope, search)}
                disabled={loading || isMutating}
              >
                Refresh
              </Button>
            </div>
          </form>

          <div className="flex items-center gap-2">
            <Checkbox
              id="force-unlink"
              checked={forceUnlinkOnDelete}
              onCheckedChange={(checked) => setForceUnlinkOnDelete(checked === true)}
            />
            <Label htmlFor="force-unlink">
              Force unlink references before delete
            </Label>
          </div>

          {message && (
            <p className={message.type === 'ok' ? 'text-sm text-success' : 'text-sm text-destructive'}>
              {message.text}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assets</CardTitle>
          <CardDescription>
            {loading ? 'Loading assets…' : `${assets.length.toLocaleString()} result(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Asset cards — phones (one tap-target per file) */}
          <div className="space-y-2 md:hidden">
            {!loading && assets.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No media found for this scope.</p>
            )}
            {assets.map((asset) => (
              <div
                key={`${asset.bucket}:${asset.path}`}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium text-foreground">{asset.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{asset.path}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatFileSize(asset.sizeBytes)}</span>
                  <span aria-hidden>•</span>
                  <span>{formatDate(asset.updatedAt)}</span>
                </div>
                <div className="mt-2">
                  {asset.usages.length === 0 ? (
                    <Badge variant="outline">Unused</Badge>
                  ) : (
                    <div className="space-y-1">
                      <Badge variant="secondary">{asset.usages.length} linked</Badge>
                      <p className="text-xs text-muted-foreground">
                        {asset.usages.slice(0, 2).map((usage) => usage.label).join(' • ')}
                        {asset.usages.length > 2 ? ' • …' : ''}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 flex-1"
                    onClick={async () => {
                      await navigator.clipboard.writeText(asset.publicUrl)
                      setMessage({ type: 'ok', text: 'Copied asset URL.' })
                    }}
                  >
                    Copy URL
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-10 flex-1"
                    onClick={() => handleDelete(asset)}
                    disabled={isMutating}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Asset table — desktop */}
          <div className="hidden overflow-hidden rounded-lg border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && assets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No media found for this scope.
                    </TableCell>
                  </TableRow>
                )}
                {assets.map((asset) => (
                  <TableRow key={`${asset.bucket}:${asset.path}`}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">{asset.path}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatFileSize(asset.sizeBytes)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(asset.updatedAt)}</TableCell>
                    <TableCell>
                      {asset.usages.length === 0 ? (
                        <Badge variant="outline">Unused</Badge>
                      ) : (
                        <div className="space-y-1">
                          <Badge variant="secondary">{asset.usages.length} linked</Badge>
                          <p className="text-xs text-muted-foreground">
                            {asset.usages.slice(0, 2).map((usage) => usage.label).join(' • ')}
                            {asset.usages.length > 2 ? ' • …' : ''}
                          </p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            await navigator.clipboard.writeText(asset.publicUrl)
                            setMessage({ type: 'ok', text: 'Copied asset URL.' })
                          }}
                        >
                          Copy URL
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(asset)}
                          disabled={isMutating}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
