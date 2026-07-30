import { cn } from "@/lib/utils";

export interface SpinnerProps {
  className?: string;
  size?: "sm" | "default" | "lg";
}

const sizeClasses = {
  sm: "spinner-sm",
  default: "",
  lg: "spinner-lg",
} as const;

export function Spinner({ className, size = "default" }: SpinnerProps) {
  return (
    <div
      className={cn("spinner", sizeClasses[size], className)}
      role="status"
      aria-label="Loading"
    />
  );
}
