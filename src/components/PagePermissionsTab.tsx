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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_PAGES = [
  { key: "/", label: "หน้าแรก", icon: "🏠" },
  { key: "/dashboard", label: "Dashboard", icon: "📊" },
  { key: "/issues", label: "จัดการปัญหา", icon: "🧩" },
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
  { key: "/electricity", label: "ระบบจัดการไฟฟ้า", icon: "⚡" },
  { key: "/admin", label: "จัดการระบบ", icon: "🔑" },
];

// Granular action/button permissions. Stored in the same page_permissions table
// using the "action:*" key prefix so we don't need a new table or migration.
const ACTION_GROUPS: { group: string; items: { key: string; label: string; icon: string }[] }[] = [
  {
    group: "ระบบน้ำประปา",
    items: [
      { key: "action:water-emergency", label: "ปุ่ม “น้ำส่วนกลางไม่ไหล / น้ำไหลแล้ว”", icon: "🚨" },
      { key: "action:water-meter-record", label: "บันทึกมิเตอร์น้ำ", icon: "🔢" },
      { key: "action:water-quality-record", label: "บันทึกผลตรวจคุณภาพน้ำ", icon: "💧" },
      { key: "action:water-disinfectant-record", label: "บันทึกสารเคมีกำจัดเชื้อโรค", icon: "🧪" },
      { key: "action:water-pathogen-record", label: "บันทึกผลตรวจเชื้อจุลินทรีย์", icon: "🦠" },
      { key: "action:wastewater-daily-record", label: "ตรวจระบบบำบัดน้ำเสียประจำวัน", icon: "♻️" },
      { key: "action:wastewater-stats-record", label: "บันทึกสถิติระบบบำบัดน้ำเสีย", icon: "📈" },
    ],
  },
  {
    group: "งานสิ่งแวดล้อม / 5ส.",
    items: [
      { key: "action:waste-record", label: "บันทึกข้อมูลขยะ", icon: "🗑️" },
      { key: "action:infectious-waste-record", label: "บันทึกขยะติดเชื้อ", icon: "☣️" },
      { key: "action:5s-audit-create", label: "บันทึกตรวจ 5ส.", icon: "✅" },
      { key: "action:env-round-create", label: "บันทึกตรวจ ENV Round", icon: "🌿" },
    ],
  },
  {
    group: "ระบบไฟฟ้า / มิเตอร์",
    items: [
      { key: "action:electricity-record", label: "บันทึกเลขมิเตอร์ไฟฟ้า", icon: "⚡" },
      { key: "action:electricity-settings", label: "ตั้งค่าระบบไฟฟ้า (จัดการมิเตอร์/สถานที่ติดตั้ง)", icon: "⚙️" },
      { key: "action:electricity-meter-manage", label: "เพิ่ม/จัดการสถานที่ติดตั้งมิเตอร์", icon: "🏢" },
      { key: "action:electricity-pending-check", label: "ตรวจสถานที่ค้างลงมิเตอร์", icon: "🔍" },
      { key: "action:electricity-export", label: "ส่งออกรายงานค่าไฟ", icon: "📄" },
    ],
  },
  {
    group: "จัดการปัญหา",
    items: [
      { key: "action:issue-create", label: "เพิ่มปัญหาที่พบ", icon: "➕" },
      { key: "action:issue-manage", label: "จัดการ/อัพเดตสถานะปัญหา", icon: "🛠️" },
    ],
  },
  {
    group: "อัคคีภัย / ซ่อมบำรุง",
    items: [
      { key: "action:fire-check-create", label: "บันทึกตรวจถังดับเพลิง", icon: "🧯" },
      { key: "action:maintenance-request-create", label: "แจ้งซ่อม", icon: "📝" },
      { key: "action:maintenance-approve", label: "อนุมัติ/มอบหมายงานซ่อม", icon: "👷" },
    ],
  },
  {
    group: "การจัดการข้อมูล (ขั้นสูง)",
    items: [
      { key: "action:edit-history", label: "แก้ไขประวัติการบันทึก", icon: "✏️" },
      { key: "action:delete-records", label: "ลบข้อมูลในระบบ", icon: "🗑️" },
      { key: "action:export-excel", label: "ส่งออกข้อมูลเป็น Excel", icon: "📤" },
      { key: "action:backdate-records", label: "บันทึกย้อนหลัง (เลือกวัน/เวลา/ผู้บันทึก)", icon: "🕒" },
    ],
  },
];
const ALL_ACTIONS = ACTION_GROUPS.flatMap(g => g.items);

