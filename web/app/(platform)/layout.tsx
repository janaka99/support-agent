"use client";

import { useAuth } from "@/contexts/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Building2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
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
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="text-[--accent]" />
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
    <div className="min-h-screen flex bg-background">
      <Sidebar 
        items={navItems} 
        title="Platform Admin" 
        subtitle="Superuser Portal"
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
