import { PageHeader } from "@/components/layout/page-header";
import { StatCardGrid } from "@/components/dashboard/stat-card-grid";

export default function DashboardOverviewPage() {
  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
      <PageHeader 
        title="Dashboard Overview" 
        description="Monitor your support agents and team metrics."
      />
      <StatCardGrid />
      
      <div className="mt-12">
        <h3 className="text-lg font-medium text-[--text-primary] mb-6">Recent Activity</h3>
        <div className="card p-12 flex items-center justify-center border-dashed bg-transparent shadow-none">
          <p className="text-[--text-muted] text-sm">Activity feed coming soon.</p>
        </div>
      </div>
    </div>
  );
}
