import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="p-12 flex flex-col items-center justify-center text-center">
      {icon && (
        <div className="mb-4 text-[--text-muted] opacity-50">{icon}</div>
      )}
      <h3 className="text-sm font-medium text-[--text-primary] mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-[--text-muted] mb-6 max-w-sm">
        {description}
      </p>
      {action && <div>{action}</div>}
    </Card>
  );
}
