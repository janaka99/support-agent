import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef, useMemo } from "react";

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name?: string;
  size?: "sm" | "default" | "lg";
}

const sizeClasses = {
  sm: "w-7 h-7 text-[0.625rem]",
  default: "w-9 h-9 text-xs",
  lg: "w-11 h-11 text-sm",
} as const;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Simple hash to pick a consistent color from a name string.
 * Returns an HSL hue value 0-360.
 */
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, name, size = "default", ...props }, ref) => {
    const initials = useMemo(() => (name ? getInitials(name) : "?"), [name]);
    const hue = useMemo(() => (name ? nameToHue(name) : 240), [name]);

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-full flex items-center justify-center font-medium select-none shrink-0",
          sizeClasses[size],
          className
        )}
        style={{
          backgroundColor: `hsl(${hue}, 40%, 20%)`,
          color: `hsl(${hue}, 60%, 70%)`,
        }}
        {...props}
      >
        {initials}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";
