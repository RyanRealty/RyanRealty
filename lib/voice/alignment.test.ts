import { describe, expect, it } from 'vitest';

import {
  forcedAlignment,
  mapAlignmentResponse,
  secondsToFrame,
  synthesizeVictoria,
  synthesizeAndAlign,
  VICTORIA_MODEL_ID,
  VICTORIA_OUTPUT_FORMAT,
  VICTORIA_SETTINGS,
  VICTORIA_VOICE_ID,
} from './alignment';
import type { SceneScript } from '../youtube-market-report/generate-script';

describe('Victoria voice constants (LOCKED 2026-04-27)', () => {
  it('uses the canonical voice ID', () => {
    expect(VICTORIA_VOICE_ID).toBe('qSeXEcewz7tA0Q0qk9fH');
  });

  it('uses eleven_turbo_v2_5', () => {
    expect(VICTORIA_MODEL_ID).toBe('eleven_turbo_v2_5');
  });

  it('uses the canonical conversational settings (locked 2026-05-07: stability 0.4, similarity 0.8, style 0.5, speaker_boost true)', () => {
    expect(VICTORIA_SETTINGS).toEqual({
      stability: 0.4,
      similarity_boost: 0.8,
      style: 0.5,
      use_speaker_boost: true,
    });
  });

  it('uses mp3_44100_128 output format', () => {
    expect(VICTORIA_OUTPUT_FORMAT).toBe('mp3_44100_128');
  });
});

describe('secondsToFrame', () => {
  it('rounds to 30fps frame boundaries', () => {
    expect(secondsToFrame(0)).toBe(0);
    expect(secondsToFrame(0.1)).toBe(3);
    expect(secondsToFrame(1.0)).toBe(30);
    expect(secondsToFrame(1.5)).toBe(45);
    expect(secondsToFrame(2.0)).toBe(60);
  });

  it('matches generate-props.ts secondsToFrames at frame boundaries', () => {
    // VideoProps.secondsToFrames clamps at 1, this util does not. Either way,
    // the math at non-zero inputs has to match to keep CaptionBand timing.
    expect(secondsToFrame(0.5)).toBe(15);
    expect(secondsToFrame(28.5)).toBe(855);
  });
});

