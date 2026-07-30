"use client";

import { ReactNode, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";

interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => ReactNode;
  className?: string;
}

export type RowAction<T> =
  | {
      isSeparator?: never;
      label: string;
      icon?: React.ElementType;
      onClick: (item: T) => void;
      destructive?: boolean;
    }
  | {
      isSeparator: true;
    };

/** Define named groups of rows. Order matches the render order. */
export interface RowGroup<T> {
  /** Label shown as a section header row above the group rows. */
  label: string;
  /** Optional badge/count rendered beside the label. */
  badge?: ReactNode;
  /** Filter function: rows where this returns true belong to this group. */
  filter: (item: T) => boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Adds a trailing "..." menu column. Omit to leave the table without one. */
  actions?: (item: T) => RowAction<T>[];
  /** Rows per page, client-side. Omit or set 0 to disable pagination. */
  pageSize?: number;
  /**
   * Optional grouping definitions. When supplied the table renders a subtle
   * labelled section header between groups instead of a flat list of dividers.
   * Rows that do not match any group filter are placed in an implicit
   * "Other" section at the bottom.
   */
  groups?: RowGroup<T>[];
}

function GroupHeaderRow({
  label,
  badge,
  colSpan,
}: {
  label: string;
  badge?: ReactNode;
  colSpan: number;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 pt-5 pb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted select-none">
            {label}
          </span>
          {badge && <span>{badge}</span>}
          <span className="flex-1 h-px bg-border" />
        </div>
      </td>
    </tr>
  );
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading,
  emptyTitle = "No records found",
  emptyDescription = "There is no data to display here yet.",
  emptyAction,
  actions,
  pageSize = 10,
  groups,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const totalPages =
    pageSize > 0 ? Math.max(1, Math.ceil(data.length / pageSize)) : 1;

  const effectivePage = Math.min(page, totalPages);

  if (isLoading) {
    return (
      <Card className="p-12 flex justify-center items-center">
        <Spinner className="text-accent" />
      </Card>
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

  const pageData =
    pageSize > 0
      ? data.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)
      : data;
  const rangeStart = pageSize > 0 ? (effectivePage - 1) * pageSize + 1 : 1;
  const rangeEnd =
    pageSize > 0
      ? Math.min(effectivePage * pageSize, data.length)
      : data.length;

  const colSpan = columns.length + (actions ? 1 : 0);

  type Section = { label?: string; badge?: ReactNode; rows: T[] };
  const sections: Section[] = [];

  if (groups && groups.length > 0) {
    const claimed = new Set<string>();
    for (const g of groups) {
      const rows = pageData.filter((item) => {
        if (g.filter(item)) {
          claimed.add(keyExtractor(item));
          return true;
        }
        return false;
      });
      if (rows.length > 0) {
        sections.push({ label: g.label, badge: g.badge, rows });
      }
    }
    const rest = pageData.filter((item) => !claimed.has(keyExtractor(item)));
    if (rest.length > 0) {
      sections.push({ label: "Other", rows: rest });
    }
  } else {
    sections.push({ rows: pageData });
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={`px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider ${col.className || ""}`}
                >
                  {col.header}
                </th>
              ))}
              {actions && <th className="px-5 py-3 w-12" />}
            </tr>
          </thead>
          <tbody>
            {sections.map((section, si) => (
              <>
                {section.label && (
                  <GroupHeaderRow
                    key={`group-hdr-${si}`}
                    label={section.label}
                    badge={section.badge}
                    colSpan={colSpan}
                  />
                )}
                {section.rows.map((item, ri) => {
                  const isLastRowInSection = ri === section.rows.length - 1;
                  const isLastSection = si === sections.length - 1;
                  const showDivider = !(isLastRowInSection && isLastSection);
                  const rowActions = actions?.(item) ?? [];

                  return (
                    <tr
                      key={keyExtractor(item)}
                      className={`hover:bg-bg-elevated/50 transition-colors duration-150 ${
                        showDivider ? "border-b border-border" : ""
                      }`}
                    >
                      {columns.map((col, i) => (
                        <td
                          key={i}
                          className={`px-5 py-3.5 text-sm text-text-primary ${col.className || ""}`}
                        >
                          {col.cell
                            ? col.cell(item)
                            : col.accessorKey
                              ? String(item[col.accessorKey])
                              : null}
                        </td>
                      ))}
                      {actions && (
                        <td className="px-5 py-3.5 text-right">
                          {rowActions.length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-text-muted hover:text-text-primary hover:bg-bg-elevated"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {rowActions.map((action, i) => {
                                  if (action.isSeparator) {
                                    return (
                                      <DropdownMenuSeparator key={`sep-${i}`} />
                                    );
                                  }

                                  const Icon = action.icon;
                                  return (
                                    <DropdownMenuItem
                                      key={`item-${i}`}
                                      onClick={() => action.onClick(item)}
                                      className={
                                        action.destructive
                                          ? "cursor-pointer text-error focus:text-error focus:bg-error/10 [&_svg]:text-current"
                                          : "cursor-pointer [&_svg]:text-current"
                                      }
                                    >
                                      {Icon && <Icon className="w-4 h-4" />}
                                      {action.label}
                                    </DropdownMenuItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {pageSize > 0 && data.length > pageSize && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <p className="text-xs text-text-muted">
            Showing{" "}
            <span className="text-text-secondary">
              {rangeStart}&#x2013;{rangeEnd}
            </span>{" "}
            of <span className="text-text-secondary">{data.length}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-2.5"
              disabled={effectivePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-text-muted px-1">
              Page {effectivePage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-2.5"
              disabled={effectivePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
