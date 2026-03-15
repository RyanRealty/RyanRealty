'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  getAreaGuideEntityMapping,
  uploadAreaGuideFolder,
  SKIP_FOLDERS,
  type FolderMappingRow,
  type AreaGuideEntityType,
} from '@/app/actions/area-guide-upload'

const PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.heic'])
const VIDEO_EXT = new Set(['.mp4', '.mov', '.avi', '.webm', '.mkv'])

/** Top-level folder names that are media containers; the next segment is the place name. */
const MEDIA_CONTAINER_NAMES = new Set(['photos', 'videos', 'Photos', 'Videos', 'photo', 'video', 'Photo', 'Video'])

function isPhoto(name: string): boolean {
  return PHOTO_EXT.has(name.slice(name.lastIndexOf('.')).toLowerCase())
}
function isVideo(name: string): boolean {
  return VIDEO_EXT.has(name.slice(name.lastIndexOf('.')).toLowerCase())
}

/**
 * Browse the selected folder structure and group files by place (city/neighborhood/subdivision).
 * Supports:
 * - PlaceFirst:  Tetherow/photo.jpg, Tetherow/videos/tour.mp4, Tetherow/photos/hero.jpg
 * - MediaFirst: photos/Tetherow/1.jpg, videos/Old Bend/clip.mp4
 * - Mixed:       some places with nested photos/videos folders, some with files at root.
 */
function groupFilesByFolder(fileList: FileList): { folderName: string; photoCount: number; videoCount: number; files: { file: File; relativePath: string }[] }[] {
  const byFolder = new Map<string, { file: File; relativePath: string }[]>()
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i]
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    const parts = path.split(/[/\\]/).filter(Boolean)
    if (parts.length === 0) continue
    let placeName: string
    let relativePath: string
    if (parts.length >= 2 && MEDIA_CONTAINER_NAMES.has(parts[0])) {
      placeName = parts[1]
      relativePath = parts.slice(1).join('/')
    } else {
      placeName = parts[0]
      relativePath = parts.slice(1).join('/') || file.name
    }
    if (SKIP_FOLDERS.has(placeName)) continue
    if (!byFolder.has(placeName)) byFolder.set(placeName, [])
    byFolder.get(placeName)!.push({ file, relativePath })
  }
  return Array.from(byFolder.entries()).map(([folderName, files]) => {
    let photoCount = 0
    let videoCount = 0
    for (const { relativePath } of files) {
      if (isPhoto(relativePath)) photoCount++
      else if (isVideo(relativePath)) videoCount++
    }
    return { folderName, photoCount, videoCount, files }
  })
}

export default function AreaGuideUploadClient() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [mapping, setMapping] = useState<FolderMappingRow[] | null>(null)
  const [folderFiles, setFolderFiles] = useState<Map<string, { file: File; relativePath: string }[]>>(new Map())
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: string; done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleDirectoryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    setError(null)
    setSuccess(null)
    const groups = groupFilesByFolder(files)
    const folderNames = groups.map((g) => ({ name: g.folderName, photoCount: g.photoCount, videoCount: g.videoCount }))
    const fileMap = new Map<string, { file: File; relativePath: string }[]>()
    for (const g of groups) fileMap.set(g.folderName, g.files)
    setFolderFiles(fileMap)
    const result = await getAreaGuideEntityMapping(
      groups.map((g) => ({ name: g.folderName, photoCount: g.photoCount, videoCount: g.videoCount }))
    )
    if (!result.ok) {
      setError(result.error)
      setMapping(null)
      return
    }
    setMapping(result.rows)
    setDialogOpen(true)
    e.target.value = ''
  }

  async function handleUploadAll() {
    if (!mapping?.length || mapping.length === 0) return
    setUploading(true)
    setError(null)
    setSuccess(null)
    let done = 0
    const total = mapping.length
    for (const row of mapping) {
      setUploadProgress({ current: row.folderName, done, total })
      const files = folderFiles.get(row.folderName)
      if (!files?.length) {
        done++
        continue
      }
      const formData = new FormData()
      formData.set('folderName', row.folderName)
      formData.set('entityType', row.entityType)
      formData.set('entitySlug', row.entitySlug)
      formData.set('entityName', row.entityName)
      if (row.entityId) formData.set('entityId', row.entityId)
      for (const { file, relativePath } of files) {
        formData.append(`file:${relativePath}`, file)
      }
      const result = await uploadAreaGuideFolder(formData)
      if (!result.ok) {
        setError(`"${row.folderName}": ${result.error}`)
        setUploading(false)
        setUploadProgress(null)
        return
      }
      done++
    }
    setUploadProgress(null)
    setUploading(false)
    setSuccess(`Uploaded ${total} folder(s). Refresh the site to see changes.`)
    setMapping(null)
    setFolderFiles(new Map())
    setDialogOpen(false)
  }

  const typeLabel = (t: AreaGuideEntityType) => (t === 'city' ? 'City' : t === 'neighborhood' ? 'Neighborhood' : 'Subdivision')

  return (
    <div className="mt-8">
      <section className="rounded-lg border border-border bg-muted p-4">
        <h2 className="font-semibold text-foreground">Area Guide media upload</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select the root folder (e.g. Area Guides). The system will browse inside and find every place by name.
          Supports any structure: place folders with files at root, or nested <code className="rounded bg-muted px-1">photos/</code> / <code className="rounded bg-muted px-1">videos/</code> folders, or top-level <code className="rounded bg-muted px-1">photos/PlaceName/</code> and <code className="rounded bg-muted px-1">videos/PlaceName/</code>. Each place is mapped to the correct city, neighborhood, or subdivision.
        </p>
        <input
          ref={inputRef}
          type="file"
          // @ts-expect-error webkitdirectory is non-standard but supported in Chrome/Edge/Safari
          webkitdirectory=""
          multiple
          className="sr-only"
          aria-hidden
          onChange={handleDirectoryChange}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Select Area Guides folder…
        </button>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        {success && <p className="mt-2 text-sm text-green-600">{success}</p>}
      </section>

      {dialogOpen && mapping && mapping.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4" role="dialog" aria-modal aria-labelledby="area-guide-dialog-title">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg border border-border bg-background p-6 shadow-lg">
            <h2 id="area-guide-dialog-title" className="text-lg font-semibold text-foreground">
              Confirm folder mapping
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each subfolder is classified as City, Neighborhood, or Subdivision. Matched = existing record; Create = new record will be created.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-4 font-medium">Folder</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium">Matched to</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Photos</th>
                    <th className="pb-2 font-medium">Videos</th>
                  </tr>
                </thead>
                <tbody>
                  {mapping.map((row) => (
                    <tr key={row.folderName} className="border-b border-border/70">
                      <td className="py-2 pr-4 font-medium">{row.folderName}</td>
                      <td className="py-2 pr-4">{typeLabel(row.entityType)}</td>
                      <td className="py-2 pr-4">{row.entityName}</td>
                      <td className="py-2 pr-4">{row.status === 'matched' ? 'Matched' : 'Will create'}</td>
                      <td className="py-2 pr-4">{row.photoCount}</td>
                      <td className="py-2">{row.videoCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleUploadAll}
                disabled={uploading}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Upload all'}
              </button>
              <button
                type="button"
                onClick={() => { setDialogOpen(false); setMapping(null); setFolderFiles(new Map()) }}
                disabled={uploading}
                className="rounded border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
            {uploadProgress && (
              <p className="mt-3 text-sm text-muted-foreground">
                Uploading {uploadProgress.current}… ({uploadProgress.done}/{uploadProgress.total})
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
