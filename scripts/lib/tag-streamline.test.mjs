import { describe, it, expect } from 'vitest';
import {
  classify, deriveFromAddresses, rewritePersonTags, fieldWritePlan,
  isSacred, isExpiredSignal, isMigrationRealtorTag,
} from './tag-streamline.mjs';

const rw = (tags, addresses = [], custom = {}, stage = 'Lead') => rewritePersonTags(tags, addresses, custom, stage).tags;

describe('tag-streamline v2: SACRED / compliance', () => {
  it('keeps every send-gate tag verbatim + do_not_text (V2-P2-2)', () => {
    for (const t of ['compliance:hard-stop', 'contact:do-not-text', 'contact:do-not-call',
      'do_not_email', 'do_not_text', 'Unsubscribed', 'Bounced', 'complained', 'tcpa:litigator']) {
      expect(isSacred(t)).toBe(true);
      expect(rw([t])).toContain(t); // verbatim, casing preserved
    }
  });
  it('never drops a sacred tag even alone', () => {
    expect(rw(['contact:do-not-call'])).toEqual(['contact:do-not-call']);
    expect(rw(['Bounced'])).toEqual(['Bounced']);
  });
});

describe('tag-streamline v2: segment emission', () => {
  it('expired is additive across ALL variants incl source/seller/classification', () => {
    for (const t of ['Expired', 'Expired Listings', 'intent:expired-listing', 'ExpiredWave3',
      'status:expired', 'seller:expired-untouched', 'source:expired-listing-cron', 'source:expired-listing-mls']) {
      expect(isExpiredSignal(t.toLowerCase())).toBe(true);
      expect(rw([t])).toContain('segment:expired');
    }
    expect(rw([], [], { customClassification: 'EXPIRED' })).toContain('segment:expired');
    // per-listing/date noise is NOT a segment signal
    expect(isExpiredSignal('expired-mls:123')).toBe(false);
    expect(isExpiredSignal('expired-detected:2026-05-01')).toBe(false);
  });
  it('fsbo + buyer segments', () => {
    expect(rw(['FSBO'])).toContain('segment:fsbo');
    expect(rw(['Buyer'])).toContain('segment:buyer');
    expect(rw(['audience:buyer'])).toContain('segment:buyer');
  });
  it('seller = stage-only (Matt 2026-07-03) — audience:seller does NOT emit segment:seller', () => {
    expect(rw(['audience:seller'], [], {}, 'Lead')).not.toContain('segment:seller');
    expect(rw([], [], {}, 'Seller Prospect')).toContain('segment:seller');
    expect(rw(['audience:seller'], [], {}, 'Lead')).toContain('audience:seller'); // tag kept
  });
});

describe('tag-streamline v2: realtor identity + local/migration', () => {
  it('industry:realtor kept as base + realtor:local when no feeder signal', () => {
    const out = rw(['industry:realtor']);
    expect(out).toContain('industry:realtor');
    expect(out).toContain('realtor:local');
    expect(out).not.toContain('realtor:migration');
  });
  it('a feeder city-realtor tag → realtor:migration; migration broker too', () => {
    expect(isMigrationRealtorTag('seattle realtor')).toBe(true);
    expect(rw(['industry:realtor', 'Seattle realtor'])).toContain('realtor:migration');
    expect(rw(['Portland realtor'])).toContain('realtor:migration'); // identity via city-realtor
    expect(rw(['migration broker'])).toContain('realtor:migration');
  });
  it('bare Realtor + broker-recruit resolve to realtor:local, tags dropped', () => {
    const out = rw(['Realtor', 'audience:broker-recruit']);
    expect(out).toContain('realtor:local');
    expect(out).not.toContain('Realtor');
    expect(out).not.toContain('audience:broker-recruit');
  });
  it('stage Real Estate Agent is realtor identity', () => {
    expect(rw([], [], {}, 'Real Estate Agent')).toContain('realtor:local');
  });
});

