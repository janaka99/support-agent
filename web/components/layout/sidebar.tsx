"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth";
import { LogOut, Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface SidebarProps {
  items: NavItem[];
  title: string;
  subtitle?: string;
}

export function Sidebar({ items, title, subtitle }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 h-screen sticky top-0 flex flex-col shrink-0 overflow-hidden bg-bg-surface/80 border-r border-border backdrop-blur-xl z-30 select-none">
      {/* Header / Brand */}
      <div className="p-5 border-b border-border flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-accent-muted border border-accent/20 text-accent shrink-0 shadow-xs">
          <Sparkles className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-text-primary tracking-tight truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[11px] text-text-muted truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Platform Studio
          </div>
          <nav className="space-y-1">
            {items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(`${item.href}`));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 group",
                    isActive
                      ? "bg-accent-muted text-accent font-semibold shadow-xs"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/70"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0 transition-colors",
                      isActive ? "text-accent" : "text-text-muted group-hover:text-text-primary"
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User / Sign Out Footer */}
      <div className="p-3.5 border-t border-border bg-bg-base/40 space-y-2">
        {user && (
          <div className="px-2 py-1 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-accent/20 text-accent border border-accent/30 flex items-center justify-center text-xs font-semibold shrink-0">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-text-primary truncate">{user.email}</p>
              <p className="text-[10px] text-text-muted capitalize">{user.role}</p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => logout()}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>

        <div className="px-3 pt-1 text-[10px] text-text-muted/60 flex items-center justify-between">
          <span>v1.0.0 Composable</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Connected" />
        </div>
      </div>
    </aside>
  );
}
