import { SidebarTrigger } from "@/components/ui/sidebar";
import { ProfileMenu } from "./profile-menu";

export function Topbar() {
  return (
    <div className="h-14 border-b border-border bg-bg-surface/60 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="text-text-secondary hover:text-text-primary" />
      </div>

      <ProfileMenu />
    </div>
  );
}
