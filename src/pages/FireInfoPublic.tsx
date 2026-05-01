import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Flame, MapPin, Building, Layers, Palette, Ruler, FileText, Calendar, CheckCircle2, XCircle, Shield, User, Droplets, CalendarClock } from "lucide-react";

export default function FireInfoPublic() {
  const { id } = useParams<{ id: string }>();
  const [location, setLocation] = useState<any>(null);
  const [lastCheck, setLastCheck] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const { data: loc } = await supabase
        .from("fire_extinguisher_locations")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      setLocation(loc);

      if (loc) {
        const { data: check } = await supabase
          .from("fire_extinguisher_checks")
          .select("*")
          .eq("location", loc.id)
          .order("checked_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setLastCheck(check);
      }
      setLoading(false);
    };
    fetchData();

    const channel = supabase
      .channel(`fire-info-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "fire_extinguisher_checks" }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-white to-cyan-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-600 border-t-transparent" />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-white to-cyan-50 p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 text-center">
          <XCircle className="mx-auto h-12 w-12 text-red-400 mb-3" />
          <h1 className="text-lg font-bold text-gray-800">ไม่พบข้อมูลถังดับเพลิง</h1>
          <p className="text-sm text-gray-500 mt-1">QR Code นี้ไม่ตรงกับถังดับเพลิงใดในระบบ</p>
        </div>
      </div>
    );
  }

  const allOk = lastCheck ? lastCheck.pressure_ok && lastCheck.condition_ok : null;

  const InfoRow = ({ icon: Icon, label, value, color = "text-cyan-600" }: any) => (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className={`w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0`}>
        <Icon className={`h-4.5 w-4.5 ${color}`} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-base font-bold text-gray-900 leading-snug break-words">{value || "-"}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-red-600 via-rose-600 to-rose-800">
      {/* Header */}
      <div className="px-4 pt-6 pb-8 text-center text-white">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-xl">
          <Flame className="h-9 w-9 text-white" strokeWidth={2.2} />
        </div>
        <h1 className="text-xl font-extrabold tracking-tight">ข้อมูลถังดับเพลิง</h1>
        <p className="text-xs text-white/80 mt-0.5">Fire Extinguisher Information</p>
      </div>

      {/* Content */}
      <div className="bg-gray-50 rounded-t-3xl px-4 pt-5 pb-10 -mt-3 min-h-[60vh]">
        <div className="max-w-md mx-auto space-y-4">
          {/* Title card */}
          <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
            <p className="text-xs text-gray-500 font-medium">รหัส / ตำแหน่ง</p>
            <h2 className="text-2xl font-extrabold text-gray-900 leading-tight mt-1 break-words">{location.name}</h2>
          </div>

          {/* Status card */}
          <div className={`rounded-2xl shadow-sm p-4 border-2 ${allOk === null ? "bg-gray-50 border-gray-200" : allOk ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
            <div className="flex items-center gap-3">
              {allOk === null ? <FileText className="h-10 w-10 text-gray-400 flex-shrink-0" />
                : allOk ? <CheckCircle2 className="h-10 w-10 text-green-600 flex-shrink-0" />
                : <XCircle className="h-10 w-10 text-red-600 flex-shrink-0" />}
              <div className="min-w-0">
                <p className={`text-base font-extrabold ${allOk === null ? "text-gray-700" : allOk ? "text-green-700" : "text-red-700"}`}>
                  {allOk === null ? "ยังไม่มีการตรวจสอบ" : allOk ? "พร้อมใช้งาน ✓" : "พบปัญหา ต้องแก้ไข"}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {lastCheck ? `อัปเดต ${new Date(lastCheck.checked_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}` : "No inspection record"}
                </p>
              </div>
            </div>
          </div>

          {/* Location card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5">
              <p className="text-sm font-bold text-white flex items-center gap-2"><MapPin className="h-4 w-4" /> ตำแหน่งติดตั้ง</p>
            </div>
            <div className="px-4 py-2">
              <InfoRow icon={Building} label="อาคาร" value={location.building} color="text-blue-600" />
              <InfoRow icon={Layers} label="ชั้น" value={location.floor} color="text-indigo-600" />
            </div>
          </div>

          {/* Specification card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2.5">
              <p className="text-sm font-bold text-white flex items-center gap-2"><Flame className="h-4 w-4" /> ข้อมูลจำเพาะ</p>
            </div>
            <div className="px-4 py-2">
              <InfoRow icon={Flame} label="ชนิดถังดับเพลิง" value={location.extinguisher_type} color="text-red-600" />
              <InfoRow icon={Droplets} label="สารดับเพลิง / เชื้อเพลิง" value={location.fuel_type} color="text-orange-600" />
              <InfoRow icon={Ruler} label="ขนาด" value={location.size} color="text-amber-600" />
              <InfoRow icon={Palette} label="สีถัง" value={location.color} color="text-pink-600" />
              <InfoRow icon={CalendarClock} label="ปีที่ผลิต" value={location.manufacture_year} color="text-violet-600" />
              {location.detail && <InfoRow icon={FileText} label="รายละเอียดเพิ่มเติม" value={location.detail} color="text-slate-600" />}
            </div>
          </div>

          {/* Last inspection card */}
          {lastCheck && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5">
                <p className="text-sm font-bold text-white flex items-center gap-2"><Calendar className="h-4 w-4" /> ผลการตรวจครั้งล่าสุด</p>
              </div>
              <div className="px-4 py-2">
                <InfoRow icon={Calendar} label="วันที่ตรวจ" value={new Date(lastCheck.checked_at).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })} color="text-emerald-600" />
                <InfoRow icon={User} label="ผู้ตรวจสอบ" value={lastCheck.inspector_name} color="text-teal-600" />
                <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-700">แรงดันถัง</p>
                  <Badge className={`text-xs px-3 py-1 rounded-full font-bold ${lastCheck.pressure_ok ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100"}`}>
                    {lastCheck.pressure_ok ? "✓ ปกติ" : "✗ ผิดปกติ"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <p className="text-sm font-medium text-gray-700">สภาพถัง</p>
                  <Badge className={`text-xs px-3 py-1 rounded-full font-bold ${lastCheck.condition_ok ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-red-100 text-red-700 hover:bg-red-100"}`}>
                    {lastCheck.condition_ok ? "✓ ปกติ" : "✗ ผิดปกติ"}
                  </Badge>
                </div>
                {lastCheck.notes && (
                  <div className="bg-amber-50 rounded-xl p-3 mt-2 border border-amber-200">
                    <p className="text-xs text-amber-700 font-bold mb-1">หมายเหตุจากผู้ตรวจ</p>
                    <p className="text-sm text-amber-900 leading-relaxed">{lastCheck.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-center text-[11px] text-gray-400 pt-2 pb-4">
            <Shield className="inline h-3 w-3 mr-1" />
            Smart Hospital ENV & 5S Platform
          </p>
        </div>
      </div>
    </div>
  );
}
