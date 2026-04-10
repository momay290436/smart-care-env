import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Camera } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// --- Equipment Tab ---
function EquipmentTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [qrImage, setQrImage] = useState<File | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["equipment-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("equipment_categories").select("*").order("name");
      return data || [];
    },
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").order("name");
      return data || [];
    },
  });

  const { data: equipment } = useQuery({
    queryKey: ["equipment-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("equipment")
        .select("*, equipment_categories(name), departments(name)")
        .order("name");
      return data || [];
    },
  });

  const addEquipment = useMutation({
    mutationFn: async () => {
      let qrImageUrl = null;
      if (qrImage) {
        const ext = qrImage.name.split(".").pop();
        const path = `qr-codes/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("photos").upload(path, qrImage);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("photos").getPublicUrl(path);
        qrImageUrl = data.publicUrl;
      }

      const { error } = await supabase.from("equipment").insert({
        name,
        code,
        category_id: categoryId || null,
        department_id: departmentId || null,
        qr_image_url: qrImageUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("เพิ่มอุปกรณ์สำเร็จ");
      setName(""); setCode(""); setCategoryId(""); setDepartmentId(""); setQrImage(null);
      queryClient.invalidateQueries({ queryKey: ["equipment-list"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteEquipment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบอุปกรณ์สำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["equipment-list"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Category management
  const [newCat, setNewCat] = useState("");
  const addCategory = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("equipment_categories").insert({ name: newCat });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("เพิ่มหมวดหมู่สำเร็จ");
      setNewCat("");
      queryClient.invalidateQueries({ queryKey: ["equipment-categories"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Add category */}
      <div className="flex gap-2">
        <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="หมวดหมู่ใหม่" className="flex-1" />
        <Button size="sm" onClick={() => addCategory.mutate()} disabled={!newCat}>
          <Plus className="h-4 w-4 mr-1" />หมวด
        </Button>
      </div>

      {/* Add equipment form */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <p className="font-semibold text-sm">เพิ่มอุปกรณ์ใหม่</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่ออุปกรณ์" />
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="รหัสประจำเครื่อง" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="หมวดหมู่" /></SelectTrigger>
              <SelectContent>
                {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue placeholder="แผนก" /></SelectTrigger>
              <SelectContent>
                {departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-border p-2 text-xs">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{qrImage ? qrImage.name.slice(0, 25) : "อัปโหลดรูป QR Code"}</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setQrImage(e.target.files?.[0] || null)} />
          </label>
          <Button className="w-full" size="sm" onClick={() => addEquipment.mutate()} disabled={!name || !code || addEquipment.isPending}>
            <Plus className="h-4 w-4 mr-1" />เพิ่มอุปกรณ์
          </Button>
        </CardContent>
      </Card>

      {/* Equipment list */}
      {equipment?.map((eq: any) => (
        <Card key={eq.id} className="border-0 shadow-sm">
          <CardContent className="flex items-center justify-between p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{eq.name}</p>
              <p className="text-[10px] text-muted-foreground">
                รหัส: {eq.code} • {eq.equipment_categories?.name || "-"} • {eq.departments?.name || "-"}
              </p>
              {eq.qr_code_url && (
                <p className="text-[10px] text-primary truncate">{eq.qr_code_url}</p>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("ยืนยันการลบ?")) deleteEquipment.mutate(eq.id); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// --- Technicians Tab ---
function TechniciansTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [lineId, setLineId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [userId, setUserId] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["equipment-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("equipment_categories").select("*").order("name");
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("full_name");
      return data || [];
    },
  });

  const { data: technicians } = useQuery({
    queryKey: ["technicians-list"],
    queryFn: async () => {
      const { data } = await supabase.from("technicians").select("*, equipment_categories(name)").order("name");
      return data || [];
    },
  });

  const addTech = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("technicians").insert({
        name,
        user_id: userId,
        line_user_id: lineId || null,
        category_id: categoryId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("เพิ่มช่างสำเร็จ");
      setName(""); setLineId(""); setCategoryId(""); setUserId("");
      queryClient.invalidateQueries({ queryKey: ["technicians-list"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTech = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("technicians").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบช่างสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["technicians-list"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <p className="font-semibold text-sm">เพิ่มช่างซ่อม</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อช่าง" />
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger><SelectValue placeholder="เลือกผู้ใช้" /></SelectTrigger>
            <SelectContent>
              {profiles?.map((p) => <SelectItem key={p.auth_id} value={p.auth_id}>{p.full_name || p.auth_id}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={lineId} onChange={(e) => setLineId(e.target.value)} placeholder="LINE User ID" />
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="หมวดหมู่ที่รับผิดชอบ" /></SelectTrigger>
            <SelectContent>
              {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="w-full" size="sm" onClick={() => addTech.mutate()} disabled={!name || !userId || addTech.isPending}>
            <Plus className="h-4 w-4 mr-1" />เพิ่มช่าง
          </Button>
        </CardContent>
      </Card>

      {technicians?.map((t: any) => (
        <Card key={t.id} className="border-0 shadow-sm">
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="text-sm font-medium">{t.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {t.equipment_categories?.name || "ไม่ระบุหมวด"} {t.line_user_id ? `• LINE: ${t.line_user_id.slice(0, 10)}...` : ""}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("ยืนยันการลบ?")) deleteTech.mutate(t.id); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// --- Users/Roles Tab ---
function UsersRolesTab() {
  const queryClient = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ["admin-users-roles"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*, departments(name)").order("full_name");
      const { data: roles } = await supabase.from("user_roles").select("*");
      return (profiles || []).map((p: any) => ({
        ...p,
        role: roles?.find((r: any) => r.user_id === p.auth_id)?.role || "user",
      }));
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "user" | "technician" | "manager" }) => {
      const { error } = await supabase.from("user_roles").update({ role }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("อัปเดตสิทธิ์สำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["admin-users-roles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const roleColors: Record<string, string> = {
    admin: "bg-red-100 text-red-700",
    technician: "bg-blue-100 text-blue-700",
    manager: "bg-violet-100 text-violet-700",
    user: "bg-slate-700 text-muted-foreground",
  };

  const roleLabels: Record<string, string> = {
    admin: "แอดมิน",
    technician: "ช่างซ่อม",
    manager: "ผู้บริหาร",
    user: "เจ้าหน้าที่",
  };

  return (
    <div className="space-y-3">
      {users?.map((u: any) => (
        <Card key={u.id} className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{u.full_name || "ไม่ระบุชื่อ"}</p>
                <p className="text-xs text-muted-foreground">{u.departments?.name || "ไม่มีแผนก"}</p>
              </div>
              <Select value={u.role} onValueChange={(v: "admin" | "user" | "technician" | "manager") => updateRole.mutate({ userId: u.auth_id, role: v })}>
                <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">แอดมิน</SelectItem>
                  <SelectItem value="technician">ช่างซ่อม</SelectItem>
                  <SelectItem value="manager">ผู้บริหาร</SelectItem>
                  <SelectItem value="user">เจ้าหน้าที่</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// --- Main Admin Page ---
export default function MaintenanceAdmin() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>← กลับ</Button>
        <h2 className="text-lg font-bold text-foreground">จัดการระบบแจ้งซ่อม</h2>
      </div>

      <Tabs defaultValue="equipment">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="equipment" className="text-xs">อุปกรณ์</TabsTrigger>
          <TabsTrigger value="technicians" className="text-xs">ช่างซ่อม</TabsTrigger>
          <TabsTrigger value="users" className="text-xs">ผู้ใช้/สิทธิ์</TabsTrigger>
        </TabsList>
        <TabsContent value="equipment"><EquipmentTab /></TabsContent>
        <TabsContent value="technicians"><TechniciansTab /></TabsContent>
        <TabsContent value="users"><UsersRolesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
