import { cn } from "@/lib/utils";

export const Spinner = ({ className }: { className?: string }) => (
  <div className={cn("spinner", className)} />
);
