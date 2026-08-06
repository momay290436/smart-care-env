export type AlertLevel = "warn" | "bad";

export interface RuleAlert {
  level: AlertLevel;
  text: string;
}

export const getWaterAlertLevel = (chlorine: number | null, ph: number | null, turbidity: number | null): RuleAlert[] => {
  const alerts: RuleAlert[] = [];
  if (chlorine !== null && chlorine < 0.2) {
    alerts.push({ level: "warn", text: `ค่าคลอรีนต่ำกว่าค่าปกติ (${chlorine} mg/L | ค่าปกติ 0.2–0.5)` });
  }
  if (chlorine !== null && chlorine > 0.5) {
    alerts.push({ level: "bad", text: `ค่าคลอรีนเกินค่าปกติ (${chlorine} mg/L | ค่าปกติ 0.2–0.5)` });
  }
  if (ph !== null && (ph < 6.5 || ph > 8.5)) {
    alerts.push({ level: "warn", text: `ค่า pH ผิดปกติ (${ph} | ค่าปกติ 6.5–8.5)` });
  }
  if (turbidity !== null && turbidity > 5) {
    alerts.push({ level: "warn", text: `ค่าความขุ่นเกินค่าปกติ (${turbidity} NTU | ค่าปกติ ≤ 5)` });
  }
  return alerts;
};

export const getWastewaterAlertLevel = (chlorine: number | null, ph: number | null, doValue: number | null): RuleAlert[] => {
  const alerts: RuleAlert[] = [];
  if (chlorine !== null && chlorine < 0.5) {
    alerts.push({ level: "warn", text: `ค่าคลอรีนต่ำกว่าค่าปกติ (${chlorine} mg/L | ค่าปกติ 0.5–1.0)` });
  }
  if (chlorine !== null && chlorine > 1.0) {
    alerts.push({ level: "bad", text: `ค่าคลอรีนเกินค่าปกติ (${chlorine} mg/L | ค่าปกติ 0.5–1.0)` });
  }
  if (ph !== null && (ph < 6.5 || ph > 8.5)) {
    alerts.push({ level: "warn", text: `ค่า pH ผิดปกติ (${ph} | ค่าปกติ 6.5–8.5)` });
  }
  if (doValue !== null && doValue < 2) {
    alerts.push({ level: "warn", text: `ค่า DO ต่ำกว่าค่าปกติ (${doValue} mg/L | ค่าปกติ ≥ 2)` });
  }
  return alerts;
};

export const getSedimentAlertLevel = (sediment: number | null): RuleAlert | null => {
  if (sediment === null || Number.isNaN(sediment)) return null;
  if (sediment < 200) {
    return { level: "warn", text: `ค่าตะกอนต่ำกว่าค่าปกติ (${sediment} | ค่าปกติ 250–450)` };
  }
  if (sediment > 350) {
    return { level: "warn", text: `ค่าตะกอนเกินค่าปกติ (${sediment} | ค่าปกติ 250–450)` };
  }
  return null;
};
