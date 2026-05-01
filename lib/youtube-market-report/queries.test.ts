import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  fetchActiveSfrSnapshot,
  fetchClosedSfrInWindow,
  inPacificWindow,
  pacificYmd,
  paddedUtcWindow,
  priceFilter,
  RATIO_BOUNDS,
  scopeForMarket,
  uf2Filter,
  type ClosedSfrRow,
} from './queries';
import type { Market } from '../../video/market-report/src/VideoProps';

describe('scopeForMarket', () => {
  it('maps single-name cities directly', () => {
    expect(scopeForMarket('Bend')).toEqual({ cities: ['Bend'] });
    expect(scopeForMarket('Redmond')).toEqual({ cities: ['Redmond'] });
    expect(scopeForMarket('Sisters')).toEqual({ cities: ['Sisters'] });
  });

  it('expands aliased cities', () => {
    expect(scopeForMarket('Sunriver')).toEqual({ cities: ['Sunriver', 'Sun River'] });
    expect(scopeForMarket('La Pine')).toEqual({ cities: ['La Pine', 'Lapine'] });
  });

  it('maps counties via CountyOrParish', () => {
    expect(scopeForMarket('Jefferson County')).toEqual({ countyOrParish: 'Jefferson' });
    expect(scopeForMarket('Crook County')).toEqual({ countyOrParish: 'Crook' });
  });

  it('exhaustively covers the Market union', () => {
    const allMarkets: Market[] = [
      'Bend',
      'Redmond',
      'Sisters',
      'Sunriver',
      'La Pine',
      'Jefferson County',
      'Crook County',
    ];
    for (const m of allMarkets) {
      const scope = scopeForMarket(m);
      const hasCities = Array.isArray(scope.cities) && scope.cities.length > 0;
      const hasCounty = typeof scope.countyOrParish === 'string' && scope.countyOrParish.length > 0;
      expect(hasCities || hasCounty).toBe(true);
    }
  });
});

describe('paddedUtcWindow', () => {
  it('pads the window to absorb the CloseDate UTC offset', () => {
    const padded = paddedUtcWindow({ start: '2026-04-01', end: '2026-04-30' });
    // start - 1 day, end + 2 days
    expect(padded.gteIso.startsWith('2026-03-31')).toBe(true);
    expect(padded.lteIso.startsWith('2026-05-02')).toBe(true);
  });
});

describe('pacificYmd', () => {
  it('shifts midnight UTC back to the previous Pacific day', () => {
    // 2026-04-02 00:00:00 UTC = 2026-04-01 17:00:00 PDT (April is DST = UTC-7)
    expect(pacificYmd('2026-04-02T00:00:00Z')).toBe('2026-04-01');
  });

  it('handles winter (PST = UTC-8)', () => {
    // 2026-01-02 00:00:00 UTC = 2026-01-01 16:00:00 PST
    expect(pacificYmd('2026-01-02T00:00:00Z')).toBe('2026-01-01');
  });

  it('returns null for invalid input', () => {
    expect(pacificYmd('not-a-date')).toBeNull();
  });
});

describe('inPacificWindow', () => {
  const window = { start: '2026-04-01', end: '2026-04-30' };

  it('includes a sale that closed on the first day of the window in Pacific time', () => {
    // 2026-04-02T00:00:00Z = 2026-04-01 17:00 PDT
    expect(inPacificWindow('2026-04-02T00:00:00Z', window)).toBe(true);
  });

  it('includes the last day', () => {
    // 2026-05-01T00:00:00Z = 2026-04-30 17:00 PDT
    expect(inPacificWindow('2026-05-01T00:00:00Z', window)).toBe(true);
  });

  it('excludes the day before the window', () => {
    // 2026-04-01T00:00:00Z = 2026-03-31 17:00 PDT
    expect(inPacificWindow('2026-04-01T00:00:00Z', window)).toBe(false);
  });

  it('excludes the day after the window', () => {
    // 2026-05-02T00:00:00Z = 2026-05-01 17:00 PDT
    expect(inPacificWindow('2026-05-02T00:00:00Z', window)).toBe(false);
  });
});

