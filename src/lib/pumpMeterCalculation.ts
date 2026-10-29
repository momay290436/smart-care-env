export const PUMP_EFFECTIVE_POWER_KW = 2.2;

export function calculatePumpHours(latestReading: number, previousReading: number | null): number | null {
  if (previousReading === null || !Number.isFinite(latestReading) || !Number.isFinite(previousReading)) return null;
  const unitsUsed = latestReading - previousReading;
  if (unitsUsed <= 0) return 0;
  return Math.round((unitsUsed / PUMP_EFFECTIVE_POWER_KW) * 100) / 100;
}
