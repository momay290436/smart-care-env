export interface InfectiousWasteAggregateSyncPlan {
  idsToDelete: string[];
  payload: {
    waste_type: "infectious";
    weight: number;
    department_id: string | null;
    recorded_by: string;
    created_at: string;
  };
}

export interface MergeInfectiousWasteRecordsWithLogsParams {
  wasteLogsData: Array<{ waste_type?: string | null; weight?: number | string | null; created_at?: string | null }>;
  infectiousRecords: Array<{ collection_date?: string | null; sharp_waste_kg?: number | string | null; non_sharp_waste_kg?: number | string | null; created_at?: string | null }>;
}

export function mergeInfectiousWasteRecordsWithLogs({
  wasteLogsData,
  infectiousRecords,
}: MergeInfectiousWasteRecordsWithLogsParams) {
  const existingInfKeys = new Set(
    (wasteLogsData || [])
      .filter((l) => (l.waste_type || "").toString().toLowerCase().includes("infect") || l.waste_type === "infectious")
      .map((l) => `${(l.created_at || "").substring(0, 10)}|${Number(l.weight || 0)}`)
  );

  const extraInf = (infectiousRecords || [])
    .map((r) => {
      const w = Number(r.sharp_waste_kg || 0) + Number(r.non_sharp_waste_kg || 0);
      const day = r.collection_date || (r.created_at || "").substring(0, 10);
      if (!day || w <= 0) return null;
      const key = `${day}|${w}`;
      if (existingInfKeys.has(key)) return null;
      return { waste_type: "infectious", weight: w, created_at: `${day}T08:00:00` };
    })
    .filter(Boolean) as Array<{ waste_type: string; weight: number; created_at: string }>;

  return [...(wasteLogsData || []), ...extraInf];
}

function formatCollectionDay(collectionDate: Date) {
  const year = collectionDate.getFullYear();
  const month = String(collectionDate.getMonth() + 1).padStart(2, "0");
  const day = String(collectionDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildInfectiousWasteAggregateSyncPlan({
  collectionDate,
  totalKg,
  departmentId,
  userId,
  existingLogs,
  createdAt,
}: {
  collectionDate: Date;
  totalKg: number;
  departmentId: string | null;
  userId: string;
  existingLogs: Array<{ id: string; waste_type?: string | null; created_at?: string | null }>;
  createdAt: string;
}): InfectiousWasteAggregateSyncPlan {
  const collectionDay = formatCollectionDay(collectionDate);
  const idsToDelete = (existingLogs || [])
    .filter((log) => {
      const logDate = log.created_at ? log.created_at.slice(0, 10) : null;
      return log.waste_type === "infectious" && logDate === collectionDay;
    })
    .map((log) => log.id);

  return {
    idsToDelete,
    payload: {
      waste_type: "infectious",
      weight: Number(totalKg.toFixed(2)),
      department_id: departmentId || null,
      recorded_by: userId,
      created_at: createdAt,
    },
  };
}

export function subscribeToWasteDataChanges({
  supabaseClient,
  queryClient,
  channelName,
}: {
  supabaseClient: any;
  queryClient: any;
  channelName: string;
}) {
  const channel = supabaseClient.channel(channelName);

  const invalidateWasteQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["waste-logs"] });
    queryClient.invalidateQueries({ queryKey: ["waste-filtered"] });
    queryClient.invalidateQueries({ queryKey: ["waste-history"] });
    queryClient.invalidateQueries({ queryKey: ["infectious-waste"] });
  };

  channel.on("postgres_changes", { event: "*", schema: "public", table: "waste_logs" }, () => {
    invalidateWasteQueries();
  });

  channel.on("postgres_changes", { event: "*", schema: "public", table: "infectious_waste_records" }, () => {
    invalidateWasteQueries();
  });

  channel.subscribe();

  return () => {
    supabaseClient.removeChannel(channel);
  };
}

export async function syncInfectiousWasteAggregateToWasteLogs({
  supabaseClient,
  collectionDate,
  totalKg,
  departmentId,
  userId,
  createdAt,
  existingLogs,
}: {
  supabaseClient: any;
  collectionDate: Date;
  totalKg: number;
  departmentId: string | null;
  userId: string;
  createdAt: string;
  existingLogs: Array<{ id: string; waste_type?: string | null; created_at?: string | null }>;
}) {
  const plan = buildInfectiousWasteAggregateSyncPlan({
    collectionDate,
    totalKg,
    departmentId,
    userId,
    existingLogs,
    createdAt,
  });

  if (plan.idsToDelete.length > 0) {
    const { error: deleteError } = await supabaseClient.from("waste_logs").delete().in("id", plan.idsToDelete);
    if (deleteError) throw deleteError;
  }

  if (Number(totalKg) > 0) {
    const { error: insertError } = await supabaseClient.from("waste_logs").insert(plan.payload);
    if (insertError) throw insertError;
  }

  return plan;
}
