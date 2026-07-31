import { describe, expect, it } from "vitest";
import definitionsFile from "@/data/zoning/definitions.json";
import aliasesFile from "@/data/zoning/aliases.json";
import {
  allZoningDefinitions,
  normalizeZoningToken,
  resolveZoning,
  splitZoningString,
  type ZoningDefinition,
} from "./resolve";

describe("normalization", () => {
  it("treats MUA-10 and MUA10 as the same code", () => {
    const a = resolveZoning({ code: "MUA-10", county: "Deschutes", cityLower: "redmond" });
    const b = resolveZoning({ code: "MUA10", county: "Deschutes", cityLower: "redmond" });
    expect(a.status).toBe("resolved");
    expect(a.definition?.jurisdiction).toBe("deschutes-county");
    expect(b.definition).toEqual(a.definition);
  });

  it("strips spaces, periods, parentheses and slashes", () => {
    expect(normalizeZoningToken("RR(M)-5")).toBe("RRM5");
    expect(normalizeZoningToken(" rr-10 ")).toBe("RR10");
    expect(normalizeZoningToken("C-S/P")).toBe("CSP");
  });

  it("takes the token before a semicolon description, surviving the MLS truncation walls", () => {
    expect(splitZoningString("Rrm5; Recreatio").primary).toBe("RRM5");
    expect(splitZoningString("Rrm5; Recreational Reside").primary).toBe("RRM5");
    const r = resolveZoning({ code: "Rrm5; Recreational Reside", county: "Crook", cityLower: "prineville" });
    expect(r.status).toBe("resolved");
    expect(r.definition?.jurisdiction).toBe("crook-county");
    expect(r.definition?.code).toBe("RRM-5");
  });

  it("splits comma and space separated overlay tokens off the primary zone", () => {
    const r = resolveZoning({ code: "RR10, WA", county: "Deschutes", cityLower: "la pine" });
    expect(r.status).toBe("resolved");
    expect(r.definition?.code).toBe("RR10");
    expect(r.overlays).toEqual([{ token: "WA", name: "Wildlife Area Combining Zone (DCC 18.88)" }]);

    const multi = resolveZoning({ code: "EFUSC DR SMIA", county: "Deschutes", cityLower: "redmond" });
    expect(multi.status).toBe("resolved");
    expect(multi.definition?.code).toBe("EFUSC");
    expect(multi.overlays?.map((o) => o.token)).toEqual(["DR", "SMIA"]);
  });
});

describe("jurisdiction collisions are never picked silently (§6.0.1)", () => {
  it("PR in Crook County with a Prineville mailing city returns both candidates", () => {
    const r = resolveZoning({ code: "PR", county: "Crook", cityLower: "prineville" });
    expect(r.status).toBe("resolved");
    expect(r.definition).toBeUndefined();
    expect(r.jurisdictionConfidence).toBe("ambiguous");
    const keys = r.candidates?.map((c) => `${c.jurisdiction}:${c.code}`);
    expect(keys).toEqual(["crook-county:P-R", "prineville:PR"]);
  });

  it("an explicit insideCityLimits signal settles the PR collision each way", () => {
    const inside = resolveZoning({ code: "PR", county: "Crook", cityLower: "prineville", insideCityLimits: true });
    expect(inside.definition?.jurisdiction).toBe("prineville");
    expect(inside.jurisdictionConfidence).toBe("county-certain");

    const outside = resolveZoning({ code: "PR", county: "Crook", cityLower: "prineville", insideCityLimits: false });
    expect(outside.definition?.jurisdiction).toBe("crook-county");
    expect(outside.definition?.code).toBe("P-R");
  });

  it("MUE in Jefferson County with a Madras mailing city returns both candidates", () => {
    const r = resolveZoning({ code: "MUE", county: "Jefferson", cityLower: "madras" });
    expect(r.status).toBe("resolved");
    expect(r.definition).toBeUndefined();
    const keys = r.candidates?.map((c) => `${c.jurisdiction}:${c.code}`);
    expect(keys).toEqual(["jefferson-county:MUE", "madras:MUE"]);
  });
});

