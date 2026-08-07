export type AlertLevel = "warn" | "bad";

export interface RuleAlert {
  level: AlertLevel;
  text: string;
}

export interface WaterThresholds {
  potable: {
    chlorineMin: number;
    chlorineMax: number;
    phMin: number;
    phMax: number;
    turbidityMax: number;
  };
  wastewater: {
    chlorineMin: number;
    chlorineMax: number;
    phMin: number;
    phMax: number;
    doMin: number;
    doMax: number;
    doWarnMin: number;
    sedimentBadLow: number;
    sedimentWarnLow: number;
    sedimentNormalMin: number;
    sedimentNormalMax: number;
    sedimentWarnHigh: number;
    sedimentBadHigh: number;
  };
}

export const DEFAULT_THRESHOLDS: WaterThresholds = {
  potable: { chlorineMin: 0.2, chlorineMax: 0.5, phMin: 6.5, phMax: 8.5, turbidityMax: 5 },
  wastewater: {
    chlorineMin: 0.5,
    chlorineMax: 1.0,
    phMin: 6.5,
    phMax: 8.5,
    doMin: 2,
    doMax: 3,
    doWarnMin: 1,
    sedimentBadLow: 100,
    sedimentWarnLow: 200,
    sedimentNormalMin: 250,
    sedimentNormalMax: 450,
    sedimentWarnHigh: 350,
    sedimentBadHigh: 450,
  },
};

export const mergeThresholds = (raw: unknown): WaterThresholds => {
  const t = (raw && typeof raw === "object" ? raw : {}) as any;
  return {
    potable: { ...DEFAULT_THRESHOLDS.potable, ...(t.potable || {}) },
    wastewater: { ...DEFAULT_THRESHOLDS.wastewater, ...(t.wastewater || {}) },
  };
};

const range = (min: number, max: number) => `ค่าปกติ ${min}–${max}`;

export const getWaterAlertLevel = (
  chlorine: number | null,
  ph: number | null,
  turbidity: number | null,
  thresholds: WaterThresholds = DEFAULT_THRESHOLDS,
): RuleAlert[] => {
  const p = thresholds.potable;
  const alerts: RuleAlert[] = [];
  if (chlorine !== null && chlorine < p.chlorineMin) {
    alerts.push({ level: "bad", text: `ค่าคลอรีนต่ำกว่าค่าปกติ (${chlorine} mg/L | ${range(p.chlorineMin, p.chlorineMax)})` });
  }
  if (chlorine !== null && chlorine > p.chlorineMax) {
    alerts.push({ level: "bad", text: `ค่าคลอรีนเกินค่าปกติ (${chlorine} mg/L | ${range(p.chlorineMin, p.chlorineMax)})` });
  }
  if (ph !== null && (ph < p.phMin || ph > p.phMax)) {
    alerts.push({ level: "bad", text: `ค่า pH ผิดปกติ (${ph} | ${range(p.phMin, p.phMax)})` });
  }
  if (turbidity !== null && turbidity > p.turbidityMax) {
    alerts.push({ level: "warn", text: `ค่าความขุ่นเกินค่าปกติ (${turbidity} NTU | ค่าปกติ ≤ ${p.turbidityMax})` });
  }
  return alerts;
};

