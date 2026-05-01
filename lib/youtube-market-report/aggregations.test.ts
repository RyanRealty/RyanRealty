import { describe, it, expect } from 'vitest';

import {
  bandForScene5,
  bandForStories,
  classifyMarket,
  direction,
  formatDays,
  formatPercent,
  formatPriceCompact,
  groupBy,
  median,
  monthsOfSupply,
  passesUf1,
  passesUf2,
  percentileCont,
  RESIDENTIAL_PRICE_FLOOR,
  SALE_TO_LIST_MAX,
  SALE_TO_LIST_MIN,
  yoyPct,
} from './aggregations';

describe('percentileCont', () => {
  it('returns NaN on empty input', () => {
    expect(percentileCont([], 0.5)).toBeNaN();
  });

  it('returns the single element when n=1', () => {
    expect(percentileCont([42], 0.5)).toBe(42);
    expect(percentileCont([42], 0.0)).toBe(42);
    expect(percentileCont([42], 1.0)).toBe(42);
  });

  it('matches Postgres PERCENTILE_CONT linear interpolation for an even n', () => {
    // [1, 2, 3, 4] median is 2.5 (linear interp between 2 and 3).
    expect(percentileCont([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it('matches Postgres for odd n', () => {
    expect(percentileCont([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  it('handles unsorted input', () => {
    expect(percentileCont([5, 1, 3, 2, 4], 0.5)).toBe(3);
  });

  it('drops non-finite values silently', () => {
    expect(percentileCont([1, 2, Number.NaN, 3, Number.POSITIVE_INFINITY, 4], 0.5)).toBe(2.5);
  });

  it('computes p25 and p75 correctly for a 5-element series', () => {
    // n=5: ranks 0,1,2,3,4. p25 = rank 1.0 = 2. p75 = rank 3.0 = 4.
    expect(percentileCont([1, 2, 3, 4, 5], 0.25)).toBe(2);
    expect(percentileCont([1, 2, 3, 4, 5], 0.75)).toBe(4);
  });

  it('throws on out-of-range p', () => {
    expect(() => percentileCont([1, 2, 3], -0.1)).toThrow(RangeError);
    expect(() => percentileCont([1, 2, 3], 1.1)).toThrow(RangeError);
    expect(() => percentileCont([1, 2, 3], Number.NaN)).toThrow(RangeError);
  });

  it('matches a known Bend-shaped median', () => {
    // 11 values clustered around $700K — median should be exact middle value.
    const prices = [475000, 525000, 600000, 650000, 680000, 700000, 720000, 760000, 825000, 950000, 1_200_000];
    expect(median(prices)).toBe(700_000);
  });
});

describe('yoyPct', () => {
  it('rounds to one decimal', () => {
    expect(yoyPct(725000, 710000)).toBe(2.1);
    expect(yoyPct(699000, 754375)).toBe(-7.3);
  });

  it('returns NaN when prior is 0', () => {
    expect(yoyPct(100, 0)).toBeNaN();
  });

  it('handles non-finite inputs', () => {
    expect(yoyPct(Number.NaN, 100)).toBeNaN();
    expect(yoyPct(100, Number.NaN)).toBeNaN();
  });
});

describe('direction', () => {
  it('classifies up/down/flat with a tight dead-band', () => {
    expect(direction(2.1)).toBe('up');
    expect(direction(-7.3)).toBe('down');
    expect(direction(0)).toBe('flat');
    expect(direction(0.04)).toBe('flat');
    expect(direction(-0.04)).toBe('flat');
    expect(direction(0.06)).toBe('up');
  });

  it('treats NaN as flat', () => {
    expect(direction(Number.NaN)).toBe('flat');
  });
});

describe('monthsOfSupply', () => {
  it('matches the canonical Template 11 formula', () => {
    // active=412, closed_180d=706, lookback=180 -> monthly_rate = 117.67 -> mos = 3.50.
    // Bend-shaped numbers (drawn from the skill's reference deltas section).
    // 3.50 is unambiguously seller's market under the <=4.0 threshold per
    // query-rules.md Template 11 CASE statement.
    const result = monthsOfSupply(412, 706, 180);
    expect(result.monthsOfSupply).toBe(3.5);
    expect(result.marketCondition).toBe("Seller's Market");
    expect(result.monthlyCloseRate).toBe(117.67);
  });

  it('classifies a 4.20 MoS value as Balanced under the documented threshold', () => {
    // The skill's C3 section has a parenthetical that calls 4.20 "seller's market"
    // but the explicit threshold table and Template 11 CASE both define <=4.0
    // as seller's. We follow the explicit threshold; 4.20 -> Balanced.
    const result = monthsOfSupply(412, 588, 180);
    expect(result.monthsOfSupply).toBe(4.2);
    expect(result.marketCondition).toBe('Balanced Market');
  });

  it('classifies balanced markets', () => {
    // active = 600, closed_180d = 600. close rate = 100/mo. MoS = 6.0 — boundary.
    // Per spec, < 6.0 is balanced and >= 6.0 is buyer.
    const balanced = monthsOfSupply(500, 600, 180);
    expect(balanced.marketCondition).toBe('Balanced Market');
    const buyerBoundary = monthsOfSupply(600, 600, 180);
    expect(buyerBoundary.monthsOfSupply).toBe(6.0);
    expect(buyerBoundary.marketCondition).toBe("Buyer's Market");
  });

  it('produces NaN MoS when close rate is 0', () => {
    const result = monthsOfSupply(100, 0, 180);
    expect(result.monthsOfSupply).toBeNaN();
    expect(result.marketCondition).toBe('Balanced Market');
  });

  it('rejects non-positive lookback', () => {
    expect(() => monthsOfSupply(100, 100, 0)).toThrow(RangeError);
    expect(() => monthsOfSupply(100, 100, -5)).toThrow(RangeError);
  });

  it('rejects negative counts', () => {
    expect(() => monthsOfSupply(-1, 100, 180)).toThrow(RangeError);
    expect(() => monthsOfSupply(100, -1, 180)).toThrow(RangeError);
  });
});

describe('classifyMarket', () => {
  it('uses correct thresholds', () => {
    expect(classifyMarket(0.1)).toBe("Seller's Market");
    expect(classifyMarket(4.0)).toBe("Seller's Market");
    expect(classifyMarket(4.0001)).toBe('Balanced Market');
    expect(classifyMarket(5.5)).toBe('Balanced Market');
    expect(classifyMarket(6.0)).toBe("Buyer's Market");
    expect(classifyMarket(99)).toBe("Buyer's Market");
  });

  it('falls back to Balanced for NaN', () => {
    expect(classifyMarket(Number.NaN)).toBe('Balanced Market');
  });
});

describe('formatPriceCompact', () => {
  it('formats sub-million as $K', () => {
    expect(formatPriceCompact(725_000)).toBe('$725K');
    expect(formatPriceCompact(699_000)).toBe('$699K');
    expect(formatPriceCompact(474_500)).toBe('$475K');
  });

  it('formats millions with three decimals stripped', () => {
    expect(formatPriceCompact(1_075_000)).toBe('$1.075M');
    expect(formatPriceCompact(1_500_000)).toBe('$1.5M');
    expect(formatPriceCompact(2_000_000)).toBe('$2M');
  });

  it('returns em-dash for sub-floor values (UF1)', () => {
    expect(formatPriceCompact(0)).toBe('—');
    expect(formatPriceCompact(0.09)).toBe('—');
    expect(formatPriceCompact(9999)).toBe('—');
    expect(formatPriceCompact(Number.NaN)).toBe('—');
  });
});

describe('formatDays + formatPercent', () => {
  it('formats days', () => {
    expect(formatDays(12)).toBe('12 days');
    expect(formatDays(56.4)).toBe('56 days');
    expect(formatDays(Number.NaN)).toBe('—');
  });

  it('formats signed percent with arrow', () => {
    expect(formatPercent(2.1)).toBe('↑ 2.1%');
    expect(formatPercent(-7.3)).toBe('↓ 7.3%');
    expect(formatPercent(0.0)).toBe('→ 0.0%');
  });

  it('formats without arrow when requested', () => {
    expect(formatPercent(2.1, { arrow: false })).toBe('+2.1%');
    expect(formatPercent(-7.3, { arrow: false })).toBe('-7.3%');
  });

  it('honors decimals option', () => {
    expect(formatPercent(2.16, { decimals: 2 })).toBe('↑ 2.16%');
  });
});

describe('price band helpers', () => {
  it('bandForScene5 uses 4-band split', () => {
    expect(bandForScene5(450_000)).toBe('Under $500K');
    expect(bandForScene5(600_000)).toBe('$500K-$700K');
    expect(bandForScene5(850_000)).toBe('$700K-$1M');
    expect(bandForScene5(1_500_000)).toBe('$1M+');
  });

  it('bandForStories uses 6-band split', () => {
    expect(bandForStories(350_000)).toBe('Under $400K');
    expect(bandForStories(450_000)).toBe('$400K-$500K');
    expect(bandForStories(550_000)).toBe('$500K-$600K');
    expect(bandForStories(700_000)).toBe('$600K-$750K');
    expect(bandForStories(875_000)).toBe('$750K-$1M');
    expect(bandForStories(1_500_000)).toBe('$1M+');
  });

  it('returns null for sub-UF1 values', () => {
    expect(bandForScene5(0)).toBeNull();
    expect(bandForStories(9999)).toBeNull();
  });
});

describe('groupBy', () => {
  it('preserves insertion order and groups by key', () => {
    const xs = [
      { k: 'a', v: 1 },
      { k: 'b', v: 2 },
      { k: 'a', v: 3 },
    ];
    const grouped = groupBy(xs, (x) => x.k);
    expect([...grouped.keys()]).toEqual(['a', 'b']);
    expect(grouped.get('a')).toEqual([{ k: 'a', v: 1 }, { k: 'a', v: 3 }]);
    expect(grouped.get('b')).toEqual([{ k: 'b', v: 2 }]);
  });
});

describe('UF1 + UF2 guards', () => {
  it('UF1: residential price floor is $10K', () => {
    expect(RESIDENTIAL_PRICE_FLOOR).toBe(10_000);
    expect(passesUf1(0.09)).toBe(false);
    expect(passesUf1(9999)).toBe(false);
    expect(passesUf1(10_000)).toBe(true);
    expect(passesUf1(725_000)).toBe(true);
    expect(passesUf1(Number.NaN)).toBe(false);
  });

  it('UF2: sale-to-list ratio bounds [0.5, 1.5]', () => {
    expect(SALE_TO_LIST_MIN).toBe(0.5);
    expect(SALE_TO_LIST_MAX).toBe(1.5);
    expect(passesUf2(0.49)).toBe(false);
    expect(passesUf2(0.5)).toBe(true);
    expect(passesUf2(0.97)).toBe(true);
    expect(passesUf2(1.5)).toBe(true);
    expect(passesUf2(1.51)).toBe(false);
    expect(passesUf2(99.9)).toBe(false);
    expect(passesUf2(Number.NaN)).toBe(false);
  });
});
