import { describe, expect, it } from 'vitest';
import { CONTACT } from '../brand/contact';

import {
  buildScene0,
  buildScene1,
  buildScene2,
  buildScene3,
  buildScene4,
  buildScene5,
  buildScene6,
  buildScene7,
  buildScene8,
} from './scene-builders';
import type { ActiveSfrRow, ClosedSfrRow } from './queries';
import type { VideoPeriod } from '../../video/market-report/src/VideoProps';

const PERIOD: VideoPeriod = {
  label: 'April 2026',
  monthId: '2026-04',
  monthName: 'April',
  year: 2026,
  current: { start: '2026-04-01', end: '2026-04-30' },
  priorYear: { start: '2025-04-01', end: '2025-04-30' },
  trailing24mo: { start: '2024-05-01', end: '2026-04-30' },
};

function closed(overrides: Partial<ClosedSfrRow> = {}): ClosedSfrRow {
  return {
    ListingKey: `key-${Math.random()}`,
    ClosePrice: 700_000,
    CloseDate: '2026-04-15T07:00:00Z',
    PostalCode: '97703',
    TotalLivingAreaSqFt: 1800,
    days_to_pending: 12,
    sale_to_final_list_ratio: 0.97,
    sale_to_list_ratio: 0.95,
    close_price_per_sqft: 388,
    property_sub_type: 'Single Family Residence',
    ...overrides,
  };
}

