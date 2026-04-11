import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Shield, Settings2 } from "lucide-react";

const ALL_PAGES = [
  { key: "/dashboard", label: "Dashboard", icon: "📊" },
  { key: "/maintenance-hub", label: "ระบบแจ้งซ่อม", icon: "🔧" },
  { key: "/maintenance", label: "แจ้งซ่อม", icon: "📝" },
  { key: "/repair-status", label: "สถานะซ่อม", icon: "📋" },
  { key: "/technician-work", label: "งานช่าง", icon: "👷" },
  { key: "/maintenance-admin", label: "จัดการซ่อม", icon: "⚙️" },
  { key: "/5s-hub", label: "5ส. Hub", icon: "⭐" },
  { key: "/5s", label: "ตรวจ 5ส.", icon: "✅" },
  { key: "/env-round", label: "ENV Round", icon: "🌿" },
  { key: "/waste", label: "จัดการขยะ", icon: "🗑️" },
  { key: "/hazmat", label: "สารเคมี", icon: "⚗️" },
  { key: "/safety-hub", label: "ความปลอดภัย", icon: "🛡️" },
  { key: "/fire-safety", label: "อัคคีภัย", icon: "🔥" },
  { key: "/fire-check", label: "ตรวจถังดับเพลิง", icon: "🧯" },
  { key: "/map-hub", label: "แผนที่", icon: "🗺️" },
  { key: "/map", label: "แผนผัง", icon: "📍" },
  { key: "/wayfinding", label: "นำทาง", icon: "🧭" },
  { key: "/wayfinding-admin", label: "จัดการนำทาง", icon: "🗺️" },
  { key: "/map-aligner", label: "จัดแผนที่", icon: "📐" },
  { key: "/water", label: "ระบบจัดการน้ำประปา", icon: "💧" },
  { key: "/water-meter", label: "บันทึกมิเตอร์น้ำ", icon: "🔢" },
  { key: "/admin", label: "จัดการระบบ", icon: "🔑" },
];

export default function PagePermissionsTab() {
  const queryClient = useQueryClient();
  const [editUser, setEditUser] = useState<any>(null);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);

  const { data: users } = useQuery({
    queryKey: ["perm-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*, departments(name)").order("full_name");
      const { data: roles } = await supabase.from("user_roles").select("*");
      const { data: perms } = await supabase.from("page_permissions").select("*");
      return (profiles || []).map((p: any) => ({
        ...p,
        role: roles?.find((r: any) => r.user_id === p.auth_id)?.role || "user",
        permissions: (perms || []).filter((pm: any) => pm.user_id === p.auth_id).map((pm: any) => pm.page_key),
      }));
    },
  });

  const openEdit = (u: any) => {
    setEditUser(u);
    setSelectedPages(u.permissions || []);
  };

  const togglePage = (key: string) => {
    setSelectedPages(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
  };

  const selectAll = () => setSelectedPages(ALL_PAGES.map(p => p.key));
  const clearAll = () => setSelectedPages([]);

  const savePermissions = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      // Delete existing
      await supabase.from("page_permissions").delete().eq("user_id", editUser.auth_id);
      // Insert new
      if (selectedPages.length > 0) {
        const { error } = await supabase.from("page_permissions").insert(
          selectedPages.map(page_key => ({ user_id: editUser.auth_id, page_key }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("บันทึกสิทธิ์สำเร็จ");
      setEditUser(null);
      queryClient.invalidateQueries({ queryKey: ["perm-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const roleLabels: Record<string, string> = {
    admin: "ผู้ดูแลระบบ", user: "ผู้ใช้งาน", technician: "ช่างเทคนิค", manager: "ผู้จัดการ",
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
        <p className="text-sm text-blue-800">
          <strong>หมายเหตุ:</strong> ผู้ดูแลระบบ (Admin) สามารถเข้าถึงทุกหน้าเสมอ หากไม่ได้กำหนดสิทธิ์ให้ผู้ใช้ ผู้ใช้จะสามารถเข้าถึงทุกหน้าได้ (ค่าเริ่มต้น)
        </p>
      </div>

      {users?.filter((u: any) => u.role !== "admin").map((u: any) => (
        <Card key={u.id} className="shadow-card rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base truncate">{u.full_name || "ไม่ระบุชื่อ"}</p>
                <p className="text-sm text-muted-foreground">{u.departments?.name || "-"} · {roleLabels[u.role] || u.role}</p>
                {u.permissions.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="secondary" className="text-xs rounded-2xl">{u.permissions.length} หน้า</Badge>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">เข้าถึงทุกหน้า (ค่าเริ่มต้น)</p>
                )}
              </div>
              <Button variant="outline" size="sm" className="rounded-2xl gap-1.5" onClick={() => openEdit(u)}>
                <Settings2 className="h-4 w-4" /> กำหนดสิทธิ์
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="rounded-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" /> กำหนดสิทธิ์: {editUser?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-2xl text-xs" onClick={selectAll}>เลือกทั้งหมด</Button>
              <Button variant="outline" size="sm" className="rounded-2xl text-xs" onClick={clearAll}>ล้างทั้งหมด</Button>
              <Badge variant="secondary" className="rounded-2xl flex items-center">{selectedPages.length}/{ALL_PAGES.length}</Badge>
            </div>
            <div className="space-y-2">
              {ALL_PAGES.map(page => (
                <label key={page.key} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/50 cursor-pointer transition-colors">
                  <Checkbox checked={selectedPages.includes(page.key)} onCheckedChange={() => togglePage(page.key)} />
                  <span className="text-lg">{page.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{page.label}</p>
                    <p className="text-xs text-muted-foreground">{page.key}</p>
                  </div>
                </label>
              ))}
            </div>
            <Button className="w-full h-12 rounded-2xl text-base font-bold" onClick={() => savePermissions.mutate()} disabled={savePermissions.isPending}>
              {savePermissions.isPending ? "กำลังบันทึก..." : "บันทึกสิทธิ์"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
