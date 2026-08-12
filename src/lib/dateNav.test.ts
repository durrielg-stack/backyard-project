import { describe, it, expect } from "vitest";
import {
  localDateStr,
  parseLocalDate,
  shiftLocalDate,
  SHIFT_CUTOFF_HOUR,
  dayBounds,
  navigateDay,
} from "./dateNav";

// SHIFT_CUTOFF_HOUR pins the owner decision (2026-07-12): a sale after
// midnight but before 6am belongs to the previous night's shift. This is
// the exact rule whose absence misattributed ₱15,568 of the Jul 11 Saturday
// night to Sunday's calendar date. If this ever drifts, revenue reports
// silently split a single night across two days again.
describe("SHIFT_CUTOFF_HOUR", () => {
  it("is 6am", () => {
    expect(SHIFT_CUTOFF_HOUR).toBe(6);
  });
});

describe("shiftLocalDate", () => {
  it("attributes a 1am sale to the previous calendar day", () => {
    const oneAmSunday = new Date(2026, 6, 12, 1, 30); // Jul 12, 2026, 01:30
    expect(shiftLocalDate(oneAmSunday)).toBe("2026-07-11");
  });

  it("attributes exactly 5:59am to the previous calendar day", () => {
    const beforeCutoff = new Date(2026, 6, 12, 5, 59);
    expect(shiftLocalDate(beforeCutoff)).toBe("2026-07-11");
  });

  it("attributes exactly 6:00am to the current calendar day", () => {
    const atCutoff = new Date(2026, 6, 12, 6, 0);
    expect(shiftLocalDate(atCutoff)).toBe("2026-07-12");
  });

  it("attributes an evening sale to its own calendar day", () => {
    const eightPm = new Date(2026, 6, 11, 20, 0);
    expect(shiftLocalDate(eightPm)).toBe("2026-07-11");
  });

  it("rolls over correctly across a month boundary", () => {
    const earlyAugust1st = new Date(2026, 7, 1, 2, 0); // Aug 1, 02:00
    expect(shiftLocalDate(earlyAugust1st)).toBe("2026-07-31");
  });
});

describe("localDateStr / parseLocalDate round-trip", () => {
  it("survives a round trip without drifting a day", () => {
    const d = new Date(2026, 0, 5); // Jan 5 — a date a UTC off-by-one would break
    expect(parseLocalDate(localDateStr(d)).getDate()).toBe(5);
  });
});

describe("dayBounds", () => {
  it("spans 2pm on the given date to 6am the next calendar day", () => {
    const { start, end } = dayBounds("2026-07-11");
    const startDate = new Date(start);
    const endDate = new Date(end);
    expect(startDate.getHours()).toBe(14);
    expect(startDate.getDate()).toBe(11);
    expect(endDate.getHours()).toBe(SHIFT_CUTOFF_HOUR);
    expect(endDate.getDate()).toBe(12);
  });
});

describe("navigateDay", () => {
  it("moves forward one calendar day", () => {
    expect(navigateDay("2026-07-11", 1)).toBe("2026-07-12");
  });

  it("moves backward across a month boundary", () => {
    expect(navigateDay("2026-08-01", -1)).toBe("2026-07-31");
  });
});
