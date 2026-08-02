"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error
    console.error("Dashboard error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex h-full w-full items-center justify-center p-6 bg-bg-base">
      <div className="flex max-w-md flex-col items-center space-y-6 text-center">
        <div className="rounded-full bg-red-500/10 p-4">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">
            Something went wrong!
          </h2>
          <p className="text-sm text-text-muted">
            We ran into an unexpected issue while rendering this page.
          </p>
        </div>
        
        <button
          onClick={() => reset()}
          className="btn btn-primary flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Try again</span>
        </button>
      </div>
    </div>
  );
}