function active(overrides: Partial<ActiveSfrRow> = {}): ActiveSfrRow {
  return {
    ListingKey: `key-${Math.random()}`,
    ListPrice: 800_000,
    OnMarketDate: '2026-03-01T07:00:00Z',
    property_sub_type: 'Single Family Residence',
    PropertyType: 'A',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('buildScene0', () => {
  it('builds the hook from current and prior-year rows', () => {
    const current = [725_000, 700_000, 650_000, 800_000].map((p) => closed({ ClosePrice: p, days_to_pending: 12 }));
    const prior = [710_000, 690_000].map((p) => closed({ ClosePrice: p }));

    const scene = buildScene0({
      currentRows: current,
      priorYearRows: prior,
      anchorStat: 'median_price',
    });

    expect(scene.medianPrice).toBe(712_500);
    expect(scene.closedCount).toBe(4);
    expect(scene.medianDaysToPending).toBe(12);
    expect(scene.direction).toBe('up');
    expect(scene.anchorStatName).toBe('median_price');
    expect(scene.anchorStatDisplay).toBe('$713K');
    expect(scene.anchorStatValue).toBe(712_500);
  });

  it('formats the months_of_supply anchor when supplied', () => {
    const scene = buildScene0({
      currentRows: [closed()],
      priorYearRows: [closed()],
      anchorStat: 'months_of_supply',
      monthsOfSupplyValue: 4.2,
    });
    expect(scene.anchorStatDisplay).toBe('4.2 months');
    expect(scene.anchorStatValue).toBe(4.2);
  });

  it('returns NaN-flat shape when no data', () => {
    const scene = buildScene0({
      currentRows: [],
      priorYearRows: [],
      anchorStat: 'median_price',
    });
    expect(Number.isNaN(scene.medianPrice)).toBe(true);
    expect(scene.closedCount).toBe(0);
    expect(scene.direction).toBe('flat');
    expect(scene.characterization).toBe('shifting');
  });
});

describe('buildScene1', () => {
  it('builds title scene from period label', () => {
    const s = buildScene1(PERIOD);
    expect(s.monthYear).toBe('April 2026');
    expect(s.miniAgenda).toEqual(['Prices', 'Inventory', 'Days to Pending', 'Neighborhood Breakdown']);
  });
});

describe('buildScene2', () => {
  it('builds monthly series and YoY', () => {
    // 24 months of one closed each month at varying prices.
    const trailing = Array.from({ length: 24 }).map((_, i) => {
      const monthIdx = i + 5; // start at month 5 of 2024 to span 2024-05..2026-04
      const year = 2024 + Math.floor((monthIdx - 1) / 12);
      const month = ((monthIdx - 1) % 12) + 1;
      return closed({
        ClosePrice: 600_000 + i * 5_000,
        CloseDate: `${year}-${String(month).padStart(2, '0')}-15T07:00:00Z`,
      });
    });

    const scene = buildScene2({
      currentRows: [closed({ ClosePrice: 725_000 })],
      priorYearRows: [closed({ ClosePrice: 700_000 })],
      trailingRows: trailing,
      period: PERIOD,
    });

    expect(scene.currentMedian).toBe(725_000);
    expect(scene.priorYearMedian).toBe(700_000);
    expect(scene.yoyPct).toBe(3.6);
    expect(scene.yoyDirection).toBe('up');
    expect(scene.currentMonthLabel).toBe('April');
    expect(scene.monthlySeries.length).toBeGreaterThan(0);
    expect(scene.trendDescription.length).toBeGreaterThan(0);
    expect(scene.interpretation.length).toBeGreaterThan(0);
  });
});

describe('buildScene3', () => {
  it('builds price-per-sqft per sub-type with YoY', () => {
    const current = [
      closed({ property_sub_type: 'Single Family Residence', close_price_per_sqft: 380 }),
      closed({ property_sub_type: 'Single Family Residence', close_price_per_sqft: 390 }),
      closed({ property_sub_type: 'Condominium', close_price_per_sqft: 425 }),
    ];
    const prior = [
      closed({ property_sub_type: 'Single Family Residence', close_price_per_sqft: 400 }),
      closed({ property_sub_type: 'Condominium', close_price_per_sqft: 410 }),
    ];
    const scene = buildScene3({ currentRows: current, priorYearRows: prior });

    expect(scene.byPropertyType.length).toBeGreaterThanOrEqual(2);
    expect(scene.sfrPpsf).toBe(385);
    // (385 - 400) / 400 * 100 = -3.75; Math.round(-37.5) = -37; /10 = -3.7
    expect(scene.sfrPct).toBe(-3.7);
    expect(scene.sfrDirection).toBe('down');
    expect(scene.condoComparison).toContain('Condos posted 1 sales');
  });
});

describe('buildScene4', () => {
  it('builds inventory + Months of Supply per Template 11', () => {
    // active=412, closed_180d=706, lookback=180 -> mos=3.50, seller's
    const scene = buildScene4({
      activeRows: Array.from({ length: 412 }).map(() => active()),
      priorYearActiveCount: 380,
      closedLookbackRows: Array.from({ length: 706 }).map(() => closed()),
      lookbackDays: 180,
    });
    expect(scene.activeCount).toBe(412);
    expect(scene.activeCountPriorYear).toBe(380);
    expect(scene.inventoryPct).toBe(8.4);
    expect(scene.inventoryDirection).toBe('up');
    expect(scene.monthsOfSupply).toBe(3.5);
    expect(scene.marketCondition).toBe("Seller's Market");
    expect(scene.monthlyCloseRate).toBe(117.67);
  });
});

describe('buildScene5', () => {
  it('groups closed rows by price band, computes percentiles + absorption', () => {
    const rows: ClosedSfrRow[] = [
      closed({ ClosePrice: 450_000, days_to_pending: 7 }),
      closed({ ClosePrice: 475_000, days_to_pending: 9 }),
      closed({ ClosePrice: 600_000, days_to_pending: 11 }),
      closed({ ClosePrice: 650_000, days_to_pending: 13 }),
      closed({ ClosePrice: 850_000, days_to_pending: 18 }),
      closed({ ClosePrice: 1_200_000, days_to_pending: 42 }),
    ];
    const scene = buildScene5({ closedRows: rows, activeCount: 200, pendingCount: 50 });

    expect(scene.byPriceBand).toHaveLength(4);
    expect(scene.byPriceBand[0]?.priceBand).toBe('Under $500K');
    expect(scene.byPriceBand[3]?.priceBand).toBe('$1M+');
    expect(scene.domUnder500k).toBe(8);
    expect(scene.dom500to700k).toBe(12);
    expect(scene.dom700kTo1m).toBe(18);
    expect(scene.dom1mPlus).toBe(42);
    expect(scene.medianDaysToPending).toBe(12);

    // absorption = closed / (closed + active) = 6 / 206 = 2.9%
    expect(scene.absorptionRatePct).toBe(2.9);
    // sell-through = closed / (closed + pending) = 6/56 = 10.7%
    expect(scene.sellThroughRate90d).toBe(10.7);
  });
});

describe('buildScene6', () => {
  it('builds per-ZIP metrics + identifies hottest, highest-price, best-value ZIPs', () => {
    const current = [
      closed({ PostalCode: '97703', ClosePrice: 875_000, close_price_per_sqft: 462, days_to_pending: 14 }),
      closed({ PostalCode: '97703', ClosePrice: 825_000, close_price_per_sqft: 450, days_to_pending: 12 }),
      closed({ PostalCode: '97701', ClosePrice: 615_000, close_price_per_sqft: 351, days_to_pending: 9 }),
      closed({ PostalCode: '97701', ClosePrice: 595_000, close_price_per_sqft: 340, days_to_pending: 11 }),
    ];
    const prior = [
      closed({ PostalCode: '97703', ClosePrice: 825_000 }),
      closed({ PostalCode: '97701', ClosePrice: 600_000 }),
    ];

    const scene = buildScene6({ currentRows: current, priorYearRows: prior });

    expect(scene.byZip).toHaveLength(2);
    const z703 = scene.byZip.find((r) => r.postalCode === '97703');
    const z701 = scene.byZip.find((r) => r.postalCode === '97701');
    expect(z703?.areaName).toBe('West Side');
    expect(z703?.medianPrice).toBe(850_000);
    expect(z701?.areaName).toBe('East Side');
    expect(z701?.medianPrice).toBe(605_000);

    expect(scene.highestPriceZip).toBe('97703');
    expect(scene.bestValueZip).toBe('97701');
    expect(scene.bestValueMedian).toBe(605_000);
    expect(scene.hottestZip).toBe('97703'); // highest yoyPct
  });
});

describe('buildScene7', () => {
  it('produces buyer/seller takeaways tied to verdict + sale-to-list', () => {
    const trailing = [
      closed({ sale_to_final_list_ratio: 0.96 }),
      closed({ sale_to_final_list_ratio: 0.97 }),
      closed({ sale_to_final_list_ratio: 0.98 }),
    ];
    const scene6 = buildScene6({
      currentRows: [closed({ PostalCode: '97701', ClosePrice: 615_000, close_price_per_sqft: 351 })],
      priorYearRows: [],
    });
    const scene4 = buildScene4({
      activeRows: Array.from({ length: 200 }).map(() => active()),
      priorYearActiveCount: 180,
      closedLookbackRows: Array.from({ length: 600 }).map(() => closed()),
      lookbackDays: 180,
    });
    const scene5 = buildScene5({
      closedRows: [closed({ ClosePrice: 1_200_000, days_to_pending: 42 })],
      activeCount: 100,
      pendingCount: 25,
    });

    const scene = buildScene7({
      trailing90Rows: trailing,
      scene6,
      scene4,
      scene5,
    });

    expect(scene.medianSaleToListPct).toBe(97);
    expect(scene.buyerTakeaways.length).toBeGreaterThan(0);
    expect(scene.sellerTakeaways.length).toBeGreaterThan(0);
    expect(scene.bestValueZip).toBe('97701');
    expect(scene.bestValueZipPpsf).toBe(351);
  });
});

describe('buildScene8', () => {
  it('emits brand-locked CTA fields', () => {
    const scene = buildScene8({ nextReportDate: 'May 24, 2026' });
    expect(scene.url).toBe('ryan-realty.com');
    // Asserted against the canonical source, not a literal. This line held
    // '541.213.6706' until 2026-08-06 — the private forward target — so the
    // test was locking the CTA to a number we had already taken off the site.
    expect(scene.phone).toBe(CONTACT.phoneDirect);
    expect(scene.nextReportDate).toBe('May 24, 2026');
  });
});
