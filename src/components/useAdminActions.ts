import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAdminDelete(table: string, queryKey: string | string[]) {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบสำเร็จ");
      const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
      keys.forEach((k: string) => queryClient.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return { deleteId, setDeleteId, confirmDelete, isDeleting: deleteMutation.isPending };
}