describe('tag-streamline v2: address derivation + out-of-area', () => {
  it('own-property + out-of-state mailing → absentee + out-of-state + segment:out-of-area', () => {
    const out = rw([], [
      { type: 'home', state: 'CA', city: 'LA', street: '1 A St' },
      { type: 'Property', state: 'OR', city: 'Bend', street: '2 B St' },
    ]);
    expect(out).toEqual(expect.arrayContaining(['owner:absentee', 'location:out-of-state', 'segment:out-of-area']));
  });
  it('local absentee investor → NO out-of-area segment', () => {
    const out = rw([], [
      { type: 'home', state: 'OR', city: 'Bend', street: '1 A St' },
      { type: 'Property', state: 'OR', city: 'Redmond', street: '2 B St' },
    ]);
    expect(out).toContain('owner:absentee');
    expect(out).not.toContain('segment:out-of-area');
  });
  it('hardened: a phone-typed entry is NOT used as the mailing address (V2-P2-8)', () => {
    const r = deriveFromAddresses([
      { type: 'mobile', state: 'ZZ', city: 'x', street: '5551212' },
      { type: 'Property', state: 'OR', city: 'Bend', street: '2 B St' },
    ]);
    // only a phone + a property → no real mailing → unknown, no bogus location
    expect(r.location).toBe(null);
    expect(r.occ).toBe('unknown-no-mailing');
  });
});

describe('tag-streamline v2: field-write plan (never guess, never overwrite)', () => {
  it('single tag + empty field → safe capture', () => {
    const { plan, needsGeocode } = fieldWritePlan(['neighborhood:tetherow'], {});
    expect(plan.customNeighborhood).toBe('tetherow');
    expect(needsGeocode).toHaveLength(0);
  });
  it('multiple tags + empty field → flagged for geocode, NOT guessed', () => {
    const { plan, needsGeocode } = fieldWritePlan(['neighborhood:a', 'neighborhood:b'], {});
    expect(plan.customNeighborhood).toBeUndefined();
    expect(needsGeocode[0]).toMatchObject({ field: 'customNeighborhood', count: 2 });
  });
  it('populated field is never overwritten', () => {
    const { plan } = fieldWritePlan(['neighborhood:a'], { customNeighborhood: 'Awbrey Butte' });
    expect(plan.customNeighborhood).toBeUndefined();
  });
});

describe('tag-streamline v2: end-to-end + idempotency', () => {
  it('collapses a sprawl row, drops pollution, keeps sacred + attribution, emits segments', () => {
    const before = ['compliance:hard-stop', 'audience:seller', 'seller:nurture',
      'neighborhood:awbrey-butte', 'city:bend', 'industry:realtor', 'import:westside',
      'owner:absentee', 'geo:out-of-state', 'email:valid'];
    const out = rw(before, [
      { type: 'home', state: 'CA', city: 'LA', street: 'a' },
      { type: 'Property', state: 'OR', city: 'Bend', street: 'b' },
    ], {}, 'Seller Prospect');
    expect(out).toEqual(expect.arrayContaining([
      'compliance:hard-stop', 'audience:seller', 'seller:nurture',
      'segment:seller', 'industry:realtor', 'realtor:local',
      'owner:absentee', 'location:out-of-state', 'segment:out-of-area',
    ]));
    for (const gone of ['neighborhood:awbrey-butte', 'city:bend', 'import:westside', 'geo:out-of-state', 'email:valid']) {
      expect(out).not.toContain(gone);
    }
  });
  it('is idempotent', () => {
    const addr = [{ type: 'home', state: 'OR', city: 'Bend', street: 'x' }];
    const once = rw(['audience:seller', 'seller:hot'], addr, {}, 'Seller Prospect');
    const twice = rewritePersonTags(once, addr, {}, 'Seller Prospect').tags;
    expect(twice).toEqual(once);
  });
});