export default function PagePermissionsTab() {
  const queryClient = useQueryClient();
  const [editUser, setEditUser] = useState<any>(null);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [editRole, setEditRole] = useState<string>("user");
  const [editSimplified, setEditSimplified] = useState<boolean>(false);

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
    setEditRole(u.role || "user");
    setEditSimplified(!!u.simplified_mode);
  };

  const togglePage = (key: string) => {
    setSelectedPages(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
  };

  const selectAll = () => setSelectedPages(ALL_PAGES.map(p => p.key));
  const clearAll = () => setSelectedPages([]);
  const selectAllActions = () => setSelectedPages(prev => Array.from(new Set([...prev, ...ALL_ACTIONS.map(a => a.key)])));
  const clearAllActions = () => setSelectedPages(prev => prev.filter(k => !k.startsWith("action:")));

  const savePermissions = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      // Update role - delete old then insert new to avoid constraint issues
      await supabase.from("user_roles").delete().eq("user_id", editUser.auth_id);
      const { error: rErr } = await supabase
        .from("user_roles")
        .insert({ user_id: editUser.auth_id, role: editRole as any });
      if (rErr) throw rErr;
      // Update simplified flag on profile
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ simplified_mode: editSimplified })
        .eq("auth_id", editUser.auth_id);
      if (pErr) throw pErr;
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
      toast.success("บันทึกสิทธิ์ผู้ใช้สำเร็จ");
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
          <strong>คำแนะนำ:</strong> Admin = เข้าถึงทุกหน้า · Manager = ดูข้อมูล/Dashboard · Staff (โหมดบันทึก) = เห็นเฉพาะปุ่มลัดสำหรับบันทึกข้อมูลที่ได้รับสิทธิ์เท่านั้น (ไม่มีเมนู)
        </p>
      </div>

      {users?.map((u: any) => (
        <Card key={u.id} className="shadow-card rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base truncate">{u.full_name || "ไม่ระบุชื่อ"}</p>
                <p className="text-sm text-muted-foreground">{u.departments?.name || "-"} · {roleLabels[u.role] || u.role}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {u.simplified_mode && (
                    <Badge className="text-[10px] rounded-2xl bg-amber-100 text-amber-700 border-0">โหมดบันทึก</Badge>
                  )}
                  {u.permissions.length > 0 ? (
                    <Badge variant="secondary" className="text-xs rounded-2xl">{u.permissions.length} หน้า</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs rounded-2xl">เข้าถึงทุกหน้า</Badge>
                  )}
                </div>
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
            <div className="rounded-2xl border border-border p-3 space-y-3 bg-muted/30">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">บทบาท (Role)</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — เข้าถึงทุกหน้า + ตั้งค่าระบบ</SelectItem>
                    <SelectItem value="manager">Manager — ดู Dashboard / สรุปข้อมูล</SelectItem>
                    <SelectItem value="user">Staff / User — บันทึกข้อมูล</SelectItem>
                    <SelectItem value="technician">ช่างเทคนิค</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-3">
                <div>
                  <p className="text-sm font-semibold">โหมดบันทึก (Staff Simplified Mode)</p>
                  <p className="text-[11px] text-muted-foreground">ซ่อนเมนูทั้งหมด เห็นเฉพาะปุ่มลัดบันทึกข้อมูลที่กำหนด</p>
                </div>
                <Switch checked={editSimplified} onCheckedChange={setEditSimplified} />
              </div>
            </div>

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

            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold">สิทธิ์ระดับปุ่ม / การกระทำ</p>
                  <p className="text-[11px] text-muted-foreground">เลือกเฉพาะปุ่มหรือการกระทำที่อนุญาตให้ผู้ใช้คนนี้ใช้งานได้</p>
                </div>
                <Badge variant="secondary" className="rounded-2xl">
                  {selectedPages.filter(k => k.startsWith("action:")).length}/{ALL_ACTIONS.length}
                </Badge>
              </div>
              <div className="flex gap-2 mb-3">
                <Button variant="outline" size="sm" className="rounded-2xl text-xs" onClick={selectAllActions}>เลือกทุกปุ่ม</Button>
                <Button variant="outline" size="sm" className="rounded-2xl text-xs" onClick={clearAllActions}>ล้างปุ่มทั้งหมด</Button>
              </div>
              <div className="space-y-3">
                {ACTION_GROUPS.map(group => (
                  <div key={group.group} className="rounded-2xl border border-border p-3 bg-muted/20">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{group.group}</p>
                    <div className="space-y-1">
                      {group.items.map(item => (
                        <label key={item.key} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white cursor-pointer transition-colors">
                          <Checkbox checked={selectedPages.includes(item.key)} onCheckedChange={() => togglePage(item.key)} />
                          <span className="text-base">{item.icon}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.label}</p>
                            <p className="text-[10px] text-muted-foreground">{item.key}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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
