"use client";

import { useAuth } from "@/contexts/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { LayoutDashboard, Bot, Users, Settings } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useEffect, useState } from "react";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
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
        <Spinner className="text-[--accent]" />
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
    <div className="min-h-screen flex bg-background">
      <Sidebar 
        items={navItems} 
        title="Dashboard" 
        subtitle="Org Portal"
      />
      <div className="flex-1 ml-64 flex flex-col">
        <Topbar />
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
