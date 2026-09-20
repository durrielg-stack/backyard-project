import { describe, it, expect } from "vitest";
import {
  monthStart,
  previousMonthStart,
  isEffectiveForMonth,
  itemsForMonth,
  effectiveLabel,
} from "./opex";

const open = (from: string, to: string | null = null) => ({
  effectiveFrom: from,
  effectiveTo: to,
});

describe("monthStart / previousMonthStart", () => {
  it("pads single-digit months", () => {
    expect(monthStart(2026, 9)).toBe("2026-09-01");
    expect(monthStart(2026, 12)).toBe("2026-12-01");
  });

  it("wraps January back to the previous December", () => {
    expect(previousMonthStart(2026, 1)).toBe("2025-12-01");
    expect(previousMonthStart(2026, 9)).toBe("2026-08-01");
  });
});

describe("isEffectiveForMonth", () => {
  const legacy = open("2000-01-01", "2026-08-01"); // Salary ₱1,950 era
  const current = open("2026-09-01"); // Salary ₱2,250 era

  it("includes both boundary months", () => {
    expect(isEffectiveForMonth(legacy, 2026, 8)).toBe(true);
    expect(isEffectiveForMonth(current, 2026, 9)).toBe(true);
  });

  it("excludes months outside the span", () => {
    expect(isEffectiveForMonth(legacy, 2026, 9)).toBe(false);
    expect(isEffectiveForMonth(current, 2026, 8)).toBe(false);
  });

  it("treats a null effectiveTo as open-ended", () => {
    expect(isEffectiveForMonth(current, 2030, 1)).toBe(true);
  });

  it("gives every month exactly one version of a split item", () => {
    for (const [y, m] of [
      [2026, 5],
      [2026, 8],
      [2026, 9],
      [2027, 3],
    ] as const) {
      expect(itemsForMonth([legacy, current], y, m)).toHaveLength(1);
    }
  });
});

describe("itemsForMonth", () => {
  it("keeps items with no versioning in every month", () => {
    const rent = open("2000-01-01");
    expect(itemsForMonth([rent], 2026, 9)).toEqual([rent]);
  });

  it("drops an item retired before the month", () => {
    expect(itemsForMonth([open("2000-01-01", "2026-06-01")], 2026, 9)).toEqual(
      [],
    );
  });

  it("drops an item that starts after the month", () => {
    expect(itemsForMonth([open("2026-10-01")], 2026, 9)).toEqual([]);
  });
});

describe("effectiveLabel", () => {
  it("returns null for an always-on item", () => {
    expect(effectiveLabel(open("2000-01-01"))).toBeNull();
  });

  it("labels open-ended, closed, and single-month spans", () => {
    expect(effectiveLabel(open("2026-09-01"))).toBe("Sep 2026 →");
    expect(effectiveLabel(open("2000-01-01", "2026-08-01"))).toBe("— Aug 2026");
    expect(effectiveLabel(open("2026-09-01", "2027-01-01"))).toBe(
      "Sep 2026 — Jan 2027",
    );
    expect(effectiveLabel(open("2026-09-01", "2026-09-01"))).toBe("Sep 2026");
  });
});
