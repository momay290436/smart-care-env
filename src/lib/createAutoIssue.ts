import { supabase } from "@/integrations/supabase/client";

export interface AnomalyData {
  sourceModule: string;
  sourceId: string | null;
  title: string;
  description?: string;
  severity?: "high" | "medium" | "low";
  department?: string;
  createdBy?: string;
}

export async function createAutoIssue(data: AnomalyData) {
  try {
    const { error } = await supabase.from("issues").insert({
      source_module: data.sourceModule,
      source_id: data.sourceId,
      title: data.title,
      description: data.description || null,
      severity: data.severity || "medium",
      department_name: data.department || null,
      created_by: data.createdBy || null,
      status: "open",
    });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error("Failed to create auto issue:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Determines if an anomaly exists based on check results
 * For Fire Extinguisher: fails if pressure or condition is not OK
 */
export function hasFireCheckAnomaly(
  pressureOk: boolean,
  conditionOk: boolean
): boolean {
  return !pressureOk || !conditionOk;
}

/**
 * Determines if an anomaly exists based on 5S audit score
 * Fails if score is below 70%
 */
export function has5SAnomalyByScore(score: number): boolean {
  return score < 70;
}

/**
 * Determines if an anomaly exists based on ENV round item
 * Fails if status is explicitly "fail"
 */
export function hasEnvRoundAnomaly(status: string): boolean {
  return status === "fail" || status === "failed";
}

/**
 * Determines if an anomaly exists based on water quality log
 * Fails if status is explicitly "fail"
 */
export function hasWaterQualityAnomaly(status: string): boolean {
  return status === "fail" || status === "failed";
}

/**
 * Get severity level based on anomaly type and details
 */
export function getIssueSeverity(
  sourceModule: string,
  details?: any
): "high" | "medium" | "low" {
  if (sourceModule === "FireCheck") {
    return "high"; // Fire safety is always high priority
  } else if (sourceModule === "Audit5S") {
    const score = details?.score || 0;
    return score < 50 ? "high" : score < 70 ? "medium" : "low";
  } else if (sourceModule === "EnvRound" || sourceModule === "WaterManagement") {
    return "medium";
  }
  return "medium";
}
