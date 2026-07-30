"use client";

import { useAuth } from "@/contexts/auth";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut } from "lucide-react";

export function ProfileMenu() {
  const { user, logout } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-3 rounded-md px-1.5 py-1 outline-none transition-base hover:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-accent">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-text-primary leading-tight">
            {user?.email}
          </p>
          <p className="text-xs text-text-muted capitalize">{user?.role}</p>
        </div>
        <Avatar name={user?.email ?? "User"} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="text-sm font-medium text-text-primary truncate">
            {user?.email}
          </p>
          <p className="text-xs text-text-muted capitalize font-normal">
            {user?.role}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="[&_svg]:text-current">
          <a href="/settings" className="cursor-pointer">
            <Settings className="w-4 h-4" />
            Account settings
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logout()}
          className="cursor-pointer text-error focus:text-error focus:bg-error/10 [&_svg]:text-current"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
