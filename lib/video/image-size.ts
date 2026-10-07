/**
 * Width and height of a JPEG, PNG or WebP, read from the header bytes.
 *
 * The Studio needs the true shape of a photograph before it decides how to
 * move across it (lib/video/pan.ts) and before it lets a generator animate a
 * still (the shape gate in lib/studio/produce.ts). Reading the header is
 * exact and needs no decoder, no native module and no network.
 */
export type ImageSize = { width: number; height: number }

function jpegSize(buf: Buffer): ImageSize | null {
  let offset = 2
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++
      continue
    }
    const marker = buf[offset + 1]
    // 0xFF fill bytes may pad the space before a marker; step over them.
    if (marker === 0xff) {
      offset++
      continue
    }
    // Standalone markers carry no length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    const length = buf.readUInt16BE(offset + 2)
    // SOF0-SOF15 except DHT (C4), JPG (C8) and DAC (CC) carry the frame size.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) }
    }
    offset += 2 + length
  }
  return null
}

export function imageSize(buf: Buffer): ImageSize | null {
  if (buf.length < 30) return null
  // PNG: signature, then IHDR width and height.
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  // JPEG: walk the segments to the start-of-frame.
  if (buf[0] === 0xff && buf[1] === 0xd8) return jpegSize(buf)
  // WebP: RIFF....WEBP then VP8, VP8L or VP8X.
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16)
    if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
    if (chunk === 'VP8L') {
      const bits = buf.readUInt32LE(21)
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
    if (chunk === 'VP8X') return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 }
  }
  return null
}

/** Width over height for an aspect string like "9:16". */
export function aspectValue(aspect: string): number | null {
  const m = aspect.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
  if (!m) return null
  const w = Number(m[1])
  const h = Number(m[2])
  return w > 0 && h > 0 ? w / h : null
}

/**
 * True when an image of this size can fill a frame of `aspect` without being
 * stretched or squeezed by more than `tolerance` (2% by default, under what an
 * eye can see). A generator handed a still of the wrong shape squeezes it.
 */
export function sameShape(size: ImageSize, aspect: string, tolerance = 0.02): boolean {
  const target = aspectValue(aspect)
  if (!target || size.width <= 0 || size.height <= 0) return false
  return Math.abs(size.width / size.height / target - 1) <= tolerance
}
