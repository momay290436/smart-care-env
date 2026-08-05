import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import PagePermissionsTab from "@/components/PagePermissionsTab";
import DeptQrPointsSection from "@/components/DeptQrPointsSection";
import ConfirmDialog from "@/components/ConfirmDialog";
import FireQrPrintDialog from "@/components/FireQrPrintDialog";
import { Pencil, Trash2, Plus, Shield, KeyRound, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Checkbox } from "@/components/ui/checkbox";

// --- Departments Tab ---
function DepartmentsTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => { const { data } = await supabase.from("departments").select("*").order("name"); return data || []; },
  });

  const addDept = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("departments").insert({ name }); if (error) throw error; },
    onSuccess: () => { toast.success("เพิ่มแผนกสำเร็จ"); setName(""); queryClient.invalidateQueries({ queryKey: ["departments"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateDept = useMutation({
    mutationFn: async () => { if (!editId) return; const { error } = await supabase.from("departments").update({ name: editName }).eq("id", editId); if (error) throw error; },
    onSuccess: () => { toast.success("แก้ไขสำเร็จ"); setEditId(null); setDialogOpen(false); queryClient.invalidateQueries({ queryKey: ["departments"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDept = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("departments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("ลบแผนกสำเร็จ"); queryClient.invalidateQueries({ queryKey: ["departments"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อแผนกใหม่" className="flex-1 h-12 rounded-2xl text-base" />
        <Button className="h-12 rounded-2xl gap-1.5 px-5" onClick={() => addDept.mutate()} disabled={!name || addDept.isPending}>
          <Plus className="h-4 w-4" /> เพิ่ม
        </Button>
      </div>
      {departments?.map((d) => (
        <Card key={d.id} className="shadow-card border-0 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-base">{d.name}</span>
              <div className="flex gap-2">
                <Dialog open={dialogOpen && editId === d.id} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditId(null); }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-2xl gap-1.5" onClick={() => { setEditId(d.id); setEditName(d.name); setDialogOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" /> แก้ไข
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-3xl">
                    <DialogHeader><DialogTitle>แก้ไขแผนก</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-12 rounded-2xl" />
                      <Button className="w-full h-12 rounded-2xl" onClick={() => updateDept.mutate()}>บันทึก</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="ghost" size="sm" className="text-destructive rounded-2xl gap-1.5" onClick={() => setDeleteId(d.id)}>
                  <Trash2 className="h-3.5 w-3.5" /> ลบ
                </Button>
              </div>
            </div>
            <DeptQrPointsSection departmentId={d.id} departmentName={d.name} />
          </CardContent>
        </Card>
      ))}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="ลบแผนก"
        description="ยืนยันการลบแผนกนี้? ข้อมูลที่เชื่อมโยงอาจได้รับผลกระทบ"
        confirmLabel="ลบ"
        onConfirm={() => { if (deleteId) { deleteDept.mutate(deleteId); setDeleteId(null); } }}
      />
    </div>
  );
}

// --- Users Tab ---
function UsersTab() {
  const queryClient = useQueryClient();
  const [editUser, setEditUser] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editDeptId, setEditDeptId] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [showAddUser, setShowAddUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newDeptId, setNewDeptId] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [creating, setCreating] = useState(false);
  const [pwUser, setPwUser] = useState<any>(null);
  const [newPw, setNewPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*, departments(name)").order("full_name");
      const { data: roles } = await supabase.from("user_roles").select("*");
      return (profiles || []).map((p: any) => ({
        ...p,
        role: roles?.find((r: any) => r.user_id === p.auth_id)?.role || "user",
        roleId: roles?.find((r: any) => r.user_id === p.auth_id)?.id,
      }));
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => { const { data } = await supabase.from("departments").select("*").order("name"); return data || []; },
  });

  const createUser = async () => {
    if (!newEmail || !newPassword) { toast.error("กรุณากรอกอีเมลและรหัสผ่าน"); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { email: newEmail, password: newPassword, full_name: newName, department_id: newDeptId || null, role: newRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("เพิ่มผู้ใช้สำเร็จ");
      setShowAddUser(false);
      setNewEmail(""); setNewPassword(""); setNewName(""); setNewDeptId(""); setNewRole("user");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setCreating(false); }
  };


  const updateProfile = useMutation({
    mutationFn: async ({ id, full_name, department_id, auth_id, role }: { id: string; full_name: string; department_id: string | null; auth_id: string; role: "admin" | "user" | "technician" | "manager" }) => {
      const { error } = await supabase.from("profiles").update({ full_name, department_id: department_id || null }).eq("id", id);
      if (error) throw error;
      // Also update role
      const { error: roleErr } = await supabase.from("user_roles").update({ role }).eq("user_id", auth_id);
      if (roleErr) throw roleErr;
    },
    onSuccess: () => { toast.success("แก้ไขสำเร็จ"); setEditUser(null); queryClient.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const changePassword = async () => {
    if (!pwUser || !newPw || newPw.length < 6) { toast.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    setChangingPw(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "update_password", user_id: pwUser.auth_id, password: newPw },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("เปลี่ยนรหัสผ่านสำเร็จ");
      setPwUser(null); setNewPw("");
    } catch (e: any) { toast.error(e.message); }
    finally { setChangingPw(false); }
  };

  const deleteUser = async (u: any) => {
    if (!confirm(`ยืนยันลบผู้ใช้ "${u.full_name || u.auth_id}"? การดำเนินการนี้ไม่สามารถย้อนกลับได้`)) return;
    setDeleting(u.auth_id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: { action: "delete_user", user_id: u.auth_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("ลบผู้ใช้สำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setDeleting(null); }
  };

  const roleColors: Record<string, string> = {
    admin: "bg-red-100 text-red-700",
    user: "bg-blue-100 text-blue-700",
    technician: "bg-amber-100 text-amber-700",
    manager: "bg-purple-100 text-purple-700",
  };

  const roleLabels: Record<string, string> = {
    admin: "ผู้ดูแลระบบ",
    user: "ผู้ใช้งาน",
    technician: "ช่างเทคนิค",
    manager: "ผู้จัดการ",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users?.length || 0} ผู้ใช้ทั้งหมด</p>
        <Button className="rounded-2xl gap-1.5 h-11" onClick={() => setShowAddUser(true)}>
          <Plus className="h-4 w-4" /> เพิ่มผู้ใช้ใหม่
        </Button>
      </div>

      {/* Add user dialog */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle className="text-lg">เพิ่มผู้ใช้งานใหม่</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-sm font-semibold">ชื่อ-นามสกุล</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ชื่อ-นามสกุล" className="h-12 rounded-2xl" /></div>
            <div><Label className="text-sm font-semibold">อีเมล *</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@hospital.go.th" required className="h-12 rounded-2xl" /></div>
            <div><Label className="text-sm font-semibold">รหัสผ่าน *</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" required className="h-12 rounded-2xl" /></div>
            <div><Label className="text-sm font-semibold">แผนก</Label>
              <Select value={newDeptId} onValueChange={setNewDeptId}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="เลือกแผนก" /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-sm font-semibold">สิทธิ์</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="user">ผู้ใช้งาน (User)</SelectItem>
                  <SelectItem value="admin">ผู้ดูแลระบบ (Admin)</SelectItem>
                  <SelectItem value="technician">ช่างเทคนิค (Technician)</SelectItem>
                  <SelectItem value="manager">ผู้จัดการ (Manager)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full h-12 rounded-2xl text-base font-bold" onClick={createUser} disabled={creating}>
              {creating ? "กำลังสร้าง..." : "สร้างผู้ใช้งาน"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* User list */}
      {users?.map((u: any) => (
        <Card key={u.id} className="shadow-card rounded-2xl">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base truncate">{u.full_name || "ไม่ระบุชื่อ"}</p>
                <p className="text-sm text-muted-foreground">{u.departments?.name || "ไม่มีแผนก"}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${roleColors[u.role] || roleColors.user} rounded-2xl text-xs`}>
                  <Shield className="h-3 w-3 mr-1" />{roleLabels[u.role] || u.role}
                </Badge>
                <Button variant="outline" size="sm" className="rounded-2xl gap-1" onClick={() => { setPwUser(u); setNewPw(""); }}>
                  <KeyRound className="h-3.5 w-3.5" /> รหัสผ่าน
                </Button>
                <Button variant="outline" size="sm" className="rounded-2xl gap-1" onClick={() => { setEditUser(u); setEditName(u.full_name); setEditDeptId(u.department_id || ""); setEditRole(u.role); }}>
                  <Pencil className="h-3.5 w-3.5" /> แก้ไข
                </Button>
                <Button variant="ghost" size="sm" className="rounded-2xl gap-1 text-destructive hover:text-destructive" onClick={() => deleteUser(u)} disabled={deleting === u.auth_id}>
                  <Trash2 className="h-3.5 w-3.5" /> {deleting === u.auth_id ? "กำลังลบ..." : "ลบ"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {(!users || users.length === 0) && <p className="text-center text-muted-foreground py-8 text-base">ยังไม่มีผู้ใช้ในระบบ</p>}

      {/* Edit user dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>แก้ไขข้อมูลผู้ใช้</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-sm font-semibold">ชื่อ-นามสกุล</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-12 rounded-2xl" /></div>
            <div><Label className="text-sm font-semibold">แผนก</Label>
              <Select value={editDeptId} onValueChange={setEditDeptId}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="เลือกแผนก" /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="">- ไม่ระบุ -</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-sm font-semibold">สิทธิ์การใช้งาน</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="user">ผู้ใช้งาน (User)</SelectItem>
                  <SelectItem value="admin">ผู้ดูแลระบบ (Admin)</SelectItem>
                  <SelectItem value="technician">ช่างเทคนิค (Technician)</SelectItem>
                  <SelectItem value="manager">ผู้จัดการ (Manager)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full h-12 rounded-2xl text-base font-bold" onClick={() => updateProfile.mutate({ id: editUser.id, full_name: editName, department_id: editDeptId || null, auth_id: editUser.auth_id, role: editRole as "admin" | "user" | "technician" | "manager" })}>
              บันทึกการเปลี่ยนแปลง
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change password dialog */}
      <Dialog open={!!pwUser} onOpenChange={() => setPwUser(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>เปลี่ยนรหัสผ่าน</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">เปลี่ยนรหัสผ่านสำหรับ: <strong className="text-foreground">{pwUser?.full_name || "ผู้ใช้"}</strong></p>
            <div><Label className="text-sm font-semibold">รหัสผ่านใหม่</Label><Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" className="h-12 rounded-2xl" /></div>
            <Button className="w-full h-12 rounded-2xl text-base font-bold" onClick={changePassword} disabled={changingPw || newPw.length < 6}>
              {changingPw ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Fire Locations Tab ---
function FireLocationsTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [extType, setExtType] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [manufactureYear, setManufactureYear] = useState("");

  const colorOptions = ["สีเขียว", "สีแดง", "สีบอร์น"];
  const sizeOptions = ["5 ปอนด์", "10 ปอนด์", "15 ปอนด์", "20 ปอนด์"];
  const typeOptions = [
    "ถังดับเพลิงชนิดผงเคมีแห้ง (Dry Chemical)",
    "ถังดับเพลิงชนิดก๊าซคาร์บอนไดออกไซด์ (CO2)",
    "ถังดับเพลิงชนิดสารสะอาด (Clean Agent/HCFC-123)",
  ];

  const fuelTypeMap: Record<string, string> = {
    "ถังดับเพลิงชนิดผงเคมีแห้ง (Dry Chemical)": "Class A: ไม้, กระดาษ, ผ้า, พลาสติก / Class B: น้ำมันเชื้อเพลิง, ก๊าซหุงต้ม, สารไวไฟ / Class C: อุปกรณ์ไฟฟ้าที่มีกระแสไฟไหลอยู่",
    "ถังดับเพลิงชนิดก๊าซคาร์บอนไดออกไซด์ (CO2)": "Class B: สารไวไฟ, ทินเนอร์, น้ำมัน / Class C: อุปกรณ์ไฟฟ้า, ห้องเซิร์ฟเวอร์, เครื่องจักร (ไม่ทิ้งคราบ)",
    "ถังดับเพลิงชนิดสารสะอาด (Clean Agent/HCFC-123)": "Class A, B และ C (ครอบคลุมคล้ายผงเคมีแห้งแต่สะอาดกว่า ไม่ทิ้งคราบ เหมาะกับอุปกรณ์อิเล็กทรอนิกส์)",
  };

  // Auto-set fuel type when extinguisher type changes
  const handleExtTypeChange = (val: string) => {
    setExtType(val);
    if (fuelTypeMap[val]) setFuelType(fuelTypeMap[val]);
  };

  const { data: locations } = useQuery({
    queryKey: ["fire-locations"],
    queryFn: async () => { const { data } = await supabase.from("fire_extinguisher_locations").select("*").order("name"); return data || []; },
  });

  const addLoc = useMutation({
    mutationFn: async () => {
      const { data: newLoc, error } = await supabase.from("fire_extinguisher_locations").insert({
        name, building: building || null, floor: floor || null,
        color: color || null, size: size || null,
        extinguisher_type: extType || null, fuel_type: fuelType || null,
        manufacture_year: manufactureYear || null,
        qr_code_data: null,
      }).select().single();
      if (error) throw error;
      // Update qr_code_data with the ID for scanning
      await supabase.from("fire_extinguisher_locations").update({ qr_code_data: newLoc.id }).eq("id", newLoc.id);
    },
    onSuccess: () => {
      toast.success("เพิ่มตำแหน่งสำเร็จ (QR Code สร้างอัตโนมัติ)");
      setName(""); setBuilding(""); setFloor(""); setColor(""); setSize(""); setExtType(""); setFuelType(""); setManufactureYear("");
      queryClient.invalidateQueries({ queryKey: ["fire-locations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteLoc = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("fire_extinguisher_locations").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("ลบสำเร็จ"); queryClient.invalidateQueries({ queryKey: ["fire-locations"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const [showQr, setShowQr] = useState<string | null>(null);
  const [deleteLocId, setDeleteLocId] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const previewUrl = typeof window !== "undefined" ? window.location.origin : "";

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllLocs = () => {
    if (selectedIds.size === (locations?.length || 0)) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set((locations || []).map((l: any) => l.id)));
    }
  };

  const downloadSelectedQRs = async () => {
    if (selectedIds.size === 0) { toast.info("กรุณาเลือกรายการก่อน"); return; }
    const selected = (locations || []).filter((l: any) => selectedIds.has(l.id));
    // Generate a printable HTML with all selected QRs
    let html = `<html><head><meta charset="utf-8"><title>QR Codes ถังดับเพลิง</title><style>
      body{font-family:sans-serif;padding:20px}
      .qr-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px}
      .qr-card{border:1px solid #ddd;border-radius:12px;padding:16px;text-align:center;page-break-inside:avoid}
      .qr-card h3{font-size:14px;margin:0 0 4px}
      .qr-card p{font-size:11px;color:#666;margin:2px 0}
      .qr-label{font-size:10px;font-weight:bold;margin:8px 0 4px;color:#333}
      svg{margin:0 auto}
      @media print{.no-print{display:none}}
    </style></head><body>
    <h2 style="text-align:center">QR Codes ถังดับเพลิง (${selected.length} รายการ)</h2>
    <button class="no-print" onclick="window.print()" style="display:block;margin:12px auto;padding:8px 24px;background:#0891b2;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">🖨️ พิมพ์</button>
    <div class="qr-grid">`;
    selected.forEach((l: any) => {
      html += `<div class="qr-card">
        <h3>${l.name}</h3>
        <p>${l.building || ""} ${l.floor ? "ชั้น " + l.floor : ""}</p>
        <div style="display:flex;gap:16px;justify-content:center;margin-top:8px">
          <div><p class="qr-label">QR ตรวจสอบ</p><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(l.id)}" width="120" height="120"/></div>
          <div><p class="qr-label">QR ข้อมูล</p><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(previewUrl + "/fire-info/" + l.id)}" width="120" height="120"/></div>
        </div>
      </div>`;
    });
    html += `</div></body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        {selectedIds.size > 0 && (
          <Button variant="default" size="sm" className="rounded-2xl gap-1.5 h-10" onClick={downloadSelectedQRs}>
            <Printer className="h-4 w-4" /> ดาวน์โหลด QR ({selectedIds.size} รายการ)
          </Button>
        )}
        <Button variant="outline" size="sm" className="rounded-2xl gap-1.5 h-10 text-xs" onClick={selectAllLocs}>
          {selectedIds.size === (locations?.length || 0) ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
        </Button>
        <Button variant="outline" size="sm" className="rounded-2xl gap-1.5 h-10 border-primary/30 text-primary" onClick={() => setPrintOpen(true)}>
          <Printer className="h-4 w-4" /> พิมพ์สติกเกอร์ QR
        </Button>
      </div>
      <div className="space-y-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อตำแหน่ง" className="h-12 rounded-2xl text-base" />
        <div className="grid grid-cols-2 gap-3">
          <Input value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="อาคาร" className="rounded-2xl" />
          <Input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="ชั้น" className="rounded-2xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger className="rounded-2xl"><SelectValue placeholder="สีถัง" /></SelectTrigger>
            <SelectContent className="rounded-2xl">{colorOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger className="rounded-2xl"><SelectValue placeholder="ขนาด" /></SelectTrigger>
            <SelectContent className="rounded-2xl">{sizeOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Select value={extType} onValueChange={handleExtTypeChange}>
          <SelectTrigger className="rounded-2xl"><SelectValue placeholder="ชนิดถังดับเพลิง" /></SelectTrigger>
          <SelectContent className="rounded-2xl">{typeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        {fuelType && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">ประเภทเชื้อเพลิง (กำหนดอัตโนมัติ)</p>
            <p className="text-sm text-amber-900">{fuelType}</p>
          </div>
        )}
        <div>
          <Label className="text-sm font-semibold">ปีที่ผลิต</Label>
          <Input value={manufactureYear} onChange={(e) => setManufactureYear(e.target.value)} placeholder="เช่น 2565" className="rounded-2xl" />
        </div>
        <Button className="w-full h-12 rounded-2xl gap-1.5" onClick={() => addLoc.mutate()} disabled={!name || addLoc.isPending}>
          <Plus className="h-4 w-4" /> เพิ่มตำแหน่ง + สร้าง QR Code
        </Button>
      </div>
      {locations?.map((l: any) => (
        <Card key={l.id} className="shadow-card border-0 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <Checkbox
                  checked={selectedIds.has(l.id)}
                  onCheckedChange={() => toggleSelect(l.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                <p className="font-semibold text-base">{l.name}</p>
                {l.building && <p className="text-sm text-muted-foreground">{l.building} - {l.floor}</p>}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {l.color && <Badge variant="outline" className="text-xs rounded-2xl">{l.color}</Badge>}
                  {l.size && <Badge variant="outline" className="text-xs rounded-2xl">{l.size}</Badge>}
                  {l.extinguisher_type && <Badge variant="outline" className="text-xs rounded-2xl">{l.extinguisher_type}</Badge>}
                </div>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="rounded-2xl text-xs" onClick={() => setShowQr(showQr === l.id ? null : l.id)}>QR</Button>
                <Button variant="ghost" size="sm" className="text-destructive rounded-2xl" onClick={() => setDeleteLocId(l.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {showQr === l.id && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-xl bg-muted/30">
                  <p className="text-xs font-semibold mb-2 text-foreground">QR ตรวจสอบ (ใช้ในแอป)</p>
                  <QRCodeSVG value={l.id} size={120} className="mx-auto" />
                  <Button variant="link" size="sm" className="text-xs mt-1" onClick={() => downloadQR(l.id, `check-${l.name}`)}>ดาวน์โหลด</Button>
                </div>
                <div className="text-center p-3 rounded-xl bg-muted/30">
                  <p className="text-xs font-semibold mb-2 text-foreground">QR ข้อมูล (สแกนทั่วไป)</p>
                  <QRCodeSVG value={`${previewUrl}/fire-info/${l.id}`} size={120} className="mx-auto" />
                  <Button variant="link" size="sm" className="text-xs mt-1" onClick={() => downloadQR(`${previewUrl}/fire-info/${l.id}`, `info-${l.name}`)}>ดาวน์โหลด</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      <ConfirmDialog
        open={!!deleteLocId}
        onOpenChange={(o) => !o && setDeleteLocId(null)}
        title="ลบตำแหน่งถังดับเพลิง"
        description="ยืนยันการลบตำแหน่งนี้?"
        confirmLabel="ลบ"
        onConfirm={() => { if (deleteLocId) { deleteLoc.mutate(deleteLocId); setDeleteLocId(null); } }}
      />
      <FireQrPrintDialog open={printOpen} onOpenChange={setPrintOpen} locations={locations || []} />
    </div>
  );
}

function downloadQR(data: string, filename: string) {
  const canvas = document.createElement("canvas");
  const size = 300;
  canvas.width = size;
  canvas.height = size;
  // Use the existing QR on screen - find SVG and convert
  const svgEl = document.querySelector(`[data-qr="${data}"]`) as SVGSVGElement | null;
  if (!svgEl) {
    // fallback: just copy the data as text
    toast.info("กรุณาสกรีนช็อต QR Code");
    return;
  }
}


// --- Maintenance Tab ---
function MaintenanceTab() {
  const queryClient = useQueryClient();

  const { data: tickets } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: async () => { const { data } = await supabase.from("maintenance_tickets").select("*, departments(name)").order("created_at", { ascending: false }).limit(50); return data || []; },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => { const { error } = await supabase.from("maintenance_tickets").update({ status }).eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("อัปเดตสำเร็จ"); queryClient.invalidateQueries({ queryKey: ["admin-tickets"] }); },
  });

  const deleteTicket = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("maintenance_tickets").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("ลบสำเร็จ"); queryClient.invalidateQueries({ queryKey: ["admin-tickets"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const [deleteTicketId, setDeleteTicketId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {tickets?.map((t: any) => (
        <Card key={t.id} className="shadow-card border-0 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-base">{t.title}</p>
                <p className="text-sm text-muted-foreground">{t.departments?.name} · {new Date(t.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={t.status} onValueChange={(v: string) => updateStatus.mutate({ id: t.id, status: v })}>
                  <SelectTrigger className="h-9 w-28 text-sm rounded-2xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="pending">รอ</SelectItem>
                    <SelectItem value="in_progress">กำลังทำ</SelectItem>
                    <SelectItem value="completed">เสร็จ</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" className="text-destructive rounded-2xl" onClick={() => setDeleteTicketId(t.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <ConfirmDialog
        open={!!deleteTicketId}
        onOpenChange={(o) => !o && setDeleteTicketId(null)}
        title="ลบใบแจ้งซ่อม"
        description="ยืนยันการลบใบแจ้งซ่อมนี้?"
        confirmLabel="ลบ"
        onConfirm={() => { if (deleteTicketId) { deleteTicket.mutate(deleteTicketId); setDeleteTicketId(null); } }}
      />
    </div>
  );
}

// --- Settings Tab ---
function SettingsTab() {
  return <SettingsTabInner />;
}

// --- Issue Areas Tab ---
function IssueAreasTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: areas = [] } = useQuery({
    queryKey: ["issue-areas"],
    queryFn: async () => { const { data } = await supabase.from("issue_areas").select("*").order("name"); return data || []; },
  });

  const addArea = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("issue_areas").insert({ name: name.trim() }); if (error) throw error; },
    onSuccess: () => { toast.success("เพิ่มพื้นที่สำเร็จ"); setName(""); queryClient.invalidateQueries({ queryKey: ["issue-areas"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateArea = useMutation({
    mutationFn: async () => { if (!editId) return; const { error } = await supabase.from("issue_areas").update({ name: editName.trim() }).eq("id", editId); if (error) throw error; },
    onSuccess: () => { toast.success("แก้ไขสำเร็จ"); setEditId(null); queryClient.invalidateQueries({ queryKey: ["issue-areas"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteArea = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("issue_areas").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("ลบสำเร็จ"); queryClient.invalidateQueries({ queryKey: ["issue-areas"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">จัดการรายการ "แผนก / พื้นที่" สำหรับดรอปดาวน์ในหน้าจัดการปัญหา</p>
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อพื้นที่/แผนกใหม่" className="flex-1 h-12 rounded-2xl text-base" />
        <Button className="h-12 rounded-2xl gap-1.5 px-5" onClick={() => addArea.mutate()} disabled={!name.trim() || addArea.isPending}>
          <Plus className="h-4 w-4" /> เพิ่ม
        </Button>
      </div>
      {areas.map((a: any) => (
        <Card key={a.id} className="shadow-card border-0 rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between gap-2">
            {editId === a.id ? (
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 h-11 rounded-2xl" />
            ) : (
              <span className="font-medium text-base">{a.name}</span>
            )}
            <div className="flex gap-2">
              {editId === a.id ? (
                <>
                  <Button size="sm" className="rounded-2xl" onClick={() => updateArea.mutate()}>บันทึก</Button>
                  <Button size="sm" variant="ghost" className="rounded-2xl" onClick={() => setEditId(null)}>ยกเลิก</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="rounded-2xl gap-1.5" onClick={() => { setEditId(a.id); setEditName(a.name); }}>
                    <Pencil className="h-3.5 w-3.5" /> แก้ไข
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive rounded-2xl gap-1.5" onClick={() => setDeleteId(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" /> ลบ
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      {areas.length === 0 && <p className="text-center text-muted-foreground py-8">ยังไม่มีรายการ</p>}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="ลบพื้นที่"
        description="ยืนยันการลบพื้นที่นี้?"
        confirmLabel="ลบ"
        onConfirm={() => { if (deleteId) { deleteArea.mutate(deleteId); setDeleteId(null); } }}
      />
    </div>
  );
}

type LineRouteSetting = {
  id: string;
  scopeType: "department" | "role" | "all";
  scopeValue: string;
  provider: "line_notify_token" | "line_channel_token";
  token: string;
  recipients: string;
};

// --- Settings Tab Inner ---
function SettingsTabInner() {
  const [notifyToken, setNotifyToken] = useState("");
  const [channelToken, setChannelToken] = useState("");
  const [lineRoutes, setLineRoutes] = useState<LineRouteSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [testRecipient, setTestRecipient] = useState("");
  const [profileRecipients, setProfileRecipients] = useState<any[]>([]);
  const [settingsError, setSettingsError] = useState("");

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => { const { data } = await supabase.from("departments").select("*").order("name"); return data || []; },
  });

  const roleOptions = [
    { value: "admin", label: "Admin" },
    { value: "manager", label: "Manager" },
    { value: "technician", label: "Technician" },
    { value: "user", label: "User" },
  ];

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setSettingsError("");
        const [notifyRes, channelRes, routesRes, profilesRes, roleRes] = await Promise.allSettled([
          supabase.from("app_settings").select("value").eq("key", "line_notify_token").maybeSingle(),
          supabase.from("app_settings").select("value").eq("key", "line_channel_token").maybeSingle(),
          supabase.from("app_settings").select("value").eq("key", "line_notification_routes").maybeSingle(),
          supabase.from("profiles").select("id, auth_id, full_name, department_id, departments(name)").order("full_name"),
          supabase.from("user_roles").select("user_id, role"),
        ]);

        const notifyData = notifyRes.status === "fulfilled" ? notifyRes.value.data : null;
        const channelData = channelRes.status === "fulfilled" ? channelRes.value.data : null;
        const routesData = routesRes.status === "fulfilled" ? routesRes.value.data : null;
        const profilesData = profilesRes.status === "fulfilled" ? profilesRes.value.data : null;
        const roleData = roleRes.status === "fulfilled" ? roleRes.value.data : null;

        if (notifyData) setNotifyToken(notifyData.value || "");
        if (channelData) setChannelToken(channelData.value || "");

        const profiles = (profilesData || []).map((profile: any) => ({
          ...profile,
          departments: profile.departments?.name || "-",
          role: (roleData || []).find((r: any) => r.user_id === profile.auth_id)?.role || "user",
        }));

        const resolvedRecipients = await Promise.allSettled(profiles.map(async (profile: any) => {
          const { data: tech } = await supabase
            .from("technicians")
            .select("line_user_id")
            .eq("user_id", profile.auth_id)
            .maybeSingle();
          return { ...profile, line_user_id: tech?.line_user_id || "" };
        }));

        setProfileRecipients(resolvedRecipients
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value));

        let parsedRoutes: LineRouteSetting[] = [];
        if (routesData?.value) {
          try {
            const parsed = JSON.parse(routesData.value);
            if (Array.isArray(parsed)) parsedRoutes = parsed.filter(Boolean);
          } catch {}
        }

        if (parsedRoutes.length === 0) {
          const fallbackScope = departments[0]?.id || "";
          parsedRoutes = [{ id: `route-${Date.now()}`, scopeType: "department", scopeValue: fallbackScope, provider: "line_notify_token", token: "", recipients: "" }];
        }

        setLineRoutes(parsedRoutes);
      } catch (error: any) {
        console.error("Failed to load settings", error);
        setSettingsError(error?.message || "ไม่สามารถโหลดข้อมูลการตั้งค่าได้");
      } finally {
        setFetching(false);
      }
    };

    fetchSettings();
  }, []);

  const addRoute = () => {
    setLineRoutes((current) => [
      ...current,
      {
        id: `route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        scopeType: "department",
        scopeValue: departments[0]?.id || "",
        provider: "line_notify_token",
        token: "",
        recipients: "",
      },
    ]);
  };

  const updateRoute = <K extends keyof LineRouteSetting>(routeId: string, field: K, value: LineRouteSetting[K]) => {
    setLineRoutes((current) => current.map((route) => route.id === routeId ? { ...route, [field]: value } : route));
  };

  const removeRoute = (routeId: string) => {
    setLineRoutes((current) => current.filter((route) => route.id !== routeId));
  };

  const saveTokens = async () => {
    setLoading(true);
    try {
      const notifyExisting = await supabase.from("app_settings").select("id").eq("key", "line_notify_token").maybeSingle();
      if (notifyExisting.data) {
        await supabase.from("app_settings").update({ value: notifyToken }).eq("key", "line_notify_token");
      } else {
        await supabase.from("app_settings").insert({ key: "line_notify_token", value: notifyToken });
      }

      const channelExisting = await supabase.from("app_settings").select("id").eq("key", "line_channel_token").maybeSingle();
      if (channelExisting.data) {
        await supabase.from("app_settings").update({ value: channelToken }).eq("key", "line_channel_token");
      } else {
        await supabase.from("app_settings").insert({ key: "line_channel_token", value: channelToken });
      }

      toast.success("บันทึก Line Token สำเร็จ");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const saveRoutes = async () => {
    setLoading(true);
    try {
      const filteredRoutes = lineRoutes
        .filter((route) => route.scopeValue || route.scopeType === "all")
        .map((route) => ({
          ...route,
          recipients: route.recipients
            .split(/[\n,]/)
            .map((item) => item.trim())
            .filter(Boolean)
            .join(","),
        }));

      const { data: existing } = await supabase.from("app_settings").select("id").eq("key", "line_notification_routes").maybeSingle();
      const value = JSON.stringify(filteredRoutes);
      if (existing) {
        await supabase.from("app_settings").update({ value }).eq("key", "line_notification_routes");
      } else {
        await supabase.from("app_settings").insert({ key: "line_notification_routes", value });
      }
      toast.success("บันทึกการกำหนดผู้รับ LINE ตามแผนก/บทบาทสำเร็จ");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const appendRecipient = (routeId: string, profileLabel: string, lineUserId: string) => {
    if (!lineUserId) {
      toast.info(`${profileLabel} ยังไม่มี LINE User ID`);
      return;
    }

    setLineRoutes((current) => current.map((route) => {
      if (route.id !== routeId) return route;
      const existingRecipients = route.recipients.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
      const nextRecipients = existingRecipients.includes(lineUserId) ? existingRecipients : [...existingRecipients, lineUserId];
      return { ...route, recipients: nextRecipients.join(",") };
    }));
  };

  const testNotify = async () => {
    try {
      const recipientIds = testRecipient ? [testRecipient] : [];
      const { error } = await supabase.functions.invoke("line-notify", {
        body: {
          message: "🔔 ทดสอบระบบแจ้งเตือน Smart ENV & 5S\nข้อความนี้เป็นตัวอย่างเพื่อยืนยันการส่ง LINE ให้ผู้รับที่เลือกไว้",
          recipient_ids: recipientIds,
        },
      });
      if (error) throw error;
      toast.success("ส่งข้อความทดสอบสำเร็จ");
    } catch (e: any) {
      toast.error("ส่งไม่สำเร็จ: " + e.message);
    }
  };

  if (fetching) {
    return (
      <div className="space-y-4">
        <Card className="shadow-card border-0 rounded-2xl">
          <CardContent className="p-6 text-sm text-muted-foreground">กำลังโหลดการตั้งค่า LINE...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {settingsError && (
        <Card className="shadow-card border-0 rounded-2xl border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">{settingsError}</CardContent>
        </Card>
      )}
      <Card className="shadow-card border-0 rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Line Token (Global)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm">Line Notify Token</Label>
              <Input type="password" value={notifyToken} onChange={(e) => setNotifyToken(e.target.value)} placeholder="กรอก Line Notify Token" disabled={fetching} className="h-12 rounded-2xl text-base" />
              <p className="text-sm text-muted-foreground">รับ Token ได้ที่ <a href="https://notify-bot.line.me/" target="_blank" rel="noreferrer" className="text-primary underline">notify-bot.line.me</a></p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Line Channel Token</Label>
              <Input type="password" value={channelToken} onChange={(e) => setChannelToken(e.target.value)} placeholder="กรอก Line Channel Token" disabled={fetching} className="h-12 rounded-2xl text-base" />
              <p className="text-sm text-muted-foreground">สำหรับส่งไปยังผู้รับตาม LINE User ID หรือ Broadcast</p>
            </div>
          </div>
          <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">ตัวอย่างการทดสอบส่ง LINE</p>
                <p className="text-xs text-muted-foreground">ข้อความต่อไปนี้จะถูกส่งโดยตรง เพื่อยืนยันความพร้อมก่อนใช้งานจริง</p>
              </div>
            </div>
            <div className="rounded-xl bg-white px-3 py-2 text-sm text-muted-foreground border border-border">
              🔔 ทดสอบระบบแจ้งเตือน Smart ENV & 5S\nข้อความนี้เป็นตัวอย่างเพื่อยืนยันการส่ง LINE ให้ผู้รับที่เลือกไว้
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm">เลือกผู้รับจากโปรไฟล์ผู้ใช้</Label>
                <Select value={testRecipient} onValueChange={setTestRecipient}>
                  <SelectTrigger className="h-11 rounded-2xl"><SelectValue placeholder="เลือกผู้รับทดสอบ" /></SelectTrigger>
                  <SelectContent>
                    {profileRecipients.map((profile: any) => (
                      <SelectItem key={profile.auth_id} value={profile.line_user_id || ""} disabled={!profile.line_user_id}>
                        {profile.full_name} — {profile.departments} — {profile.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" className="h-11 rounded-2xl flex-1" onClick={testNotify}>ทดสอบการส่ง LINE</Button>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveTokens} disabled={loading} className="flex-1 h-12 rounded-2xl">
              {loading ? "กำลังบันทึก..." : "บันทึก Token"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card border-0 rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">กำหนดผู้รับ LINE ตามแผนก/บทบาท</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lineRoutes.map((route, index) => (
            <div key={route.id} className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Rule #{index + 1}</span>
                <Button variant="ghost" size="sm" className="text-destructive rounded-2xl" onClick={() => removeRoute(route.id)} disabled={lineRoutes.length === 1}>ลบ</Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm">เลือกกลุ่มเป้าหมาย</Label>
                  <Select value={route.scopeType} onValueChange={(value) => updateRoute(route.id, "scopeType", value as LineRouteSetting["scopeType"])}>
                    <SelectTrigger className="h-11 rounded-2xl"><SelectValue placeholder="เลือกกลุ่ม" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="department">แผนก</SelectItem>
                      <SelectItem value="role">บทบาทผู้ใช้</SelectItem>
                      <SelectItem value="all">ทุกคน</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">ค่าเป้าหมาย</Label>
                  {route.scopeType === "department" ? (
                    <Select value={route.scopeValue} onValueChange={(value) => updateRoute(route.id, "scopeValue", value)}>
                      <SelectTrigger className="h-11 rounded-2xl"><SelectValue placeholder="เลือกแผนก" /></SelectTrigger>
                      <SelectContent>
                        {departments.map((dept: any) => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : route.scopeType === "role" ? (
                    <Select value={route.scopeValue} onValueChange={(value) => updateRoute(route.id, "scopeValue", value)}>
                      <SelectTrigger className="h-11 rounded-2xl"><SelectValue placeholder="เลือกบทบาท" /></SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((role) => (<SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={route.scopeValue} onChange={(e) => updateRoute(route.id, "scopeValue", e.target.value)} placeholder="ทุกคน" className="h-11 rounded-2xl" />
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm">ช่องทาง LINE</Label>
                  <Select value={route.provider} onValueChange={(value) => updateRoute(route.id, "provider", value as LineRouteSetting["provider"])}>
                    <SelectTrigger className="h-11 rounded-2xl"><SelectValue placeholder="เลือกช่องทาง" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line_notify_token">LINE Notify Token</SelectItem>
                      <SelectItem value="line_channel_token">LINE Channel Token</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Token</Label>
                  <Input type="password" value={route.token} onChange={(e) => updateRoute(route.id, "token", e.target.value)} placeholder="กรอก Token ของช่องทางนี้" className="h-11 rounded-2xl" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">LINE User ID / ผู้รับ</Label>
                <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <Input value={route.recipients} onChange={(e) => updateRoute(route.id, "recipients", e.target.value)} placeholder="คั่นด้วยเครื่องหมาย , หรือเว้นบรรทัด" className="h-11 rounded-2xl" />
                  <Select onValueChange={(value) => {
                    const selected = profileRecipients.find((profile: any) => profile.auth_id === value);
                    if (selected?.line_user_id) {
                      appendRecipient(route.id, selected.full_name, selected.line_user_id);
                    }
                  }}>
                    <SelectTrigger className="h-11 rounded-2xl md:w-[260px]"><SelectValue placeholder="เลือกจาก user profile" /></SelectTrigger>
                    <SelectContent>
                      {profileRecipients.map((profile: any) => (
                        <SelectItem key={profile.auth_id} value={profile.auth_id} disabled={!profile.line_user_id}>
                          {profile.full_name} — {profile.departments} — {profile.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">เลือกจาก user profile เพื่อเติม LINE User ID ให้เร็วขึ้น สำหรับ LINE Channel Token ให้ใส่ LINE User ID ของผู้รับที่ต้องการ ส่งได้หลายคนโดยคั่นด้วยเครื่องหมาย ,</p>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-11 rounded-2xl" onClick={addRoute}>+ เพิ่ม Rule</Button>
            <Button onClick={saveRoutes} disabled={loading} className="h-11 rounded-2xl">บันทึก Rule</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card border-0 rounded-2xl">
        <CardContent className="flex items-center gap-3 p-4">
          <div>
            <p className="font-medium text-base">เวอร์ชัน 1.0</p>
            <p className="text-sm text-muted-foreground">Smart ENV & 5S Hospital Management</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Main Admin Page ---
export default function AdminPage() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="w-full space-y-5">
      <PageHeader title="จัดการระบบ" subtitle="Admin Panel" />
      <Tabs defaultValue="departments" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-6 h-auto rounded-2xl bg-muted/60 shadow-sm p-1 gap-1">
          <TabsTrigger value="departments" className="rounded-xl text-xs md:text-sm py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white">แผนก</TabsTrigger>
          <TabsTrigger value="locations" className="rounded-xl text-xs md:text-sm py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white">ถังดับเพลิง</TabsTrigger>
          <TabsTrigger value="users" className="rounded-xl text-xs md:text-sm py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white">ผู้ใช้</TabsTrigger>
          <TabsTrigger value="permissions" className="rounded-xl text-xs md:text-sm py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white">สิทธิ์</TabsTrigger>
          <TabsTrigger value="tickets" className="rounded-xl text-xs md:text-sm py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white">แจ้งซ่อม</TabsTrigger>
          <TabsTrigger value="issue-areas" className="rounded-xl text-xs md:text-sm py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white">พื้นที่ปัญหา</TabsTrigger>
        </TabsList>
        <TabsContent value="departments"><DepartmentsTab /></TabsContent>
        <TabsContent value="locations"><FireLocationsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="permissions"><PagePermissionsTab /></TabsContent>
        <TabsContent value="tickets"><MaintenanceTab /></TabsContent>
        <TabsContent value="issue-areas"><IssueAreasTab /></TabsContent>
      </Tabs>
    </div>
  );
}
