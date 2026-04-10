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
import { Pencil, Trash2, Plus, Shield, KeyRound } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

// --- Departments Tab ---
function DepartmentsTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

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
                <Button variant="ghost" size="sm" className="text-destructive rounded-2xl gap-1.5" onClick={() => { if (confirm("ยืนยันลบ?")) deleteDept.mutate(d.id); }}>
                  <Trash2 className="h-3.5 w-3.5" /> ลบ
                </Button>
              </div>
            </div>
            <DeptQrPointsSection departmentId={d.id} departmentName={d.name} />
          </CardContent>
        </Card>
      ))}
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

  const colorOptions = ["สีเขียว", "สีแดง"];
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
        qr_code_data: null,
      }).select().single();
      if (error) throw error;
      // Update qr_code_data with the ID for scanning
      await supabase.from("fire_extinguisher_locations").update({ qr_code_data: newLoc.id }).eq("id", newLoc.id);
    },
    onSuccess: () => {
      toast.success("เพิ่มตำแหน่งสำเร็จ (QR Code สร้างอัตโนมัติ)");
      setName(""); setBuilding(""); setFloor(""); setColor(""); setSize(""); setExtType(""); setFuelType("");
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
  const previewUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-4">
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
        <Button className="w-full h-12 rounded-2xl gap-1.5" onClick={() => addLoc.mutate()} disabled={!name || addLoc.isPending}>
          <Plus className="h-4 w-4" /> เพิ่มตำแหน่ง + สร้าง QR Code
        </Button>
      </div>
      {locations?.map((l: any) => (
        <Card key={l.id} className="shadow-card border-0 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base">{l.name}</p>
                {l.building && <p className="text-sm text-muted-foreground">{l.building} - {l.floor}</p>}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {l.color && <Badge variant="outline" className="text-xs rounded-2xl">{l.color}</Badge>}
                  {l.size && <Badge variant="outline" className="text-xs rounded-2xl">{l.size}</Badge>}
                  {l.extinguisher_type && <Badge variant="outline" className="text-xs rounded-2xl">{l.extinguisher_type}</Badge>}
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="rounded-2xl text-xs" onClick={() => setShowQr(showQr === l.id ? null : l.id)}>QR</Button>
                <Button variant="ghost" size="sm" className="text-destructive rounded-2xl" onClick={() => { if (confirm("ยืนยันลบ?")) deleteLoc.mutate(l.id); }}>
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
                <Button variant="ghost" size="sm" className="text-destructive rounded-2xl" onClick={() => { if (confirm("ยืนยันลบ?")) deleteTicket.mutate(t.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// --- Settings Tab ---
function SettingsTab() {
  const [lineToken, setLineToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "line_notify_token").maybeSingle();
      if (data) setLineToken(data.value);
      setFetching(false);
    };
    fetchSettings();
  }, []);

  const saveToken = async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase.from("app_settings").select("id").eq("key", "line_notify_token").maybeSingle();
      if (existing) {
        await supabase.from("app_settings").update({ value: lineToken }).eq("key", "line_notify_token");
      } else {
        await supabase.from("app_settings").insert({ key: "line_notify_token", value: lineToken });
      }
      toast.success("บันทึก Line Notify Token สำเร็จ");
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const testNotify = async () => {
    try {
      const { error } = await supabase.functions.invoke("line-notify", {
        body: { message: "ทดสอบระบบแจ้งเตือน Smart ENV & 5S" },
      });
      if (error) throw error;
      toast.success("ส่งข้อความทดสอบสำเร็จ");
    } catch (e: any) { toast.error("ส่งไม่สำเร็จ: " + e.message); }
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-card border-0 rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Line Notify</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Token</Label>
            <Input type="password" value={lineToken} onChange={(e) => setLineToken(e.target.value)} placeholder="กรอก Line Notify Token" disabled={fetching} className="h-12 rounded-2xl text-base" />
            <p className="text-sm text-muted-foreground">
              รับ Token ได้ที่ <a href="https://notify-bot.line.me/" target="_blank" rel="noreferrer" className="text-primary underline">notify-bot.line.me</a>
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveToken} disabled={loading} className="flex-1 h-12 rounded-2xl">
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
            <Button variant="outline" className="h-12 rounded-2xl" onClick={testNotify}>ทดสอบ</Button>
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
    <div className="space-y-5">
      <PageHeader title="จัดการระบบ" subtitle="Admin Panel" gradient="from-slate-100/80 to-slate-50/80" />
      <Tabs defaultValue="departments">
        <TabsList className="grid w-full grid-cols-6 h-12 rounded-2xl">
          <TabsTrigger value="departments" className="rounded-2xl text-sm">แผนก</TabsTrigger>
          <TabsTrigger value="locations" className="rounded-2xl text-sm">ถังดับเพลิง</TabsTrigger>
          <TabsTrigger value="users" className="rounded-2xl text-sm">ผู้ใช้</TabsTrigger>
          <TabsTrigger value="permissions" className="rounded-2xl text-sm">สิทธิ์</TabsTrigger>
          <TabsTrigger value="tickets" className="rounded-2xl text-sm">แจ้งซ่อม</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-2xl text-sm">ตั้งค่า</TabsTrigger>
        </TabsList>
        <TabsContent value="departments"><DepartmentsTab /></TabsContent>
        <TabsContent value="locations"><FireLocationsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="permissions"><PagePermissionsTab /></TabsContent>
        <TabsContent value="tickets"><MaintenanceTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
