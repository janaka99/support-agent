import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="card p-12 flex flex-col items-center justify-center text-center">
      {icon && <div className="mb-4 text-[--text-muted] opacity-50">{icon}</div>}
      <h3 className="text-lg font-medium text-[--text-primary] mb-2">{title}</h3>
      <p className="text-sm text-[--text-muted] mb-6 max-w-sm">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
