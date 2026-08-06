import { describe, expect, it } from "vitest";
import { getWaterAlertLevel, getWastewaterAlertLevel, getSedimentAlertLevel } from "./rules";

describe("water alert rules", () => {
  it("marks low sediment as a warning", () => {
    expect(getSedimentAlertLevel(120)).toEqual({ level: "warn", text: "ค่าตะกอนผิดปกติ (120 | ค่าปกติ 250–450)" });
  });

  it("marks critical low sediment as bad", () => {
    expect(getSedimentAlertLevel(90)).toEqual({ level: "bad", text: "ค่าตะกอนต่ำกว่าค่าปกติ (90 | ค่าปกติ 250–450)" });
  });

  it("marks critical high sediment as bad", () => {
    expect(getSedimentAlertLevel(460)).toEqual({ level: "bad", text: "ค่าตะกอนเกินค่าปกติ (460 | ค่าปกติ 250–450)" });
  });

  it("marks low potable chlorine as bad", () => {
    expect(getWaterAlertLevel(0.1, null, null)).toEqual([{ level: "bad", text: "ค่าคลอรีนต่ำกว่าค่าปกติ (0.1 mg/L | ค่าปกติ 0.2–0.5)" }]);
  });

  it("marks water pH out of range as bad", () => {
    expect(getWaterAlertLevel(null, 9.0, null)).toEqual([{ level: "bad", text: "ค่า pH ผิดปกติ (9 | ค่าปกติ 6.5–8.5)" }]);
  });

  it("marks disinfectant source pH out of range as bad", () => {
    expect(getDisinfectantAlertLevel(0.3, 5.5, 0.3, 7.0)).toEqual([{ level: "bad", text: "pH ต้นทางผิดปกติ (5.5 | ค่าปกติ 6.5–8.5)" }]);
  });

  it("marks disinfectant outlet chlorine high as bad", () => {
    expect(getDisinfectantAlertLevel(0.3, 7.0, 0.6, 7.0)).toEqual([{ level: "bad", text: "ปลายทางคลอรีนเกินค่าปกติ (0.6 mg/L | ค่าปกติ 0.2–0.5)" }]);
  });

  it("marks high wastewater chlorine as a bad alert", () => {
    expect(getWastewaterAlertLevel(1.2, null, null)).toEqual([{ level: "bad", text: "ค่าคลอรีนเกินค่าปกติ (1.2 mg/L | ค่าปกติ 0.5–1.0)" }]);
  });
});
