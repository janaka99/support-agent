"use client";

import { useAuth } from "@/contexts/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  Cpu,
  Wrench,
  ShieldAlert,
  Users,
  Settings,
  AlertCircle,
  Shield,
  BarChart3,
  BookOpen,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useEffect, useState } from "react";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Chat Playground", href: "/dashboard/chat", icon: MessageSquare },
  { label: "Bots Studio", href: "/dashboard/bots", icon: Bot },
  { label: "Specialist Agents", href: "/dashboard/agents", icon: Cpu },
  { label: "Knowledge Bases", href: "/dashboard/knowledge-bases", icon: BookOpen },
  { label: "Tools Hub", href: "/dashboard/tools", icon: Wrench },
  { label: "Guardrails Library", href: "/dashboard/guardrails", icon: ShieldAlert },
  { label: "Escalations", href: "/dashboard/escalations", icon: AlertCircle },
  { label: "Analytics & Cost", href: "/dashboard/analytics", icon: BarChart3 },
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
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <Spinner size="lg" className="text-accent" />
      </div>
    );
  }

  if (!user) {
    redirect("/login");
  }

  const items = [...navItems];
  if (user?.is_superuser) {
    items.push({ label: "AI Models (Superadmin)", href: "/platform/models", icon: Cpu });
    items.push({ label: "Platform Admin", href: "/platform", icon: Shield });
  }

  return (
    <div className="flex h-screen w-full bg-bg-base text-text-primary overflow-hidden">
      <Sidebar
        items={items}
        title="Support Agent"
        subtitle="Composable Studio"
      />
      <div className="flex flex-col flex-1 h-screen min-w-0 bg-transparent overflow-hidden">
        <Topbar />
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
