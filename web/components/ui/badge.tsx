import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "accent" | "success" | "error" | "warning" | "info" | "muted";
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
          "badge-warning": variant === "warning",
          "badge-info": variant === "info",
          "badge-muted": variant === "muted",
        },
        className
      )}
      {...props}
    />
  )
);
Badge.displayName = "Badge";
