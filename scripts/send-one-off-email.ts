/**
 * CLI for a tracked CRM one-off HTML send (Resend rail).
 *
 *   npx tsx scripts/send-one-off-email.ts --html FILE --person ID --to EMAIL \
 *     --subject TEXT --key oneoff:... [--from EMAIL] [--map FILE] [--send]
 *
 * Default is verify-only: host images, rewrite src, instrument a copy, print
 * the tracked-link / pixel / image-200 checks. --send fires exactly once.
 */
import Module from 'node:module'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })
  ._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (
  this: unknown,
  request: string,
  ...args: unknown[]
) {
  const req =
    request === 'server-only' || request === 'client-only'
      ? STUB
      : request === 'next/cache'
        ? CACHE_STUB
        : request
  return resolveFilename.call(this, req, ...args)
}

type Args = {
  htmlPath: string
  personId: number
  to: string
  subject: string
  sendKey: string
  from?: string
  mapPath?: string
  send: boolean
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  if (i < 0 || i + 1 >= process.argv.length) return undefined
  return process.argv[i + 1]
}

function parseArgs(): Args {
  const htmlPath = argValue('--html')
  const person = argValue('--person')
  const to = argValue('--to')
  const subject = argValue('--subject')
  const sendKey = argValue('--key')
  if (!htmlPath || !person || !to || !subject || !sendKey) {
    console.error(
      'Usage: npx tsx scripts/send-one-off-email.ts --html FILE --person ID --to EMAIL --subject TEXT --key oneoff:... [--from EMAIL] [--map FILE] [--send]',
    )
    process.exit(2)
  }
  return {
    htmlPath,
    personId: Number(person),
    to,
    subject,
    sendKey,
    from: argValue('--from'),
    mapPath: argValue('--map'),
    send: process.argv.includes('--send'),
  }
}

function contentTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  return 'application/octet-stream'
}

function resolveMapPath(explicit?: string): string | null {
  const candidates = [
    explicit,
    '/home/ubuntu/.cursor/projects/workspace/uploads/tetherow-map-v2.tar.gz',
    '/home/ubuntu/.cursor/projects/workspace/uploads/tetherow-map-v2.png',
    path.resolve(process.cwd(), 'uploads/tetherow-map-v2.tar.gz'),
    path.resolve(process.cwd(), 'uploads/tetherow-map-v2.png'),
    path.resolve(process.cwd(), 'elize/tetherow-map-v2.png'),
  ].filter((p): p is string => Boolean(p))
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function extractPngFromTar(tarPath: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'one-off-map-'))
  execFileSync('tar', ['-xzf', tarPath, '-C', dir])
  const png = path.join(dir, 'tetherow-map-v2.png')
  if (!existsSync(png)) {
    throw new Error(`tar ${tarPath} did not contain tetherow-map-v2.png`)
  }
  return png
}

async function main() {
  const args = parseArgs()
  const html = readFileSync(args.htmlPath, 'utf8')
  const { localImageFilenames, normalizeOneOffUtms, rewriteLocalImageSrcs } = await import(
    '@/lib/email/one-off-html'
  )
  const needed = localImageFilenames(html)
  const urlByFilename: Record<string, string> = {}

  if (needed.length) {
    const mapPath = resolveMapPath(args.mapPath)
    if (!mapPath) {
      throw new Error(`Local images ${needed.join(', ')} need a hosted file. Pass --map.`)
    }
    const pngPath = mapPath.endsWith('.tar.gz') || mapPath.endsWith('.tgz') ? extractPngFromTar(mapPath) : mapPath
    const { uploadOneOffImage } = await import('@/lib/data/email/upload-one-off-images')
    const uploaded = await uploadOneOffImage({
      sendKey: args.sendKey,
      filename: path.basename(pngPath),
      body: readFileSync(pngPath),
      contentType: contentTypeFor(pngPath),
    })
    if (!uploaded.ok) throw new Error(`image upload failed: ${uploaded.error}`)
    urlByFilename[path.basename(pngPath)] = uploaded.url
    console.log(JSON.stringify({ hostedImage: uploaded.url, path: uploaded.path }))
  }

  const rewritten = normalizeOneOffUtms(rewriteLocalImageSrcs(html, urlByFilename))
  const stillMissing = localImageFilenames(rewritten)
  if (stillMissing.length) {
    throw new Error(`Unhosted local images remain: ${stillMissing.join(', ')}`)
  }

  const { attributeOutbound } = await import('@/lib/crm/attributed-links')
  const { oneOffEmailKey } = await import('@/lib/comms/sendOneOffEmail')
  const emailKey = oneOffEmailKey(args.sendKey, args.personId)
  const instrumented = attributeOutbound(rewritten, {
    brokerSlug: 'matt',
    personId: args.personId,
    emailKey,
    label: args.subject,
    broker: 'matt',
  })

  const clickCount = (instrumented.match(/\/api\/track\/e\/click/g) ?? []).length
  const hasPixel = instrumented.includes('/api/track/e/open')
  const imageUrl = Object.values(urlByFilename)[0] ?? null
  let imageStatus: number | null = null
  if (imageUrl) {
    const head = await fetch(imageUrl, { method: 'HEAD' })
    imageStatus = head.status
    if (imageStatus >= 400) {
      const get = await fetch(imageUrl, { method: 'GET' })
      imageStatus = get.status
    }
  }

  const verify = {
    emailKey,
    clickWrapped: clickCount,
    openPixel: hasPixel,
    imageUrl,
    imageStatus,
    ready: clickCount > 0 && hasPixel && (imageStatus === 200 || imageUrl == null),
  }
  console.log(JSON.stringify({ verify }))
  if (!verify.ready) {
    throw new Error('Pre-send verification failed: tracked links, open pixel, or image 200 missing')
  }

  const previewPath = path.join(tmpdir(), `one-off-${args.personId}-preview.html`)
  writeFileSync(previewPath, instrumented)
  console.log(JSON.stringify({ previewPath, note: 'Do not load the open pixel or click tracked links for the recipient.' }))

  if (!args.send) {
    console.log(JSON.stringify({ sent: false, reason: 'verify-only; pass --send to fire once' }))
    return
  }

  const { sendOneOffEmail } = await import('@/lib/comms/sendOneOffEmail')
  const sent = await sendOneOffEmail({
    personId: args.personId,
    to: args.to,
    subject: args.subject,
    html: rewritten,
    sendKey: args.sendKey,
    from: args.from,
  })
  console.log(JSON.stringify({ sent }))
  if (!sent.ok) process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
