"use client";

import { useAuth } from "@/contexts/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { LayoutDashboard, Bot, Users, Settings } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useEffect, useState } from "react";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Chat", href: "/dashboard/chat", icon: Bot },
  { label: "Agents", href: "/dashboard/agents", icon: Bot },
  { label: "Team", href: "/dashboard/team", icon: Users },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (isLoading || !isMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" className="text-[--accent]" />
      </div>
    );
  }

  if (!user) {
    redirect("/login");
  }

  // Superusers belong in the platform portal, not here.
  if (user.is_superuser) {
    redirect("/platform");
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[--bg-base]">
        <Sidebar
          items={navItems}
          title="Support Agent"
          subtitle="Dashboard"
        />
        <SidebarInset className="flex flex-col flex-1 min-w-0 bg-transparent">
          <Topbar />
          <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
