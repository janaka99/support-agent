import { useAuth } from "@/contexts/auth";
import { User as UserIcon } from "lucide-react";

export function Topbar() {
  const { user } = useAuth();

  return (
    <div className="h-16 border-b border-[--border] bg-surface/30 backdrop-blur-md sticky top-0 z-40 px-8 flex items-center justify-between">
      <div className="flex-1" />
      
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-[--text-primary]">{user?.email}</p>
          <p className="text-xs text-[--text-muted] capitalize">{user?.role}</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-surface border border-[--border] flex items-center justify-center text-[--text-muted]">
          <UserIcon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
