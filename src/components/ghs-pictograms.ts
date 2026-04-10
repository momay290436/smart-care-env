import flammable from "@/assets/ghs/flammable.png";
import toxic from "@/assets/ghs/toxic.png";
import corrosive from "@/assets/ghs/corrosive.png";
import irritant from "@/assets/ghs/irritant.png";
import healthHazard from "@/assets/ghs/health-hazard.png";
import environment from "@/assets/ghs/environment.png";
import explosive from "@/assets/ghs/explosive.png";
import oxidizer from "@/assets/ghs/oxidizer.png";
import compressedGas from "@/assets/ghs/compressed-gas.png";

export const GHS_PICTOGRAMS: Record<string, { src: string; label: string; labelTh: string }> = {
  flammable: { src: flammable, label: "Flammable", labelTh: "สารไวไฟ" },
  toxic: { src: toxic, label: "Toxic", labelTh: "สารพิษ" },
  corrosive: { src: corrosive, label: "Corrosive", labelTh: "กัดกร่อน" },
  irritant: { src: irritant, label: "Irritant", labelTh: "สารระคายเคือง" },
  health_hazard: { src: healthHazard, label: "Health Hazard", labelTh: "อันตรายต่อสุขภาพ" },
  environment: { src: environment, label: "Environment", labelTh: "อันตรายต่อสิ่งแวดล้อม" },
  explosive: { src: explosive, label: "Explosive", labelTh: "สารระเบิด" },
  oxidizer: { src: oxidizer, label: "Oxidizer", labelTh: "สารออกซิไดซ์" },
  compressed_gas: { src: compressedGas, label: "Compressed Gas", labelTh: "ก๊าซอัด" },
};

export const CHEMICAL_CATEGORIES = [
  { value: "flammable", label: "สารไวไฟ" },
  { value: "corrosive", label: "สารกัดกร่อน" },
  { value: "toxic", label: "สารพิษ" },
  { value: "irritant", label: "สารระคายเคือง" },
  { value: "oxidizer", label: "สารออกซิไดซ์" },
  { value: "explosive", label: "สารระเบิด" },
  { value: "compressed_gas", label: "ก๊าซอัด" },
  { value: "health_hazard", label: "อันตรายต่อสุขภาพ" },
  { value: "environment", label: "อันตรายต่อสิ่งแวดล้อม" },
  { value: "other", label: "อื่นๆ" },
];
