import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary shadow-elevated">
            <span className="text-2xl font-black text-white">5S</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Smart ENV & 5S</h1>
          <p className="text-sm text-muted-foreground">ระบบบริหารจัดการสิ่งแวดล้อมและ 5ส</p>
        </div>

        <Card className="border shadow-elevated rounded-3xl overflow-hidden">
          <CardHeader className="pb-4 pt-6 text-center">
            <h2 className="text-xl font-bold text-card-foreground">เข้าสู่ระบบ</h2>
            <p className="text-sm text-muted-foreground mt-1">กรุณากรอกอีเมลและรหัสผ่าน</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-card-foreground">อีเมล</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@hospital.go.th" required className="h-12 rounded-2xl text-base" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-card-foreground">รหัสผ่าน</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-12 rounded-2xl text-base" />
              </div>
              <Button type="submit" className="w-full h-13 rounded-2xl text-base font-bold shadow-lg" disabled={submitting}>
                {submitting ? "กำลังดำเนินการ..." : "เข้าสู่ระบบ"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>ติดต่อผู้ดูแลระบบเพื่อขอบัญชีใช้งาน</span>
        </div>
      </div>
    </div>
  );
}
