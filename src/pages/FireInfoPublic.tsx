import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Flame, MapPin, Building, Layers, Palette, Ruler, FileText, Calendar, CheckCircle2, XCircle, Shield } from "lucide-react";

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

  const infoItems = [
    { icon: MapPin, label: "ตำแหน่ง", value: location.name, color: "text-cyan-600" },
    { icon: Building, label: "อาคาร", value: location.building || "-", color: "text-blue-600" },
    { icon: Layers, label: "ชั้น", value: location.floor || "-", color: "text-indigo-600" },
    { icon: Palette, label: "สีถัง", value: location.color || "-", color: "text-pink-600" },
    { icon: Ruler, label: "ขนาด", value: location.size || "-", color: "text-amber-600" },
    { icon: Flame, label: "ชนิด", value: location.extinguisher_type || "-", color: "text-red-600" },
    { icon: FileText, label: "เชื้อเพลิง", value: location.fuel_type || "-", color: "text-orange-600" },
  ];

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-cyan-600 to-teal-700 flex flex-col">
      {/* Compact Header */}
      <div className="text-center pt-4 pb-3 px-4">
        <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-base font-bold text-white">ข้อมูลถังดับเพลิง</h1>
        <p className="text-xs text-white/70">Fire Extinguisher Info</p>
      </div>

      {/* Content area - scrollable white card */}
      <div className="flex-1 bg-white rounded-t-3xl px-4 pt-4 pb-6 overflow-y-auto">
        <div className="max-w-md mx-auto space-y-3">
          {/* Status Badge */}
          <div className={`flex items-center gap-3 p-3 rounded-xl ${allOk === null ? "bg-gray-50" : allOk ? "bg-green-50" : "bg-red-50"}`}>
            {allOk === null ? (
              <>
                <FileText className="h-8 w-8 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-gray-700">ยังไม่มีการตรวจสอบ</p>
                  <p className="text-xs text-gray-500">No inspection record</p>
                </div>
              </>
            ) : allOk ? (
              <>
                <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-green-700">ผลตรวจ: ปกติ ✓</p>
                  <p className="text-xs text-green-600">พร้อมใช้งาน</p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="h-8 w-8 text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-700">ผลตรวจ: พบปัญหา</p>
                  <p className="text-xs text-red-600">ต้องดำเนินการแก้ไข</p>
                </div>
              </>
            )}
          </div>

          {/* Info Grid - compact 2 columns for short items */}
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="grid grid-cols-2 gap-2">
              {infoItems.slice(0, 6).map((item, i) => (
                <div key={i} className="flex items-center gap-2 bg-white rounded-lg p-2">
                  <item.icon className={`h-4 w-4 ${item.color} flex-shrink-0`} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 leading-tight">{item.label}</p>
                    <p className="text-xs font-semibold text-gray-900 truncate">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Fuel type - full width */}
            {(() => {
              const fuelItem = infoItems[6];
              const FuelIcon = fuelItem.icon;
              return (
                <div className="flex items-start gap-2 bg-white rounded-lg p-2 mt-2">
                  <FuelIcon className={`h-4 w-4 ${fuelItem.color} flex-shrink-0 mt-0.5`} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 leading-tight">{fuelItem.label}</p>
                    <p className="text-xs font-semibold text-gray-900 leading-snug">{fuelItem.value}</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Last Check - compact */}
          {lastCheck && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-cyan-600" />
                <h3 className="text-sm font-bold text-gray-800">ผลตรวจครั้งล่าสุด</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white rounded-lg p-2">
                  <p className="text-[10px] text-gray-400">วันที่ตรวจ</p>
                  <p className="text-xs font-bold text-gray-900">
                    {new Date(lastCheck.checked_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <p className="text-[10px] text-gray-400">ผู้ตรวจ</p>
                  <p className="text-xs font-bold text-gray-900 truncate">{lastCheck.inspector_name || "-"}</p>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <p className="text-[10px] text-gray-400">แรงดัน</p>
                  <Badge className={`text-[10px] px-1.5 py-0 ${lastCheck.pressure_ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"} rounded`}>
                    {lastCheck.pressure_ok ? "ปกติ" : "ผิดปกติ"}
                  </Badge>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <p className="text-[10px] text-gray-400">สภาพถัง</p>
                  <Badge className={`text-[10px] px-1.5 py-0 ${lastCheck.condition_ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"} rounded`}>
                    {lastCheck.condition_ok ? "ปกติ" : "ผิดปกติ"}
                  </Badge>
                </div>
              </div>
              {lastCheck.notes && (
                <div className="bg-amber-50 rounded-lg p-2">
                  <p className="text-[10px] text-amber-600">หมายเหตุ</p>
                  <p className="text-xs text-amber-800">{lastCheck.notes}</p>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-[10px] text-gray-400 pt-1">Smart Hospital ENV & 5S Platform</p>
        </div>
      </div>
    </div>
  );
}
