/**
 * File size, for a document a visitor is about to open.
 *
 * One decimal at megabyte scale and whole kilobytes below it, which is the
 * granularity a reader deciding whether to tap a PDF on a phone can act on.
 * A missing or nonsense size prints nothing rather than "0 KB": a hosted file
 * always has a size, so zero would be a claim about the file rather than about
 * the record, and an absent figure is the honest form of an unknown one.
 *
 * Lives in lib/format because components/site/v3 is format-free by law
 * (components/site/v3/index.ts, ci:public-v3 rule 3).
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return ''
  const mb = bytes / 1_048_576
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
