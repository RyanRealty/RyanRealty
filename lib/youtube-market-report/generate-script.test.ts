import { describe, expect, it } from 'vitest';

import { generateScript, ScriptValidationError } from './generate-script';
import { sampleVideoProps } from '../../video/market-report/src/VideoProps.fixture';

describe('generateScript', () => {
  it('produces nine scenes with non-empty text + ttsText', () => {
    const bundle = generateScript({ props: sampleVideoProps });
    expect(bundle.scenes).toHaveLength(9);
    for (const s of bundle.scenes) {
      expect(s.text.length).toBeGreaterThan(10);
      expect(s.ttsText.length).toBeGreaterThan(10);
      expect(s.wordCount).toBeGreaterThan(0);
    }
  });

  it('estimates runtime at 150 WPM', () => {
    const bundle = generateScript({ props: sampleVideoProps });
    const expected = Math.round((bundle.totalWordCount / 150) * 60);
    expect(bundle.estimatedDurationSeconds).toBe(expected);
  });

  it('produces clean text — no banned words', () => {
    const bundle = generateScript({ props: sampleVideoProps });
    expect(bundle.bannedWordHits).toEqual([]);
  });

  it('throws ScriptValidationError when a banned word slips into a scene', () => {
    const tainted = {
      ...sampleVideoProps,
      scene7: {
        ...sampleVideoProps.scene7,
        // Inject a banned word into the takeaway list.
        buyerTakeaways: ['This is a stunning opportunity to negotiate.'] as const,
      },
    };
    expect(() => generateScript({ props: tainted })).toThrow(ScriptValidationError);
  });

  it('returns banned hits without throwing when strict=false', () => {
    const tainted = {
      ...sampleVideoProps,
      scene7: {
        ...sampleVideoProps.scene7,
        sellerTakeaways: ['Your home is truly luxurious.'] as const,
      },
    };
    const bundle = generateScript({ props: tainted, strict: false });
    expect(bundle.bannedWordHits.length).toBeGreaterThan(0);
    expect(bundle.bannedWordHits).toContain('truly');
    expect(bundle.bannedWordHits).toContain('luxurious');
  });

  it('spells numbers in TTS text', () => {
    const bundle = generateScript({ props: sampleVideoProps });
    const scene0 = bundle.scenes[0]!;
    // Display text should still contain "$725K"-style display.
    expect(scene0.text).toMatch(/\$\d/);
    // TTS should have the spelled-out version, not the raw $725K.
    expect(scene0.ttsText).toContain('thousand');
    expect(scene0.ttsText).not.toMatch(/\$\d/);
  });

  it('phoneme-tags Deschutes when it appears', () => {
    const propsWithDeschutes = {
      ...sampleVideoProps,
      scene2: {
        ...sampleVideoProps.scene2,
        trendDescription: 'Deschutes county prices climbed for the third straight month.',
      },
    };
    const bundle = generateScript({ props: propsWithDeschutes });
    const matched = bundle.scenes.find((s) => s.ttsText.includes('phoneme'));
    expect(matched).toBeDefined();
    expect(matched?.ttsText).toContain('<phoneme alphabet="ipa"');
  });

  it('builds YouTube metadata under 60 chars in the title', () => {
    const bundle = generateScript({ props: sampleVideoProps });
    expect(bundle.youtube.title.length).toBeLessThanOrEqual(60);
    expect(bundle.youtube.titleVariants.length).toBeGreaterThan(0);
    expect(bundle.youtube.tags.length).toBeGreaterThan(2);
    expect(bundle.youtube.hashtags.every((h) => h.startsWith('#'))).toBe(true);
    expect(bundle.youtube.categoryId).toBe(25);
  });

  it('strips em-dashes and semicolons from script text', () => {
    const propsWithEmDash = {
      ...sampleVideoProps,
      scene2: {
        ...sampleVideoProps.scene2,
        interpretation: 'Buyers paid more than last year — a meaningful shift.',
      },
    };
    const bundle = generateScript({ props: propsWithEmDash });
    for (const s of bundle.scenes) {
      expect(s.text).not.toContain('—');
      expect(s.text).not.toContain(';');
      expect(s.text).not.toContain('!');
    }
  });
});
