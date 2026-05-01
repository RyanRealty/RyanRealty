import { describe, expect, it } from 'vitest';

import {
  BANNED_AI_FILLER,
  BANNED_PUNCTUATION,
  BANNED_REAL_ESTATE,
  BANNED_WORDS,
  BANNED_WORDS_REGEX,
  findBannedTokens,
  PHONEME_MAP,
  sanitizePunctuation,
  spellDollars,
  spellNumber,
  spellNumbersInLine,
  tagPhonemes,
} from './script-helpers';

describe('banned word constants', () => {
  it('include the canonical real-estate slop list', () => {
    for (const w of ['stunning', 'nestled', 'breathtaking', 'must-see', 'turnkey']) {
      expect(BANNED_REAL_ESTATE).toContain(w);
    }
  });

  it('include the canonical AI-filler list', () => {
    for (const w of ['delve', 'leverage', 'tapestry', 'navigate', 'robust']) {
      expect(BANNED_AI_FILLER).toContain(w);
    }
  });

  it('include forbidden punctuation', () => {
    expect(BANNED_PUNCTUATION).toEqual(expect.arrayContaining(['—', ';', '!']));
  });

  it('expose a combined word list and a compiled regex', () => {
    expect(BANNED_WORDS.length).toBeGreaterThan(20);
    expect(BANNED_WORDS_REGEX.test('this is a stunning home')).toBe(true);
    BANNED_WORDS_REGEX.lastIndex = 0; // reset stateful global regex
    expect(BANNED_WORDS_REGEX.test('factual numerical statement')).toBe(false);
  });
});

describe('findBannedTokens', () => {
  it('flags banned words case-insensitively', () => {
    const hits = findBannedTokens('A truly stunning luxurious home, nestled in trees.');
    expect(hits).toContain('truly');
    expect(hits).toContain('stunning');
    expect(hits).toContain('luxurious');
    expect(hits).toContain('nestled');
  });

  it('flags banned punctuation', () => {
    const hits = findBannedTokens('Great deal — really; very nice!');
    expect(hits).toContain('—');
    expect(hits).toContain(';');
    expect(hits).toContain('!');
  });

  it('returns empty for clean text', () => {
    const hits = findBannedTokens('Median sale price was 725,000 dollars in April.');
    expect(hits).toEqual([]);
  });

  it('does not flag substrings inside other words', () => {
    // "robusta" contains "robust" — make sure word boundary works.
    const hits = findBannedTokens('I drink robusta coffee daily.');
    expect(hits).not.toContain('robust');
  });
});

describe('spellNumber', () => {
  it('handles small integers', () => {
    expect(spellNumber(0)).toBe('zero');
    expect(spellNumber(7)).toBe('seven');
    expect(spellNumber(15)).toBe('fifteen');
    expect(spellNumber(42)).toBe('forty two');
  });

  it('handles hundreds + thousands', () => {
    expect(spellNumber(412)).toBe('four hundred twelve');
    expect(spellNumber(1_000)).toBe('one thousand');
    expect(spellNumber(725_000)).toBe('seven hundred twenty five thousand');
    expect(spellNumber(1_075_000)).toBe('one million seventy five thousand');
  });

  it('handles decimals', () => {
    expect(spellNumber(2.1)).toBe('two point one');
    expect(spellNumber(97.1)).toBe('ninety seven point one');
    expect(spellNumber(4.2)).toBe('four point two');
  });

  it('handles negatives', () => {
    expect(spellNumber(-7)).toBe('negative seven');
  });

  it('handles unavailable input', () => {
    expect(spellNumber(Number.NaN)).toBe('unavailable');
  });
});

describe('spellDollars', () => {
  it('appends "dollars"', () => {
    expect(spellDollars(725_000)).toBe('seven hundred twenty five thousand dollars');
    expect(spellDollars(1_075_000)).toBe('one million seventy five thousand dollars');
  });
});

describe('spellNumbersInLine', () => {
  it('expands $725K and $1.5M', () => {
    expect(spellNumbersInLine('Median is $725K.'))
      .toBe('Median is seven hundred twenty five thousand dollars.');
    expect(spellNumbersInLine('Top is $1.5M.'))
      .toBe('Top is one million five hundred thousand dollars.');
  });

  it('expands percentages', () => {
    expect(spellNumbersInLine('YoY 2.1%')).toBe('YoY two point one percent');
    expect(spellNumbersInLine('-7.3%')).toBe('negative seven point three percent');
  });

  it('expands "12 days"', () => {
    expect(spellNumbersInLine('12 days')).toBe('twelve days');
    expect(spellNumbersInLine('188 sales this month'))
      .toBe('one hundred eighty eight sales this month');
  });

  it('does not mangle 4-digit years', () => {
    const out = spellNumbersInLine('Report for 2026');
    expect(out).toContain('2026');
  });
});

describe('tagPhonemes', () => {
  it('wraps known place names in <phoneme> tags', () => {
    const out = tagPhonemes('The Deschutes river runs through Bend.');
    expect(out).toBe(
      `The <phoneme alphabet="ipa" ph="${PHONEME_MAP['Deschutes']}">Deschutes</phoneme> river runs through Bend.`,
    );
  });

  it('handles multiple place names in one line', () => {
    const out = tagPhonemes('Tetherow and Awbrey are two areas.');
    expect(out).toContain('<phoneme alphabet="ipa"');
    expect(out).toContain('Tetherow</phoneme>');
    expect(out).toContain('Awbrey</phoneme>');
  });

  it('is idempotent — running twice does not double-wrap', () => {
    const once = tagPhonemes('Deschutes county');
    const twice = tagPhonemes(once);
    expect(twice).toBe(once);
  });
});

describe('sanitizePunctuation', () => {
  it('replaces em-dashes with periods', () => {
    expect(sanitizePunctuation('Median rose — strong demand.')).toBe('Median rose. strong demand.');
  });

  it('replaces semicolons with periods', () => {
    expect(sanitizePunctuation('A; B')).toBe('A. B');
  });

  it('drops exclamation marks', () => {
    expect(sanitizePunctuation('Great deal!')).toBe('Great deal.');
  });

  it('collapses repeated periods', () => {
    expect(sanitizePunctuation('Great...')).toBe('Great.');
  });
});
