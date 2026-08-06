import { describe, expect, it } from "vitest";
import { buildInfectiousWasteAggregateSyncPlan, mergeInfectiousWasteRecordsWithLogs } from "./infectiousWasteSync";

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

describe("mergeInfectiousWasteRecordsWithLogs", () => {
  it("does not add a duplicate infectious entry when the same day already has a summary row", () => {
    const merged = mergeInfectiousWasteRecordsWithLogs({
      wasteLogsData: [{ waste_type: "infectious", weight: 7.5, created_at: "2026-07-15T08:00:00.000Z" }],
      infectiousRecords: [{ collection_date: "2026-07-15", sharp_waste_kg: 3, non_sharp_waste_kg: 4.5 }],
    });

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ waste_type: "infectious", weight: 7.5, created_at: "2026-07-15T08:00:00.000Z" });
  });
});
