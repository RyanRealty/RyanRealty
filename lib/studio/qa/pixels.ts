/**
 * lib/studio/qa/pixels.ts - check 17 ("Pixels"): the film's pixels against its manifest.
 *
 * Checks 1 to 16 judge the manifest, and the manifest is a file anyone could
 * write. This check reads the MP4 itself, so a manifest cannot claim captions
 * or figures the pixels do not show, or hide a figure the pixels do show:
 *
 *  1. The ryan-studio render gate (.claude/skills/ryan-studio/tools/video_render_gate.py)
 *     runs on the MP4: end card sequence, loop, hook text, caption presence
 *     across the voice, "top team", price-with-closed flashes. Its LENGTH
 *     finding is dropped (check 3 holds the type's own length; the gate's
 *     15 to 30 s is buyer_ad only), as are LOOP and END CARD for a type that
 *     requires neither and a manifest that has neither.
 *  2. Every text the manifest claims (cards, the call to action, every caption)
 *     is read back off its own box at its own time (ocr.ts) and must be there:
 *     every figure in it, and at least half of its longer words.
 *  3. The gate's full-frame OCR samples are scanned for figure-shaped tokens
 *     ($, %, a decimal, or three or more digits) that persist across two
 *     samples and are not within one digit of any figure the manifest lists.
 *     Full-frame OCR over footage is noisy (it reads 3.5 as 3.0 or 3.9), so this
 *     scan is deliberately conservative; it catches a figure the manifest left
 *     out, not a misread.
 *
 * OCR tooling missing (tesseract, python3 with opencv) is a FAIL with the
 * install line, never a pass.
 *
 * The probe is injected (tests fake it); the judgments are pure.
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Manifest, ManifestText } from './manifest'
import { readBox, readingShowsCaption, type OcrBox, type OcrMode } from './ocr'
import { resolvePython, resolveTesseract, runBinary, studioBinaries } from './measure'
import { extractNumberTokens } from './spoken'
import { REPO_ROOT } from './thresholds'

export const RENDER_GATE_PATH = join(REPO_ROOT, '.claude', 'skills', 'ryan-studio', 'tools', 'video_render_gate.py')
export const PIXEL_GATE_WRAPPER = join(REPO_ROOT, 'lib', 'studio', 'qa', 'pixel_gate.py')

export const INSTALL_OCR =
  'install the OCR tooling: macOS `brew install tesseract` and `python3 -m pip install opencv-python-headless numpy`; Debian or Ubuntu `apt-get install -y tesseract-ocr python3-opencv python3-numpy`'

export interface GateOptions {
  videoType: string
  silent: boolean
  voStart: number | null
  voEnd: number | null
}

export interface GateRun {
  fails: string[]
  info: Record<string, unknown>
  /** The gate's full-frame OCR, every 0.5 s from 0. */
  samples: Array<{ t: number; text: string }>
}

export interface PixelProbe {
  /** Null when OCR can run here; otherwise what is missing and how to install it. */
  missingTooling(): Promise<string | null>
  gate(mp4: string, opts: GateOptions): Promise<GateRun>
  readBox(mp4: string, t: number, box: OcrBox, mode: OcrMode): Promise<string>
}

// ---------------------------------------------------------------------------
// The pure judgments

/** The gate's findings this check keeps, and the ones it drops with the reason. */
export function gateFindings(
  fails: readonly string[],
  manifest: Pick<Manifest, 'loop' | 'endcard'>,
  rules: { requires_loop: boolean; requires_end_card: boolean },
): { kept: string[]; dropped: string[] } {
  const kept: string[] = []
  const dropped: string[] = []
  for (const f of fails) {
    if (/^LENGTH:/.test(f)) dropped.push(`${f} (check 3 holds the type's own length)`)
    else if (/^LOOP:/.test(f) && !rules.requires_loop && manifest.loop === null) dropped.push(`${f} (this type does not loop)`)
    else if (/^END CARD:/.test(f) && !rules.requires_end_card && manifest.endcard === null) dropped.push(`${f} (this type has no end card)`)
    else kept.push(f)
  }
  return { kept, dropped }
}

/** What check 17 reads off each claimed box, and when. */
export interface BoxClaim {
  text: string
  kind: ManifestText['kind']
  t: number
  box: OcrBox
  mode: OcrMode
}

/**
 * Every text the manifest claims, as a box to read at the middle of its time
 * on screen. The locked end card is left to the render gate's own end
 * sequence check. A caption in `captions` with no drawn box in `texts` is a
 * claim with nothing to read, and is reported by the caller.
 */
export function boxClaims(m: Pick<Manifest, 'texts'>): BoxClaim[] {
  return m.texts
    .filter((t) => t.kind !== 'endcard' && /[A-Za-z0-9]/.test(t.text))
    .map((t) => ({
      text: t.text,
      kind: t.kind,
      t: Math.round(((t.start + t.end) / 2) * 1000) / 1000,
      box: t.box,
      mode: t.kind === 'caption' ? ('caption' as const) : ('card' as const),
    }))
}

/** Captions the manifest lists that have no drawn box in texts. */
export function captionsWithoutBoxes(m: Pick<Manifest, 'texts' | 'captions'>): string[] {
  return m.captions
    .filter((c) => !m.texts.some((t) => t.kind === 'caption' && t.text === c.text && Math.abs(t.start - c.start) < 0.05))
    .map((c) => c.text)
}

const digitsOf = (s: string) => s.replace(/[^0-9]/g, '')

/** Levenshtein distance, for "is this a misread of a listed figure". */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return d[a.length][b.length]
}

