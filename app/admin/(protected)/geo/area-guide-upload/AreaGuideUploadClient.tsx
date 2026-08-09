'use client'

// @no-parity — internal admin surface, no public mockup contract
//
// 11F: taken off raw markup and onto the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only — groupFilesByFolder and
// both of its path shapes, the SKIP_FOLDERS filter, the PHOTO_EXT/VIDEO_EXT
// sets, the getAreaGuideEntityMapping call, the per-folder FormData contract
// (`file:<relativePath>`, entityType/entitySlug/entityName/entityId), the
// sequential upload loop with its early return on the first failure, the
// `e.target.value = ''` reset and every user-visible string are untouched.
//
// Substitutions, and why each one:
//   raw <h2>           -> SectionHead, which owns the heading element.
//   raw file <input>   -> TextField, the one v2 field that forwards a ref (the
//                         picker is driven by inputRef.current.click()). It
//                         keeps the original's sr-only + aria-hidden wrapper, so
//                         the control is exactly as hidden as it was.
//   hand-rolled modal  -> the v2 Dialog, which drives the platform <dialog>:
//                         focus trap, Esc and top-layer stacking come from the
//                         browser. Esc is gated on `uploading` so it cannot
//                         dismiss mid-upload, which the old div could not be.
//   raw <table>        -> ReportGrid, the admin's one tabular reader, so the
//                         mapping scrolls inside its own box and reads as rows
//                         at 375px.
//   raw <button> x3    -> the v2 Button. ONE primary per file (ci:admin-ui rule
//                         C): the dialog's "Upload all" keeps it, because it is
//                         the action that writes; the picker trigger goes quiet.
//
// Surface stack, checked both ways in design_system/admin/tokens.css: the intro
// section is --a-bg behind a hairline (it was bg-muted holding bg-muted <code>
// chips — a token painted onto its own parent, so the chips were invisible), and
// the <code> chips are now --a-inset against it.

import { useRef, useState } from 'react'
import {
  Button,
  Dialog,
  ReportGrid,
  SectionHead,
  TextField,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
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

const MAPPING_COLUMNS: ReportColumn[] = [
  { key: 'folder', label: 'Folder' },
  { key: 'type', label: 'Type' },
  { key: 'matched', label: 'Matched to' },
  { key: 'status', label: 'Status' },
  { key: 'photos', label: 'Photos', numeric: true },
  { key: 'videos', label: 'Videos', numeric: true },
]

const CODE_STYLE = { background: 'var(--a-inset)', padding: '0 4px' } as const

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

  /** Cancel — and the dialog's own Esc / outside-click path. Inert while a
   *  batch is in flight, which is what the old hand-rolled div enforced by
   *  disabling its only close button. */
  function closeMapping() {
    if (uploading) return
    setDialogOpen(false)
    setMapping(null)
    setFolderFiles(new Map())
  }

  const typeLabel = (t: AreaGuideEntityType) => (t === 'city' ? 'City' : t === 'neighborhood' ? 'Neighborhood' : 'Subdivision')

  const mappingRows: ReportGridRow[] = (mapping ?? []).map((row) => ({
    key: row.folderName,
    cells: [
      row.folderName,
      typeLabel(row.entityType),
      row.entityName,
      row.status === 'matched' ? 'Matched' : 'Will create',
      row.photoCount,
      row.videoCount,
    ],
  }))

  return (
    <div className="mt-8">
      <section
        style={{
          border: '1px solid var(--a-border)',
          borderRadius: 'var(--a-r-lg)',
          padding: 'var(--a-s4)',
        }}
      >
        <SectionHead>Area Guide media upload</SectionHead>
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '4px 0 0' }}>
          Select the root folder (e.g. Area Guides). The system will browse inside and find every place by name.
          Supports any structure: place folders with files at root, or nested <code className="rounded" style={CODE_STYLE}>photos/</code> / <code className="rounded" style={CODE_STYLE}>videos/</code> folders, or top-level <code className="rounded" style={CODE_STYLE}>photos/PlaceName/</code> and <code className="rounded" style={CODE_STYLE}>videos/PlaceName/</code>. Each place is mapped to the correct city, neighborhood, or subdivision.
        </p>
        <div className="sr-only" aria-hidden>
          <TextField
            ref={inputRef}
            label="Area Guides folder"
            type="file"
            // @ts-expect-error webkitdirectory is non-standard but supported in Chrome/Edge/Safari
            webkitdirectory=""
            multiple
            onChange={handleDirectoryChange}
          />
        </div>
        <Button variant="quiet" className="mt-3" onClick={() => inputRef.current?.click()}>
          Select Area Guides folder…
        </Button>
        {error && (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)', margin: '8px 0 0' }}>{error}</p>
        )}
        {success && (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-ok)', margin: '8px 0 0' }}>{success}</p>
        )}
      </section>

      <Dialog
        open={dialogOpen && mapping != null && mapping.length > 0}
        onClose={closeMapping}
        title="Confirm folder mapping"
        description="Each subfolder is classified as City, Neighborhood, or Subdivision. Matched = existing record; Create = new record will be created."
        size="work"
        footer={
          <>
            <Button variant="quiet" onClick={closeMapping} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUploadAll} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload all'}
            </Button>
          </>
        }
      >
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <ReportGrid
            label="Folder mapping"
            columns={MAPPING_COLUMNS}
            template="minmax(140px, 1.2fr) minmax(112px, 0.8fr) minmax(160px, 1.4fr) minmax(96px, 0.8fr) minmax(72px, 0.5fr) minmax(72px, 0.5fr)"
            minWidth={700}
            rows={mappingRows}
            empty={<>No folder came back from the scan.</>}
          />
        </div>
        {uploadProgress && (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: 0 }}>
            Uploading {uploadProgress.current}… ({uploadProgress.done}/{uploadProgress.total})
          </p>
        )}
      </Dialog>
    </div>
  )
}