describe('uf2Filter + priceFilter', () => {
  function row(overrides: Partial<ClosedSfrRow>): ClosedSfrRow {
    return {
      ListingKey: 'k',
      ClosePrice: 700_000,
      CloseDate: '2026-04-15T00:00:00Z',
      PostalCode: '97703',
      TotalLivingAreaSqFt: 1800,
      days_to_pending: 14,
      sale_to_final_list_ratio: 0.97,
      sale_to_list_ratio: 0.95,
      close_price_per_sqft: 388,
      property_sub_type: 'Single Family Residence',
      ...overrides,
    };
  }

  it('keeps rows with null ratio', () => {
    const rows = [row({ sale_to_final_list_ratio: null })];
    expect(uf2Filter(rows)).toHaveLength(1);
  });

  it('drops rows with ratio outside [0.5, 1.5]', () => {
    const rows = [
      row({ sale_to_final_list_ratio: 0.49 }),
      row({ sale_to_final_list_ratio: 0.5 }),
      row({ sale_to_final_list_ratio: 1.5 }),
      row({ sale_to_final_list_ratio: 1.51 }),
      row({ sale_to_final_list_ratio: 99.9 }),
    ];
    const kept = uf2Filter(rows);
    expect(kept.map((r) => r.sale_to_final_list_ratio)).toEqual([0.5, 1.5]);
  });

  it('priceFilter drops sub-floor ClosePrice', () => {
    const rows = [
      row({ ClosePrice: 9999 }),
      row({ ClosePrice: 10_000 }),
      row({ ClosePrice: 700_000 }),
    ];
    expect(priceFilter(rows).map((r) => r.ClosePrice)).toEqual([10_000, 700_000]);
  });
});

