import { PageHeader } from "@/components/layout/page-header";
import { StatCardGrid } from "@/components/dashboard/stat-card-grid";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardOverviewPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Dashboard Overview"
        description="Monitor your support agents and team metrics."
      />
      <StatCardGrid />

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-[--text-primary] mb-4">
          Recent Activity
        </h3>
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-[--text-muted] text-sm">
              Activity feed coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
