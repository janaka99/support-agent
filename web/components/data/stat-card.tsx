import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-[--accent-muted] flex items-center justify-center text-[--accent]">
              {icon}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight text-[--text-primary]">
            {value}
          </span>
          {trend && (
            <span
              className={`text-xs font-medium ${
                trend.isPositive ? "text-[--success]" : "text-[--error]"
              }`}
            >
              {trend.isPositive ? "+" : ""}
              {trend.value}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
