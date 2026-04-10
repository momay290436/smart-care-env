import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const maps = [
  { id: "buildings", title: "แผนที่อาคาร", desc: "ตำแหน่งอาคารทั้งหมดในโรงพยาบาล", image: "/maps/buildings.jpg" },
  { id: "service", title: "หน่วยให้บริการ", desc: "จุดคัดกรอง, เวชระเบียน, ห้องยา, X-ray", image: "/maps/service-units.jpg" },
  { id: "meeting", title: "ห้องประชุม", desc: "ห้องประชุมเอื้องคำ, เอื้องหลวง, เอื้องเงิน", image: "/maps/meeting-rooms.jpg" },
  { id: "toilets", title: "ห้องน้ำ", desc: "ตำแหน่งห้องน้ำทั่วโรงพยาบาล", image: "/maps/toilets.jpg" },
  { id: "gardens", title: "สวนในพื้นที่", desc: "สวนประพัฒน์, สวนต้นไผ่หลิว, สวนสมุนไพร", image: "/maps/gardens.jpg" },
  { id: "parking-staff", title: "ที่จอดรถเจ้าหน้าที่", desc: "จุดจอดรถยนต์สำหรับบุคลากร", image: "/maps/parking-staff.jpg" },
  { id: "parking-vehicles", title: "ที่จอดรถยนต์และมอเตอร์ไซด์", desc: "จุดจอดรถจักรยานยนต์และรถยนต์ทั่วไป", image: "/maps/parking-vehicles.jpg" },
  { id: "assembly", title: "จุดรวมพล", desc: "จุดรวมพลที่ 1 และ 2 สำหรับกรณีฉุกเฉิน", image: "/maps/assembly-points.jpg" },
];

export default function HospitalMap() {
  const [selected, setSelected] = useState<string | null>(null);
  const navigate = useNavigate();
  const selectedMap = maps.find((m) => m.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>← กลับ</Button>
        <div>
          <h2 className="text-lg font-bold text-foreground">แผนผังโรงพยาบาล</h2>
          <p className="text-sm text-muted-foreground">แผนที่นำทางภายในโรงพยาบาลแม่สรวย</p>
        </div>
      </div>

      {selected && selectedMap ? (
        <div className="space-y-3 animate-fade-in">
          <button
            onClick={() => setSelected(null)}
            className="text-sm text-primary font-medium hover:underline"
          >
            ← กลับหน้ารวม
          </button>
          <Card className="shadow-card overflow-hidden">
            <CardContent className="p-0">
              <img
                src={selectedMap.image}
                alt={selectedMap.title}
                className="w-full object-contain"
              />
            </CardContent>
          </Card>
          <p className="text-center text-sm font-semibold text-foreground">{selectedMap.title}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {maps.map((map) => (
            <Card
              key={map.id}
              className="shadow-card cursor-pointer transition-all hover:shadow-elevated hover:-translate-y-0.5 animate-fade-in overflow-hidden"
              onClick={() => setSelected(map.id)}
            >
              <CardContent className="p-0">
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  <img src={map.image} alt={map.title} className="h-full w-full object-cover" />
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-foreground">{map.title}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{map.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
