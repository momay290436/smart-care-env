import { describe, expect, it } from "vitest";
import {
  getWaterAlertLevel,
  getWastewaterAlertLevel,
  getSedimentAlertLevel,
  getDisinfectantAlertLevel,
} from "../../supabase/functions/water-alert-daily/rules";

describe("water alert rules", () => {
  it("marks low sediment below 100 as critical", () => {
    expect(getSedimentAlertLevel(90)).toEqual({ level: "bad", text: "ค่าตะกอนต่ำกว่าค่าปกติ (90 | ค่าปกติ 250–450)" });
  });

  it("marks sediment between 100 and 200 as warning", () => {
    expect(getSedimentAlertLevel(120)?.level).toBe("warn");
  });

  it("marks sediment between 350 and 450 as warning", () => {
    expect(getSedimentAlertLevel(360)?.level).toBe("warn");
  });

  it("marks high sediment above 450 as critical", () => {
    expect(getSedimentAlertLevel(460)?.level).toBe("bad");
  });

  it("marks disinfectant source pH out of range as critical", () => {
    expect(getDisinfectantAlertLevel(0.3, 5.5, 0.3, 7.0)).toEqual([
      { level: "bad", text: "pH ต้นทางผิดปกติ (5.5 | ค่าปกติ 6.5–8.5)" },
    ]);
  });

  it("does not alert when disinfectant values are in range", () => {
    expect(getDisinfectantAlertLevel(0.4, 7.5, 0.4, 7.5)).toEqual([]);
  });

  it("marks disinfectant outlet chlorine over 0.5 as critical", () => {
    expect(getDisinfectantAlertLevel(0.3, 7.0, 0.6, 7.0)).toEqual([
      { level: "bad", text: "คลอรีนปลายทางเกินค่าปกติ (0.6 mg/L | ค่าปกติ 0.2–0.5)" },
    ]);
  });

  it("ignores potable rules when values are null", () => {
    expect(getWaterAlertLevel(null, null, null)).toEqual([]);
  });

  it("warns on wastewater chlorine below 0.5", () => {
    expect(getWastewaterAlertLevel(0.3, null, null)[0].level).toBe("warn");
  });

  it("marks high wastewater chlorine as critical", () => {
    expect(getWastewaterAlertLevel(1.2, null, null)[0].level).toBe("bad");
  });

  it("warns on DO between 1 and 2", () => {
    expect(getWastewaterAlertLevel(null, null, 1.1)).toEqual([
      { level: "warn", text: "ค่า DO ต่ำกว่าค่าปกติ (1.1 mg/L | ค่าปกติ 2–3)" },
    ]);
  });

  it("marks DO below 1 and above 3 as critical", () => {
    expect(getWastewaterAlertLevel(null, null, 0.5)[0].level).toBe("bad");
    expect(getWastewaterAlertLevel(null, null, 3.5)[0].level).toBe("bad");
  });

  it("accepts custom thresholds", () => {
    const custom = getWastewaterAlertLevel(1.2, null, null, {
      potable: { chlorineMin: 0.2, chlorineMax: 0.5, phMin: 6.5, phMax: 8.5, turbidityMax: 5 },
      wastewater: {
        chlorineMin: 0.5, chlorineMax: 2, phMin: 6.5, phMax: 8.5, doMin: 2, doMax: 3, doWarnMin: 1,
        sedimentBadLow: 100, sedimentWarnLow: 200, sedimentNormalMin: 250, sedimentNormalMax: 450,
        sedimentWarnHigh: 350, sedimentBadHigh: 450,
      },
    });
    expect(custom).toEqual([]);
  });
});
