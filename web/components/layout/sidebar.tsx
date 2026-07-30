"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { LogOut, Shield } from "lucide-react";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar,
} from "@/components/ui/sidebar";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType; // Lucide icon
}

interface SidebarProps {
  items: NavItem[];
  title: string;
  subtitle?: string;
}

export function Sidebar({ items, title, subtitle }: SidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { setOpenMobile } = useSidebar();

  return (
    // No "inset" variant — this runs flush, full height, edge-to-edge
    // with the topbar above it, rather than as a floating margined card.
    <ShadcnSidebar className="sidebar">
      <SidebarHeader className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-accent-muted shrink-0">
            <Shield className="w-4.5 h-4.5 text-accent" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-primary tracking-tight truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-text-muted truncate">{subtitle}</p>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 mb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
            Platform
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className={
                        isActive
                          ? "h-9 rounded-md bg-accent-muted text-accent border-l-2 border-accent rounded-l-none pl-2.5"
                          : "h-9 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated"
                      }
                    >
                      <Link
                        href={item.href}
                        onClick={() => setOpenMobile(false)}
                        className="flex items-center gap-2.5 text-sm"
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => logout()}
              tooltip="Sign out"
              className="h-9 rounded-md text-text-muted hover:text-error hover:bg-error/10"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="mono text-[10px] text-text-muted/70 mt-3 px-2">
          v1.0.0 · Production
        </p>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}
