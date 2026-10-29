import { describe, expect, it } from "vitest";
import { calculatePumpHours } from "./pumpMeterCalculation";

describe("calculatePumpHours", () => {
  it("converts consumed kWh to effective pump hours", () => {
    expect(calculatePumpHours(102.2, 100)).toBe(1);
  });

  it("rounds operating hours to two decimal places", () => {
    expect(calculatePumpHours(105, 100)).toBe(2.27);
  });

  it("defaults to zero when the meter decreases", () => {
    expect(calculatePumpHours(99, 100)).toBe(0);
  });

  it("returns null when there is no previous reading", () => {
    expect(calculatePumpHours(100, null)).toBeNull();
  });
});
