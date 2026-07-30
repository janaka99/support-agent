"use client";

import { ReactNode, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ConfirmVariant = "default" | "destructive";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** "destructive" maps to the same red used for delete/danger actions
   *  everywhere else (badge-error, alert-error, etc). */
  variant?: ConfirmVariant;
  /** Can be sync or async — the dialog handles the loading state either
   *  way. Throw from here if you want the dialog to stay open on error. */
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
}: ConfirmDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      // Swallow here — the dialog stays open so the caller can show its
      // own error state (toast, inline message, etc.) without the dialog
      // vanishing mid-failure.
      console.error("ConfirmDialog action failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (isLoading) return; // block the X button, overlay click, and Esc
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn("sm:max-w-md", isLoading && "[&>button:last-child]:hidden")}
        onEscapeKeyDown={(e) => isLoading && e.preventDefault()}
        onPointerDownOutside={(e) => isLoading && e.preventDefault()}
        onInteractOutside={(e) => isLoading && e.preventDefault()}
      >
        <DialogHeader>
          {variant === "destructive" && (
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-error/10 mb-1">
              <AlertTriangle className="w-5 h-5 text-error" />
            </div>
          )}
          <DialogTitle className="text-text-primary">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-text-secondary">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading && <Spinner className="w-3.5 h-3.5" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