/** A token that reads as a figure, not as OCR noise: $, %, a decimal point, or three or more digits. */
export function figureShaped(token: string): boolean {
  return /[$%]/.test(token) || /\d\.\d/.test(token) || digitsOf(token).length >= 3
}

/**
 * Figures the pixels show that the manifest does not list. A token counts only
 * when it is figure-shaped, is not a piece of the locked phone, is not within
 * one digit of a listed figure, and is read in two consecutive samples (a
 * figure on screen holds 2.5 s, five samples; noise rarely repeats). Samples
 * from the end card on are skipped (the gate checks the locked card).
 */
export function unlistedFigures(
  samples: ReadonlyArray<{ t: number; text: string }>,
  listed: readonly string[],
  endcardStart: number | null,
): string[] {
  const listedDigits = [...new Set(listed.map(digitsOf).filter(Boolean))]
  const near = (d: string) => listedDigits.some((l) => editDistance(d, l) <= 1)
  const until = endcardStart === null ? Infinity : endcardStart - 0.25
  const used = samples.filter((s) => s.t < until).sort((a, b) => a.t - b.t)
  const perSample = used.map((s) => {
    const found = new Map<string, string>()
    for (const tok of extractNumberTokens(s.text)) {
      const d = digitsOf(tok)
      if (!d || !figureShaped(tok) || near(d)) continue
      if (d.length >= 3 && '5417033095'.includes(d)) continue
      found.set(d, tok)
    }
    return { t: s.t, found }
  })
  const out = new Map<string, string>()
  for (let i = 1; i < perSample.length; i++) {
    const a = perSample[i - 1]
    const b = perSample[i]
    if (Math.abs(b.t - a.t - 0.5) > 0.01) continue
    for (const [d, tok] of b.found) {
      if (a.found.has(d) && !out.has(d)) out.set(d, `"${tok}" at ${a.t}s and ${b.t}s`)
    }
  }
  return [...out.values()]
}

/** Every figure token the manifest shows (texts and captions), for unlistedFigures. */
export function listedFigures(m: Pick<Manifest, 'texts' | 'captions'>): string[] {
  return [...m.texts.map((t) => t.text), ...m.captions.map((c) => c.text)].flatMap((s) => extractNumberTokens(s))
}

/** Was the claimed text read off its box? Figures all, and at least half the longer words. */
export function claimConfirmed(reading: string, text: string): boolean {
  return readingShowsCaption(reading, text).ok
}

// ---------------------------------------------------------------------------
// The real probe: python3 + opencv + tesseract, ffmpeg from the shared resolver

export function createPixelProbe(env: NodeJS.ProcessEnv = process.env): PixelProbe {
  const tesseract = () => resolveTesseract(env)
  const python = () => resolvePython(env)
  return {
    async missingTooling() {
      const missing: string[] = []
      const tess = tesseract()
      if (!tess) missing.push('tesseract is not installed')
      const py = python()
      if (!py) missing.push('python3 is not installed')
      else {
        const r = await runBinary(py, ['-c', 'import cv2, numpy'], { timeoutMs: 60_000 }).catch((e: Error) => ({ code: -1, stdout: Buffer.alloc(0), stderr: e.message }))
        if (r.code !== 0) missing.push('python3 cannot import cv2 (opencv) and numpy')
      }
      if (!existsSync(RENDER_GATE_PATH)) missing.push(`the render gate is not at ${RENDER_GATE_PATH}`)
      return missing.length ? `${missing.join('; ')}: ${INSTALL_OCR}` : null
    },

    async gate(mp4, opts) {
      const py = python()
      const tess = tesseract()
      if (!py || !tess) throw new Error(`OCR tooling is missing: ${INSTALL_OCR}`)
      const { ffprobe } = studioBinaries(env)
      // The gate calls bare ffprobe and tesseract: put the resolved ones first on PATH.
      const PATH = [dirname(ffprobe), dirname(tess), env.PATH ?? ''].filter(Boolean).join(':')
      const args = [PIXEL_GATE_WRAPPER, RENDER_GATE_PATH, mp4, '--type', opts.videoType]
      if (opts.silent) args.push('--silent')
      if (opts.voStart !== null && opts.voEnd !== null) args.push('--vo-start', opts.voStart.toFixed(3), '--vo-end', opts.voEnd.toFixed(3))
      const r = await runBinary(py, args, { timeoutMs: 15 * 60_000, env: { ...env, PATH }, group: true })
      const text = r.stdout.toString('utf8').trim()
      let parsed: { fails?: unknown; info?: unknown; samples?: unknown; error?: unknown }
      try {
        parsed = JSON.parse(text.split(/\r?\n/).pop() ?? '')
      } catch {
        throw new Error(`the render gate printed no result (exit ${r.code}): ${r.stderr.trim().split(/\r?\n/).slice(-2).join(' | ')}`)
      }
      if (typeof parsed.error === 'string') throw new Error(`the render gate could not run: ${parsed.error}`)
      if (!Array.isArray(parsed.fails) || !Array.isArray(parsed.samples)) throw new Error('the render gate result has no fails or samples')
      return {
        fails: parsed.fails.map(String),
        info: (parsed.info ?? {}) as Record<string, unknown>,
        samples: (parsed.samples as Array<{ t: number; text: string }>).map((s) => ({ t: Number(s.t), text: String(s.text) })),
      }
    },

    async readBox(mp4, t, box, mode) {
      const tess = tesseract()
      if (!tess) throw new Error(`tesseract is not installed: ${INSTALL_OCR}`)
      return readBox(mp4, t, box, mode, { ffmpeg: studioBinaries(env).ffmpeg, tesseract: tess })
    },
  }
}
