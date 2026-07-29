import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";

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

  return (
    <div className="sidebar w-64 h-screen fixed top-0 left-0 flex flex-col">
      <div className="p-6 border-b border-[--border]">
        <h2 className="text-lg font-bold text-[--text-primary] tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-[--text-muted] mt-1">{subtitle}</p>}
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-[--accent-bg] text-[--accent]" 
                  : "text-[--text-muted] hover:text-[--text-primary] hover:bg-surface/50"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
      
      <div className="p-4 border-t border-[--border]">
        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-[--text-muted] hover:text-[--error] hover:bg-red-500/10 rounded-md transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
