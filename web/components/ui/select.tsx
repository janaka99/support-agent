import { cn } from "@/lib/utils";
import { SelectHTMLAttributes, forwardRef } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, ...props }, ref) => (
    <select
      ref={ref}
      className={cn("select", error && "border-[--error]", className)}
      {...props}
    />
  )
);
Select.displayName = "Select";
