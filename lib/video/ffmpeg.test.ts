import { describe, expect, it } from 'vitest'
import { readFileSync, mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import {
  FFMPEG_PACKAGE,
  extractTarEntry,
  fetchPinnedFfmpeg,
  resolveFfmpeg,
  serverlessFfmpegPath,
  sriSha512,
} from './ffmpeg'

/** A minimal ustar archive, built the way npm packs a tarball. */
function tar(entries: Array<{ name: string; body: Buffer }>): Buffer {
  const blocks: Buffer[] = []
  for (const { name, body } of entries) {
    const header = Buffer.alloc(512, 0)
    header.write(name, 0, 'utf8')
    header.write('0000755\0', 100)
    header.write('0000000\0', 108)
    header.write('0000000\0', 116)
    header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124)
    header.write('00000000000\0', 136)
    header.write('        ', 148)
    header.write('0', 156)
    header.write('ustar\0', 257)
    header.write('00', 263)
    let sum = 0
    for (const byte of header) sum += byte
    header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148)
    blocks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512, 0))
  }
  blocks.push(Buffer.alloc(1024, 0))
  return Buffer.concat(blocks)
}

describe('pinned ffmpeg', () => {
  it('pins the exact artifact package-lock.json resolves', () => {
    const lock = JSON.parse(readFileSync(join(process.cwd(), 'package-lock.json'), 'utf8')) as {
      packages: Record<string, { version?: string; resolved?: string; integrity?: string }>
    }
    const entry = lock.packages['node_modules/@ffmpeg-installer/linux-x64']
    expect(entry, 'lockfile entry for @ffmpeg-installer/linux-x64').toBeTruthy()
    expect(FFMPEG_PACKAGE.version).toBe(entry.version)
    expect(FFMPEG_PACKAGE.url).toBe(entry.resolved)
    expect(FFMPEG_PACKAGE.integrity).toBe(entry.integrity)
  })

  it('spells sha512 the way npm does', () => {
    expect(sriSha512(Buffer.from('abc'))).toBe(
      'sha512-3a81oZNherrMQXNJriBBMRLm+k6JqX6iCp7u5ktV05ohkpkqJ0/BqDa6PCOj/uu9RU1EI2Q86A4qmslPpUyknw==',
    )
  })

  it('pulls one file out of a tarball and ignores the rest', () => {
    const archive = tar([
      { name: 'package/package.json', body: Buffer.from('{"name":"x"}') },
      { name: 'package/ffmpeg', body: Buffer.from('BINARY-BYTES') },
    ])
    expect(extractTarEntry(archive, 'package/ffmpeg')?.toString()).toBe('BINARY-BYTES')
    expect(extractTarEntry(archive, 'package/missing')).toBeNull()
  })

  it('refuses a tarball whose integrity does not match, before writing anything', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'ffmpeg-pin-'))
    const forged = gzipSync(tar([{ name: 'package/ffmpeg', body: Buffer.from('not ffmpeg') }]))
    await expect(fetchPinnedFfmpeg({ fetchBytes: async () => forged, tmp })).rejects.toThrow(/integrity mismatch/)
    expect(existsSync(serverlessFfmpegPath(tmp))).toBe(false)
  })

  it('prefers an explicit FFMPEG_PATH, and never downloads off serverless', async () => {
    const here = join(process.cwd(), 'package.json')
    await expect(resolveFfmpeg({ FFMPEG_PATH: here } as unknown as NodeJS.ProcessEnv)).resolves.toBe(here)
    // Off serverless the answer is the local installer or nothing: never a fetch.
    const local = await resolveFfmpeg({} as unknown as NodeJS.ProcessEnv)
    expect(local === null || existsSync(local)).toBe(true)
  })
})
