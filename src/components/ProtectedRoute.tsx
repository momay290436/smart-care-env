import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Pages that all authenticated users can always access
const ALWAYS_ALLOWED = ["/", "/login"];

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, user, loading, isAdmin } = useAuth();
  const location = useLocation();

  const { data: permissions, isLoading: permLoading } = useQuery({
    queryKey: ["my-page-permissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("page_permissions")
        .select("page_key")
        .eq("user_id", user.id);
      return (data || []).map((p: any) => p.page_key);
    },
    enabled: !!user && !isAdmin,
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  // Admin always has access to everything
  if (isAdmin) return <>{children}</>;

  // Always allowed pages
  if (ALWAYS_ALLOWED.includes(location.pathname)) return <>{children}</>;

  // Wait for permissions to load
  if (permLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // If user has no permissions set at all, allow everything (backwards compatible)
  if (!permissions || permissions.length === 0) return <>{children}</>;

  // Check if current path is in allowed pages
  const currentPath = location.pathname;
  if (permissions.includes(currentPath)) return <>{children}</>;

  // Not allowed
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-3">
        <div className="text-5xl">🔒</div>
        <h2 className="text-xl font-bold text-foreground">ไม่มีสิทธิ์เข้าถึง</h2>
        <p className="text-muted-foreground">คุณไม่ได้รับอนุญาตให้เข้าถึงหน้านี้ กรุณาติดต่อผู้ดูแลระบบ</p>
        <Navigate to="/" replace />
      </div>
    </div>
  );
}