describe("mailing city is never trusted as jurisdiction (§6.0 item 4)", () => {
  it("ERD with a Madras mailing city resolves to the county zone, county-certain", () => {
    const r = resolveZoning({ code: "ERD", county: "Jefferson", cityLower: "madras" });
    expect(r.status).toBe("resolved");
    expect(r.definition?.jurisdiction).toBe("jefferson-county");
    expect(r.jurisdictionConfidence).toBe("county-certain");
  });

  it("a city-zone match reached only through the mailing city is city-assumed", () => {
    const r = resolveZoning({ code: "SFR-4", county: "Jackson", cityLower: "medford" });
    expect(r.status).toBe("resolved");
    expect(r.definition?.jurisdiction).toBe("medford");
    expect(r.jurisdictionConfidence).toBe("city-assumed");
  });

  it("a Culver mailing city never borrows a Madras city zone", () => {
    const r = resolveZoning({ code: "R1", county: "Jefferson", cityLower: "culver" });
    expect(r.status).toBe("unmapped");
    expect(r.definition).toBeUndefined();
    expect(r.candidates).toBeUndefined();
  });

  it("a mailing city outside the stated county is dropped as a data conflict", () => {
    // Bend is not in Jackson County; the Bend RS zone must not be reachable.
    const r = resolveZoning({ code: "RS", county: "Jackson", cityLower: "bend" });
    expect(r.definition?.jurisdiction).not.toBe("bend");
  });
});

describe("the explicit unmapped state (§6.0.1)", () => {
  it("a string matching nothing returns unmapped with no definition", () => {
    const r = resolveZoning({ code: "ZZZ99", county: "Deschutes", cityLower: "bend" });
    expect(r.status).toBe("unmapped");
    expect(r.definition).toBeUndefined();
    expect(r.candidates).toBeUndefined();
    expect(r.normalizedCode).toBe("ZZZ99");
  });

  it("RR1 in Jefferson County is unmapped with the curated note, not force-matched", () => {
    const r = resolveZoning({ code: "RR1", county: "Jefferson", cityLower: "madras" });
    expect(r.status).toBe("unmapped");
    expect(r.unmappedNote).toMatch(/RR-2, RR-5, RR-10 and RR-20/);
  });

  it("FR in Crook County stays unmapped because F-1 and FR-10 are different zones", () => {
    const r = resolveZoning({ code: "FR", county: "Crook", cityLower: "prineville" });
    expect(r.status).toBe("unmapped");
    expect(r.unmappedNote).toMatch(/F-1/);
  });

  it("generic labels are unmapped everywhere", () => {
    for (const code of ["Residential", "Res", "SFR"]) {
      const r = resolveZoning({ code, county: "Deschutes", cityLower: "bend" });
      expect(r.status, code).toBe("unmapped");
    }
  });
});

describe("aliases", () => {
  it("TRRAR resolves to the verified TRRA zone in Jefferson County", () => {
    const r = resolveZoning({ code: "TRRAR", county: "Jefferson", cityLower: "culver" });
    expect(r.status).toBe("resolved");
    expect(r.definition?.code).toBe("TRRA");
    expect(r.definition?.jurisdiction).toBe("jefferson-county");
    expect(r.definition?.status).toBe("verified");
  });

  it("every alias target exists as a definition in the same jurisdiction", () => {
    const defs = allZoningDefinitions();
    const normalized = new Set(
      Object.values(defs).map((d) => `${d.jurisdiction}:${normalizeZoningToken(d.code)}`),
    );
    for (const [key, alias] of Object.entries(aliasesFile.aliases)) {
      const [jur] = key.split(":");
      expect(
        normalized.has(`${jur}:${normalizeZoningToken((alias as { to: string }).to)}`),
        `alias ${key} -> ${(alias as { to: string }).to}`,
      ).toBe(true);
    }
  });
});

