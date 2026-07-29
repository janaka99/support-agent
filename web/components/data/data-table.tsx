import { ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/layout/empty-state";

interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}

export function DataTable<T>({ 
  data, 
  columns, 
  keyExtractor, 
  isLoading,
  emptyTitle = "No records found",
  emptyDescription = "There is no data to display here yet.",
  emptyAction
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="card p-12 flex justify-center items-center">
        <Spinner className="text-[--accent]" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState 
        title={emptyTitle} 
        description={emptyDescription} 
        action={emptyAction} 
      />
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[--border] bg-surface/50">
              {columns.map((col, i) => (
                <th key={i} className={`p-4 text-xs font-semibold text-[--text-muted] uppercase tracking-wider ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[--border]">
            {data.map((item) => (
              <tr key={keyExtractor(item)} className="hover:bg-surface/30 transition-colors">
                {columns.map((col, i) => (
                  <td key={i} className={`p-4 text-sm text-[--text-primary] ${col.className || ''}`}>
                    {col.cell ? col.cell(item) : (col.accessorKey ? String(item[col.accessorKey]) : null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
