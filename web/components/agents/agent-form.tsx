"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Agent, AgentCreate, agentsApi } from "@/lib/api/agents";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  specialization: z.string().min(2, "Specialization is required"),
  model: z.string().min(2, "Model is required"),
  system_prompt: z.string().min(10, "System prompt needs to be more descriptive"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  initialData?: Agent;
}

export function AgentForm({ initialData }: Props) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialData ? {
      name: initialData.name,
      specialization: initialData.specialization,
      model: initialData.model,
      system_prompt: initialData.system_prompt,
    } : {
      model: "gpt-4o-mini", // default
    }
  });

  const onSubmit = async (data: FormValues) => {
    try {
      setSubmitError(null);
      const payload: AgentCreate = {
        ...data,
        tools: [],
      };
      
      if (initialData) {
        await agentsApi.update(initialData.id, payload);
      } else {
        await agentsApi.create(payload);
      }
      
      router.push("/dashboard/agents");
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Failed to save agent");
      }
    }
  };

  return (
    <Card className="max-w-2xl p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {submitError && (
          <div className="alert alert-error">
            <span>{submitError}</span>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label="Agent Name" error={errors.name?.message}>
            <Input {...register("name")} placeholder="e.g. Billing Assistant" disabled={isSubmitting} />
          </FormField>
          
          <FormField label="Specialization" error={errors.specialization?.message}>
            <Input {...register("specialization")} placeholder="e.g. Handles refund requests" disabled={isSubmitting} />
          </FormField>
        </div>

        <FormField label="AI Model" error={errors.model?.message}>
          <select 
            {...register("model")} 
            className="input" 
            disabled={isSubmitting}
          >
            <option value="gpt-4o-mini">gpt-4o-mini</option>
            <option value="gpt-4o">gpt-4o</option>
            <option value="claude-3-5-sonnet-20240620">claude-3.5-sonnet</option>
          </select>
        </FormField>

        <FormField label="System Prompt" error={errors.system_prompt?.message}>
          <textarea 
            {...register("system_prompt")} 
            className="input min-h-[150px] resize-y" 
            placeholder="You are a helpful customer support agent..."
            disabled={isSubmitting}
          />
        </FormField>

        <div className="flex justify-end gap-3 pt-4 border-t border-[--border]">
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : (initialData ? "Save Changes" : "Create Agent")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
