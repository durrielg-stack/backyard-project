import { describe, it, expect } from "vitest";
import { fmtPeso } from "./format";

describe("fmtPeso", () => {
  it("formats with the peso sign and thousands separator", () => {
    expect(fmtPeso(1234.5)).toBe("₱1,234.50");
  });

  it("defaults to 2 decimal places", () => {
    expect(fmtPeso(5)).toBe("₱5.00");
  });

  it("respects a custom decimal count", () => {
    expect(fmtPeso(5, 0)).toBe("₱5");
  });

  it("handles zero", () => {
    expect(fmtPeso(0)).toBe("₱0.00");
  });
});
