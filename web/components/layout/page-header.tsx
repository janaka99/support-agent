import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-6 mb-6 border-b border-[--border]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[--text-primary]">{title}</h1>
        {description && <p className="text-sm text-[--text-muted] mt-1">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