describe('RATIO_BOUNDS', () => {
  it('matches aggregations.ts UF2 bounds', () => {
    expect(RATIO_BOUNDS.min).toBe(0.5);
    expect(RATIO_BOUNDS.max).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// Fetcher tests — mock the Supabase client to verify filter wiring
// ---------------------------------------------------------------------------

interface CapturedQuery {
  table: string;
  select: string;
  filters: Array<{ method: string; args: unknown[] }>;
}

function makeMockClient(rows: unknown[] = []): {
  client: SupabaseClient;
  captured: CapturedQuery[];
} {
  const captured: CapturedQuery[] = [];

  const buildQuery = (table: string, select: string): unknown => {
    const c: CapturedQuery = { table, select, filters: [] };
    captured.push(c);

    let pageCount = 0;
    const proxy: Record<string, unknown> = {
      then(onFulfilled: (v: unknown) => unknown) {
        // Single page mock: always returns the rows array on first call, then
        // returns empty on subsequent calls so paginate.ts terminates.
        const data = pageCount === 0 ? rows : [];
        pageCount += 1;
        return Promise.resolve(onFulfilled({ data, error: null }));
      },
    };
    const recordAndReturn = (method: string, ...args: unknown[]) => {
      c.filters.push({ method, args });
      return proxy;
    };
    proxy.eq = (...args: unknown[]) => recordAndReturn('eq', ...args);
    proxy.in = (...args: unknown[]) => recordAndReturn('in', ...args);
    proxy.gte = (...args: unknown[]) => recordAndReturn('gte', ...args);
    proxy.lte = (...args: unknown[]) => recordAndReturn('lte', ...args);
    proxy.range = (...args: unknown[]) => recordAndReturn('range', ...args);
    return proxy;
  };

  const client = {
    from: (table: string) => ({
      select: (select: string) => buildQuery(table, select),
    }),
  } as unknown as SupabaseClient;

  return { client, captured };
}

describe('fetchClosedSfrInWindow', () => {
  it('applies UF1, UF3, status, scope, and date window filters', async () => {
    const { client, captured } = makeMockClient([]);
    await fetchClosedSfrInWindow(client, 'Bend', { start: '2026-04-01', end: '2026-04-30' });

    expect(captured).toHaveLength(1);
    const c = captured[0]!;
    expect(c.table).toBe('listings');
    expect(c.select).toContain('days_to_pending');
    expect(c.select).toContain('sale_to_final_list_ratio');
    expect(c.select).toContain('close_price_per_sqft');

    const flat = c.filters.map((f) => `${f.method}:${JSON.stringify(f.args)}`);
    expect(flat).toContain('eq:["PropertyType","A"]');                                 // UF3
    expect(flat).toContain('eq:["property_sub_type","Single Family Residence"]');       // UF3
    expect(flat).toContain('eq:["StandardStatus","Closed"]');
    expect(flat).toContain('gte:["ClosePrice",10000]');                                 // UF1
    expect(flat.some((f) => f.startsWith('gte:["CloseDate"'))).toBe(true);
    expect(flat.some((f) => f.startsWith('lte:["CloseDate"'))).toBe(true);
    expect(flat).toContain('in:["City",["Bend"]]');
  });

  it('uses CountyOrParish for county-scoped markets', async () => {
    const { client, captured } = makeMockClient([]);
    await fetchClosedSfrInWindow(client, 'Crook County', { start: '2026-01-01', end: '2026-04-30' });

    const flat = captured[0]!.filters.map((f) => `${f.method}:${JSON.stringify(f.args)}`);
    expect(flat).toContain('eq:["CountyOrParish","Crook"]');
    expect(flat.every((f) => !f.startsWith('in:["City"'))).toBe(true);
  });

  it('post-filters rows to the Pacific-local window', async () => {
    const rowInside: ClosedSfrRow = {
      ListingKey: 'k1',
      ClosePrice: 700_000,
      CloseDate: '2026-04-02T00:00:00Z', // 2026-04-01 PDT — inside
      PostalCode: '97703',
      TotalLivingAreaSqFt: 1800,
      days_to_pending: 14,
      sale_to_final_list_ratio: 0.97,
      sale_to_list_ratio: 0.95,
      close_price_per_sqft: 388,
      property_sub_type: 'Single Family Residence',
    };
    const rowOutside: ClosedSfrRow = {
      ...rowInside,
      ListingKey: 'k2',
      CloseDate: '2026-04-01T00:00:00Z', // 2026-03-31 PDT — outside
    };

    const { client } = makeMockClient([rowInside, rowOutside]);
    const result = await fetchClosedSfrInWindow(client, 'Bend', {
      start: '2026-04-01',
      end: '2026-04-30',
    });
    expect(result.map((r) => r.ListingKey)).toEqual(['k1']);
  });
});

describe('fetchActiveSfrSnapshot', () => {
  it('applies UF1, UF3, status filters', async () => {
    const { client, captured } = makeMockClient([]);
    await fetchActiveSfrSnapshot(client, 'Bend');

    const flat = captured[0]!.filters.map((f) => `${f.method}:${JSON.stringify(f.args)}`);
    expect(flat).toContain('eq:["PropertyType","A"]');
    expect(flat).toContain('eq:["property_sub_type","Single Family Residence"]');
    expect(flat).toContain('eq:["StandardStatus","Active"]');
    expect(flat).toContain('gte:["ListPrice",10000]'); // UF1 list-side
    expect(flat).toContain('in:["City",["Bend"]]');
  });

  it('does not query CloseDate', async () => {
    const { client, captured } = makeMockClient([]);
    await fetchActiveSfrSnapshot(client, 'Bend');
    const flat = captured[0]!.filters.map((f) => `${f.method}:${JSON.stringify(f.args)}`);
    expect(flat.every((f) => !f.includes('CloseDate'))).toBe(true);
  });
});
// suppress unused-import warning under strict mode
void vi;
