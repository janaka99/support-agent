import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "accent" | "success" | "error" | "muted";
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "muted", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "badge",
        {
          "badge-accent": variant === "accent",
          "badge-success": variant === "success",
          "badge-error": variant === "error",
          "badge-muted": variant === "muted",
        },
        className
      )}
      {...props}
    />
  )
);
Badge.displayName = "Badge";
