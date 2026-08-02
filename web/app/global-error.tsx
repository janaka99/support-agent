"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service if available
    console.error("Global Error Caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex h-screen w-full items-center justify-center bg-bg-base text-text-primary p-6">
          <div className="flex max-w-md flex-col items-center space-y-6 text-center">
            <div className="rounded-full bg-red-500/10 p-4">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                A critical error occurred
              </h2>
              <p className="text-text-muted">
                We're extremely sorry, but something went catastrophically wrong and the application could not recover.
              </p>
            </div>
            
            <button
              onClick={() => reset()}
              className="btn btn-primary"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
