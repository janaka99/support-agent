import { ProfileMenu } from "./profile-menu";
import { Sparkles } from "lucide-react";

export function Topbar() {
  return (
    <div className="h-14 border-b border-border bg-bg-surface/60 backdrop-blur-md sticky top-0 z-20 px-6 flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-accent-muted text-accent font-medium">
          <Sparkles className="w-3 h-3" />
          Composable Studio
        </span>
      </div>

      <ProfileMenu />
    </div>
  );
}
