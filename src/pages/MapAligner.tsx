import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, RotateCcw, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const BASE_MAP = "/maps/hospital-map.jpg";
const OVERLAY_MAP = "/maps/overlay-sketch.jpg";

interface TransformParams {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  skewX: number;
  skewY: number;
  opacity: number;
}

const DEFAULT_PARAMS: TransformParams = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  skewX: 0,
  skewY: 0,
  opacity: 0.5,
};

export default function MapAligner() {
  const navigate = useNavigate();
  const [params, setParams] = useState<TransformParams>({ ...DEFAULT_PARAMS });
  const [copied, setCopied] = useState(false);

  const update = useCallback((key: keyof TransformParams, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const reset = () => setParams({ ...DEFAULT_PARAMS });

  const transformStyle: React.CSSProperties = {
    transform: `translate(${params.x}px, ${params.y}px) scale(${params.scale}) rotate(${params.rotation}deg) skewX(${params.skewX}deg) skewY(${params.skewY}deg)`,
    opacity: params.opacity,
    transformOrigin: "center center",
  };

  const paramsJson = JSON.stringify(params, null, 2);

  const copyParams = () => {
    navigator.clipboard.writeText(paramsJson);
    setCopied(true);
    toast.success("คัดลอกค่าพารามิเตอร์แล้ว");
    setTimeout(() => setCopied(false), 2000);
  };

  const controls: {
    key: keyof TransformParams;
    label: string;
    min: number;
    max: number;
    step: number;
    unit: string;
  }[] = [
    { key: "x", label: "ตำแหน่ง X", min: -500, max: 500, step: 1, unit: "px" },
    { key: "y", label: "ตำแหน่ง Y", min: -500, max: 500, step: 1, unit: "px" },
    { key: "scale", label: "ขนาด (Scale)", min: 0.1, max: 3, step: 0.01, unit: "x" },
    { key: "rotation", label: "หมุน (Rotation)", min: -180, max: 180, step: 0.5, unit: "°" },
    { key: "skewX", label: "เอียง X (Skew X)", min: -45, max: 45, step: 0.5, unit: "°" },
    { key: "skewY", label: "เอียง Y (Skew Y)", min: -45, max: 45, step: 0.5, unit: "°" },
    { key: "opacity", label: "ความโปร่งใส", min: 0, max: 1, step: 0.05, unit: "" },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-4">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          กลับ
        </Button>
        <h2 className="text-lg font-bold text-foreground">ปรับซ้อนแผนที่</h2>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Map Area */}
        <div className="flex-1 relative overflow-hidden rounded-xl border-2 border-border bg-muted/30">
          <img
            src={BASE_MAP}
            alt="แผนที่โรงพยาบาล 3D"
            className="w-full h-full object-contain select-none pointer-events-none"
            draggable={false}
          />
          <img
            src={OVERLAY_MAP}
            alt="ผังทางเดิน"
            className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
            style={transformStyle}
            draggable={false}
          />
        </div>

        {/* Control Panel */}
        <Card className="w-80 shrink-0 overflow-y-auto border-2 border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">แผงควบคุม</CardTitle>
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                รีเซ็ต
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {controls.map(ctrl => (
              <div key={ctrl.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{ctrl.label}</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={params[ctrl.key]}
                      onChange={e => update(ctrl.key, parseFloat(e.target.value) || 0)}
                      step={ctrl.step}
                      min={ctrl.min}
                      max={ctrl.max}
                      className="w-20 h-7 text-xs text-right"
                    />
                    <span className="text-xs text-muted-foreground w-5">{ctrl.unit}</span>
                  </div>
                </div>
                <Slider
                  value={[params[ctrl.key]]}
                  onValueChange={([v]) => update(ctrl.key, v)}
                  min={ctrl.min}
                  max={ctrl.max}
                  step={ctrl.step}
                />
              </div>
            ))}

            {/* Params Output */}
            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">ค่าพารามิเตอร์</Label>
                <Button variant="outline" size="sm" onClick={copyParams}>
                  {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  {copied ? "คัดลอกแล้ว" : "คัดลอก"}
                </Button>
              </div>
              <pre className="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre">
                {paramsJson}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
