"use client";

import { PageHeader } from "@/components/layout/page-header";
import { BotForm } from "@/components/bots/bot-form";

export default function NewBotPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Create New Bot"
        description="Configure a new customer-facing touchpoint and assign a team of specialist agents."
      />
      <BotForm />
    </div>
  );
}