describe('mapAlignmentResponse', () => {
  it('converts API word entries to typed AlignmentWord', () => {
    const words = mapAlignmentResponse(
      {
        words: [
          { text: 'April', start: 0.0, end: 0.35 },
          { word: 'was', start: 0.35, end: 0.55 }, // alt key shape
          { text: 'a', start: 0.55, end: 0.62 },
        ],
      },
      0,
    );
    expect(words).toHaveLength(3);
    expect(words[0]).toEqual({
      word: 'April',
      startSeconds: 0.0,
      endSeconds: 0.35,
      startFrame: 0,
      endFrame: 11,
      segmentIndex: 0,
    });
    expect(words[1]?.word).toBe('was');
    expect(words[2]?.startFrame).toBe(17);
  });

  it('drops malformed entries silently', () => {
    const words = mapAlignmentResponse(
      {
        words: [
          { text: '', start: 0, end: 0.1 },              // empty text
          { text: 'good', start: NaN, end: 0.2 },        // bad start
          { text: 'good', start: 0.2 },                   // missing end
          { text: 'kept', start: 0.3, end: 0.5 },
        ],
      },
      4,
    );
    expect(words.map((w) => w.word)).toEqual(['kept']);
    expect(words[0]?.segmentIndex).toBe(4);
  });

  it('handles empty words array', () => {
    expect(mapAlignmentResponse({ words: [] }, 0)).toEqual([]);
    expect(mapAlignmentResponse({}, 0)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Mocked-fetch tests for the network layer
// ---------------------------------------------------------------------------

function makeMp3(): Uint8Array {
  // 4 bytes is enough — we just need something non-empty.
  return new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
}

describe('synthesizeVictoria', () => {
  it('POSTs to the correct endpoint with locked settings + headers', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl = ((url: string, init: RequestInit) => {
      captured = { url, init };
      return Promise.resolve(
        new Response(makeMp3() as BodyInit, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } }),
      );
    }) as unknown as typeof fetch;

    const bytes = await synthesizeVictoria('hello', { apiKey: 'k1', fetchImpl });

    expect(captured).not.toBeNull();
    expect(captured!.url).toBe(
      'https://api.elevenlabs.io/v1/text-to-speech/qSeXEcewz7tA0Q0qk9fH',
    );
    expect(captured!.init.method).toBe('POST');
    const headers = (captured!.init.headers ?? {}) as Record<string, string>;
    expect(headers['xi-api-key']).toBe('k1');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(captured!.init.body as string);
    expect(body.model_id).toBe('eleven_turbo_v2_5');
    expect(body.voice_settings).toEqual(VICTORIA_SETTINGS);
    expect(body.text).toBe('hello');
    expect(body.output_format).toBe('mp3_44100_128');
    expect(bytes.byteLength).toBe(4);
  });

  it('chains previous_text when supplied', async () => {
    const fetchImpl = ((_: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      expect(body.previous_text).toBe('previously...');
      return Promise.resolve(new Response(makeMp3() as BodyInit, { status: 200 }));
    }) as unknown as typeof fetch;
    await synthesizeVictoria('next sentence', {
      apiKey: 'k',
      fetchImpl,
      previousText: 'previously...',
    });
  });

  it('throws when API key missing', async () => {
    const orig = process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    try {
      await expect(synthesizeVictoria('hello')).rejects.toThrow(/ELEVENLABS_API_KEY missing/);
    } finally {
      if (orig !== undefined) process.env.ELEVENLABS_API_KEY = orig;
    }
  });

  it('throws on non-2xx with response body', async () => {
    const fetchImpl = (() =>
      Promise.resolve(new Response('quota exceeded', { status: 429 }))) as unknown as typeof fetch;
    await expect(synthesizeVictoria('x', { apiKey: 'k', fetchImpl })).rejects.toThrow(/429/);
  });
});

describe('forcedAlignment', () => {
  it('POSTs multipart form with audio file + text', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl = ((url: string, init: RequestInit) => {
      captured = { url, init };
      return Promise.resolve(
        new Response(JSON.stringify({ words: [{ text: 'hi', start: 0, end: 0.2 }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }) as unknown as typeof fetch;

    const result = await forcedAlignment(makeMp3(), 'hi', { apiKey: 'k', fetchImpl });
    expect(captured!.url).toBe('https://api.elevenlabs.io/v1/forced-alignment');
    expect(captured!.init.method).toBe('POST');
    const headers = (captured!.init.headers ?? {}) as Record<string, string>;
    expect(headers['xi-api-key']).toBe('k');
    // multipart body type — FormData
    expect(typeof (captured!.init.body as { append?: unknown })?.append).toBe('function');
    expect(result.words?.[0]?.text).toBe('hi');
  });
});

describe('synthesizeAndAlign', () => {
  it('chains previous_text across segments and bundles them into Voice', async () => {
    const tts = ['Scene zero text.', 'Scene one text.'].map((text, i): SceneScript => ({
      sceneIndex: i,
      text,
      ttsText: `${text} [tts]`,
      wordCount: text.split(' ').length,
    }));

    const previousChain: string[] = [];
    let synthCalls = 0;
    let alignCalls = 0;

    const fetchImpl = ((url: string, init: RequestInit) => {
      if (url.includes('text-to-speech')) {
        synthCalls += 1;
        const body = JSON.parse(init.body as string);
        previousChain.push(body.previous_text ?? '');
        return Promise.resolve(new Response(makeMp3() as BodyInit, { status: 200 }));
      }
      if (url.includes('forced-alignment')) {
        alignCalls += 1;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              words: [
                { text: 'hello', start: 0.0, end: 0.4 },
                { text: 'world', start: 0.4, end: 0.9 },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      throw new Error(`unexpected url ${url}`);
    }) as unknown as typeof fetch;

    const writtenAudio: string[] = [];
    const writtenAlign: string[] = [];

    const voice = await synthesizeAndAlign({
      scenes: tts,
      writeAudio: async (filename, bytes) => {
        writtenAudio.push(filename);
        expect(bytes.byteLength).toBe(4);
        return `/audio/${filename}`;
      },
      writeAlignment: async (filename) => {
        writtenAlign.push(filename);
        return `/audio/${filename}`;
      },
      options: { apiKey: 'k', fetchImpl },
    });

    expect(synthCalls).toBe(2);
    expect(alignCalls).toBe(2);
    expect(previousChain).toEqual(['', 'Scene zero text.']);

    expect(voice.voiceId).toBe(VICTORIA_VOICE_ID);
    expect(voice.modelId).toBe(VICTORIA_MODEL_ID);
    expect(voice.segments).toHaveLength(2);
    expect(voice.segments[0]?.audioPath).toBe('/audio/scene0.mp3');
    expect(voice.segments[0]?.words).toHaveLength(2);
    expect(voice.segments[0]?.words[0]?.startFrame).toBe(0);
    expect(voice.segments[0]?.words[1]?.endFrame).toBe(27);
    expect(voice.segments[1]?.audioPath).toBe('/audio/scene1.mp3');

    expect(voice.alignmentPath).toBe('/audio/alignment.json');
    expect(writtenAudio).toEqual(['scene0.mp3', 'scene1.mp3']);
    expect(writtenAlign).toEqual(['alignment.json']);
    expect(voice.totalDurationSeconds).toBeGreaterThan(0);
  });
});
