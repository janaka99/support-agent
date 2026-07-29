import { Card } from "@/components/ui/card";
import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export function StatCard({ title, value, icon, trend }: StatCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[--text-muted]">{title}</h3>
        {icon && <div className="text-[--accent] opacity-80">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold tracking-tight text-[--text-primary]">{value}</div>
        {trend && (
          <div className={`text-xs font-medium ${trend.isPositive ? 'text-[--success]' : 'text-[--error]'}`}>
            {trend.isPositive ? '+' : '-'}{trend.value}
          </div>
        )}
      </div>
    </Card>
  );
}