describe("live-data spot checks", () => {
  it("Klamath County R2 resolves county-certain with its verified 2 acre minimum", () => {
    const r = resolveZoning({ code: "R2", county: "Klamath", cityLower: "chiloquin" });
    expect(r.status).toBe("resolved");
    expect(r.definition?.jurisdiction).toBe("klamath-county");
    expect(r.jurisdictionConfidence).toBe("county-certain");
    expect(r.definition?.minLotSize).toContain("2 acres");
  });

  it("Bend RS resolves to the city district via mailing city, city-assumed", () => {
    const r = resolveZoning({ code: "RS", county: "Deschutes", cityLower: "bend" });
    expect(r.status).toBe("resolved");
    expect(r.definition?.jurisdiction).toBe("bend");
    expect(r.jurisdictionConfidence).toBe("city-assumed");
  });

  it("a bare code with no geography is ambiguous by definition (§6.0 item 3)", () => {
    const r = resolveZoning({ code: "MUA10" });
    expect(r.status).toBe("resolved");
    expect(r.jurisdictionConfidence).toBe("ambiguous");
  });
});

describe("definitions file integrity", () => {
  const entries = definitionsFile.entries as Record<string, ZoningDefinition>;
  const ADU_VALUES = ["allowed", "conditional", "not-permitted", "check"];
  const STR_VALUES = ["allowed", "permit-required", "prohibited", "check"];

  it("every entry is complete, keyed correctly, and enum-valid", () => {
    expect(Object.keys(entries).length).toBeGreaterThanOrEqual(60);
    for (const [key, d] of Object.entries(entries)) {
      expect(key, key).toBe(`${d.jurisdiction}:${d.code}`);
      expect(d.name.length, key).toBeGreaterThan(2);
      expect(d.plainEnglish.length, key).toBeGreaterThan(20);
      expect(d.sourceUrl, key).toMatch(/^https:\/\//);
      expect(d.sourceCite.length, key).toBeGreaterThan(3);
      expect(ADU_VALUES, key).toContain(d.adu);
      expect(STR_VALUES, key).toContain(d.str);
      expect(["verified", "unverified"], key).toContain(d.status);
      expect(
        (definitionsFile.jurisdictions as Record<string, unknown>)[d.jurisdiction],
        `${key} jurisdiction registered`,
      ).toBeDefined();
    }
  });

  it("verified entries carry verifiedOn; unverified entries state no minimums and answer check", () => {
    for (const [key, d] of Object.entries(entries)) {
      if (d.status === "verified") {
        expect(d.verifiedOn, key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      } else {
        expect(d.verifiedOn, key).toBeUndefined();
        expect(d.minLotSize, key).toBeUndefined();
        expect(d.adu, key).toBe("check");
        expect(d.str, key).toBe("check");
      }
    }
  });

  it("buyer-facing text carries no hedging words and no banned punctuation (§2)", () => {
    const banned = /\b(may|could|potentially)\b/i;
    for (const [key, d] of Object.entries(entries)) {
      for (const text of [d.plainEnglish, d.notes ?? "", d.name]) {
        expect(banned.test(text), `${key} hedging: ${text}`).toBe(false);
        expect(/[—–;]/.test(text), `${key} punctuation: ${text}`).toBe(false);
      }
    }
    for (const u of aliasesFile.unmapped as { note: string }[]) {
      expect(banned.test(u.note), u.note).toBe(false);
      expect(/[—–;]/.test(u.note), u.note).toBe(false);
    }
  });

  it("minimums only appear on verified entries and always carry units and a cite", () => {
    for (const [key, d] of Object.entries(entries)) {
      if (d.minLotSize === undefined) continue;
      expect(d.status, key).toBe("verified");
      expect(d.minLotSize, key).toMatch(/(acres?|sq ft)/);
      expect(d.minLotSize, key).toMatch(/\(/);
    }
  });
});