export const getDisinfectantAlertLevel = (
  sourceConcentration: number | null,
  sourcePh: number | null,
  outletConcentration: number | null,
  outletPh: number | null,
  thresholds: WaterThresholds = DEFAULT_THRESHOLDS,
): RuleAlert[] => {
  const p = thresholds.potable;
  const alerts: RuleAlert[] = [];
  const clRange = range(p.chlorineMin, p.chlorineMax);
  const phRange = range(p.phMin, p.phMax);
  if (sourceConcentration !== null && sourceConcentration < p.chlorineMin) {
    alerts.push({ level: "bad", text: `คลอรีนต้นทางต่ำกว่าค่าปกติ (${sourceConcentration} mg/L | ${clRange})` });
  }
  if (sourceConcentration !== null && sourceConcentration > p.chlorineMax) {
    alerts.push({ level: "bad", text: `คลอรีนต้นทางเกินค่าปกติ (${sourceConcentration} mg/L | ${clRange})` });
  }
  if (outletConcentration !== null && outletConcentration < p.chlorineMin) {
    alerts.push({ level: "bad", text: `คลอรีนปลายทางต่ำกว่าค่าปกติ (${outletConcentration} mg/L | ${clRange})` });
  }
  if (outletConcentration !== null && outletConcentration > p.chlorineMax) {
    alerts.push({ level: "bad", text: `คลอรีนปลายทางเกินค่าปกติ (${outletConcentration} mg/L | ${clRange})` });
  }
  if (sourcePh !== null && (sourcePh < p.phMin || sourcePh > p.phMax)) {
    alerts.push({ level: "bad", text: `pH ต้นทางผิดปกติ (${sourcePh} | ${phRange})` });
  }
  if (outletPh !== null && (outletPh < p.phMin || outletPh > p.phMax)) {
    alerts.push({ level: "bad", text: `pH ปลายทางผิดปกติ (${outletPh} | ${phRange})` });
  }
  return alerts;
};

export const getWastewaterAlertLevel = (
  chlorine: number | null,
  ph: number | null,
  doValue: number | null,
  thresholds: WaterThresholds = DEFAULT_THRESHOLDS,
): RuleAlert[] => {
  const w = thresholds.wastewater;
  const alerts: RuleAlert[] = [];
  if (chlorine !== null && chlorine < w.chlorineMin) {
    alerts.push({ level: "warn", text: `ค่าคลอรีนต่ำกว่าค่าปกติ (${chlorine} mg/L | ${range(w.chlorineMin, w.chlorineMax)})` });
  }
  if (chlorine !== null && chlorine > w.chlorineMax) {
    alerts.push({ level: "bad", text: `ค่าคลอรีนเกินค่าปกติ (${chlorine} mg/L | ${range(w.chlorineMin, w.chlorineMax)})` });
  }
  if (ph !== null && (ph < w.phMin || ph > w.phMax)) {
    alerts.push({ level: "bad", text: `ค่า pH ผิดปกติ (${ph} | ${range(w.phMin, w.phMax)})` });
  }
  if (doValue !== null) {
    const doRange = range(w.doMin, w.doMax);
    if (doValue < w.doWarnMin || doValue > w.doMax) {
      alerts.push({
        level: "bad",
        text: `ค่า DO ${doValue > w.doMax ? "เกินค่าปกติ" : "ต่ำกว่าค่าปกติ"} (${doValue} mg/L | ${doRange})`,
      });
    } else if (doValue < w.doMin) {
      alerts.push({ level: "warn", text: `ค่า DO ต่ำกว่าค่าปกติ (${doValue} mg/L | ${doRange})` });
    }
  }
  return alerts;
};

export const getSedimentAlertLevel = (
  sediment: number | null,
  thresholds: WaterThresholds = DEFAULT_THRESHOLDS,
): RuleAlert | null => {
  if (sediment === null || Number.isNaN(sediment)) return null;
  const w = thresholds.wastewater;
  const sedRange = range(w.sedimentNormalMin, w.sedimentNormalMax);
  if (sediment < w.sedimentBadLow) {
    return { level: "bad", text: `ค่าตะกอนต่ำกว่าค่าปกติ (${sediment} | ${sedRange})` };
  }
  if (sediment > w.sedimentBadHigh) {
    return { level: "bad", text: `ค่าตะกอนเกินค่าปกติ (${sediment} | ${sedRange})` };
  }
  if ((sediment > w.sedimentBadLow && sediment < w.sedimentWarnLow) || (sediment > w.sedimentWarnHigh && sediment <= w.sedimentBadHigh)) {
    return { level: "warn", text: `ค่าตะกอนผิดปกติ (${sediment} | ${sedRange})` };
  }
  return null;
};
