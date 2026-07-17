import { describe, expect, it } from "vitest";
import { buildInfectiousWasteAggregateSyncPlan } from "./infectiousWasteSync";

describe("buildInfectiousWasteAggregateSyncPlan", () => {
  it("marks existing infectious summary rows for the same collection day for replacement", () => {
    const collectionDate = new Date("2026-07-15T00:00:00.000Z");
    const plan = buildInfectiousWasteAggregateSyncPlan({
      collectionDate,
      totalKg: 12.5,
      departmentId: "dept-1",
      userId: "user-1",
      existingLogs: [
        { id: "old-1", waste_type: "infectious", created_at: "2026-07-15T08:00:00.000Z" },
        { id: "old-2", waste_type: "general", created_at: "2026-07-15T09:00:00.000Z" },
        { id: "old-3", waste_type: "infectious", created_at: "2026-07-16T08:00:00.000Z" },
      ],
      createdAt: "2026-07-15T08:00:00.000Z",
    });

    expect(plan.idsToDelete).toEqual(["old-1"]);
    expect(plan.payload).toMatchObject({
      waste_type: "infectious",
      weight: 12.5,
      department_id: "dept-1",
      recorded_by: "user-1",
      created_at: "2026-07-15T08:00:00.000Z",
    });
  });
});
