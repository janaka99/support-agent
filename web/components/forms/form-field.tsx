import { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}

export function FormField({ label, error, children, htmlFor }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error && <p className="text-xs text-[--error] mt-1.5">{error}</p>}
    </div>
  );
}
