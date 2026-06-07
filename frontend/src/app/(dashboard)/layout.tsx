"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { logoutApi, getMeApi } from "@/lib/api-client/auth";
import { Users, LogOut, BarChart3, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { toast } from "sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, clearAuth } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useWorkspaceStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!user) {
      getMeApi()
        .then((data) => setUser(data))
        .catch(() => router.replace("/login"));
    }
  }, [user, setUser, router]);

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {}
    clearAuth();
    router.replace("/login");
    toast.success("Logged out");
  };

  if (!mounted) return null;

  return (
    <div className="flex h-full">
      <aside className={`flex flex-col border-r bg-muted/30 transition-all duration-200 ${sidebarOpen ? "w-56" : "w-14"}`}>
        <div className={`flex h-12 items-center border-b ${sidebarOpen ? "gap-2 px-4" : "justify-center px-0"}`}>
          <BarChart3 className="h-5 w-5 shrink-0 text-primary" />
          {sidebarOpen && <span className="text-sm font-semibold">ProBalance</span>}
        </div>

        <nav className="flex-1 space-y-0.5 p-2">
          <Link
            href="/clients"
            title="Clients"
            className={`flex h-8 items-center rounded text-sm ${sidebarOpen ? "gap-2 px-3" : "justify-center px-0"} ${
              pathname.startsWith("/clients")
                ? "bg-accent font-medium"
                : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            <Users className="h-4 w-4 shrink-0" />
            {sidebarOpen && "Clients"}
          </Link>
        </nav>

        <div className="border-t p-1.5">
          <button
            onClick={handleLogout}
            title="Sign out"
            className={`flex h-8 w-full items-center rounded text-sm text-muted-foreground cursor-pointer hover:bg-accent/50 ${sidebarOpen ? "gap-2 px-3" : "justify-center px-0"}`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {sidebarOpen && <span className="truncate">Sign out</span>}
          </button>
          <button
            onClick={toggleSidebar}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            className={`flex h-8 w-full items-center rounded text-sm text-muted-foreground cursor-pointer hover:bg-accent/50 ${sidebarOpen ? "gap-2 px-3" : "justify-center px-0"}`}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4 shrink-0" /> : <PanelLeftOpen className="h-4 w-4 shrink-0" />}
            {sidebarOpen && <span className="truncate">Collapse</span>}
          </button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
