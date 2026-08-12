import { describe, it, expect } from "vitest";
import {
  seniorPwdUnitPrice,
  selectSeniorPwdUnits,
  computeOwnerEmployeeDiscount,
  computeDiscount,
  type DiscountableLine,
} from "./discounts";

describe("seniorPwdUnitPrice", () => {
  it("strips 12% VAT then applies the 20% RA 9994/10754 discount", () => {
    // ₱112 VAT-inclusive -> ₱100 VAT-exclusive -> ₱80 after 20% off
    expect(seniorPwdUnitPrice(112)).toBeCloseTo(80, 10);
  });

  it("is linear in price", () => {
    expect(seniorPwdUnitPrice(224)).toBeCloseTo(160, 10);
  });
});

describe("selectSeniorPwdUnits", () => {
  const lines: DiscountableLine[] = [
    { lineId: "L1", unitPrice: 200, unitCost: 80, qty: 2, isFood: true },
    { lineId: "L2", unitPrice: 150, unitCost: 60, qty: 1, isFood: true },
    { lineId: "L3", unitPrice: 500, unitCost: 200, qty: 1, isFood: false }, // bar item — excluded
  ];

  it("only considers food items", () => {
    const units = selectSeniorPwdUnits(lines, 10);
    expect(units.every((u) => u.lineId !== "L3")).toBe(true);
  });

  it("picks highest-price units first, one unit per qualifying person", () => {
    const units = selectSeniorPwdUnits(lines, 2);
    expect(units).toHaveLength(2);
    expect(units[0]).toMatchObject({ lineId: "L1", unitPrice: 200 });
    expect(units[1]).toMatchObject({ lineId: "L1", unitPrice: 200 });
  });

  it("caps at the number of qualifying food units available", () => {
    // 3 food units total (L1 qty 2 + L2 qty 1), asking for 5
    expect(selectSeniorPwdUnits(lines, 5)).toHaveLength(3);
  });

  it("returns nothing for a non-positive count", () => {
    expect(selectSeniorPwdUnits(lines, 0)).toHaveLength(0);
  });
});

describe("computeOwnerEmployeeDiscount", () => {
  it("discounts every line to cost, across the whole order", () => {
    const lines: DiscountableLine[] = [
      { lineId: "L1", unitPrice: 200, unitCost: 80, qty: 2, isFood: true },
      { lineId: "L2", unitPrice: 150, unitCost: 60, qty: 1, isFood: false },
    ];
    // (200-80)*2 + (150-60)*1 = 240 + 90 = 330
    expect(computeOwnerEmployeeDiscount(lines)).toBe(330);
  });

  it("treats a never-costed item (null cost) as ₱0 cost, not an error", () => {
    const lines: DiscountableLine[] = [
      { lineId: "L1", unitPrice: 100, unitCost: null, qty: 1, isFood: true },
    ];
    expect(computeOwnerEmployeeDiscount(lines)).toBe(100);
  });
});

describe("computeDiscount", () => {
  const lines: DiscountableLine[] = [
    { lineId: "L1", unitPrice: 112, unitCost: 50, qty: 1, isFood: true },
  ];

  it("returns 0 for 'none'", () => {
    expect(computeDiscount("none", lines, 5)).toBe(0);
  });

  it("routes to the owner/employee calculation", () => {
    expect(computeDiscount("owner_employee", lines, 0)).toBe(
      computeOwnerEmployeeDiscount(lines),
    );
  });

  it("routes to the senior/PWD calculation", () => {
    // 112 - 80 = 32 discount on the one qualifying unit
    expect(computeDiscount("senior_pwd", lines, 1)).toBeCloseTo(32, 10);
  });
});
