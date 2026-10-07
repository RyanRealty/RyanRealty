import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { panPhotoClip, planPan } from './pan'
import { imageSize, sameShape } from './image-size'
import { resolveFfmpeg } from './ffmpeg'

describe('planPan', () => {
  const frame = { width: 1080, height: 1920, seconds: 6, direction: 'forward' as const }

  it('a landscape photo is scaled uniformly to the frame height and panned across', () => {
    const plan = planPan({ ...frame, source: { width: 1535, height: 1024 } })
    expect(plan.axis).toBe('x')
    expect(plan.scaled.height).toBe(1920)
    // Uniform: the scaled shape is the source shape, to rounding.
    expect(plan.scaled.width / plan.scaled.height).toBeCloseTo(1535 / 1024, 2)
    // ffmpeg derives the scale from the decoded frame: uniform cover, never a forced size.
    expect(plan.filter).toContain('scale=1080:1920:force_original_aspect_ratio=increase')
    expect(plan.filter).toMatch(/crop=1080:1920:x='\(iw-1080\)\*/)
    expect(plan.filter).toMatch(/y='\(ih-1920\)\*/)
  })

  it('a tall photo pans down instead', () => {
    const plan = planPan({ ...frame, source: { width: 800, height: 1600 } })
    expect(plan.axis).toBe('y')
    expect(plan.scaled.width).toBe(1080)
    expect(plan.scaled.width / plan.scaled.height).toBeCloseTo(800 / 1600, 2)
  })

  it('a photo already the frame shape holds still', () => {
    expect(planPan({ ...frame, source: { width: 1584, height: 2816 } }).axis).toBe('none')
  })

  it('back reverses the direction of travel', () => {
    const forward = planPan({ ...frame, source: { width: 1500, height: 1000 } }).filter
    const back = planPan({ ...frame, direction: 'back', source: { width: 1500, height: 1000 } }).filter
    expect(forward).toContain('0.5-0.5*cos')
    expect(back).toContain('0.5+0.5*cos')
  })
})

describe('image size and the shape gate', () => {
  it('reads a JPEG frame size past 0xFF fill bytes', () => {
    const jpeg = Buffer.from([
      0xff, 0xd8, // SOI
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0, length 4
      0xff, 0xff, 0xff, // fill bytes before the next marker
      0xc0, 0x00, 0x11, 0x08, 0x04, 0x00, 0x06, 0x00, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, // SOF0 1536x1024
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ])
    expect(imageSize(jpeg)).toEqual({ width: 1536, height: 1024 })
  })

  it('a 9:16 still matches a 9:16 clip; a landscape photo does not', () => {
    expect(sameShape({ width: 1584, height: 2816 }, '9:16')).toBe(true)
    expect(sameShape({ width: 1088, height: 1920 }, '9:16')).toBe(true)
    expect(sameShape({ width: 1535, height: 1024 }, '9:16')).toBe(false)
  })
})

const ffmpeg = await resolveFfmpeg()

describe.skipIf(!ffmpeg)('a pan never reshapes the photo (real ffmpeg)', () => {
  it('a square in a landscape photo is still a square in the portrait frame', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pan-shape-'))
    try {
      const photoPath = join(dir, 'photo.png')
      // 1500x1000 landscape, white, with a 200x200 red square in the middle.
      execFileSync(ffmpeg!, [
        '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=white:s=1500x1000',
        '-vf', 'drawbox=x=650:y=400:w=200:h=200:color=red:t=fill', '-frames:v', '1', photoPath,
      ])
      const photo = readFileSync(photoPath)
      expect(imageSize(photo)).toEqual({ width: 1500, height: 1000 })

      const { body, plan } = await panPhotoClip({ ffmpeg: ffmpeg!, photo, width: 1080, height: 1920, seconds: 2, fps: 30, direction: 'forward' })
      expect(plan.axis).toBe('x')
      const clipPath = join(dir, 'pan.mp4')
      writeFileSync(clipPath, body)

      // Mid-pan the square sits in the window; measure it in the decoded frame.
      const raw = execFileSync(ffmpeg!, [
        '-loglevel', 'error', '-ss', '1.0', '-i', clipPath, '-frames:v', '1',
        '-vf', 'scale=in_range=tv:out_range=pc,format=rgb24', '-f', 'rawvideo', '-',
      ], { maxBuffer: 16 * 1024 * 1024 })
      let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1
      for (let y = 0; y < 1920; y++) {
        for (let x = 0; x < 1080; x++) {
          const i = (y * 1080 + x) * 3
          if (raw[i] > 180 && raw[i + 1] < 90 && raw[i + 2] < 90) {
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
      }
      const w = maxX - minX + 1
      const h = maxY - minY + 1
      // 200px scaled by 1920/1000 is 384px each way: square, not squeezed.
      expect(h).toBeGreaterThan(370)
      expect(h).toBeLessThan(398)
      expect(Math.abs(w / h - 1)).toBeLessThan(0.03)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
