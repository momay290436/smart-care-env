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
