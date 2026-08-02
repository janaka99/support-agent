"use client";

import { useState } from "react";
import { Tool, toolsApi, ToolTestResponse } from "@/lib/api/tools";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Play, CheckCircle2, AlertTriangle, Terminal } from "lucide-react";

interface TestToolModalProps {
  tool: Tool | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TestToolModal({ tool, isOpen, onClose }: TestToolModalProps) {
  const [params, setParams] = useState<Record<string, string>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [testResult, setTestResult] = useState<ToolTestResponse | null>(null);

  if (!tool) return null;

  const schemaProperties = tool.parameters_schema?.properties || {};
  const requiredProps = new Set(tool.parameters_schema?.required || []);

  const handleParamChange = (key: string, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleExecute = async () => {
    setIsRunning(true);
    setTestResult(null);

    try {
      // Cast numerical inputs if required
      const preparedParams: Record<string, any> = {};
      for (const [k, v] of Object.entries(params)) {
        const propType = schemaProperties[k]?.type;
        if (propType === "integer" || propType === "number") {
          const num = Number(v);
          preparedParams[k] = isNaN(num) ? v : num;
        } else if (propType === "boolean") {
          preparedParams[k] = v === "true";
        } else {
          preparedParams[k] = v;
        }
      }

      const res = await toolsApi.test({
        tool_id: tool.id,
        tool_type: tool.tool_type,
        config: tool.config,
        parameters: preparedParams,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        status_code: 500,
        error: err.message || "Failed to execute tool.",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-bg-surface border-border">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-accent-muted border border-accent/20">
              <Terminal className="w-5 h-5 text-accent" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-text-primary">
                Live Test Sandbox: {tool.display_name || tool.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-text-muted mt-0.5">
                Execute this tool directly to verify parameters, HTTP headers, and API payload responses.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
          {/* Parameter Inputs */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Input Parameters
            </h4>

            {Object.keys(schemaProperties).length === 0 ? (
              <p className="text-xs text-text-muted italic bg-bg-base p-3 rounded-lg border border-border">
                This tool accepts no input parameters.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(schemaProperties).map(([propKey, propSpec]: [string, any]) => {
                  const isRequired = requiredProps.has(propKey);
                  return (
                    <div key={propKey} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`param-${propKey}`} className="text-xs font-medium text-text-secondary">
                          {propKey}
                          {isRequired && <span className="text-rose-400 ml-0.5">*</span>}
                        </Label>
                        <span className="mono text-[10px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded">
                          {propSpec.type || "string"}
                        </span>
                      </div>
                      <Input
                        id={`param-${propKey}`}
                        placeholder={propSpec.description || `Enter ${propKey}...`}
                        value={params[propKey] || ""}
                        onChange={(e) => handleParamChange(propKey, e.target.value)}
                        className="bg-bg-base border-border text-xs h-9"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Test Execution Output */}
          {testResult && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Execution Output
                </h4>
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Success ({testResult.status_code ?? 200})
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5" /> Failed ({testResult.status_code ?? 500})
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-bg-base border border-border overflow-x-auto max-h-56">
                <pre className="mono text-[11px] text-text-primary leading-relaxed">
                  {JSON.stringify(testResult.data || testResult.error || testResult, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border pt-3 flex items-center justify-between sm:justify-between">
          <Button variant="ghost" onClick={onClose} className="text-xs text-text-muted">
            Close
          </Button>
          <Button
            onClick={handleExecute}
            disabled={isRunning}
            className="btn-primary gap-2 text-xs"
          >
            {isRunning ? <Spinner size="sm" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>Run Test</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
