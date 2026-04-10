import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function BackButton({ label = "กลับ" }: { label?: string }) {
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate("/")}
      className="gap-1 rounded-2xl px-3 h-9 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
    >
      <ChevronLeft className="h-5 w-5" />
      {label}
    </Button>
  );
}
