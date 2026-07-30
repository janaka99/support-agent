"use client";

import { useAuth } from "@/contexts/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Building2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useEffect, useState } from "react";

const navItems = [
  { label: "Organizations", href: "/platform", icon: Building2 },
];

export default function PlatformLayout({
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

  // Non-superusers belong in the org dashboard.
  if (!user.is_superuser) {
    redirect("/dashboard");
  }

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full bg-bg-base overflow-hidden">
        {/* Ambient glow — same accent-muted signature as the login screen's
            brand panel, and gives the sidebar's glass blur something to
            actually blur instead of tinting flat color. */}
        <div
          className="pointer-events-none absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-accent-muted blur-3xl"
          aria-hidden="true"
        />

        <Sidebar
          items={navItems}
          title="Platform Admin"
          subtitle="Superuser Portal"
        />
        <SidebarInset className="relative flex flex-col flex-1 min-w-0 bg-transparent m-0! ">
          <Topbar />
          <main className="flex-1 p-6 lg:p-8 overflow-y-auto">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
