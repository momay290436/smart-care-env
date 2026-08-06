import { describe, expect, it } from "vitest";
import { getWaterAlertLevel, getWastewaterAlertLevel, getSedimentAlertLevel } from "../../supabase/functions/water-alert-daily/rules";

describe("water alert rules", () => {
  it("marks low sediment as a warning", () => {
    expect(getSedimentAlertLevel(120)).toEqual({ level: "warn", text: "ค่าตะกอนต่ำกว่าค่าปกติ (120 | ค่าปกติ 250–450)" });
  });

  it("marks very low potable chlorine as a warning", () => {
    expect(getWaterAlertLevel(0.1, null, null)).toEqual([
      { level: "warn", text: "ค่าคลอรีนต่ำกว่าค่าปกติ (0.1 mg/L | ค่าปกติ 0.2–0.5)" },
    ]);
  });

  it("marks high wastewater chlorine as a bad alert", () => {
    expect(getWastewaterAlertLevel(1.2, null, null)).toEqual([
      { level: "bad", text: "ค่าคลอรีนเกินค่าปกติ (1.2 mg/L | ค่าปกติ 0.5–1.0)" },
    ]);
  });
});
