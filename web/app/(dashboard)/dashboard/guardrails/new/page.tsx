"use client";

import { PageHeader } from "@/components/layout/page-header";
import { GuardrailForm } from "@/components/guardrails/guardrail-form";

export default function NewGuardrailPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Create Guardrail Policy"
        description="Configure a reusable security interceptor to protect your multi-agent architecture."
      />
      <GuardrailForm />
    </div>
  );
}
