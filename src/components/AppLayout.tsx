import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut } from "lucide-react";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 bg-primary px-3 md:px-5 py-2.5 md:py-3.5 shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
          <div
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate("/")}
          >
            <div className="flex h-9 w-9 md:h-11 md:w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg">
              <span className="text-xs md:text-sm font-bold text-primary-foreground">5S</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm md:text-lg font-bold leading-tight text-primary-foreground truncate">Smart ENV & 5S</h1>
              <p className="text-[10px] md:text-xs text-primary-foreground/70">
                {isAdmin ? "ผู้ดูแลระบบ" : "เจ้าหน้าที่"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="ghost" size="sm" className="rounded-2xl text-xs md:text-sm gap-1 md:gap-1.5 h-8 md:h-10 px-2 md:px-4 text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10" onClick={() => navigate("/admin")}>
                <Settings className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden sm:inline">ผู้ดูแลระบบ</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl hover:bg-white/10">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-white/20 text-primary-foreground font-semibold text-base">
                      {profile?.full_name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl">
                <DropdownMenuItem className="flex-col items-start gap-0.5 rounded-xl py-3">
                  <span className="text-base font-semibold text-foreground">{profile?.full_name || "ผู้ใช้"}</span>
                  <span className="text-sm text-muted-foreground">{isAdmin ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน"}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive rounded-xl gap-2 py-3 text-base">
                  <LogOut className="h-4 w-4" />
                  ออกจากระบบ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 md:px-4 pb-20 pt-4 md:pt-6 md:pb-8">
        <div className="flex justify-end mb-1">
          <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wide">Create by Momay Maneewan</span>
        </div>
        <PageTransition>{children}</PageTransition>
      </main>

      <BottomNav />
    </div>
  );
}
